import * as vscode from 'vscode';
import { BracketLynxConfig } from '../lens';
import { getCurrentColor } from '../../actions/colors';
import { isEditorEnabled, isExtensionEnabled } from '../../actions/toggle';

// FRAMEWORK CONFIGURATIONS - Centralized to eliminate duplication
const FRAMEWORK_CONFIGS = {
  astro: {
    name: 'Astro',
    extensions: ['.astro', '.html'],
    languageIds: ['astro', 'html'],
    components: ['Fragment', 'Astro', 'Code', 'Markdown', 'Debug', 'slot', 'Component'],
    htmlElements: ['style', 'script', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'html', 'body'],
    hasScoped: false
  },
  vue: {
    name: 'Vue',
    extensions: ['.vue'],
    languageIds: ['vue'],
    components: ['template', 'script', 'style', 'component', 'transition', 'transition-group', 'keep-alive', 'slot', 'teleport', 'suspense'],
    htmlElements: ['section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'form', 'table', 'ul', 'ol', 'li', 'p', 'span', 'button'],
    hasScoped: true
  },
  svelte: {
    name: 'Svelte',
    extensions: ['.svelte'],
    languageIds: ['svelte'],
    components: ['script', 'style', 'main', 'section', 'header', 'footer', 'aside', 'nav', 'slot', 'svelte:head', 'svelte:body', 'svelte:window', 'svelte:options', 'svelte:fragment'],
    htmlElements: ['div', 'span', 'section', 'article', 'main', 'ul', 'li', 'button', 'form', 'table', 'p'],
    hasScoped: false
  }
} as const;

type FrameworkName = keyof typeof FRAMEWORK_CONFIGS;
type SupportedFramework = typeof FRAMEWORK_CONFIGS[FrameworkName];

interface ComponentRange {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly range: vscode.Range;
  readonly hasContent: boolean;
  readonly componentType?: 'framework' | 'html' | 'custom';
  readonly lineSpan?: number;
  readonly isScoped?: boolean;
}

interface ComponentStackEntry {
  readonly name: string;
  readonly startLine: number;
  readonly timestamp?: number;
}

interface PendingDecoration {
  editor: vscode.TextEditor;
  framework: FrameworkName;
}

// ============================================================================
// UNIFIED FRAMEWORKS DECORATOR - Eliminates all duplication
// ============================================================================
class FrameworksDecorator {
  private static decorationTypes = new Map<FrameworkName, vscode.TextEditorDecorationType>();
  private static decorationTypeOptions = new Map<FrameworkName, { color: string; fontStyle: string }>();
  private static pendingDecorations: PendingDecoration[] = [];
  private static isProcessing = false;
  private static updateQueue = new Set<string>();

  // Optimized regex patterns - compiled once, used everywhere
  private static readonly OPEN_TAG_REGEX = /<(\w+)(?:\s+[^>]*)?(?<!\/)\s*>/;
  private static readonly CLOSE_TAG_REGEX = /<\/(\w+)\s*>/;
  private static readonly TAG_DETECTOR_REGEX = /<[^>]+>/;
  private static readonly SCOPED_STYLE_REGEX = /<style[^>]*\s+scoped[^>]*>/;
  private static readonly INSIGNIFICANT_CONTENT = new Set(['{', '}', '', '<!--', '-->', '{{', '}}']);
  private static readonly COMMENT_REGEX = /^<!--.*-->$/;

  /**
   * Main entry point - processes all supported frameworks
   */
  public static async updateDecorations(editor?: vscode.TextEditor): Promise<void> {
    if (!editor) {
      return;
    }

    const framework = this.detectFramework(editor.document);
    if (!framework) {
      return;
    }

    // Add to queue and process
    const editorKey = this.getEditorKey(editor);
    this.updateQueue.add(editorKey);
    this.pendingDecorations.push({ editor, framework });

    if (!this.isProcessing) {
      await this.processDecorationQueue();
    }
  }

  /**
   * Process decoration queue to avoid conflicts
   */
  private static async processDecorationQueue(): Promise<void> {
    if (this.isProcessing || this.pendingDecorations.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const decorationsToProcess = [...this.pendingDecorations];
      this.pendingDecorations = [];

      for (const { editor, framework } of decorationsToProcess) {
        // Delay for Astro, Vue, Svelte so all appear together
        if (framework === 'astro' || framework === 'vue' || framework === 'svelte') {
          await new Promise(resolve => setTimeout(resolve, 225));
        }
        await this.processEditorDecorations(editor, framework);
        await new Promise(resolve => setTimeout(resolve, 5)); // Small delay for smoothness
      }
    } catch (error) {
      console.error('FrameworksDecorator: Error processing decoration queue:', error);
    } finally {
      this.isProcessing = false;
      this.updateQueue.clear();

      // Process any new decorations that came in while we were processing
      if (this.pendingDecorations.length > 0) {
        setTimeout(() => this.processDecorationQueue(), 10);
      }
    }
  }

  /**
   * Process decorations for a specific editor and framework
   */
  private static async processEditorDecorations(editor: vscode.TextEditor, framework: FrameworkName): Promise<void> {
    if (!this.shouldProcessFile(editor.document, framework)) {
      this.clearDecorations(editor, framework);
      return;
    }

    const editorEnabled = isEditorEnabled(editor);
    const extensionEnabled = isExtensionEnabled();

    if (!extensionEnabled && !editorEnabled) {
      this.clearDecorations(editor, framework);
      return;
    }

    if (!editorEnabled) {
      this.clearDecorations(editor, framework);
      return;
    }

    try {
      const decorationType = this.ensureDecorationType(framework);
      const decorations = this.generateDecorations(editor.document, framework);
      editor.setDecorations(decorationType, decorations);

      if (BracketLynxConfig.debug) {
        const config = FRAMEWORK_CONFIGS[framework];
        console.log(`${config.name} Decorator: Applied ${decorations.length} decorations to ${editor.document.fileName}`);
      }
    } catch (error) {
      console.error(`FrameworksDecorator: Error updating ${framework} decorations:`, error);
      this.clearDecorations(editor, framework);
    }
  }

  /**
   * Ensure decoration type exists for framework
   */
  private static ensureDecorationType(framework: FrameworkName): vscode.TextEditorDecorationType {
    const color = getCurrentColor();
    const fontStyle = BracketLynxConfig.fontStyle;
    const prevOptions = this.decorationTypeOptions.get(framework);
    const existing = this.decorationTypes.get(framework);

    if (existing && prevOptions && prevOptions.color === color && prevOptions.fontStyle === fontStyle) {
      return existing;
    }
    if (existing) {
      existing.dispose();
    }

    const decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color,
        fontStyle,
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    this.decorationTypes.set(framework, decorationType);
    this.decorationTypeOptions.set(framework, { color, fontStyle });
    return decorationType;
  }

  /**
   * Generate decorations for a document
   */
  private static generateDecorations(document: vscode.TextDocument, framework: FrameworkName): vscode.DecorationOptions[] {
    const decorations: vscode.DecorationOptions[] = [];
    const text = document.getText();
    const lines = text.split('\n');
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

    const maxDecorations = BracketLynxConfig.maxDecorationsPerFile;
    if (decorations.length > maxDecorations) {
      if (BracketLynxConfig.debug) {
        const config = FRAMEWORK_CONFIGS[framework];
        console.log(`${config.name} Decorator: Limiting decorations from ${decorations.length} to ${maxDecorations}`);
      }
      return decorations.slice(0, maxDecorations);
    }

    return decorations;
  }

  /**
   * Find component ranges in document
   */
  private static findComponentRanges(lines: string[], framework: FrameworkName): ComponentRange[] {
    const config = FRAMEWORK_CONFIGS[framework];
    const componentStack: ComponentStackEntry[] = [];
    const componentRanges: ComponentRange[] = [];
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || !this.TAG_DETECTOR_REGEX.test(line)) {
        continue;
      }

      const trimmedLine = line.trim();

      // Process opening tags
      const openTagMatch = trimmedLine.match(this.OPEN_TAG_REGEX);
      if (openTagMatch) {
        const componentName = openTagMatch[1];
        if (this.isTargetElement(componentName, config)) {
          componentStack.push({
            name: componentName,
            startLine: i + 1,
            timestamp: BracketLynxConfig.debug ? Date.now() : undefined
          });
        }
        continue;
      }

      // Process closing tags
      const closeTagMatch = trimmedLine.match(this.CLOSE_TAG_REGEX);
      if (closeTagMatch) {
        const componentName = closeTagMatch[1];

        for (let j = componentStack.length - 1; j >= 0; j--) {
          if (componentStack[j].name === componentName) {
            const openComponent = componentStack[j];
            componentStack.splice(j, 1);

            const lineSpan = (i + 1) - openComponent.startLine;

            if (lineSpan >= minLines && this.hasSignificantContent(lines, openComponent.startLine - 1, i, config)) {
              const componentType = this.isFrameworkComponent(componentName, config) ? 'framework' : 'html';
              const isScoped = config.hasScoped && componentName === 'style' &&
                this.isStyleScoped(lines, openComponent.startLine - 1);

              componentRanges.push({
                name: componentName,
                startLine: openComponent.startLine,
                endLine: i + 1,
                range: new vscode.Range(i, line.length, i, line.length),
                hasContent: true,
                componentType,
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
   * Detect which framework a document belongs to
   */
  private static detectFramework(document: vscode.TextDocument): FrameworkName | null {
    for (const [key, config] of Object.entries(FRAMEWORK_CONFIGS)) {
      const framework = key as FrameworkName;
      const frameworkConfig = config as SupportedFramework;

      const hasValidExtension = frameworkConfig.extensions.some(ext =>
        document.fileName.endsWith(ext)
      );
      const hasValidLanguageId = frameworkConfig.languageIds.some(id => id === document.languageId);

      if (hasValidExtension || hasValidLanguageId) {
        return framework;
      }
    }
    return null;
  }

  /**
   * Check if element is a target for decoration
   */
  private static isTargetElement(tagName: string, config: SupportedFramework): boolean {
    return this.isFrameworkComponent(tagName, config) ||
           this.isTargetHtmlElement(tagName, config) ||
           this.isCustomComponent(tagName);
  }

  /**
   * Check if element is a framework component
   */
  private static isFrameworkComponent(tagName: string, config: SupportedFramework): boolean {
    return config.components.some(comp => comp === tagName.toLowerCase()) ||
           (tagName[0] === tagName[0].toUpperCase() && tagName[0] !== tagName[0].toLowerCase());
  }

  /**
   * Check if element is a custom component
   */
  private static isCustomComponent(tagName: string): boolean {
    return tagName[0] === tagName[0].toUpperCase() && tagName[0] !== tagName[0].toLowerCase();
  }

  /**
   * Check if element is target HTML element
   */
  private static isTargetHtmlElement(tagName: string, config: SupportedFramework): boolean {
    return config.htmlElements.some(elem => elem === tagName.toLowerCase());
  }

  /**
   * Check if style tag is scoped
   */
  private static isStyleScoped(lines: string[], startIndex: number): boolean {
    const openingLine = lines[startIndex]?.trim();
    return openingLine ? this.SCOPED_STYLE_REGEX.test(openingLine) : false;
  }

  /**
   * Check if content is significant
   */
  private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number, config: SupportedFramework): boolean {
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

    for (let i = startIndex + 1; i < endIndex; i++) {
      const contentLine = lines[i]?.trim();

      if (!contentLine || this.INSIGNIFICANT_CONTENT.has(contentLine)) {
        continue;
      }

      if (this.COMMENT_REGEX.test(contentLine)) {
        continue;
      }

      if (isSpecialTag) {
        return true;
      }

      return true;
    }

    return false;
  }

  /**
   * Check if file should be processed
   */
  private static shouldProcessFile(document: vscode.TextDocument, framework: FrameworkName): boolean {
    if (!BracketLynxConfig.enablePerformanceFilters) {
      return true;
    }

    const fileSize = document.getText().length;
    const maxFileSize = BracketLynxConfig.maxFileSize;

    if (fileSize > maxFileSize) {
      if (BracketLynxConfig.debug) {
        const config = FRAMEWORK_CONFIGS[framework];
        console.log(`${config.name} Decorator: Skipping large file: ${document.fileName} (${fileSize} bytes)`);
      }
      return false;
    }

    return true;
  }

  /**
   * Check if decoration should be shown
   */
  private static shouldShowDecoration(component: ComponentRange): boolean {
    const lineSpan = component.endLine - component.startLine;
    const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);
    return lineSpan >= minLines;
  }

  /**
   * Get editor key for tracking
   */
  private static getEditorKey(editor: vscode.TextEditor): string {
    return `${editor.document.uri.toString()}-${editor.document.version}`;
  }

  /**
   * Clear decorations for specific editor
   */
  public static clearDecorations(editor: vscode.TextEditor, framework?: FrameworkName): void {
    if (framework) {
      const decorationType = this.decorationTypes.get(framework);
      if (decorationType && editor) {
        editor.setDecorations(decorationType, []);
      }
    } else {
      // Clear all frameworks
      for (const decorationType of this.decorationTypes.values()) {
        if (decorationType && editor) {
          editor.setDecorations(decorationType, []);
        }
      }
    }
  }

  /**
   * Clear all decorations from all editors
   */
  public static clearAllDecorations(): void {
    for (const [framework, decorationType] of this.decorationTypes.entries()) {
      if (decorationType) {
        const config = FRAMEWORK_CONFIGS[framework];
        vscode.window.visibleTextEditors
          .filter(editor => {
            const detectedFramework = this.detectFramework(editor.document);
            return detectedFramework === framework;
          })
          .forEach(editor => this.clearDecorations(editor, framework));
      }
    }
  }

  /**
   * Handle configuration changes
   */
  public static onDidChangeConfiguration(): void {
    for (const [framework, decorationType] of this.decorationTypes.entries()) {
      if (decorationType) {
        decorationType.dispose();
      }
    }
    this.decorationTypes.clear();
  }

  /**
   * Force color refresh for all decorations
   */
  public static async forceColorRefresh(): Promise<void> {
    // Dispose all decoration types
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();

    // Clear all decorations
    this.clearAllDecorations();

    // Small delay for cleanup
    await new Promise(resolve => setTimeout(resolve, 50));

    // Update all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      const framework = this.detectFramework(editor.document);
      if (framework && isEditorEnabled(editor)) {
        await this.updateDecorations(editor);
        console.log(`FrameworksDecorator: Force refreshed color for ${framework} in ${editor.document.fileName}`);
      }
    }
  }

  /**
   * Dispose all resources
   */
  public static dispose(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
    this.pendingDecorations = [];
    this.updateQueue.clear();
    this.isProcessing = false;
  }
}

// Export unified decorator and aliases for backward compatibility
export default FrameworksDecorator;
export const AstroDecorator = FrameworksDecorator;
export const VueDecorator = FrameworksDecorator;
export const SvelteDecorator = FrameworksDecorator;
