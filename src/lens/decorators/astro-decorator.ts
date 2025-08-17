import * as vscode from 'vscode';
import { getCurrentColor } from '../../actions/colors';
import { isEditorEnabled, isExtensionEnabled } from '../../actions/toggle';
import { BracketLynxConfig } from '../lens';

// 🎯 TARGET ELEMENTS CONFIGURATION - GLOBAL MODULE CONSTANTS (Easy to maintain!)
const ASTRO_COMPONENTS = [
  'Fragment', 'Astro', 'Code', 'Markdown', 'Debug',
  'slot', 'Component'
];

const TARGET_HTML_ELEMENTS = [
  'style', 'script', 'section', 'article',
  'main', 'header', 'footer', 'aside', 'nav',
  'html', 'body'
];

// 🎯 ULTRA-SPECIFIC Types for maximum type safety and intellisense
export type AstroComponentName = 'Fragment' | 'Astro' | 'Code' | 'Markdown' | 'Debug' | 'slot' | 'Component';
export type HtmlElementName = 'style' | 'script' | 'section' | 'article' | 'main' | 'header' | 'footer' | 'aside' | 'nav' | 'html' | 'body';
export type SupportedExtension = '.astro' | '.html';
export type SupportedLanguageId = 'astro' | 'html';

export interface ComponentRange {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly range: vscode.Range;
  readonly hasContent: boolean;
  readonly componentType?: 'astro' | 'html' | 'custom';
  readonly lineSpan?: number;
}

// 🚀 Performance-optimized component stack entry
interface ComponentStackEntry {
  readonly name: string;
  readonly startLine: number;
  readonly timestamp?: number; // For debugging performance
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

    // Check if this specific editor should have decorations
    const editorEnabled = isEditorEnabled(editor);
    const extensionEnabled = isExtensionEnabled();

    if (!extensionEnabled && !editorEnabled) {
      this.clearDecorations(editor);
      return;
    }

    if (!editorEnabled) {
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
        console.log(`Universal Decorator: Extension enabled: ${extensionEnabled}, Editor enabled: ${editorEnabled}`);
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

  // 🚀 HYPER-OPTIMIZED Regex Cache - Compiled once, used forever!
  private static readonly OPEN_TAG_REGEX = /<(\w+)(?:\s+[^>]*)?(?<!\/)\s*>/;
  private static readonly CLOSE_TAG_REGEX = /<\/(\w+)\s*>/;
  private static readonly TAG_DETECTOR_REGEX = /<[^>]+>/;

  /**
   * 🔥 LIGHTNING-FAST Component Range Finder - Multi-level optimization!
   */
  private static findComponentRanges(lines: string[]): ComponentRange[] {
    const componentStack: ComponentStackEntry[] = [];
    const componentRanges: ComponentRange[] = [];
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);

    // 🚀 ULTRA-FAST Line Processing - Skip non-tag lines instantly
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 🔥 INSTANT SKIP - No tags, no processing!
      if (!line || !this.TAG_DETECTOR_REGEX.test(line)) {continue;}

      const trimmedLine = line.trim();

      // 🎯 SMART Tag Detection - Process opening tags first (more common)
      const openTagMatch = trimmedLine.match(this.OPEN_TAG_REGEX);
      if (openTagMatch) {
        const componentName = openTagMatch[1];
        if (this.isTargetElement(componentName)) {
          componentStack.push({
            name: componentName,
            startLine: i + 1,
            timestamp: BracketLynxConfig.debug ? Date.now() : undefined
          });
        }
        continue; // 🚀 Skip close tag check - can't be both!
      }

      // 🔍 Process closing tags
      const closeTagMatch = trimmedLine.match(this.CLOSE_TAG_REGEX);
      if (closeTagMatch) {
        const componentName = closeTagMatch[1];

        // 🚀 REVERSE SEARCH - LIFO stack behavior for better performance
        for (let j = componentStack.length - 1; j >= 0; j--) {
          if (componentStack[j].name === componentName) {
            const openComponent = componentStack[j];
            componentStack.splice(j, 1);

            const lineSpan = (i + 1) - openComponent.startLine;

            // 🎯 SMART Content Analysis - Only if meets minimum requirements
            if (lineSpan >= minLines && this.hasSignificantContent(lines, openComponent.startLine - 1, i)) {
              const componentType = this.isAstroComponent(componentName) ? 'astro' : 'html';

              componentRanges.push({
                name: componentName,
                startLine: openComponent.startLine,
                endLine: i + 1,
                range: new vscode.Range(i, line.length, i, line.length),
                hasContent: true,
                componentType,
                lineSpan
              });
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

    return ASTRO_COMPONENTS.includes(tagName);
  }

  /**
   * Check if a tag name is one of the target HTML elements we want to decorate
   */
  private static isTargetHtmlElement(tagName: string): boolean {
    return TARGET_HTML_ELEMENTS.includes(tagName.toLowerCase());
  }

  // 🚀 ULTRA-OPTIMIZED Content Analyzer - Smart early exits and caching
  private static readonly INSIGNIFICANT_CONTENT = new Set(['{', '}', '', '<!--', '-->']);
  private static readonly COMMENT_REGEX = /^<!--.*-->$/;

  /**
   * 🧠 MEGA-SMART Content Detector - Optimized with early exits and pattern recognition
   */
  private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number): boolean {
    // 🚀 Quick validation - avoid processing if range is too small
    if (endIndex - startIndex < 2) {return false;}

    // 🎯 Smart tag detection with cached regex
    const openingLine = lines[startIndex]?.trim();
    if (!openingLine) {return false;}

    const tagMatch = openingLine.match(/<(\w+)/);
    const tagName = tagMatch?.[1]?.toLowerCase();
    const isStyleTag = tagName === 'style';

    // 🔥 OPTIMIZED Content Scanner - Early exit on first significant content
    for (let i = startIndex + 1; i < endIndex; i++) {
      const contentLine = lines[i]?.trim();

      // 🚀 Ultra-fast insignificant content check
      if (!contentLine || this.INSIGNIFICANT_CONTENT.has(contentLine)) {continue;}

      // 🎯 Smart comment detection
      if (this.COMMENT_REGEX.test(contentLine)) {continue;}

      // 🔥 INSTANT RETURN for style tags - no need to count
      if (isStyleTag) {return true;}

      // 🚀 IMMEDIATE SUCCESS - Found significant content!
      return true;
    }

    return false;
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
   * Handle configuration changes
   */
  public static onDidChangeConfiguration(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }
  }

  /**
   * Force refresh color for all decorations - called by color system
   */
  public static forceColorRefresh(): void {
    // Dispose current decoration type to force recreation with new color
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }

    // Clear all existing decorations
    this.clearAllDecorations();

    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      // Update all visible editors with supported files
      vscode.window.visibleTextEditors
        .filter(editor => this.isSupportedFile(editor.document))
        .forEach(editor => {
          // Force update regardless of current state for color refresh
          if (isEditorEnabled(editor)) {
            this.updateDecorations(editor);
            console.log(`Astro Decorator: Force refreshed color for ${editor.document.fileName}`);
          }
        });
    }, 50);
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
