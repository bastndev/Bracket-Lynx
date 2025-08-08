// ===== LANGUAGE PATTERNS FOR BRACKET LENS =====
// This file contains all language-specific patterns and context extractors

// ===== CONSTANTS =====
const HASH_PREFIX_SYMBOL = '•'; // Symbol used for context display

// ===== INTERFACES =====
export interface PatternDefinition {
  regex: RegExp;
  format: (match: RegExpMatchArray) => string;
}

// ===== CSS PATTERNS & EXTRACTORS =====
export function getCSSContext(lineText: string, openCharIndex: number): string {
  try {
    const textBefore = lineText.substring(0, openCharIndex).trim();

    if (!textBefore) {
      return '';
    }

    // Remove comments and clean up the text
    const cleanText = textBefore.replace(/\/\*.*?\*\//g, '').trim();

    // Extract CSS selectors - handle multiple selectors separated by commas
    const selectors = cleanText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (selectors.length === 0) {
      return '';
    }

    // Process the last selector (the one closest to the opening brace)
    const lastSelector = selectors[selectors.length - 1];

    // Split by spaces to get individual selector parts in order
    const selectorParts = lastSelector
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (selectorParts.length === 0) {
      return '';
    }

    // Clean each selector part (remove . # : symbols)
    const cleanedParts = selectorParts
      .map((part) => {
        // Remove CSS selector symbols but keep the name
        return part.replace(/^[.#:]+/, '').replace(/:[a-zA-Z-]*$/, '');
      })
      .filter((part) => part.length > 0 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(part));

    if (cleanedParts.length === 0) {
      return '';
    }

    // If we have multiple parts, show only first and last
    if (cleanedParts.length > 2) {
      const firstPart = cleanedParts[0];
      const lastPart = cleanedParts[cleanedParts.length - 1];
      return `${HASH_PREFIX_SYMBOL}${firstPart} ${HASH_PREFIX_SYMBOL}${lastPart}`;
    } else {
      // If we have 1 or 2 parts, show them all
      return cleanedParts.map((part) => `${HASH_PREFIX_SYMBOL}${part}`).join(' ');
    }
  } catch (error) {
    console.error('Bracket Lens: Error extracting CSS context:', error);
    return '';
  }
}

/**
 * Check if current position is inside a <style> block in HTML/template files
 */
export function isInsideStyleBlock(
  text: string,
  currentPos: number,
  languageId: string
): boolean {
  const supportedLanguages = [
    'html',
    'htm',
    'astro',
    'vue',
    'svelte',
    'xml',
    'php',
    'jsp',
    'erb',
    'ejs',
    'handlebars',
    'mustache',
  ];

  if (!supportedLanguages.includes(languageId)) {
    return false;
  }

  // Get text before current position
  const textBefore = text.substring(0, currentPos);
  const textAfter = text.substring(currentPos);

  // Find the last opening <style> tag before current position
  const styleOpenRegex = /<style[^>]*>/gi;
  let lastStyleOpen = -1;
  let match;

  while ((match = styleOpenRegex.exec(textBefore)) !== null) {
    lastStyleOpen = match.index + match[0].length;
  }

  // If no <style> tag found before current position, we're not in a style block
  if (lastStyleOpen === -1) {
    return false;
  }

  // Check if there's a closing </style> tag between the last opening and current position
  const textBetween = text.substring(lastStyleOpen, currentPos);
  const hasClosingStyle = /<\/style>/i.test(textBetween);

  // If there's a closing tag between, we're not in a style block
  if (hasClosingStyle) {
    return false;
  }

  // Check if there's a closing </style> tag after current position
  const hasClosingStyleAfter = /<\/style>/i.test(textAfter);
  
  return hasClosingStyleAfter;
}

// ===== JAVASCRIPT/TYPESCRIPT PATTERNS =====

/**
 * Get JavaScript/TypeScript patterns for context extraction
 * These patterns detect various JS/TS constructs like functions, classes, etc.
 */
export function getJavaScriptPatterns(): PatternDefinition[] {
  return [
    // ComponentName: ({ ...props }) => (
    {
      regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/,
      format: (m: RegExpMatchArray) => `${m[1]} ()=>`,
    },
    // export const ObjectName = {
    {
      regex: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/,
      format: (m: RegExpMatchArray) => `export ${m[1]}`,
    },
    // export const ComponentName = ({ ...props }) => (
    {
      regex: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/,
      format: (m: RegExpMatchArray) => `${m[1]} ()=>`,
    },
    // const ComponentName = ({ ...props }) => (
    {
      regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/,
      format: (m: RegExpMatchArray) => `${m[1]} ()=>`,
    },
    // const ObjectName = {
    {
      regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/,
      format: (m: RegExpMatchArray) => m[1],
    },
    // export function FunctionName
    {
      regex: /export\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      format: (m: RegExpMatchArray) => m[1],
    },
    // function FunctionName
    {
      regex: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      format: (m: RegExpMatchArray) => m[1],
    },
    // export default
    {
      regex: /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      format: (m: RegExpMatchArray) => m[1],
    },
    // class ClassName
    {
      regex: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      format: (m: RegExpMatchArray) => `class ${m[1]}`,
    },
    // constructor(props)
    {
      regex: /constructor\s*\(/,
      format: () => 'constructor',
    },
    // render() or handleChange = or any method
    {
      regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=(]/,
      format: (m: RegExpMatchArray) => m[1],
    },
  ];
}

/**
 * Extract context before opening bracket for JavaScript/TypeScript
 */
export function getJavaScriptContext(
  lineText: string,
  openCharIndex: number,
  text: string,
  openPos: number
): string {
  try {
    // Safety checks
    if (openCharIndex < 0 || openCharIndex > lineText.length) {
      return '';
    }

    const textBefore = lineText.substring(0, openCharIndex).trim();

    if (!textBefore) {
      return '';
    }

    // Get patterns and test them
    const patterns = getJavaScriptPatterns();
    for (const { regex, format } of patterns) {
      const match = textBefore.match(regex);
      if (match) {
        return format(match);
      }
    }

    // Handle export default without identifier
    if (textBefore.includes('export default')) {
      return 'export default';
    }

    const hasArrow = textBefore.includes('=>');

    // Enhanced fallback - try to get meaningful context

    // Look for any identifier before the opening bracket
    const identifierMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
    if (identifierMatch) {
      const identifier = identifierMatch[1];
      const skipKeywords = [
        'const',
        'let',
        'var',
        'if',
        'for',
        'while',
        'import',
        'from',
        'return',
      ];

      if (!skipKeywords.includes(identifier)) {
        return hasArrow ? `${identifier} ()=>` : identifier;
      }
    }

    // Look for patterns like "= {" or "=> {"
    if (textBefore.includes('=')) {
      const beforeEquals = textBefore.split('=')[0].trim();
      const lastWordMatch = beforeEquals.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
      if (lastWordMatch) {
        return lastWordMatch[1];
      }
    }

    // Look for method-like patterns
    const methodMatch = textBefore.match(
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/
    );
    if (methodMatch) {
      return methodMatch[1];
    }

    // Last resort - any word that looks like an identifier
    const words = textBefore.split(/\s+/).filter((word) => word.length > 0);
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word)) {
        const skipKeywords = [
          'const',
          'let',
          'var',
          'if',
          'for',
          'while',
          'import',
          'from',
          'return',
          'this',
        ];
        if (!skipKeywords.includes(word)) {
          return hasArrow ? `${word} ()=>` : word;
        }
      }
    }

    return hasArrow ? '()=>' : '';
  } catch (error) {
    console.error(
      'Bracket Lens: Error extracting JavaScript context:',
      error
    );
    return '';
  }
}

// ===== FUTURE LANGUAGE EXTENSIONS =====
// Add more language patterns here as needed:

// ===== PYTHON PATTERNS ===== (Future)
// export function getPythonPatterns(): PatternDefinition[] { ... }
// export function getPythonContext(...): string { ... }

// ===== RUST PATTERNS ===== (Future)  
// export function getRustPatterns(): PatternDefinition[] { ... }
// export function getRustContext(...): string { ... }

// ===== GO PATTERNS ===== (Future)
// export function getGoPatterns(): PatternDefinition[] { ... }
// export function getGoContext(...): string { ... }

// ===== MAIN CONTEXT EXTRACTOR =====

/**
 * Main function to get contextual information based on language and bracket type
 * This is the primary entry point used by lens.ts
 */
export function extractContextualInfo(
  text: string,
  openPos: number,
  closePos: number,
  languageId: string,
  lineText: string,
  openCharIndex: number
): string {
  try {
    // Safety checks
    if (openPos < 0 || closePos >= text.length || openPos >= closePos) {
      return '';
    }

    const openChar = text.charCodeAt(openPos);
    const content = text.substring(openPos + 1, closePos).trim();

    let contextInfo = '';

    if (openChar === '{'.charCodeAt(0)) {
      // Check if this is a CSS file or inside a <style> block
      const isCSS = ['css', 'scss', 'sass', 'less', 'stylus'].includes(languageId);
      const insideStyle = isInsideStyleBlock(text, openPos, languageId);

      if (isCSS || insideStyle) {
        contextInfo = getCSSContext(lineText, openCharIndex);
      } else {
        // JavaScript/TypeScript context
        contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
      }
    } else if (openChar === '['.charCodeAt(0)) {
      contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
    } else if (openChar === '('.charCodeAt(0)) {
      contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
    } else if (openChar === '<'.charCodeAt(0)) {
      let componentContent = content;
      const isClosingTag = componentContent.startsWith('/');

      if (isClosingTag) {
        componentContent = componentContent.substring(1).trim();
      }

      const jsxComponentMatch = componentContent.match(/^[a-zA-Z_$][\w$.]*/);
      contextInfo = jsxComponentMatch ? jsxComponentMatch[0] : '';
    }

    return contextInfo;
  } catch (error) {
    console.error('Bracket Lens: Error extracting contextual info:', error);
    return '';
  }
}