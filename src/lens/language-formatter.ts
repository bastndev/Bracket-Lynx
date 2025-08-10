import * as vscode from 'vscode';

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

    // Currently focused on TSX/JSX - easy to extend later
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
        
      // Future languages can be added here:
      // case 'json': return this.formatJSON(contextInfo);
      // case 'astro': return this.formatAstro(contextInfo);
      
      default:
        return contextInfo; // Return as-is for unsupported languages
    }
  }

  /**
   * TSX/JSX Formatter: Simplifies React component context
   * "Github: { ...props } ()=>" → "Github()=>"
   * "export const Icon = " → "export Icon"
   */
  private formatTSX(context: string): string {
    if (!context) {
      return '';
    }

    let result = context;

    // Remove complex props: "{ ...props }", "{ prop1, prop2 }", etc.
    result = result.replace(/:\s*\{[^}]*\}/g, '');
    result = result.replace(/\{[^}]*\}/g, '').trim();

    // Clean up extra spaces
    result = result.replace(/\s+/g, ' ').trim();

    // Handle export cases more intelligently
    // Keep "export" when it's followed by a meaningful identifier
    if (result.includes('export')) {
      // Pattern: "export const ComponentName = " → "export ComponentName"
      result = result.replace(/export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*/i, 'export $1');
      
      // Pattern: "export function ComponentName" → "export ComponentName" 
      result = result.replace(/export\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i, 'export $1');
      
      // Pattern: "export default ComponentName" → "export ComponentName"
      result = result.replace(/export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i, 'export $1');
    } else {
      // Only remove export keywords if there's no meaningful content after
      result = result.replace(/^export\s+(const\s+|function\s+|default\s+)?/i, '');
    }

    // Clean up again after replacements
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   *** CSS Formatter: Cleans CSS selectors and adds bullets
   */
  private formatCSS(context: string): string {
    if (!context) {
      return '';
    }

    let result = context;

    // Remove commas first
    result = result.replace(/,/g, '');

    // Remove CSS selector symbols (. and #)
    result = result.replace(/[.#]/g, '');

    // Clean up extra spaces
    result = result.replace(/\s+/g, ' ').trim();

    // Split by spaces and filter empty parts
    const parts = result.split(' ').filter(part => part.length > 0);
    
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
  // private formatAstro(context: string): string { return context; }
}