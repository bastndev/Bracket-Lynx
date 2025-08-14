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