import * as vscode from 'vscode';
import { getCurrentColor } from '../../actions/colors';
import { isEditorEnabled, isExtensionEnabled } from '../../actions/toggle';
import { BracketLynxConfig } from '../lens';

// ============================================================================
// 🎯 UNIVERSAL CONFIGURATION OF TARGET ELEMENTS
// ============================================================================
const FRAMEWORK_COMPONENTS = {
  astro: ['Fragment', 'Astro', 'Code', 'Markdown', 'Debug', 'slot', 'Component'],
  vue: ['template', 'script', 'style', 'component', 'transition', 'transition-group', 'keep-alive', 'slot', 'teleport', 'suspense'],
  svelte: ['script', 'style', 'main', 'section', 'header', 'footer', 'aside', 'nav', 'slot', 'svelte:head', 'svelte:body', 'svelte:window', 'svelte:options', 'svelte:fragment']
};

const COMMON_HTML_ELEMENTS = [
  'div', 'span', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav',
  'ul', 'ol', 'li', 'p', 'button', 'form', 'table', 'style', 'script', 'html', 'body'
];

// ============================================================================
// UNIVERSAL TYPES
// ============================================================================
export type SupportedFramework = 'astro' | 'vue' | 'svelte' | 'html';
export type SupportedExtension = '.astro' | '.vue' | '.svelte' | '.html';
export type SupportedLanguageId = 'astro' | 'vue' | 'svelte' | 'html';

export interface ComponentRange {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly range: vscode.Range;
  readonly hasContent: boolean;
  readonly framework: SupportedFramework;
  readonly lineSpan: number;
  readonly isScoped?: boolean;
}

interface ComponentStackEntry {
  readonly name: string;
  readonly startLine: number;
  readonly framework: SupportedFramework;
}

interface PendingDecoration {
  editor: vscode.TextEditor;
  timestamp: number;
}

// ============================================================================
// UNIVERSAL DECORATOR - UNIFIED SOLUTION WITHOUT FLICKERING
// ============================================================================
export class UniversalDecorator {
  private static decorationType: vscode.TextEditorDecorationType | undefined;
  private static pendingDecorations = new Map<string, PendingDecoration>();
  private static isProcessing = false;
  private static updateQueue = new Set<vscode.TextEditor>();

  // Supported file configuration
  private static readonly SUPPORTED_EXTENSIONS: SupportedExtension[] = ['.astro', '.vue', '.svelte', '.html'];
  private static readonly SUPPORTED_LANGUAGE_IDS: SupportedLanguageId[] = ['astro', 'vue', 'svelte', 'html'];

  // Optimized regex - compiled only once
  private static readonly OPEN_TAG_REGEX = /<(\w+)(?:\s+[^>]*)?(?<!\/)\s*>/;
  private static readonly CLOSE_TAG_REGEX = /<\/(\w+)\s*>/;
  private static readonly TAG_DETECTOR_REGEX = /<[^>]+>/;
  private static readonly SCOPED_STYLE_REGEX = /<style[^>]*\s+scoped[^>]*>/;
  private static readonly INSIGNIFICANT_CONTENT = new Set(['{', '}', '', '<!--', '-->', '{{', '}}']);
  private static readonly COMMENT_REGEX = /^<!--.*-->$/;

  // ============================================================================
  // 🚀 COORDINATION SYSTEM WITHOUT FLICKERING
  // ============================================================================

