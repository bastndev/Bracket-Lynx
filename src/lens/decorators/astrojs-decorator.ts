import * as vscode from 'vscode';
import { getCurrentColor } from '../../actions/colors';
import { isEditorEnabled, isExtensionEnabled } from '../../actions/toggle';
import { BracketLynxConfig } from '../lens';

export interface ComponentRange {
  name: string;
  startLine: number;
  endLine: number;
  range: vscode.Range;
  hasContent: boolean;
}

export class UniversalDecorator {
  private static decorationType: vscode.TextEditorDecorationType | undefined;
  private static readonly SUPPORTED_EXTENSIONS = ['.astro', '.html'];
  private static readonly SUPPORTED_LANGUAGE_IDS = ['astro', 'html'];
  
  /**
   * Ensure decoration type is created with current configuration
   */
  private static ensureDecorationType(): vscode.TextEditorDecorationType {
    if (this.decorationType) {
      this.decorationType.dispose();
    }

    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: getCurrentColor(),
        fontStyle: BracketLynxConfig.fontStyle,
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    return this.decorationType;
  }

  /**
   * Main method to update decorations for an editor
   */
  public static updateDecorations(editor: vscode.TextEditor): void {
    if (!editor || !this.isSupportedFile(editor.document)) {
      return;
    }

    if (!isExtensionEnabled() || !isEditorEnabled(editor)) {
      this.clearDecorations(editor);
      return;
    }

    if (!this.shouldProcessFile(editor.document)) {
      this.clearDecorations(editor);
      return;
    }

    try {
      const decorationType = this.ensureDecorationType();
      const decorations = this.generateDecorations(editor.document);
      editor.setDecorations(decorationType, decorations);
      
      if (BracketLynxConfig.debug) {
        const fileType = this.getFileType(editor.document);
        console.log(`Universal Decorator: Applied ${decorations.length} decorations to ${fileType} file: ${editor.document.fileName}`);
      }
    } catch (error) {
      console.error('Universal Decorator: Error updating decorations:', error);
      this.clearDecorations(editor);
    }
  }

  /**
   * Generate decoration options for components
   */
  private static generateDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
    const decorations: vscode.DecorationOptions[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    const componentRanges = this.findComponentRanges(lines);

    for (const component of componentRanges) {
      if (component.hasContent && this.shouldShowDecoration(component)) {
        const prefix = BracketLynxConfig.prefix.replace('‹~', '‹~').trim();
        const decorationText = `${prefix} #${component.startLine}-${component.endLine} •${component.name}`;

        const decoration: vscode.DecorationOptions = {
          range: component.range,
          renderOptions: {
            after: {
              contentText: decorationText,
              color: getCurrentColor(),
              fontStyle: BracketLynxConfig.fontStyle
            }
          }
        };

        decorations.push(decoration);
      }
    }

    const maxDecorations = BracketLynxConfig.maxDecorationsPerFile;
    if (decorations.length > maxDecorations) {
      if (BracketLynxConfig.debug) {
        console.log(`Universal Decorator: Limiting decorations from ${decorations.length} to ${maxDecorations}`);
      }
      return decorations.slice(0, maxDecorations);
    }

    return decorations;
  }

  /**
   * Find component ranges in the document
   * Optimized with cached regex and reduced string operations
   */
  private static findComponentRanges(lines: string[]): ComponentRange[] {
    const componentStack: { name: string, startLine: number }[] = [];
    const componentRanges: ComponentRange[] = [];
    
    // Cache regex patterns for better performance
    const openTagRegex = /<(\w+)(?:\s+[^>]*)?(?<!\/)\s*>/;
    const closeTagRegex = /<\/(\w+)\s*>/;
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines early
      if (!trimmedLine || !trimmedLine.includes('<')) {
        continue;
      }

      const openTagMatch = trimmedLine.match(openTagRegex);
      if (openTagMatch) {
        const componentName = openTagMatch[1];
        if (this.isTargetElement(componentName)) {
          componentStack.push({ name: componentName, startLine: i + 1 });
        }
        continue; // Skip close tag check if we found an open tag
      }

      const closeTagMatch = trimmedLine.match(closeTagRegex);
      if (closeTagMatch) {
        const componentName = closeTagMatch[1];
        
        // Search from end for better performance (LIFO stack behavior)
        for (let j = componentStack.length - 1; j >= 0; j--) {
          if (componentStack[j].name === componentName) {
            const openComponent = componentStack[j];
            componentStack.splice(j, 1);

            const lineSpan = (i + 1) - openComponent.startLine;
            
            if (lineSpan >= minLines) {
              const hasContent = this.hasSignificantContent(lines, openComponent.startLine - 1, i);
              
              if (hasContent) {
                componentRanges.push({
                  name: componentName,
                  startLine: openComponent.startLine,
                  endLine: i + 1,
                  range: new vscode.Range(i, line.length, i, line.length),
                  hasContent: true
                });
              }
            }
            break;
          }
        }
      }
    }

