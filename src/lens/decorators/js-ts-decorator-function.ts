import { KEYWORDS } from '../../core/config';

const { PROPS_PATTERNS } = KEYWORDS;

/**
 * Checks for JSX/TSX props patterns (e.g., `...props`) and returns a replacement symbol.
 * @param text The text content to analyze.
 * @returns The replacement symbol '❨❩➤' if a pattern is found, otherwise null.
 */
export function handlePropsPattern(text: string): string | null {
  const lowerText = text.toLowerCase();
  const hasProps = PROPS_PATTERNS.some(
    (pattern) =>
      lowerText.endsWith(pattern) || lowerText.includes(`...${pattern}`)
  );

  if (hasProps) {
    return '➤';
  }

  return null;
}

/**
 * Handles the decoration for exported arrow functions.
 * If the text is an exported arrow function, it removes 'const' and adds a symbol.
 * @param text The text content to analyze.
 * @returns The formatted string or null if it's not an arrow function.
 */
export function handleArrowFunctionPattern(text: string): string | null {
  const lowerText = text.toLowerCase();
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

  /**
   * Get the current arrow function symbol (backward compatibility)
   */
  static getSymbol(): string {
    return this.arrowFunctionSymbol;
  }

  /**
   * Get the current symbols
   */
  static getSymbols(): { arrow: string; async: string } {
    return {
      arrow: this.arrowFunctionSymbol,
      async: this.asyncFunctionSymbol,
    };
  }

  /**
   * Change the arrow function symbol
   */
  static changeArrowFunctionSymbol(newSymbol: string): void {
    this.arrowFunctionSymbol = newSymbol;
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
    return (
      lowerText.includes('=>') ||
      (lowerText.startsWith('export const') && !lowerText.includes('async'))
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

  // Check for props pattern
  const propsResult = handlePropsPattern(content);
  if (propsResult) {
    const words = content.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      return `${words.slice(0, -1).join(' ')} ${propsResult}`;
    }
    return propsResult;
  }

  return content;
}

/**
 * Get function symbols for configuration
 */
export function getFunctionSymbols(): {
  arrow: string;
  async: string;
  props: string;
} {
  return {
    arrow: '❨❩➤',
    async: '⧘⧙',
    props: '➤',
  };
}
