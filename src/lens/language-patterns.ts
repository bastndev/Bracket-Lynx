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
 * Enhanced version that looks at multiple lines and context patterns
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

    // Get document position for multi-line context
    const lines = text.substring(0, openPos).split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];
    
    // Get text before the bracket on current line
    const textBefore = currentLine.substring(0, openCharIndex).trim();
    
    // Try extracting context from current line first
    let context = extractFromCurrentLine(textBefore);
    if (context) {
      return context;
    }

    // If current line doesn't have context, look at previous lines
    context = extractFromPreviousLines(lines, currentLineIndex, textBefore);
    if (context) {
      return context;
    }

    // Try getting patterns
    const patterns = getJavaScriptPatterns();
    for (const { regex, format } of patterns) {
      const match = textBefore.match(regex);
      if (match) {
        return format(match);
      }
    }

    // Fallback to basic extraction
    return extractBasicContext(textBefore);
    
  } catch (error) {
    console.error('Bracket Lens: Error extracting JavaScript context:', error);
    return '';
  }
}

/**
 * Extract context from current line
 */
function extractFromCurrentLine(textBefore: string): string {
  if (!textBefore) {
    return '';
  }

  // Handle specific patterns
  
  // Function declarations: function name() {
  let match = textBefore.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/);
  if (match) {
    return `function ${match[1]}()`;
  }

  // Arrow functions: const name = () => {
  match = textBefore.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*)?=>\s*$/);
  if (match) {
    return `${match[1]} ()=>`;
  }

  // Object method: methodName() {
  match = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/);
  if (match) {
    return `${match[1]}()`;
  }

  // Object property: propertyName: {
  match = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*$/);
  if (match) {
    return match[1];
  }

  // Object assignment: name = {
  match = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/);
  if (match) {
    return match[1];
  }

  // React component prop: <Component prop={
  match = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/);
  if (match) {
    return match[1];
  }

  // Class declaration: class ClassName {
  match = textBefore.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:extends\s+[a-zA-Z_$][a-zA-Z0-9_$]*)?\s*$/);
  if (match) {
    return `class ${match[1]}`;
  }

  // If/else/for/while statements
  match = textBefore.match(/(if|else\s+if|for|while|switch|try|catch)\s*\([^)]*\)\s*$/);
  if (match) {
    return match[1];
  }

  match = textBefore.match(/(else|finally)\s*$/);
  if (match) {
    return match[1];
  }

  // Export statements
  if (textBefore.includes('export default')) {
    match = textBefore.match(/export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
    if (match) {
      return `export default ${match[1]}`;
    }
    return 'export default';
  }

  match = textBefore.match(/export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
  if (match) {
    return `export ${match[1]}`;
  }

  return '';
}

/**
 * Look at previous lines for context
 */
function extractFromPreviousLines(lines: string[], currentLineIndex: number, currentTextBefore: string): string {
  // Look at up to 3 previous lines
  for (let i = 1; i <= 3 && currentLineIndex - i >= 0; i++) {
    const prevLine = lines[currentLineIndex - i].trim();
    
    if (!prevLine || prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.endsWith('*/')) {
      continue; // Skip empty lines and comments
    }

    // Function declarations
    let match = prevLine.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/);
    if (match) {
      return `function ${match[1]}()`;
    }

    // Arrow function assignments
    match = prevLine.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*)?=>/);
    if (match) {
      return `${match[1]} ()=>`;
    }

    // Class declarations
    match = prevLine.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (match) {
      return `class ${match[1]}`;
    }

    // Object property/method on previous line
    match = prevLine.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]/);
    if (match) {
      return match[1];
    }

    // React component definitions
    match = prevLine.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/);
    if (match) {
      return `${match[1]} component`;
    }

    // If this previous line ends with a valid identifier, use it
    match = prevLine.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
    if (match && !isKeyword(match[1])) {
      return match[1];
    }
  }

  return '';
}

/**
 * Basic context extraction as fallback
 */
function extractBasicContext(textBefore: string): string {
  // Last resort - find any meaningful identifier
  const words = textBefore.split(/\s+/).filter(word => word.length > 0);
  
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    
    // Clean the word of punctuation
    const cleanWord = word.replace(/[^\w$]/g, '');
    
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleanWord) && !isKeyword(cleanWord)) {
      return cleanWord;
    }
  }

  return '';
}