  /**
   * Main coordinated method to update decorations
   */
  public static async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!editor || !this.isSupportedFile(editor.document)) {
      return;
    }

    const editorKey = this.getEditorKey(editor);

    // Add to processing queue
    this.updateQueue.add(editor);

    // If already processing, wait
    if (this.isProcessing) {
      return;
    }

    // Process queue in a coordinated way
    await this.processDecorationQueue();
  }

  /**
   * Processes the decoration queue in a coordinated way to avoid flickering
   */
  private static async processDecorationQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Create decoration type only once for all editors
      const decorationType = this.ensureDecorationType();

      // Process all editors in the queue
      const editorsToProcess = Array.from(this.updateQueue);
      this.updateQueue.clear();

      for (const editor of editorsToProcess) {
        await this.processEditorDecorations(editor, decorationType);
      }

    } catch (error) {
      console.error('Universal Decorator: Error in processDecorationQueue:', error);
    } finally {
      this.isProcessing = false;

      // If there are more editors in the queue, process them
      if (this.updateQueue.size > 0) {
        setTimeout(() => this.processDecorationQueue(), 10);
      }
    }
  }

  /**
   * Processes decorations for a specific editor
   */
  private static async processEditorDecorations(
    editor: vscode.TextEditor,
    decorationType: vscode.TextEditorDecorationType
  ): Promise<void> {
    try {
      // Enable checks
      const editorEnabled = isEditorEnabled(editor);
      const extensionEnabled = isExtensionEnabled();

      if (!extensionEnabled || !editorEnabled || !this.shouldProcessFile(editor.document)) {
        this.clearDecorations(editor);
        return;
      }

      // Generate decorations
      const decorations = this.generateDecorations(editor.document);

      // Apply decorations atomically
      editor.setDecorations(decorationType, decorations);

      if (BracketLynxConfig.debug) {
        const framework = this.detectFramework(editor.document);
        console.log(`Universal Decorator: Applied ${decorations.length} decorations to ${framework} file: ${editor.document.fileName}`);
      }

    } catch (error) {
      console.error('Universal Decorator: Error processing editor decorations:', error);
      this.clearDecorations(editor);
    }
  }

  /**
   * Ensures the decoration type is created with the current configuration
   */
  private static ensureDecorationType(): vscode.TextEditorDecorationType {
    if (this.decorationType) {
      return this.decorationType;
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
   * Generates decoration options for components
   */
  private static generateDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
    const decorations: vscode.DecorationOptions[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    const framework = this.detectFramework(document);
    const componentRanges = this.findComponentRanges(lines, framework);

    for (const component of componentRanges) {
      if (component.hasContent && this.shouldShowDecoration(component)) {
        const prefix = BracketLynxConfig.prefix.replace('‹~', '‹~').trim();
        const scopedIndicator = component.isScoped ? ' [scoped]' : '';
        const decorationText = `${prefix} #${component.startLine}-${component.endLine} •${component.name}${scopedIndicator}`;

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

    // Limit decorations per file
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
   * 🔥 Optimized finder for component ranges
   */
  private static findComponentRanges(lines: string[], framework: SupportedFramework): ComponentRange[] {
    const componentStack: ComponentStackEntry[] = [];
    const componentRanges: ComponentRange[] = [];
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip lines without tags
      if (!line || !this.TAG_DETECTOR_REGEX.test(line)) {
        continue;
      }

      const trimmedLine = line.trim();

      // Process opening tags
      const openTagMatch = trimmedLine.match(this.OPEN_TAG_REGEX);
      if (openTagMatch) {
        const componentName = openTagMatch[1];
        if (this.isTargetElement(componentName, framework)) {
          componentStack.push({
            name: componentName,
            startLine: i + 1,
            framework
          });
        }
        continue;
      }

      // Process closing tags
      const closeTagMatch = trimmedLine.match(this.CLOSE_TAG_REGEX);
      if (closeTagMatch) {
        const componentName = closeTagMatch[1];

        // Find corresponding opening tag (LIFO)
        for (let j = componentStack.length - 1; j >= 0; j--) {
          if (componentStack[j].name === componentName) {
            const openComponent = componentStack[j];
            componentStack.splice(j, 1);

            const lineSpan = (i + 1) - openComponent.startLine;

            if (lineSpan >= minLines && this.hasSignificantContent(lines, openComponent.startLine - 1, i)) {
              const isScoped = componentName === 'style' && this.isStyleScoped(lines, openComponent.startLine - 1);

              componentRanges.push({
                name: componentName,
                startLine: openComponent.startLine,
                endLine: i + 1,
                range: new vscode.Range(i, line.length, i, line.length),
                hasContent: true,
                framework,
                lineSpan,
                isScoped
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
   * Detects the framework based on the document
   */
  private static detectFramework(document: vscode.TextDocument): SupportedFramework {
    if (document.fileName.endsWith('.astro') || document.languageId === 'astro') {
      return 'astro';
    }
    if (document.fileName.endsWith('.vue') || document.languageId === 'vue') {
      return 'vue';
    }
    if (document.fileName.endsWith('.svelte') || document.languageId === 'svelte') {
      return 'svelte';
    }
    return 'html';
  }

  /**
   * Checks if an element is a target for the specific framework
   */
  private static isTargetElement(tagName: string, framework: SupportedFramework): boolean {
    // Framework-specific components
    if (framework !== 'html') {
      const frameworkComponents = FRAMEWORK_COMPONENTS[framework] || [];
      if (frameworkComponents.includes(tagName)) {
        return true;
      }
    }

    // Components with uppercase first letter (custom components)
    if (tagName[0] === tagName[0].toUpperCase()) {
      return true;
    }

    // Common HTML elements
    return COMMON_HTML_ELEMENTS.includes(tagName.toLowerCase());
  }

  /**
   * Checks if a style tag has the scoped attribute (Vue)
   */
  private static isStyleScoped(lines: string[], startIndex: number): boolean {
    const openingLine = lines[startIndex]?.trim();
    return openingLine ? this.SCOPED_STYLE_REGEX.test(openingLine) : false;
  }

  /**
   * 🧠 Smart detector of significant content
   */
  private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number): boolean {
    if (endIndex - startIndex < 2) {
      return false;
    }

    const openingLine = lines[startIndex]?.trim();
    if (!openingLine) {
      return false;
    }

    const tagMatch = openingLine.match(/<(\w+)/);
    const tagName = tagMatch?.[1]?.toLowerCase();
    const isSpecialTag = ['style', 'script', 'template'].includes(tagName || '');

    // Look for significant content
    for (let i = startIndex + 1; i < endIndex; i++) {
      const contentLine = lines[i]?.trim();

      if (!contentLine || this.INSIGNIFICANT_CONTENT.has(contentLine)) {
        continue;
      }

      if (this.COMMENT_REGEX.test(contentLine)) {
        continue;
      }

      // Special tags always have significant content
      if (isSpecialTag) {
        return true;
      }

      return true;
    }

    return false;
  }

  /**
   * Checks if the file is supported
   */
  private static isSupportedFile(document: vscode.TextDocument): boolean {
    const hasValidExtension = this.SUPPORTED_EXTENSIONS.some(ext =>
      document.fileName.endsWith(ext)
    );
    const hasValidLanguageId = this.SUPPORTED_LANGUAGE_IDS.includes(document.languageId as SupportedLanguageId);

    return hasValidExtension || hasValidLanguageId;
  }

  /**
   * Checks if the file should be processed (performance filters)
   */
  private static shouldProcessFile(document: vscode.TextDocument): boolean {
    if (!BracketLynxConfig.enablePerformanceFilters) {
      return true;
    }

    const fileSize = document.getText().length;
    const maxFileSize = BracketLynxConfig.maxFileSize;

    if (fileSize > maxFileSize) {
      if (BracketLynxConfig.debug) {
        const framework = this.detectFramework(document);
        console.log(`Universal Decorator: Skipping large ${framework} file: ${document.fileName} (${fileSize} bytes)`);
      }
      return false;
    }

    return true;
  }

  /**
   * Checks if the decoration should be shown
   */
  private static shouldShowDecoration(component: ComponentRange): boolean {
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);
    return component.lineSpan >= minLines;
  }

  /**
   * Gets a unique key for the editor
   */
  private static getEditorKey(editor: vscode.TextEditor): string {
    return `${editor.document.uri.toString()}-${editor.document.version}`;
  }

  // ============================================================================
  // 🧹 CLEANUP AND MANAGEMENT METHODS
  // ============================================================================

  /**
   * Clears decorations from a specific editor
   */
  public static clearDecorations(editor: vscode.TextEditor): void {
    if (this.decorationType && editor) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  /**
   * Clears all decorations from all visible editors
   */
  public static clearAllDecorations(): void {
    if (this.decorationType) {
      vscode.window.visibleTextEditors
        .filter(editor => this.isSupportedFile(editor.document))
        .forEach(editor => this.clearDecorations(editor));
    }
  }

  /**
   * Handles configuration changes
   */
  public static onDidChangeConfiguration(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }
    this.updateQueue.clear();
    this.pendingDecorations.clear();
  }

  /**
   * Forces color refresh without flickering
   */
  public static async forceColorRefresh(): Promise<void> {
    // Dispose current decoration type
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }

    // Clear existing decorations
    this.clearAllDecorations();

    // Small pause to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 50));

    // Update all visible editors in a coordinated way
    const supportedEditors = vscode.window.visibleTextEditors
      .filter(editor => this.isSupportedFile(editor.document) && isEditorEnabled(editor));

    for (const editor of supportedEditors) {
      this.updateQueue.add(editor);
    }

    await this.processDecorationQueue();

    if (BracketLynxConfig.debug) {
      console.log(`Universal Decorator: Force refreshed colors for ${supportedEditors.length} editors`);
    }
  }

  /**
   * Cleanup and resource disposal
   */
  public static dispose(): void {
    this.updateQueue.clear();
    this.pendingDecorations.clear();

    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }
  }
}

// ============================================================================
// EXPORTS COMPATIBLE WITH EXISTING DECORATORS
// ============================================================================
export const AstroDecorator = UniversalDecorator;
export const VueDecorator = UniversalDecorator;
export const SvelteDecorator = UniversalDecorator;
export default UniversalDecorator;
