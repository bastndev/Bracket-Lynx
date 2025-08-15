import { SUPPORTED_LANGUAGES, ALLOWED_JSON_FILES, SupportedLanguage, escapeRegExp } from '../core/utils';
import { formatAsyncFunction, formatComplexFunction, isAsyncFunction, isComplexFunction } from './decorators/js-ts-decorator-function';

// ============================================================================
// 🎯 CONFIGURATION CONSTANTS - Easy to edit at the top!
// ============================================================================

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

// Optimized Set for O(1) lookups
const EXCLUDED_SYMBOLS_SET = new Set<string>(EXCLUDED_SYMBOLS);

// Cached regex patterns for better performance
const REGEX_CACHE = new Map<string, RegExp>();

function getCachedRegex(pattern: string, flags: string = 'g'): RegExp {
  const key = `${pattern}|${flags}`;
  if (!REGEX_CACHE.has(key)) {
    REGEX_CACHE.set(key, new RegExp(pattern, flags));
  }
  return REGEX_CACHE.get(key)!;
}

// Optimized Sets for O(1) lookups
const CSS_RELATED_WORDS_SET = new Set<string>(KEYWORDS.CSS_RELATED_WORDS);
const TRY_CATCH_KEYWORDS_SET = new Set<string>(KEYWORDS.TRY_CATCH_KEYWORDS);
const IF_ELSE_KEYWORDS_SET = new Set<string>(KEYWORDS.IF_ELSE_KEYWORDS);
const CSS_LANGUAGES_SET = new Set<string>(['css', 'scss', 'sass', 'less']);

// ============================================================================
// ADVANCED TYPES - Ultra-specific for better type safety
// ============================================================================

export type ExcludedSymbol = typeof EXCLUDED_SYMBOLS[number];
export type CssLanguage = 'css' | 'scss' | 'sass' | 'less';
export type WordLimitType = 'header' | 'exception' | 'css';
export type ContentType = 'async' | 'complex' | 'arrow' | 'css' | 'exception' | 'control-flow';

// Smart union types for better intellisense
export type LanguageContext = {
  readonly languageId?: string;
  readonly contentType?: ContentType;
  readonly isLowerCase?: boolean;
};

export interface FilterRules {
  excludedSymbols: readonly ExcludedSymbol[];
  supportedLanguages: readonly string[];
}

// Performance-optimized content analyzer result
export interface ContentAnalysisResult {
  readonly contentType: ContentType | null;
  readonly maxWords: number;
  readonly requiresSymbol: boolean;
  readonly isOptimized: boolean;
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
  return EXCLUDED_SYMBOLS_SET.has(symbol);
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

// 🧠 SMART Text Analyzer - Detects if text is already lowercase
const isAlreadyLowerCase = (text: string): boolean => text === text.toLowerCase();

/**
 * 🎯 OPTIMIZED Exception Word Detector
 */
export function containsExceptionWord(text: string): boolean {
  const lowerText = isAlreadyLowerCase(text) ? text : text.toLowerCase();
  return EXCEPTION_WORDS.some(word => lowerText.includes(word));
}

/**
 * 🎨 SMART CSS Content Detector - Early exit optimization
 */
export function containsCssContent(text: string): boolean {
  const lowerText = isAlreadyLowerCase(text) ? text : text.toLowerCase();
  
  // 🚀 Early exit for common cases
  if (!lowerText.includes('s')) {return false;} // Most CSS words contain 's'
  
  for (const word of CSS_RELATED_WORDS_SET) {
    if (lowerText.includes(word)) {return true;}
  }
  return false;
}

/**
 * 🔄 INTELLIGENT Control Flow Detectors - Combined for efficiency
 */
export function containsTryCatchKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // 🚀 Quick check for common letters first
  if (!lowerText.includes('t') && !lowerText.includes('c') && !lowerText.includes('f')) {
    return false;
  }
  
  for (const keyword of TRY_CATCH_KEYWORDS_SET) {
    if (lowerText.includes(keyword)) {return true;}
  }
  return false;
}

