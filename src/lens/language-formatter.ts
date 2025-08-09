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
        
      // Future languages can be added here:
      // case 'css': return this.formatCSS(contextInfo);
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
    result = result.replace(/\{[^}]*\}/g, '');

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

  // Future methods ready to be implemented:
  // private formatCSS(context: string): string { return context; }
  // private formatJSON(context: string): string { return context; }
  // private formatAstro(context: string): string { return context; }
}