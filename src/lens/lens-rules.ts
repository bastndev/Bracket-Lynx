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
import { handlePropsPattern, handleArrowFunctionPattern } from './decorators/js-ts-decorator-function';

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

export function isAsyncFunction(lowerText: string): boolean {
  // Check for async function patterns only
  return (
    lowerText.includes('async function') ||
    lowerText.includes('async ') ||
    (lowerText.includes('export') && lowerText.includes('async'))
  ) && !lowerText.includes('=>'); // Exclude arrow functions
}

export function isArrowFunction(lowerText: string): boolean {
  // Check for arrow function patterns only
  return (
    lowerText.includes('=>') &&
    (lowerText.includes('export') || lowerText.includes('const') || lowerText.includes('let') || lowerText.includes('var'))
  );
}



export function isComplexFunction(lowerText: string): boolean {
  // Check for functions with complex type parameters (React components, etc.)
  return (
    (lowerText.includes('function ') || 
     (lowerText.includes('export') && lowerText.includes('function'))) &&
    (lowerText.includes('react.') || 
     lowerText.includes('svgprops') || 
     lowerText.includes('htmlprops') ||
     lowerText.includes('<') && lowerText.includes('>')) && // Generic types
    !lowerText.includes('async') && // Exclude async functions
    !lowerText.includes('=>') // Exclude arrow functions
  );
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

  // Check for props pattern - limit to only one word
  const propsReplacement = handlePropsPattern(text);
  if (propsReplacement) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length > 1) {
      // Return only the first meaningful word and the symbol (e.g., "GitHub ➤")
      const firstWord = getFirstMeaningfulWord(words);
      return `${firstWord} ${propsReplacement}`;
    }
    return propsReplacement; // Only show the symbol if it's just "props"
  }
  
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(word => word.length > 0);
  
  // Check for async functions only and add ⧘⧙ symbol
  if (isAsyncFunction(lowerText)) {
    if (words.length >= 3) {
      // Take first 2 words and add the symbol (removing the last word)
      return `${words.slice(0, 2).join(' ')} ⧘⧙`;
    } else if (words.length === 2) {
      // If only 2 words, add the symbol
      return `${words.join(' ')} ⧘⧙`;
    } else if (words.length === 1) {
      // If only 1 word, add the symbol
      return `${words[0]} ⧘⧙`;
    }
  }



  // Check for complex functions (with React types, generics, etc.) and add ⇄ symbol
  if (isComplexFunction(lowerText)) {
    if (words.length >= 3) {
      // Take first 2 words and add the symbol (removing the last word)
      return `${words.slice(0, 2).join(' ')} ⇄`;
    } else if (words.length === 2) {
      // If only 2 words, add the symbol
      return `${words.join(' ')} ⇄`;
    } else if (words.length === 1) {
      // If only 1 word, add the symbol
      return `${words[0]} ⇄`;
    }
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

/**
 * Get the first meaningful word (skip common prefixes/symbols)
 */
function getFirstMeaningfulWord(words: string[]): string {
  const skipWords = ['export', 'const', 'function', 'async', 'default'];
  
  for (const word of words) {
    const cleanWord = word.toLowerCase().trim();
    if (cleanWord && !skipWords.includes(cleanWord) && cleanWord !== 'props') {
      return word;
    }
  }
  
  // If no meaningful word found, return the first word
  return words[0] || '';
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCssLanguage(languageId?: string): boolean {
  if (!languageId) {
    return false;
  }
  return ['css', 'scss', 'sass', 'less'].includes(languageId);
}