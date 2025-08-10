// ============================================================================
// LANGUAGE FORMATTER - TSX Focus with Future Scalability
// ============================================================================

export class LanguageFormatter {
  /**
   * Main method: Format context based on language
   * Currently optimized for TSX, structure ready for other languages
   */
  public formatContext(contextInfo: string, languageId: string): string {
    if (!contextInfo) {
      return '';
    }

    // SMART DETECTION: Check if content looks like CSS regardless of file type
    if (this.looksLikeCSS(contextInfo)) {
      return this.formatCSS(contextInfo);
    }

    // Language-specific formatting
    switch (languageId) {
      case 'typescript':
      case 'typescriptreact':
      case 'tsx':
      case 'javascript':
      case 'javascriptreact':
      case 'jsx':
        return this.formatTSX(contextInfo);

      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return this.formatCSS(contextInfo);

      case 'html':
      case 'astro':
      case 'vue':
      case 'svelte':
        // For template languages, apply smart detection (already done above)
        return this.formatTSX(contextInfo); // Fallback to TSX for components

      // Future languages can be added here:
      // case 'json': return this.formatJSON(contextInfo);

      default:
        return contextInfo; // Return as-is for unsupported languages
    }
  }

  /**
   * Smart CSS Detection: Detects if content looks like CSS
   * Works regardless of the file type (HTML, Astro, Vue, etc.)
   */
  private looksLikeCSS(context: string): boolean {
    if (!context || context.length < 2) {
      return false;
    }

    const trimmedContext = context.trim();

    // Strong CSS indicators
    const cssPatterns = [
      /^[.#][\w-]+/, // Starts with . or # (CSS selectors)
      /[\w-]+\s*:\s*[\w-]+/, // Contains CSS properties (color: red)
      /^@[\w-]+/, // CSS at-rules (@media, @keyframes)
      /\.([\w-]+)\s*{/, // Class with opening brace
      /#([\w-]+)\s*{/, // ID with opening brace
      /[\w-]+\s*,\s*[\w-]+/, // Multiple selectors separated by comma
    ];

    // Check for strong CSS patterns
    for (const pattern of cssPatterns) {
      if (pattern.test(trimmedContext)) {
        return true;
      }
    }

    // Additional heuristic: Check for multiple CSS selector characters
    const cssSelectorCount = (trimmedContext.match(/[.#]/g) || []).length;
    const hasSpaces = trimmedContext.includes(' ');

    // If we have 2+ CSS selectors and spaces, probably CSS
    if (cssSelectorCount >= 2 && hasSpaces) {
      return true;
    }

    return false;
  }

  /**
   * TSX/JSX Formatter: Simplifies React component context
   * "GitHub: ({ ...props }) => (" → "GitHub ()=>"
   * "export const Icon = " → "export Icon"
   * "export interface TokenEntry" → "export TokenEntry"
   * "static get mode(): string" → "static mode"
   */
  private formatTSX(context: string): string {
    if (!context) {
      return '';
    }

    let result = context;

    // Handle static methods first - this is the key improvement
    // Pattern: "static get methodName(): returnType" → "static methodName"
    result = result.replace(
      /static\s+get\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*\)\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$<>|\[\]]*\s*/g,
      'static $1'
    );

    // Pattern: "static set methodName(param): void" → "static methodName"
    result = result.replace(
      /static\s+set\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$<>|\[\]]*\s*/g,
      'static $1'
    );

    // Pattern: "static methodName(): returnType" → "static methodName"
    result = result.replace(
      /static\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$<>|\[\]]*\s*/g,
      'static $1'
    );

    // Remove complex props: "{ ...props }", "{ prop1, prop2 }", etc.
    result = result.replace(/:\s*\{[^}]*\}/g, '');
    result = result.replace(/\{[^}]*\}/g, '').trim();

    // Clean up extra spaces
    result = result.replace(/\s+/g, ' ').trim();

    // Handle arrow functions with various patterns:
    // "ComponentName: ( ) =>" → "ComponentName ()=>"
    // "ComponentName: =>" → "ComponentName ()=>"
    // "ComponentName: (...) =>" → "ComponentName ()=>"
    result = result.replace(
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/g,
      '$1 ()=>'
    );
    result = result.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*=>/g, '$1 ()=>');

    // Handle export cases more intelligently
    // Keep "export" when it's followed by a meaningful identifier
    if (result.includes('export')) {
      // Pattern: "export const ComponentName = " → "export ComponentName"
      result = result.replace(
        /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*/i,
        'export $1'
      );

      // Pattern: "export function ComponentName" → "export ComponentName"
      result = result.replace(
        /export\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );

      // Pattern: "export interface InterfaceName" → "export InterfaceName"
      result = result.replace(
        /export\s+interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );

      // Pattern: "export type TypeName" → "export TypeName"
      result = result.replace(
        /export\s+type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );

      // Pattern: "export class ClassName" → "export ClassName"
      result = result.replace(
        /export\s+class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );

      // Pattern: "export enum EnumName" → "export EnumName"
      result = result.replace(
        /export\s+enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );

      // Pattern: "export default ComponentName" → "export ComponentName"
      result = result.replace(
        /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i,
        'export $1'
      );
    } else {
      // Only remove export keywords if there's no meaningful content after
      result = result.replace(
        /^export\s+(const\s+|function\s+|interface\s+|type\s+|class\s+|enum\s+|default\s+)?/i,
        ''
      );
    }

    // Clean up again after replacements
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * CSS Formatter: Cleans CSS selectors and adds bullets
   * Now works for CSS in any context (HTML, Astro, Vue, etc.)
   */
  private formatCSS(context: string): string {
    if (!context) {
      return '';
    }

    let result = context;

    // Remove common CSS property patterns first (color: red -> color red)
    result = result.replace(/:\s*[\w#%-]+(?:\s*!important)?/g, '');

    // Remove commas and semicolons
    result = result.replace(/[,;]/g, '');

    // Remove CSS selector symbols (. and #) - this is your successful improvement!
    result = result.replace(/[.#]/g, '');

    // Clean up extra spaces - this is your successful improvement!
    result = result.replace(/\s+/g, ' ').trim();

    // Handle CSS at-rules (@media, @keyframes, etc.)
    result = result.replace(/@[\w-]+\s*/g, '');

    // Remove pseudo-classes and pseudo-elements
    result = result.replace(/::?[\w-]+(?:\([^)]*\))?/g, '');

    // Split by spaces and filter empty parts
    const parts = result.split(' ').filter((part) => part.length > 0);

    if (parts.length === 0) {
      return '';
    }

    if (parts.length === 1) {
      // Single selector: "card-animation" → "card-animation"
      return parts[0];
    }

    if (parts.length === 2) {
      // Two selectors: "card-animation lucas" → "card-animation •lucas"
      return `${parts[0]} •${parts[1]}`;
    }

    // Multiple selectors: take first and last
    // "card-animation lucas maria jose" → "card-animation •jose"
    return `${parts[0]} •${parts[parts.length - 1]}`;
  }

  // Future methods ready to be implemented:
  // private formatJSON(context: string): string { return context; }

  // COMPLETED: Smart CSS detection works across all file types!
  // ✅ CSS in .css files
  // ✅ CSS in HTML <style> tags
  // ✅ CSS in Astro components
  // ✅ CSS in Vue <style> sections
  // ✅ CSS in Svelte <style> sections
}
