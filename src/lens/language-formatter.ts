import { shouldExcludeSymbol, filterContent } from './lens-rules';

export class LanguageFormatter {
  // Cached regex patterns for better performance
  private static readonly CSS_PATTERNS = [
    /^[.#][\w-]+/,
    /[\w-]+\s*:\s*[\w-]+/,
    /^@[\w-]+/,
    /\.([\w-]+)\s*{/,
    /#([\w-]+)\s*{/,
    /[\w-]+\s*,\s*[\w-]+/,
  ];
  
  private static readonly CSS_SELECTOR_REGEX = /[.#]/g;

  /**
   * Format context based on language with smart CSS detection
   */
  public formatContext(contextInfo: string, languageId: string): string {
    if (!contextInfo) {
      return '';
    }

    let filteredContext = filterContent(contextInfo);
    if (!filteredContext.trim()) {
      return '';
    }

    if (this.looksLikeCSS(filteredContext)) {
      return this.formatCSS(filteredContext);
    }

    switch (languageId) {
      case 'typescript':
      case 'typescriptreact':
      case 'tsx':
      case 'javascript':
      case 'javascriptreact':
      case 'jsx':
        return this.formatTSX(filteredContext);

      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return this.formatCSS(filteredContext);

      case 'html':
      case 'astro':
      case 'vue':
      case 'svelte':
        return this.formatTSX(filteredContext);

      default:
        return filteredContext;
    }
  }

  /**
   * Smart CSS Detection: Detects CSS patterns regardless of file type
   * Optimized with cached regex patterns
   */
  private looksLikeCSS(context: string): boolean {
    if (!context || context.length < 2) {
      return false;
    }

    const trimmedContext = context.trim();

    // Use cached patterns for better performance
    for (const pattern of LanguageFormatter.CSS_PATTERNS) {
      if (pattern.test(trimmedContext)) {
        return true;
      }
    }

    // Use cached regex for selector counting
    const cssSelectorCount = (trimmedContext.match(LanguageFormatter.CSS_SELECTOR_REGEX) || []).length;
    const hasSpaces = trimmedContext.includes(' ');

    return cssSelectorCount >= 2 && hasSpaces;
  }

  /**
   * TSX/JSX Formatter: Simplifies React component context
   */
  private formatTSX(context: string): string {
    if (!context) {
      return '';
    }

    let result = context;

    const jsxTagMatch = result.match(/<\s*([a-zA-Z][a-zA-Z0-9-]*)[^>]*/);
    if (jsxTagMatch) {
      const tagName = jsxTagMatch[1].toLowerCase();
      if (tagName === 'image' || tagName === 'image') {
        return 'image';
      }
      if (['div', 'span', 'input'].includes(tagName)) {
        return tagName;
      }
      if (tagName === 'button') {
        return 'btn';
      }
      return tagName;
    }

    const jsxClosingTagMatch = result.match(/<\/\s*([a-zA-Z][a-zA-Z0-9-]*)\s*>/);
    if (jsxClosingTagMatch) {
      const tagName = jsxClosingTagMatch[1].toLowerCase();
      return tagName === 'image' || tagName === 'img' ? 'img' : tagName;
    }

    if (result.trim().endsWith('/>') || result.trim().endsWith('} />')) {
      const tagMatch = result.match(/([a-zA-Z][a-zA-Z0-9-]*)[^<>]*\/?>?\s*$/);
      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        return tagName === 'image' || tagName === 'img' ? 'img' : tagName;
      }
    }

    result = result.replace(
      /static\s+get\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*\)\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$<>|\[\]]*\s*/g,
      'static $1'
    );

    result = result.replace(
      /static\s+set\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$<>|\[\]]*\s*/g,
      'static $1'
    );

    result = result.replace(
      /static\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$<>|\[\]]*\s*/g,
      'static $1'
    );

    result = result.replace(/:\s*\{[^}]*\}/g, '');
    result = result.replace(/\{[^}]*\}/g, '').trim();

    result = result.replace(/\s+/g, ' ').trim();

    result = result.replace(
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/g,
      '$1 ()=>'
    );
    result = result.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*=>/g, '$1 ()=>');

    if (result.includes('export')) {
      result = result.replace(
        /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*/i,
        'export $1'
      );

      result = result.replace(
        /export\s+(function|interface|type|class|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $2'
      );

      result = result.replace(
        /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );
    } else {
      result = result.replace(
        /^export\s+(const\s+|function\s+|interface\s+|type\s+|class\s+|enum\s+|default\s+)?/i,
        ''
      );
    }

    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * CSS Formatter: Cleans CSS selectors and adds visual separators
   */
  private formatCSS(context: string): string {
    if (!context) {
      return '';
    }

    let result = context;

    result = result.replace(/:\s*[\w#%-]+(?:\s*!important)?/g, '');
    result = result.replace(/[,;]/g, '');
    result = result.replace(/[.#]/g, '');
    result = result.replace(/\s+/g, ' ').trim();
    result = result.replace(/@[\w-]+\s*/g, '');
    result = result.replace(/::?[\w-]+(?:\([^)]*\))?/g, '');

    const parts = result.split(' ').filter((part) => part.length > 0);

    if (parts.length === 0) {
      return '';
    }

    if (parts.length === 1) {
      return parts[0];
    }

    if (parts.length === 2) {
      return `${parts[0]} •${parts[1]}`;
    }

    return `${parts[0]} •${parts[parts.length - 1]}`;
  }
}
