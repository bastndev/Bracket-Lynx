export interface FilterRules {
  excludedSymbols: string[];
  supportedLanguages: string[];
}

export const EXCLUDED_SYMBOLS = [
  '!', '"', '$', '%', '&', "'", '(', ')', '*', ',', '.', '/', ':', ';',
  '=', '>', '<', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}',
  '//', 'const', '---', '--', '...', 'MARK', 'props',
];

export const SUPPORTED_LANGUAGES = [
  'astro', 'c', 'cpp', 'csharp', 'css', 'dart', 'go', 'html', 'java',
  'javascript', 'javascriptreact', 'json', 'jsonc', 'less', 'php',
  'python', 'rust', 'sass', 'scss', 'svelte', 'typescript', 
  'typescriptreact', 'vue', 'xml',
];

export const MAX_HEADER_WORDS = 1;
export const MAX_EXCEPTION_WORDS = 2;
export const MAX_CSS_WORDS = 2;
export const EXCEPTION_WORDS = ['export'];
export const CSS_RELATED_WORDS = ['style', 'styles', 'css'];

export const FILTER_RULES: FilterRules = {
  excludedSymbols: EXCLUDED_SYMBOLS,
  supportedLanguages: SUPPORTED_LANGUAGES,
};
export function shouldExcludeSymbol(symbol: string): boolean {
  return EXCLUDED_SYMBOLS.includes(symbol);
}

export function isLanguageSupported(languageId: string): boolean {
  return SUPPORTED_LANGUAGES.includes(languageId);
}

export function containsExceptionWord(text: string): boolean {
  return EXCEPTION_WORDS.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

export function containsCssContent(text: string): boolean {
  return CSS_RELATED_WORDS.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

export function filterContent(content: string): string {
  let filtered = content;

  for (const symbol of EXCLUDED_SYMBOLS) {
    filtered = filtered.replace(new RegExp(escapeRegExp(symbol), 'g'), ' ');
  }

  return filtered.replace(/\s+/g, ' ').trim();
}

export function applyWordLimit(text: string, languageId?: string): string {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  
  const hasExceptionWord = containsExceptionWord(text);
  const hasCssContent = containsCssContent(text);
  const isCssFile = languageId === 'css' || languageId === 'scss' || languageId === 'sass' || languageId === 'less';
  
  // Determine max words based on context
  let maxWords = MAX_HEADER_WORDS;
  if (hasExceptionWord) {
    maxWords = MAX_EXCEPTION_WORDS;
  } else if (hasCssContent || isCssFile) {
    maxWords = MAX_CSS_WORDS;
  }
  
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  return words.join(' ');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
