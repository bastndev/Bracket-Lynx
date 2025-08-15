import {
  SUPPORTED_LANGUAGES,
  ALLOWED_JSON_FILES,
  SupportedLanguage,
  AllowedJsonFile,
  escapeRegExp,
} from '../core/utils';
import { 
  formatAsyncFunction,
  formatComplexFunction,
  isAsyncFunction as decoratorIsAsyncFunction,
  isComplexFunction as decoratorIsComplexFunction
} from './decorators/js-ts-decorator-function';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isSupportedLanguage(languageId: string): languageId is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(languageId);
}

function isAllowedJsonFile(fileName: string): boolean {
  const baseName = fileName.split('/').pop() || fileName;
  return (ALLOWED_JSON_FILES as readonly string[]).includes(baseName);
}

function configShouldProcessFile(languageId: string, fileName: string): boolean {
  if (languageId === 'json' || languageId === 'jsonc') {
    return isAllowedJsonFile(fileName);
  }
  return isSupportedLanguage(languageId);
}

/**
 * WORD LIMITS - Controls how many words are displayed
 */
export const WORD_LIMITS = {
  MAX_HEADER_WORDS: 1,
  MAX_EXCEPTION_WORDS: 2,
  MAX_CSS_WORDS: 2,
} as const;

export const EXCLUDED_SYMBOLS = [
  '!', '"', '#', '$', '%', '&', "'", ',', '.', '/', ';', '<', '?', '@', 
  '[', '\\', ']', '^', '_', '`', '{', '|', '}','//', '---', '--', '...',
  ':', '(', ')', '=', '>', 'MARK',
] as const;

/**
 * KEYWORDS - For content analysis and pattern detection
 */
export const KEYWORDS = {
  EXCEPTION_WORDS: ['export'] as const,
  CSS_RELATED_WORDS: ['style', 'styles', 'css'] as const,
  TRY_CATCH_KEYWORDS: ['try', 'catch', 'finally'] as const,
  IF_ELSE_KEYWORDS: ['if', 'else', 'switch', 'case'] as const,
} as const;

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface FilterRules {
  excludedSymbols: readonly string[];
  supportedLanguages: readonly string[];
}

// ============================================================================
// CONFIGURATION EXPORTS
// ============================================================================

export const FILTER_RULES: FilterRules = {
  excludedSymbols: EXCLUDED_SYMBOLS,
  supportedLanguages: SUPPORTED_LANGUAGES,
};

// Re-export constants for backward compatibility
export { SUPPORTED_LANGUAGES, ALLOWED_JSON_FILES } from '../core/utils';
export const { MAX_HEADER_WORDS, MAX_EXCEPTION_WORDS, MAX_CSS_WORDS } = WORD_LIMITS;
export const { EXCEPTION_WORDS, CSS_RELATED_WORDS, TRY_CATCH_KEYWORDS, IF_ELSE_KEYWORDS } = KEYWORDS;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function shouldExcludeSymbol(symbol: string): boolean {
  return (EXCLUDED_SYMBOLS as readonly string[]).includes(symbol);
}

export function isLanguageSupported(languageId: string): boolean {
  return isSupportedLanguage(languageId);
}

export function isJsonFileAllowed(fileName: string): boolean {
  return isAllowedJsonFile(fileName);
}

export function shouldProcessFile(languageId: string, fileName: string): boolean {
  return configShouldProcessFile(languageId, fileName);
}

// ============================================================================
// CONTENT ANALYSIS FUNCTIONS
// ============================================================================

export function containsExceptionWord(text: string): boolean {
  return EXCEPTION_WORDS.some(word => 
    text.toLowerCase().includes(word.toLowerCase())
  );
}

export function containsCssContent(text: string): boolean {
  return CSS_RELATED_WORDS.some(word => 
    text.toLowerCase().includes(word.toLowerCase())
  );
}

export function containsTryCatchKeyword(text: string): boolean {
  return TRY_CATCH_KEYWORDS.some(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

export function containsIfElseKeyword(text: string): boolean {
  return IF_ELSE_KEYWORDS.some(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

export function containsControlFlowKeyword(text: string): boolean {
  return containsTryCatchKeyword(text) || containsIfElseKeyword(text);
}

export function isAsyncFunction(lowerText: string): boolean {
  // Use the centralized function from decorator
  return decoratorIsAsyncFunction(lowerText);
}

export function isArrowFunction(lowerText: string): boolean {
  // Check for arrow function patterns only
  return (
    lowerText.includes('=>') &&
    (lowerText.includes('export') || lowerText.includes('const') || lowerText.includes('let') || lowerText.includes('var'))
  );
}

export function isComplexFunction(lowerText: string): boolean {
  // Use the centralized function from decorator
  return decoratorIsComplexFunction(lowerText);
}

// ============================================================================
// CONTENT FILTERING AND FORMATTING
// ============================================================================

export function filterContent(content: string): string {
  if (!content) {
    return '';
  }
  
  let filtered = content;

  // Remove excluded symbols
  for (const symbol of EXCLUDED_SYMBOLS) {
    filtered = filtered.replace(new RegExp(escapeRegExp(symbol), 'g'), ' ');
  }

  return filtered.replace(/\s+/g, ' ').trim();
}

export function applyWordLimit(text: string, languageId?: string): string {
  if (!text) {
    return '';
  }


  
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(word => word.length > 0);
  
  // Check for async functions only and add symbol
  if (isAsyncFunction(lowerText)) {
    return formatAsyncFunction(words);
  }



  // Check for complex functions (with React types, generics, etc.) and add symbol
  if (isComplexFunction(lowerText)) {
    return formatComplexFunction(words);
  }


  
  // Determine max words based on context
  let maxWords: number = MAX_HEADER_WORDS;
  
  // Handle async functions first, then other exports
  if (lowerText.includes('export') && lowerText.includes('async')) {
    maxWords = 2; // For 'export async'
  } else if (lowerText.startsWith('export const') && lowerText.includes('=>')) {
    // Only apply to export const arrow functions (that contain '=>')
    maxWords = 3;
  } else if (containsExceptionWord(text)) {
    maxWords = MAX_EXCEPTION_WORDS;
  } else if (containsCssContent(text) || isCssLanguage(languageId)) {
    maxWords = MAX_CSS_WORDS;
  }
  
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  
  return words.join(' ');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isCssLanguage(languageId?: string): boolean {
  if (!languageId) {
    return false;
  }
  return ['css', 'scss', 'sass', 'less'].includes(languageId);
}