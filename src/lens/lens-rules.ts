import {
  EXCLUDED_SYMBOLS,
  SUPPORTED_LANGUAGES,
  ALLOWED_JSON_FILES,
  WORD_LIMITS,
  KEYWORDS,
  isSupportedLanguage,
  isAllowedJsonFile,
  shouldProcessFile as configShouldProcessFile
} from '../core/config';
import { handlePropsPattern } from './decorators/js-ts-decorator-function';

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
export { EXCLUDED_SYMBOLS, SUPPORTED_LANGUAGES, ALLOWED_JSON_FILES } from '../core/config';
export const { MAX_HEADER_WORDS, MAX_EXCEPTION_WORDS, MAX_CSS_WORDS } = WORD_LIMITS;
export const { EXCEPTION_WORDS, PROPS_PATTERNS, CSS_RELATED_WORDS, TRY_CATCH_KEYWORDS, IF_ELSE_KEYWORDS } = KEYWORDS;

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

  // Check for props pattern first
  const propsReplacement = handlePropsPattern(text);
  if (propsReplacement) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length > 1) {
      // Return the word before props and the symbol (e.g., "GitHub ❨❩➤")
      return `${words.slice(0, -1).join(' ')} ${propsReplacement}`;
    }
    return propsReplacement; // Only show the symbol if it's just "props"
  }
  
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(word => word.length > 0);
  
  // Determine max words based on context
  let maxWords: number = MAX_HEADER_WORDS;
  
  // Handle async functions first, then other exports
  if (lowerText.includes('export') && lowerText.includes('async')) {
    maxWords = 2; // For 'export async'
  } else if (lowerText.startsWith('export const') || lowerText.startsWith('export function')) {
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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCssLanguage(languageId?: string): boolean {
  if (!languageId) {
    return false;
  }
  return ['css', 'scss', 'sass', 'less'].includes(languageId);
}