    return componentRanges;
  }

  /**
   * Check if a tag name represents a target element (Astro component or HTML element)
   */
  private static isTargetElement(tagName: string): boolean {
    return this.isAstroComponent(tagName) || this.isTargetHtmlElement(tagName);
  }

  /**
   * Check if a tag name represents an Astro component
   */
  private static isAstroComponent(tagName: string): boolean {
    if (tagName[0] === tagName[0].toUpperCase()) {
      return true;
    }

    const astroElements = [
      'Fragment', 'Astro', 'Code', 'Markdown', 'Debug',
      'slot', 'Component'
    ];
    
    return astroElements.includes(tagName);
  }

  /**
   * Check if a tag name is one of the target HTML elements we want to decorate
   */
  private static isTargetHtmlElement(tagName: string): boolean {
    const targetHtmlElements = [
      'style', 'script', 'section', 'article',
      'main', 'header', 'footer', 'aside', 'nav',
      'html', 'body'
    ];
    
    return targetHtmlElements.includes(tagName.toLowerCase());
  }

  /**
   * Check if there's significant content between component tags
   * Improved to detect content with only 1 significant line, with special handling for style tags
   */
  private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number): boolean {
    let significantLines = 0;
    
    const openingLine = lines[startIndex]?.trim() || '';
    const tagMatch = openingLine.match(/<(\w+)/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
    
    for (let i = startIndex + 1; i < endIndex; i++) {
      const contentLine = lines[i].trim();
      
      if (!contentLine) {
        continue;
      }
      
      if (contentLine.startsWith('<!--') || contentLine.endsWith('-->')) {
        continue;
      }
      
      if (tagName === 'style') {
        if (contentLine && contentLine !== '{' && contentLine !== '}') {
          significantLines++;
          return true;
        }
      } else {
        if (contentLine !== '{' && contentLine !== '}') {
          significantLines++;
          if (significantLines >= 1) {
            return true;
          }
        }
      }
    }
    
    return significantLines >= 1;
  }

  /**
   * Check if file is a supported file (Astro or HTML)
   */
  private static isSupportedFile(document: vscode.TextDocument): boolean {
    const hasValidExtension = this.SUPPORTED_EXTENSIONS.some(ext => 
      document.fileName.endsWith(ext)
    );
    const hasValidLanguageId = this.SUPPORTED_LANGUAGE_IDS.includes(document.languageId);
    
    return hasValidExtension || hasValidLanguageId;
  }

  /**
   * Get file type for debugging purposes
   */
  private static getFileType(document: vscode.TextDocument): string {
    if (document.fileName.endsWith('.astro') || document.languageId === 'astro') {
      return 'Astro';
    }
    if (document.fileName.endsWith('.html') || document.languageId === 'html') {
      return 'HTML';
    }
    return 'Unknown';
  }

  /**
   * Performance check - should we process this file?
   */
  private static shouldProcessFile(document: vscode.TextDocument): boolean {
    if (!BracketLynxConfig.enablePerformanceFilters) {
      return true;
    }

    const fileSize = document.getText().length;
    const maxFileSize = BracketLynxConfig.maxFileSize;

    if (fileSize > maxFileSize) {
      if (BracketLynxConfig.debug) {
        const fileType = this.getFileType(document);
        console.log(`Universal Decorator: Skipping large ${fileType} file: ${document.fileName} (${fileSize} bytes)`);
      }
      return false;
    }

    return true;
  }

  /**
   * Check if decoration should be shown for this component
   */
  private static shouldShowDecoration(component: ComponentRange): boolean {
    const lineSpan = component.endLine - component.startLine;
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);
    
    return lineSpan >= minLines;
  }

  /**
   * Clear decorations for a specific editor
   */
  public static clearDecorations(editor: vscode.TextEditor): void {
    if (this.decorationType && editor) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  /**
   * Clear all decorations from all visible editors
   */
  public static clearAllDecorations(): void {
    if (this.decorationType) {
      vscode.window.visibleTextEditors
        .filter(editor => this.isSupportedFile(editor.document))
        .forEach(editor => this.clearDecorations(editor));
    }
  }

  /**
   * Force refresh all decorations
   */
  public static forceRefresh(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }

    if (isExtensionEnabled()) {
      vscode.window.visibleTextEditors
        .filter(editor => this.isSupportedFile(editor.document))
        .forEach(editor => this.updateDecorations(editor));
    }
  }

  /**
   * Force update decorations for a specific editor
   */
  public static forceUpdateEditor(editor: vscode.TextEditor): void {
    if (this.isSupportedFile(editor.document)) {
      this.updateDecorations(editor);
    }
  }

  /**
   * Handle configuration changes
   */
  public static onDidChangeConfiguration(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }
    
    this.forceRefresh();
  }

  /**
   * Handle color refresh
   */
  public static forceColorRefresh(): void {
    this.forceRefresh();
  }

  /**
   * Dispose and cleanup all resources
   */
  public static dispose(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }
  }

  // updateAstroDecorations method removed - use updateDecorations instead
}

export const AstroDecorator = UniversalDecorator;