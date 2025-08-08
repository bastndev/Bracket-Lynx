// =============== CONSTANTS ===============
const HASH_PREFIX_SYMBOL = '•';

// =============== INTERFACES ===============
export interface PatternDefinition {
  regex: RegExp;
  format: (match: RegExpMatchArray) => string;
}

// =============== CSS PATTERNS & EXTRACTORS ===============

export function getCSSContext(lineText: string, openCharIndex: number): string {
  try {
    const textBefore = lineText.substring(0, openCharIndex).trim();
    if (!textBefore) {
      return '';
    }

    // Remove comments and clean up
    const cleanText = textBefore.replace(/\/\*.*?\*\//g, '').trim();

    // Extract CSS selectors
    const selectors = cleanText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (selectors.length === 0) {
      return '';
    }

    // Process the last selector
    const lastSelector = selectors[selectors.length - 1];
    const selectorParts = lastSelector
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (selectorParts.length === 0) {
      return '';
    }

    // Clean selector parts (remove . # : symbols)
    const cleanedParts = selectorParts
      .map((part) => {
        return part.replace(/^[.#:]+/, '').replace(/:[a-zA-Z-]*$/, '');
      })
      .filter((part) => part.length > 0 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(part));

    if (cleanedParts.length === 0) {
      return '';
    }

    // Show first and last if multiple parts
    if (cleanedParts.length > 2) {
      const firstPart = cleanedParts[0];
      const lastPart = cleanedParts[cleanedParts.length - 1];
      return `${HASH_PREFIX_SYMBOL}${firstPart} ${HASH_PREFIX_SYMBOL}${lastPart}`;
    }
    
    return cleanedParts.map((part) => `${HASH_PREFIX_SYMBOL}${part}`).join(' ');
  } catch (error) {
    console.error('Bracket Lens: Error extracting CSS context:', error);
    return '';
  }
}

// Check if position is inside <style> block
export function isInsideStyleBlock(
  text: string,
  currentPos: number,
  languageId: string
): boolean {
  const supportedLanguages = [
    'html', 'htm', 'astro', 'vue', 'svelte', 'xml', 'php', 'jsp',
    'erb', 'ejs', 'handlebars', 'mustache',
  ];

  if (!supportedLanguages.includes(languageId)) {
    return false;
  }

  const textBefore = text.substring(0, currentPos);
  const textAfter = text.substring(currentPos);

  // Find last opening <style> tag
  const styleOpenRegex = /<style[^>]*>/gi;
  let lastStyleOpen = -1;
  let match;

  while ((match = styleOpenRegex.exec(textBefore)) !== null) {
    lastStyleOpen = match.index + match[0].length;
  }

  if (lastStyleOpen === -1) {
    return false;
  }

  // Check for closing </style> between last opening and current position
  const textBetween = text.substring(lastStyleOpen, currentPos);
  const hasClosingStyle = /<\/style>/i.test(textBetween);

  if (hasClosingStyle) {
    return false;
  }

  const hasClosingStyleAfter = /<\/style>/i.test(textAfter);
  return hasClosingStyleAfter;
}

// =============== JAVASCRIPT/TYPESCRIPT ===============

// Get JS/TS patterns for context extraction
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

// Extract context for JS/TS
export function getJavaScriptContext(
  lineText: string,
  openCharIndex: number,
  text: string,
  openPos: number
): string {
  try {
    if (openCharIndex < 0 || openCharIndex > lineText.length) {
      return '';
    }

    const lines = text.substring(0, openPos).split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];
    
    const textBefore = currentLine.substring(0, openCharIndex).trim();
    
    // Try current line first
    let context = extractFromCurrentLine(textBefore);
    if (context) {
      if (text[openPos] === '(' && isArrowFunctionAfterParen(text, openPos) && !/\(\)\s*=>\s*$/.test(context)) {
        context = `${context} ()=>`;
      }
      return context;
    }

    // Try previous lines
    context = extractFromPreviousLines(lines, currentLineIndex, textBefore);
    if (context) {
      if (text[openPos] === '(' && isArrowFunctionAfterParen(text, openPos) && !/\(\)\s*=>\s*$/.test(context)) {
        context = `${context} ()=>`;
      }
      return context;
    }

    // Try patterns
    const patterns = getJavaScriptPatterns();
    for (const { regex, format } of patterns) {
      const match = textBefore.match(regex);
      if (match) {
        let ctx = format(match);
        if (text[openPos] === '(' && isArrowFunctionAfterParen(text, openPos) && !/\(\)\s*=>\s*$/.test(ctx)) {
          ctx = `${ctx} ()=>`;
        }
        return ctx;
      }
    }

    // Fallback
    let basic = extractBasicContext(textBefore);
    if (basic && text[openPos] === '(' && isArrowFunctionAfterParen(text, openPos) && !/\(\)\s*=>\s*$/.test(basic)) {
      basic = `${basic} ()=>`;
    }
    return basic;
    
  } catch (error) {
    console.error('Bracket Lens: Error extracting JavaScript context:', error);
    return '';
  }
}

// Helper functions for JS/TS context extraction

// Extract context from current line
function extractFromCurrentLine(textBefore: string): string {
  if (!textBefore) {
    return '';
  }

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

  // Object property as arrow function: prop: () => {
  match = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:\([^)]*\)\s*)?=>\s*$/);
  if (match) {
    return `${match[1]} ()=>`;
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

  // Class declaration: class ClassName {
  match = textBefore.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:extends\s+[a-zA-Z_$][a-zA-Z0-9_$]*)?\s*$/);
  if (match) {
    return `class ${match[1]}`;
  }

  // Control statements
  match = textBefore.match(/(if|else\s+if|for|while|switch|try|catch)\s*\([^)]*\)\s*$/);
  if (match) {
    return match[1];
  }

  match = textBefore.match(/(else|finally)\s*$/);
  if (match) {
    return match[1];
  }

  return '';
}

