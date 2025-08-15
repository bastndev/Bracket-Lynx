class FunctionSymbols {
  private static arrowFunctionSymbol = '❨❩➤';
  private static asyncFunctionSymbol = '⧘⧙';
  private static complexFunctionSymbol = '⇄';

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
 * Internal unified formatter - reduces code duplication
 */
function formatFunctionWithSymbol(words: string[], symbol: string): string {
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
 * Format async function with symbol
 */
export function formatAsyncFunction(words: string[]): string {
  return formatFunctionWithSymbol(words, FunctionSymbols.getAsyncSymbol());
}

/**
 * Format complex function with symbol
 */
export function formatComplexFunction(words: string[]): string {
  return formatFunctionWithSymbol(words, FunctionSymbols.getComplexSymbol());
}

// Legacy classes and interfaces removed - use FunctionSymbols and individual functions instead

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
