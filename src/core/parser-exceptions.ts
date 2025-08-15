import * as vscode from 'vscode';
import { 
  PROBLEMATIC_LANGUAGES, 
  PROBLEMATIC_EXTENSIONS, 
  PERFORMANCE_LIMITS,
  isProblematicLanguage 
} from '../lens/config';

export interface ParserExceptionConfig {
  problematicLanguages: string[];
  problematicExtensions: string[];
  enableContentDetection: boolean;
  maxContentAnalysisSize: number;
}

const DEFAULT_CONFIG: ParserExceptionConfig = {
  problematicLanguages: [...PROBLEMATIC_LANGUAGES],
  problematicExtensions: [...PROBLEMATIC_EXTENSIONS],
  enableContentDetection: true,
  maxContentAnalysisSize: PERFORMANCE_LIMITS.MAX_CONTENT_ANALYSIS_SIZE,
};

export class ParserExceptionManager {
  private static instance: ParserExceptionManager;
  private config: ParserExceptionConfig = DEFAULT_CONFIG;

  private constructor() {}

  static getInstance(): ParserExceptionManager {
    if (!ParserExceptionManager.instance) {
      ParserExceptionManager.instance = new ParserExceptionManager();
    }
    return ParserExceptionManager.instance;
  }
  updateConfig(newConfig: Partial<ParserExceptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  shouldUseOriginalParser(document: vscode.TextDocument): boolean {
    // Check if language is in problematic list
    if (isProblematicLanguage(document.languageId)) {
      return true;
    }

    // Check file extension
    const fileName = document.fileName.toLowerCase();
    if (this.config.problematicExtensions.some(ext => fileName.endsWith(ext))) {
      return true;
    }

    // Check for mixed content if enabled
    if (this.config.enableContentDetection) {
      return this.hasMixedContent(document);
    }

    return false;
  }

  /**
   * Add language to exception list
   */
  addLanguageException(languageId: string): void {
    if (!this.config.problematicLanguages.includes(languageId)) {
      this.config.problematicLanguages.push(languageId);
    }
  }

  /**
   * Add extension to exception list
   */
  addExtensionException(extension: string): void {
    if (!extension.startsWith('.')) {
      extension = '.' + extension;
    }
    
    if (!this.config.problematicExtensions.includes(extension)) {
      this.config.problematicExtensions.push(extension);
    }
  }

  /**
   * Remove language from exception list
   */
  removeLanguageException(languageId: string): void {
    const index = this.config.problematicLanguages.indexOf(languageId);
    if (index > -1) {
      this.config.problematicLanguages.splice(index, 1);
    }
  }

  /**
   * Detect if file has mixed content (HTML + CSS + JS)
   */
  private hasMixedContent(document: vscode.TextDocument): boolean {
    try {
      const text = document.getText();
      
      if (text.length > this.config.maxContentAnalysisSize) {
        return false;
      }
      
      const hasStyleBlocks = /<style[^>]*>[\s\S]*?<\/style>/i.test(text);
      const hasScriptBlocks = /<script[^>]*>[\s\S]*?<\/script>/i.test(text);
      const hasHtmlTags = /<[a-zA-Z][^>]*>/i.test(text);
      
      return hasHtmlTags && (hasStyleBlocks || hasScriptBlocks);
      
    } catch (error) {
      console.warn('Parser Exception Manager: Error analyzing content:', error);
      return false;
    }
  }
}

/**
 * Convenience functions
 */
export const shouldUseOriginalParser = (document: vscode.TextDocument): boolean => {
  return ParserExceptionManager.getInstance().shouldUseOriginalParser(document);
};
