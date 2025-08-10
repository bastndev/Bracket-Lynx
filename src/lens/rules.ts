/**
 * Rules Configuration for Bracket Lynx
 * Defines filtering rules and language-specific configurations
 */

export interface FilterRules {
  excludedSymbols: string[];
  supportedLanguages: string[];
}

/**
 * Symbols that should be excluded from decorations
 */
export const EXCLUDED_SYMBOLS = [
  '//', // Line comments
  '?', // Ternary operator
  ':', // Colon (object properties, ternary)
  '=',
  '>',
  '{',
  '}',
  ')',
  '(',
];

/**
 * All supported languages for the extension
 */
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'astro',
  'vue',
  'svelte',
  'xml',
  'php',
  'json',
  'jsonc',
  'dart',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
];

/**
 * Main rules configuration
 */
export const FILTER_RULES: FilterRules = {
  excludedSymbols: EXCLUDED_SYMBOLS,
  supportedLanguages: SUPPORTED_LANGUAGES,
};

/**
 * Check if a symbol should be excluded from decorations
 */
export function shouldExcludeSymbol(symbol: string): boolean {
  return EXCLUDED_SYMBOLS.includes(symbol);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageId: string): boolean {
  return SUPPORTED_LANGUAGES.includes(languageId);
}

/**
 * Filter text content to remove excluded symbols
 */
export function filterContent(content: string): string {
  let filtered = content;

  for (const symbol of EXCLUDED_SYMBOLS) {
    // Remove the excluded symbols from the content
    filtered = filtered.replace(new RegExp(escapeRegExp(symbol), 'g'), '');
  }

  return filtered.trim();
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
