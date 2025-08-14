import { KEYWORDS } from '../../core/config';

const { PROPS_PATTERNS } = KEYWORDS;

/**
 * Checks for JSX/TSX props patterns (e.g., `...props`) and returns a replacement symbol.
 * @param text The text content to analyze.
 * @returns The replacement symbol '❨❩➤' if a pattern is found, otherwise null.
 */
export function handlePropsPattern(text: string): string | null {
  const lowerText = text.toLowerCase();
  const hasProps = PROPS_PATTERNS.some(pattern => 
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