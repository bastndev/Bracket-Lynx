// Centralized function symbol management for decorations

// ============================================================================
// 🎯 SYMBOL CONFIGURATION - CHANGE SYMBOLS HERE TO UPDATE ALL DECORATIONS
// ============================================================================
//
// Para cambiar los símbolos de las decoraciones, modifica SOLO estos valores:
// - arrowFunctionSymbol: Para funciones flecha (export const func = () => {})
// - asyncFunctionSymbol: Para funciones async (async function, export async)
// - complexFunctionSymbol: Para funciones complejas (con React types, generics)
//
// Los cambios se aplicarán automáticamente en toda la extensión.
// ============================================================================

/**
 * Function symbols configuration - centralized symbol management
 */
class FunctionSymbols {
  private static arrowFunctionSymbol = '❨❩➤'; // 🏹 Arrow functions
  private static asyncFunctionSymbol = '⧘⧙'; // ⚡ Async functions
  private static complexFunctionSymbol = '⇄'; // 🔄 Complex functions

  /**
   * Get arrow function symbol
   */
  static getArrowSymbol(): string {
    return this.arrowFunctionSymbol;
  }

  /**
   * Get async function symbol
   */
  static getAsyncSymbol(): string {
    return this.asyncFunctionSymbol;
  }

  /**
   * Get complex function symbol
   */
  static getComplexSymbol(): string {
    return this.complexFunctionSymbol;
  }

  /**
   * Get all symbols
   */
  static getAllSymbols(): {
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
   * Change arrow function symbol
   */
  static setArrowSymbol(newSymbol: string): void {
    this.arrowFunctionSymbol = newSymbol;
  }

  /**
   * Change async function symbol
   */
  static setAsyncSymbol(newSymbol: string): void {
    this.asyncFunctionSymbol = newSymbol;
  }

  /**
   * Change complex function symbol
   */
  static setComplexSymbol(newSymbol: string): void {
    this.complexFunctionSymbol = newSymbol;
  }
}

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
    // Reconstructs the string as "export [FunctionName] [SYMBOL]"
    if (words.length >= 3) {
      return `${words[0]} ${words[2]} ${FunctionSymbols.getArrowSymbol()}`;
    }
  }

  return null;
}

/**
 * Format async function with symbol
 */
export function formatAsyncFunction(words: string[]): string {
  const symbol = FunctionSymbols.getAsyncSymbol();

  if (words.length >= 3) {
    // Take first 2 words and add the symbol (removing the last word)
    return `${words.slice(0, 2).join(' ')} ${symbol}`;
  } else if (words.length === 2) {
    // If only 2 words, add the symbol
    return `${words.join(' ')} ${symbol}`;
  } else if (words.length === 1) {
    // If only 1 word, add the symbol
    return `${words[0]} ${symbol}`;
  }

  return words.join(' ');
}

/**
 * Format complex function with symbol
 */
export function formatComplexFunction(words: string[]): string {
  const symbol = FunctionSymbols.getComplexSymbol();

  if (words.length >= 3) {
    // Take first 2 words and add the symbol (removing the last word)
    return `${words.slice(0, 2).join(' ')} ${symbol}`;
  } else if (words.length === 2) {
    // If only 2 words, add the symbol
    return `${words.join(' ')} ${symbol}`;
  } else if (words.length === 1) {
    // If only 1 word, add the symbol
    return `${words[0]} ${symbol}`;
  }

  return words.join(' ');
}

/**
 * ArrowFunctionDecorator class for managing function decorations
 * @deprecated Use FunctionSymbols and individual functions instead
 */
export class ArrowFunctionDecorator {
  /**
   * Get the current arrow function symbol (backward compatibility)
   */
  static getSymbol(): string {
    return FunctionSymbols.getArrowSymbol();
  }

  /**
   * Get the current symbols
   */
  static getSymbols(): {
    arrow: string;
    async: string;
    complex: string;
  } {
    return FunctionSymbols.getAllSymbols();
  }

  /**
   * Change the arrow function symbol
   */
  static changeArrowFunctionSymbol(newSymbol: string): void {
    FunctionSymbols.setArrowSymbol(newSymbol);
  }

  /**
   * Change the async function symbol
   */
  static changeAsyncFunctionSymbol(newSymbol: string): void {
    FunctionSymbols.setAsyncSymbol(newSymbol);
  }

  /**
   * Change the complex function symbol
   */
  static changeComplexFunctionSymbol(newSymbol: string): void {
    FunctionSymbols.setComplexSymbol(newSymbol);
  }

  /**
   * Get arrow function configuration
   */
  static getArrowFunctionConfig(): { symbol: string } {
    return {
      symbol: FunctionSymbols.getArrowSymbol(),
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

// ============================================================================
// PUBLIC API - EXPORTS FOR OTHER MODULES
// ============================================================================

/**
 * Get function symbols for configuration
 */
export function getFunctionSymbols(): {
  arrow: string;
  async: string;
  complex: string;
} {
  return FunctionSymbols.getAllSymbols();
}

/**
 * Get individual symbols
 */
export function getArrowSymbol(): string {
  return FunctionSymbols.getArrowSymbol();
}

export function getAsyncSymbol(): string {
  return FunctionSymbols.getAsyncSymbol();
}

export function getComplexSymbol(): string {
  return FunctionSymbols.getComplexSymbol();
}

/**
 * Change symbols (for configuration)
 */
export function setArrowSymbol(newSymbol: string): void {
  FunctionSymbols.setArrowSymbol(newSymbol);
}

export function setAsyncSymbol(newSymbol: string): void {
  FunctionSymbols.setAsyncSymbol(newSymbol);
}

export function setComplexSymbol(newSymbol: string): void {
  FunctionSymbols.setComplexSymbol(newSymbol);
}

/**
 * Check if content contains an async function
 */
export function isAsyncFunction(content: string): boolean {
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
export function isComplexFunction(content: string): boolean {
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
