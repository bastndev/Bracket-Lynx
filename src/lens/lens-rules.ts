export interface FilterRules {
  excludedSymbols: string[];
  supportedLanguages: string[];
}

// ============================================================================
// RULES -  DECORATION
// ============================================================================

export const EXCLUDED_SYMBOLS = [
  '!',
  '"',
  '$',
  '%',
  '&',
  "'",
  "(",
  ')',
  '*',
  ',',
  '.',
  '/',
  ':',
  ';',
  '=',
  '>',
  '?',
  '@',
  '[',
  '\\',
  ']',
  '^',
  '_',
  '`',
  '{',
  '|',
  '}',
  '//',
  'const',
  '---',
  '--',
  '...',
  'MARK',
  'props',
];

/**
 * All supported languages for the extension
 */
export const SUPPORTED_LANGUAGES = [
  'astro',
  'c',
  'cpp',
  'csharp',
  'css',
  'dart',
  'go',
  'html',
  'java',
  'javascript',
  'javascriptreact',
  'json',
  'jsonc',
  'less',
  'php',
  'python',
  'rust',
  'sass',
  'scss',
  'svelte',
  'typescript',
  'typescriptreact',
  'vue',
  'xml',
];

/**
 * Maximum number of words allowed in bracket headers
 */
export const MAX_HEADER_WORDS = 1;

/**
 * Maximum number of words allowed for exception words
 */
export const MAX_EXCEPTION_WORDS = 2;

/**
 * Words that require exception treatment (show more words)
 */
export const EXCEPTION_WORDS = ['export'];

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
 * Check if text contains exception words that require more words to be shown
 */
export function containsExceptionWord(text: string): boolean {
  return EXCEPTION_WORDS.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

/**
 * Filter text content to remove excluded symbols
 */
export function filterContent(content: string): string {
  let filtered = content;

  for (const symbol of EXCLUDED_SYMBOLS) {
    // Replace excluded symbols with spaces to avoid word concatenation
    filtered = filtered.replace(new RegExp(escapeRegExp(symbol), 'g'), ' ');
  }

  // Clean up multiple spaces and trim
  return filtered.replace(/\s+/g, ' ').trim();
}

/**
 * Apply word limit to header text
 */
export function applyWordLimit(text: string): string {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  
  // Check if text contains exception words that need more words shown
  const hasExceptionWord = containsExceptionWord(text);
  const maxWords = hasExceptionWord ? MAX_EXCEPTION_WORDS : MAX_HEADER_WORDS;
  
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  return words.join(' ');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
