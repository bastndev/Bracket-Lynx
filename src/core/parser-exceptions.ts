import * as vscode from 'vscode';

/**
 * Configuration for parser exceptions
 */
export interface ParserExceptionConfig {
  // Languages that should use original parser
  problematicLanguages: string[];
  
  // File extensions that should use original parser
  problematicExtensions: string[];
  
  // Enable content-based detection
  enableContentDetection: boolean;
  
  // Maximum file size for content analysis (performance)
  maxContentAnalysisSize: number;
}

/**
 * Default configuration for parser exceptions
 */
const DEFAULT_CONFIG: ParserExceptionConfig = {
  problematicLanguages: [
    'astro',      // Astro files
    'html',       // HTML files
    'htm',        // HTML files
    'vue',        // Vue files
    'svelte',     // Svelte files
    'php',        // PHP files
    'javascriptreact', // JSX files
    'typescriptreact', // TSX files
  ],
  
  problematicExtensions: [
    '.astro',
    '.html',
    '.htm',
    '.vue',
    '.svelte',
    '.php',
    '.jsx',       // JSX files
    '.tsx',       // TSX files
  ],
  
  enableContentDetection: true,
  maxContentAnalysisSize: 100 * 1024, // 100KB
};

/**
 * Parser Exception Manager
 */
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

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ParserExceptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if document should use original parser
   */
  shouldUseOriginalParser(document: vscode.TextDocument): boolean {
    // Check language ID
    if (this.config.problematicLanguages.includes(document.languageId)) {
      return true;
    }

    // Check file extension
    const fileName = document.fileName.toLowerCase();
    if (this.config.problematicExtensions.some(ext => fileName.endsWith(ext))) {
      return true;
    }

    // Content-based detection (optional)
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
   * Get current configuration
   */
  getConfig(): ParserExceptionConfig {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  resetToDefault(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Detect if file has mixed content (HTML + CSS + JS)
   */
  private hasMixedContent(document: vscode.TextDocument): boolean {
    try {
      const text = document.getText();
      
      // Performance guard
      if (text.length > this.config.maxContentAnalysisSize) {
        return false;
      }
      
      // Look for HTML-like tags with style/script blocks
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

export const addLanguageException = (languageId: string): void => {
  ParserExceptionManager.getInstance().addLanguageException(languageId);
};

export const addExtensionException = (extension: string): void => {
  ParserExceptionManager.getInstance().addExtensionException(extension);
};