/**
 * Check if a word is a JavaScript keyword
 */
function isKeyword(word: string): boolean {
  const keywords = [
    'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'default', 'break', 'continue', 'return', 'function', 'class', 'import', 'export',
    'from', 'as', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new',
    'this', 'super', 'extends', 'implements', 'interface', 'type', 'enum',
    'public', 'private', 'protected', 'static', 'readonly', 'abstract'
  ];
  
  return keywords.includes(word.toLowerCase());
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
      // For arrays and object property access
      contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
      if (!contextInfo) {
        // Try to identify array context
        const beforeBracket = lineText.substring(0, openCharIndex).trim();
        const arrayMatch = beforeBracket.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
        if (arrayMatch) {
          contextInfo = `${arrayMatch[1]}[]`;
        }
      }
    } else if (openChar === '('.charCodeAt(0)) {
      // For function calls and parameter lists
      contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
      if (!contextInfo) {
        // Try to identify function context
        const beforeParen = lineText.substring(0, openCharIndex).trim();
        const funcMatch = beforeParen.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
        if (funcMatch) {
          contextInfo = `${funcMatch[1]}()`;
        }
      }
    } else if (openChar === '<'.charCodeAt(0)) {
      // For HTML/XML/JSX tags
      let componentContent = content;
      const isClosingTag = componentContent.startsWith('/');

      if (isClosingTag) {
        componentContent = componentContent.substring(1).trim();
      }

      // Extract tag name or component name
      const tagMatch = componentContent.match(/^([a-zA-Z_$][\w$.-]*)/);
      if (tagMatch) {
        contextInfo = tagMatch[1];
      } else {
        // Fallback for malformed tags
        const simpleMatch = componentContent.match(/^[a-zA-Z][a-zA-Z0-9]*/);
        contextInfo = simpleMatch ? simpleMatch[0] : '';
      }
    }

    // Additional language-specific handling
    if (!contextInfo && languageId) {
      contextInfo = getLanguageSpecificContext(languageId, lineText, openCharIndex, text, openPos);
    }

    // Final cleanup
    contextInfo = contextInfo.trim();
    
    // Ensure we don't return overly long context
    if (contextInfo.length > 50) {
      contextInfo = contextInfo.substring(0, 47) + '...';
    }

    return contextInfo;
  } catch (error) {
    console.error('Bracket Lens: Error extracting contextual info:', error);
    return '';
  }
}

/**
 * Get language-specific context for languages not yet handled
 */
function getLanguageSpecificContext(
  languageId: string,
  lineText: string,
  openCharIndex: number,
  text: string,
  openPos: number
): string {
  const textBefore = lineText.substring(0, openCharIndex).trim();
  
  switch (languageId) {
    case 'json':
    case 'jsonc':
      // For JSON, try to get the property name
      const jsonMatch = textBefore.match(/"([^"]+)"\s*:\s*$/);
      if (jsonMatch) {
        return jsonMatch[1];
      }
      break;
      
    case 'python':
      // For Python, look for function/class definitions
      const pythonFuncMatch = textBefore.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*:\s*$/);
      if (pythonFuncMatch) {
        return `def ${pythonFuncMatch[1]}()`;
      }
      const pythonClassMatch = textBefore.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (pythonClassMatch) {
        return `class ${pythonClassMatch[1]}`;
      }
      break;
      
    case 'php':
      // For PHP, look for function/class definitions
      const phpFuncMatch = textBefore.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*$/);
      if (phpFuncMatch) {
        return `function ${phpFuncMatch[1]}()`;
      }
      break;
      
    case 'java':
    case 'csharp':
      // For Java/C#, look for method/class definitions
      const javaMethodMatch = textBefore.match(/(?:public|private|protected|static)?\s*(?:\w+\s+)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*$/);
      if (javaMethodMatch) {
        return `${javaMethodMatch[1]}()`;
      }
      break;
  }
  
  // Generic fallback - try to find any identifier
  const genericMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (genericMatch && !isKeyword(genericMatch[1])) {
    return genericMatch[1];
  }
  
  return '';
}