// Look at previous lines for context
function extractFromPreviousLines(lines: string[], currentLineIndex: number, currentTextBefore: string): string {
  for (let i = 1; i <= 3 && currentLineIndex - i >= 0; i++) {
    const prevLine = lines[currentLineIndex - i].trim();
    
    if (!prevLine || prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.endsWith('*/')) {
      continue;
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

    // Valid identifier at line end
    match = prevLine.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
    if (match && !isKeyword(match[1])) {
      return match[1];
    }
  }

  return '';
}

// Basic context extraction as fallback
function extractBasicContext(textBefore: string): string {
  const words = textBefore.split(/\s+/).filter(word => word.length > 0);
  
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    const cleanWord = word.replace(/[^\w$]/g, '');
    
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleanWord) && !isKeyword(cleanWord)) {
      return cleanWord;
    }
  }

  return '';
}

// Check if word is JS keyword
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

// Detect arrow function parameter list
function isArrowFunctionAfterParen(text: string, openPos: number): boolean {
  if (openPos < 0 || openPos >= text.length || text[openPos] !== '(') {
    return false;
  }

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escape = false;

  for (let i = openPos; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (inSingle) {
      if (ch === '\\') { escape = true; }
      else if (ch === '\'') { inSingle = false; }
      continue;
    }

    if (inDouble) {
      if (ch === '\\') { escape = true; }
      else if (ch === '"') { inDouble = false; }
      continue;
    }

    if (inBacktick) {
      if (ch === '\\') { escape = true; }
      else if (ch === '`') { inBacktick = false; }
      continue;
    }

    if (ch === '\'') { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }

    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) {
          j++;
        }
        return text.slice(j, j + 2) === '=>';
      }
    }
  }

  return false;
}

// =============== OTHER LANGUAGES ===============

// Get language-specific context for other languages
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
      // JSON property name
      const jsonMatch = textBefore.match(/"([^"]+)"\s*:\s*$/);
      if (jsonMatch) {
        return jsonMatch[1];
      }
      break;
      
    case 'python':
      // Python functions/classes
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
      // PHP functions
      const phpFuncMatch = textBefore.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*$/);
      if (phpFuncMatch) {
        return `function ${phpFuncMatch[1]}()`;
      }
      break;
      
    case 'java':
    case 'csharp':
      // Java/C# methods
      const javaMethodMatch = textBefore.match(/(?:public|private|protected|static)?\s*(?:\w+\s+)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*$/);
      if (javaMethodMatch) {
        return `${javaMethodMatch[1]}()`;
      }
      break;
  }
  
  // Generic fallback
  const genericMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (genericMatch && !isKeyword(genericMatch[1])) {
    return genericMatch[1];
  }
  
  return '';
}

// =============== MAIN CONTEXT EXTRACTOR ===============

// Main function to get contextual info based on language and bracket type
export function extractContextualInfo(
  text: string,
  openPos: number,
  closePos: number,
  languageId: string,
  lineText: string,
  openCharIndex: number
): string {
  try {
    if (openPos < 0 || closePos >= text.length || openPos >= closePos) {
      return '';
    }

    const openChar = text.charCodeAt(openPos);
    const content = text.substring(openPos + 1, closePos).trim();
    let contextInfo = '';

    if (openChar === '{'.charCodeAt(0)) {
      // CSS or inside <style> block
      const isCSS = ['css', 'scss', 'sass', 'less', 'stylus'].includes(languageId);
      const insideStyle = isInsideStyleBlock(text, openPos, languageId);

      if (isCSS || insideStyle) {
        contextInfo = getCSSContext(lineText, openCharIndex);
      } else {
        contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
      }
    } else if (openChar === '['.charCodeAt(0)) {
      // Arrays and object property access
      contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
      if (!contextInfo) {
        const beforeBracket = lineText.substring(0, openCharIndex).trim();
        const arrayMatch = beforeBracket.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
        if (arrayMatch) {
          contextInfo = `${arrayMatch[1]}[]`;
        }
      }
    } else if (openChar === '('.charCodeAt(0)) {
      // Function calls and parameter lists
      contextInfo = getJavaScriptContext(lineText, openCharIndex, text, openPos);
      if (!contextInfo) {
        const beforeParen = lineText.substring(0, openCharIndex).trim();
        const funcMatch = beforeParen.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
        if (funcMatch) {
          contextInfo = `${funcMatch[1]}()`;
        }
      }
    } else if (openChar === '<'.charCodeAt(0)) {
      // HTML/XML/JSX tags
      let componentContent = content;
      const isClosingTag = componentContent.startsWith('/');

      if (isClosingTag) {
        componentContent = componentContent.substring(1).trim();
      }

      const tagMatch = componentContent.match(/^([a-zA-Z_$][\w$.-]*)/);
      if (tagMatch) {
        contextInfo = tagMatch[1];
      } else {
        const simpleMatch = componentContent.match(/^[a-zA-Z][a-zA-Z0-9]*/);
        contextInfo = simpleMatch ? simpleMatch[0] : '';
      }
    }

    // Try language-specific handling if no context found
    if (!contextInfo && languageId) {
      contextInfo = getLanguageSpecificContext(languageId, lineText, openCharIndex, text, openPos);
    }

    // Cleanup and length limit
    contextInfo = contextInfo.trim();
    if (contextInfo.length > 50) {
      contextInfo = contextInfo.substring(0, 47) + '...';
    }

    return contextInfo;
  } catch (error) {
    console.error('Bracket Lens: Error extracting contextual info:', error);
    return '';
  }
}
