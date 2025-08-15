import { SUPPORTED_LANGUAGES, ALLOWED_JSON_FILES, SupportedLanguage, escapeRegExp } from '../core/utils';
import { formatAsyncFunction, formatComplexFunction, isAsyncFunction, isComplexFunction, FUNCTION_SYMBOLS } from './decorators/js-ts-decorator-function';

// WORD LIMITS - Controls how many words are displayed
export const WORD_LIMITS = {
  MAX_HEADER_WORDS: 1,           // Header
  MAX_EXCEPTION_WORDS: 2,        // Exception
  MAX_CSS_WORDS: 2,              // CSS
  MAX_ARROW_WORDS: 3,            // Normal arrow
  MAX_COLLECTION_ARROW_WORDS: 1, // Collection arrow
} as const;

/**
 * FUNCTION_SYMBOLS - Centralized symbols for consistent formatting
 * Imported from js-ts-decorator-function.ts to avoid duplication
 */

export const EXCLUDED_SYMBOLS = [
  '!', '"', '$', '%', '&', "'", ',', '.', '/', ';', '<', '?', '@', '\\',
  '[', ']', '^', '_', '`', '{', '|', '}','//', '---', '--', '...',
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
export type WordLimitType = 'header' | 'exception' | 'css' | 'arrow';
export type ContentType = 'async' | 'complex' | 'arrow' | 'collection-arrow' | 'css' | 'exception' | 'control-flow';

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
export const { MAX_HEADER_WORDS, MAX_EXCEPTION_WORDS, MAX_CSS_WORDS, MAX_ARROW_WORDS, MAX_COLLECTION_ARROW_WORDS } = WORD_LIMITS;
export { FUNCTION_SYMBOLS };
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

export function isCollectionArrowFunction(lowerText: string): boolean {
  // Input validation
  if (!lowerText || typeof lowerText !== 'string') {
    return false;
  }
  
  // Check for arrow functions in collections/objects (like Icon.Sun, Icon.Moon)
  // More robust detection: must have arrow, colon, and NOT be a variable declaration
  const hasArrow = lowerText.includes('=>');
  const hasColon = lowerText.includes(':');
  const isVariableDeclaration = lowerText.includes('export') || 
                               lowerText.includes('const') || 
                               lowerText.includes('let') || 
                               lowerText.includes('var');
  
  return hasArrow && hasColon && !isVariableDeclaration;
}

/**
 * 🎯 UNIFIED Arrow Function Type Detector
 * Determines the type of arrow function for consistent processing
 */
export function detectArrowFunctionType(text: string): 'normal' | 'collection' | null {
  // Input validation
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  const lowerText = text.toLowerCase().trim();
  
  if (!lowerText.includes('=>')) {
    return null;
  }
  
  // Check for normal arrow functions (export const, const, let, var)
  if (lowerText.includes('export') || lowerText.includes('const') || 
      lowerText.includes('let') || lowerText.includes('var')) {
    return 'normal';
  }
  
  // Check for collection arrow functions (object properties with arrow functions)
  if (lowerText.includes(':') && !lowerText.includes('export')) {
    return 'collection';
  }
  
  return null;
}

/**
 * 🚀 OPTIMIZED Arrow Function Formatter
 * Handles both normal and collection arrow functions with proper symbols
 */
export function formatArrowFunction(text: string): string | null {
  // Input validation
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  const arrowType = detectArrowFunctionType(text);
  if (!arrowType) {
    return null;
  }
  
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  
  switch (arrowType) {
    case 'normal':
      if (words.length >= 2) {
        const firstTwoWords = words.slice(0, 2).join(' ');
        return `${firstTwoWords} ${FUNCTION_SYMBOLS.NORMAL_ARROW}`;
      } else if (words.length === 1) {
        return `${words[0]} ${FUNCTION_SYMBOLS.NORMAL_ARROW}`;
      }
      break;
      
    case 'collection':
      if (words.length >= 1) {
        const functionName = words[0];
        return `${functionName} ${FUNCTION_SYMBOLS.COLLECTION_ARROW}`;
      }
      break;
  }
  
  return null;
}

export function formatCollectionArrowFunction(words: string[]): string {
  if (words.length >= 1) {
    return `${words[0]} ⮞`;
  }
  return words.join(' ');
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
 * This function determines the content type and appropriate formatting rules
 * @param text - The text content to analyze
 * @param languageId - Optional language identifier for context-specific analysis
 * @returns ContentAnalysisResult with type, word limits, and formatting requirements
 */
function analyzeContentSmart(text: string, languageId?: string): ContentAnalysisResult {
  // Input validation
  if (!text || typeof text !== 'string') {
    return { contentType: null, maxWords: MAX_HEADER_WORDS, requiresSymbol: false, isOptimized: true };
  }
  
  const lowerText = text.toLowerCase().trim();
  
  // Ultra-fast content type detection with priority order
  if (isAsyncFunction(lowerText)) {
    return { contentType: 'async', maxWords: 2, requiresSymbol: true, isOptimized: true };
  }
  
  if (isComplexFunction(lowerText)) {
    return { contentType: 'complex', maxWords: 2, requiresSymbol: true, isOptimized: true };
  }
  
  // Check for arrow functions using unified detection
  const arrowType = detectArrowFunctionType(text);
  if (arrowType === 'normal') {
    return { contentType: 'arrow', maxWords: MAX_ARROW_WORDS, requiresSymbol: false, isOptimized: true };
  }
  if (arrowType === 'collection') {
    return { contentType: 'collection-arrow', maxWords: MAX_COLLECTION_ARROW_WORDS, requiresSymbol: true, isOptimized: true };
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
      case 'collection-arrow': return formatCollectionArrowFunction(words);
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