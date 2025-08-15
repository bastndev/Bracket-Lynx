import { KEYWORDS } from '../../core/config';

/**
 * Get the first meaningful word (skip common prefixes/symbols)
 */
function getFirstMeaningfulWord(words: string[]): string {
  const skipWords = ['export', 'const', 'function', 'async', 'default'];
  
  for (const word of words) {
    const cleanWord = word.toLowerCase().trim();
    if (cleanWord && !skipWords.includes(cleanWord)) {
      return word;
    }
  }
  
  // If no meaningful word found, return the first word
  return words[0] || '';
}



/**
 * Handles the decoration for exported arrow functions.
 * If the text is an exported arrow function, it removes 'const' and adds a symbol.
 * @param text The text content to analyze.
 * @returns The formatted string or null if it's not an arrow function.
 */
export function handleArrowFunctionPattern(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // Must contain '=>' to be considered an arrow function
  if (!lowerText.includes('=>')) {
    return null;
  }
  
  // Check for export const pattern with arrow function
  if (lowerText.startsWith('export const') && !lowerText.includes('async')) {
    const words = text.split(/\s+/).filter(Boolean);
    // Reconstructs the string as "export [FunctionName] ❨❩➤"
    if (words.length >= 3) {
      return `${words[0]} ${words[2]} ❨❩➤`;
    }
  }
  
  return null;
}

/**
 * ArrowFunctionDecorator class for managing function decorations
 */
export class ArrowFunctionDecorator {
  private static arrowFunctionSymbol = '❨❩➤';
  private static asyncFunctionSymbol = '⧘⧙';

  private static complexFunctionSymbol = '⇄';

  /**
   * Get the current arrow function symbol (backward compatibility)
   */
  static getSymbol(): string {
    return this.arrowFunctionSymbol;
  }

  /**
   * Get the current symbols
   */
  static getSymbols(): {
    arrow: string;
    async: string;
    complex: string;
  } {
    return {
      arrow: this.arrowFunctionSymbol,
      async: this.asyncFunctionSymbol,
      complex: this.complexFunctionSymbol,
    };
  }

  /**
   * Change the arrow function symbol
   */
  static changeArrowFunctionSymbol(newSymbol: string): void {
    this.arrowFunctionSymbol = newSymbol;
  }

  /**
   * Change the async function symbol
   */
  static changeAsyncFunctionSymbol(newSymbol: string): void {
    this.asyncFunctionSymbol = newSymbol;
  }

  /**
   * Change the complex function symbol
   */
  static changeComplexFunctionSymbol(newSymbol: string): void {
    this.complexFunctionSymbol = newSymbol;
  }

  /**
   * Get arrow function configuration
   */
  static getArrowFunctionConfig(): { symbol: string } {
    return {
      symbol: this.arrowFunctionSymbol,
    };
  }

  /**
   * Main function to detect and decorate arrow functions
   * Returns: "functionName ✅" if arrow function detected, original text otherwise
   */
  static detectAndDecorate(content: string): string {
    const arrowResult = handleArrowFunctionPattern(content);
    if (arrowResult) {
      return arrowResult;
    }
    return content;
  }

  /**
   * Check if content contains an arrow function
   */
  static isArrowFunction(content: string): boolean {
    const lowerText = content.toLowerCase();
    // Must contain '=>' to be considered an arrow function
    return lowerText.includes('=>');
  }

  /**
   * Check if content contains an async function
   */
  static isAsyncFunction(content: string): boolean {
    const lowerText = content.toLowerCase();
    return (
      (lowerText.includes('async function') ||
        lowerText.includes('async ') ||
        (lowerText.includes('export') && lowerText.includes('async'))) &&
      !lowerText.includes('=>')
    );
  }

  /**
   * Check if content contains a complex function (with React types, generics, etc.)
   */
  static isComplexFunction(content: string): boolean {
    const lowerText = content.toLowerCase();
    return (
      (lowerText.includes('function ') ||
        (lowerText.includes('export') && lowerText.includes('function'))) &&
      (lowerText.includes('react.') ||
        lowerText.includes('svgprops') ||
        lowerText.includes('htmlprops') ||
        (lowerText.includes('<') && lowerText.includes('>'))) &&
      !lowerText.includes('async') &&
      !lowerText.includes('=>')
    );
  }

  /**
   * Get max words allowed
   */
  static getMaxWords(): number {
    return 3;
  }
}

/**
 * Interface for arrow function detection results
 */
export interface ArrowFunctionResult {
  isArrowFunction: boolean;
  functionName?: string;
  originalText: string;
  decoratedText: string;
}

/**
 * Main function to detect and decorate functions (arrow, regular, async, methods)
 * Returns decorated text with appropriate symbol
 */
export function detectAndDecorate(content: string): string {
  // First check for arrow functions
  const arrowResult = handleArrowFunctionPattern(content);
  if (arrowResult) {
    return arrowResult;
  }



  return content;
}

/**
 * Get function symbols for configuration
 */
export function getFunctionSymbols(): {
  arrow: string;
  async: string;
  complex: string;
} {
  return {
    arrow: '❨❩➤',
    async: '⧘⧙',
    complex: '⇄',
  };
}