export function containsIfElseKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // 🚀 Quick check for common letters first
  if (!lowerText.includes('i') && !lowerText.includes('e') && !lowerText.includes('s')) {
    return false;
  }
  
  for (const keyword of IF_ELSE_KEYWORDS_SET) {
    if (lowerText.includes(keyword)) {return true;}
  }
  return false;
}

export function containsControlFlowKeyword(text: string): boolean {
  return containsTryCatchKeyword(text) || containsIfElseKeyword(text);
}

// Re-export validation functions from decorator to avoid duplication
export { isAsyncFunction, isComplexFunction };

export function isArrowFunction(lowerText: string): boolean {
  // Check for arrow function patterns only
  return (
    lowerText.includes('=>') &&
    (lowerText.includes('export') || lowerText.includes('const') || lowerText.includes('let') || lowerText.includes('var'))
  );
}

// ============================================================================
// CONTENT FILTERING AND FORMATTING
// ============================================================================

// 🚀 ULTRA-OPTIMIZED Symbol Replacer - Pre-compiled for maximum speed!
const SYMBOL_REPLACER_REGEX = (() => {
  const escapedSymbols = EXCLUDED_SYMBOLS.map(escapeRegExp);
  return new RegExp(`(${escapedSymbols.join('|')})`, 'g');
})();

/**
 * 🔥 LIGHTNING-FAST Content Filter - Single regex pass instead of loop!
 */
export function filterContent(content: string): string {
  if (!content) {return '';}
  
  // 🚀 ONE-SHOT REPLACEMENT - Replace all symbols in single pass!
  return content
    .replace(SYMBOL_REPLACER_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 🚀 MEGA-INTELLIGENT Content Analyzer - Analyzes everything in one pass!
 */
function analyzeContentSmart(text: string, languageId?: string): ContentAnalysisResult {
  const lowerText = text.toLowerCase();
  
  // Ultra-fast content type detection with priority order
  if (isAsyncFunction(lowerText)) {
    return { contentType: 'async', maxWords: 2, requiresSymbol: true, isOptimized: true };
  }
  
  if (isComplexFunction(lowerText)) {
    return { contentType: 'complex', maxWords: 2, requiresSymbol: true, isOptimized: true };
  }
  
  if (lowerText.includes('=>') && (lowerText.includes('export') || lowerText.includes('const'))) {
    return { contentType: 'arrow', maxWords: 3, requiresSymbol: false, isOptimized: true };
  }
  
  if (containsExceptionWord(lowerText)) {
    return { contentType: 'exception', maxWords: MAX_EXCEPTION_WORDS, requiresSymbol: false, isOptimized: true };
  }
  
  if (containsCssContent(lowerText) || isCssLanguage(languageId)) {
    return { contentType: 'css', maxWords: MAX_CSS_WORDS, requiresSymbol: false, isOptimized: true };
  }
  
  return { contentType: null, maxWords: MAX_HEADER_WORDS, requiresSymbol: false, isOptimized: true };
}

/**
 * 🎯 SUPER-OPTIMIZED Word Limit Applier - Now with smart analysis!
 */
export function applyWordLimit(text: string, languageId?: string): string {
  if (!text) {return '';}

  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean); // Boolean is faster than word => word.length > 0
  
  // 🚀 ONE-PASS ANALYSIS - Analyze everything at once!
  const analysis = analyzeContentSmart(text, languageId);
  
  // 🎯 SMART SYMBOL FORMATTING - Apply symbols if needed
  if (analysis.requiresSymbol && analysis.contentType) {
    switch (analysis.contentType) {
      case 'async': return formatAsyncFunction(words);
      case 'complex': return formatComplexFunction(words);
    }
  }
  
  // 🔥 OPTIMIZED WORD LIMITING - Use analysis result
  if (words.length > analysis.maxWords) {
    return words.slice(0, analysis.maxWords).join(' ') + '...';
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
  return CSS_LANGUAGES_SET.has(languageId);
}