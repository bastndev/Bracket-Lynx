import * as vscode from 'vscode';

// =============== LANGUAGE PATTERNS CONSTANTS ===============
const HASH_PREFIX_SYMBOL = '•';

// =============== LANGUAGE PATTERNS INTERFACES ===============
export interface PatternDefinition {
  regex: RegExp;
  format: (match: RegExpMatchArray) => string;
}

// =============== CSS PATTERNS & EXTRACTORS ===============

export function getCSSContext(lineText: string, openCharIndex: number, text?: string, openPos?: number): string {
  try {
    const textBefore = lineText.substring(0, openCharIndex).trim();
    
    // If we have context from the current line, use it
    if (textBefore) {
      const contextFromCurrentLine = extractCSSSelectorsFromText(textBefore);
      if (contextFromCurrentLine) {
        return contextFromCurrentLine;
      }
    }

    // If no context from current line and we have full text, search previous lines
    if (text && openPos !== undefined) {
      const contextFromPreviousLines = searchCSSContextInPreviousLines(text, openPos);
      if (contextFromPreviousLines) {
        return contextFromPreviousLines;
      }
    }

    return '';
  } catch (error) {
    console.error('Bracket Lens: Error extracting CSS context:', error);
    return '';
  }
}

function extractCSSSelectorsFromText(textBefore: string): string {
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

  // Process all selectors and extract meaningful names
  const allCleanedParts: string[] = [];

  for (const selector of selectors) {
    const selectorParts = selector
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    // Clean selector parts (remove . # : symbols but keep track of what they were)
    const cleanedParts = selectorParts
      .map((part) => {
        // Extract the actual name without prefixes and suffixes
        const cleaned = part
          .replace(/^[.#:]+/, '')
          .replace(/:[a-zA-Z-]*$/, '');
        return cleaned;
      })
      .filter(
        (part) => part.length > 0 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(part)
      );

    // Add the most relevant part from this selector
    if (cleanedParts.length > 0) {
      // Prefer the last part (most specific) from each selector
      const mostRelevant = cleanedParts[cleanedParts.length - 1];
      if (!allCleanedParts.includes(mostRelevant)) {
        allCleanedParts.push(mostRelevant);
      }
    }
  }

  if (allCleanedParts.length === 0) {
    return '';
  }

  // Format the output based on how many unique parts we found
  if (allCleanedParts.length === 1) {
    return `${HASH_PREFIX_SYMBOL}${allCleanedParts[0]}`;
  } else if (allCleanedParts.length === 2) {
    // Show both parts - this handles the case like ".Banner, #banner" -> "Banner banner"
    return `${HASH_PREFIX_SYMBOL}${allCleanedParts[0]} ${HASH_PREFIX_SYMBOL}${allCleanedParts[1]}`;
  } else {
    // For more than 2, show first and last with indication of more
    const first = allCleanedParts[0];
    const last = allCleanedParts[allCleanedParts.length - 1];
    return `${HASH_PREFIX_SYMBOL}${first} ${HASH_PREFIX_SYMBOL}${last}`;
  }
}

function searchCSSContextInPreviousLines(text: string, openPos: number): string {
  const lines = text.substring(0, openPos).split('\n');
  const currentLineIndex = lines.length - 1;
  
  // Search up to 5 lines back for CSS selectors
  for (let i = 1; i <= 5 && currentLineIndex - i >= 0; i++) {
    const prevLine = lines[currentLineIndex - i].trim();
    
    // Skip empty lines and comments
    if (!prevLine || prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.endsWith('*/')) {
      continue;
    }
    
    // Look for CSS selectors that might end with { or be followed by {
    let lineToCheck = prevLine;
    
    // Remove trailing { if present
    if (lineToCheck.endsWith('{')) {
      lineToCheck = lineToCheck.slice(0, -1).trim();
    }
    
    // Check if this line contains CSS selectors
    if (containsCSSSelectors(lineToCheck)) {
      const context = extractCSSSelectorsFromText(lineToCheck);
      if (context) {
        return context;
      }
    }
    
    // Also check if we can combine this line with the next line
    // This handles cases where selector is on one line and { is on the next
    if (currentLineIndex - i + 1 < lines.length) {
      const nextLine = lines[currentLineIndex - i + 1].trim();
      if (nextLine === '{' || nextLine.startsWith('{')) {
        const context = extractCSSSelectorsFromText(lineToCheck);
        if (context) {
          return context;
        }
      }
    }
  }
  
  return '';
}

function containsCSSSelectors(line: string): boolean {
  // Check for common CSS selector patterns
  const cssPatterns = [
    /\.[a-zA-Z][a-zA-Z0-9_-]*/, // Class selectors (.class-name)
    /#[a-zA-Z][a-zA-Z0-9_-]*/, // ID selectors (#id-name)
    /^[a-zA-Z][a-zA-Z0-9]*$/, // Element selectors (div, span, etc.)
    /:[a-zA-Z-]+/, // Pseudo selectors (:hover, :focus, etc.)
    /\[[^\]]+\]/, // Attribute selectors ([type="text"])
    /[a-zA-Z][a-zA-Z0-9_-]*\s*,/, // Multiple selectors (selector1, selector2)
  ];
  
  return cssPatterns.some(pattern => pattern.test(line));
}

// Check if position is inside <style> block
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
      if (
        text[openPos] === '(' &&
        isArrowFunctionAfterParen(text, openPos) &&
        !/\(\)\s*=>\s*$/.test(context)
      ) {
        context = `${context} ()=>`;
      }
      return context;
    }

    // Try previous lines
    context = extractFromPreviousLines(lines, currentLineIndex, textBefore);
    if (context) {
      if (
        text[openPos] === '(' &&
        isArrowFunctionAfterParen(text, openPos) &&
        !/\(\)\s*=>\s*$/.test(context)
      ) {
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
        if (
          text[openPos] === '(' &&
          isArrowFunctionAfterParen(text, openPos) &&
          !/\(\)\s*=>\s*$/.test(ctx)
        ) {
          ctx = `${ctx} ()=>`;
        }
        return ctx;
      }
    }

    // Fallback
    let basic = extractBasicContext(textBefore);
    if (
      basic &&
      text[openPos] === '(' &&
      isArrowFunctionAfterParen(text, openPos) &&
      !/\(\)\s*=>\s*$/.test(basic)
    ) {
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
  let match = textBefore.match(
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/
  );
  if (match) {
    return `function ${match[1]} {}`;
  }

  // Arrow functions: const name = () => {
  match = textBefore.match(
    /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*)?=>\s*$/
  );
  if (match) {
    return `${match[1]} ()=>`;
  }

  // Object property as arrow function: prop: () => {
  match = textBefore.match(
    /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:\([^)]*\)\s*)?=>\s*$/
  );
  if (match) {
    return `${match[1]} ()=>`;
  }

  // Export statements
  if (textBefore.includes('export default')) {
    match = textBefore.match(
      /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/
    );
    if (match) {
      return `export default ${match[1]}`;
    }
    return 'export default';
  }

  match = textBefore.match(
    /export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
  );
  if (match) {
    return `export ${match[1]}`;
  }

  // Object method: methodName() {
  match = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/);
  if (match) {
    return `${match[1]} {}`;
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
  match = textBefore.match(
    /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:extends\s+[a-zA-Z_$][a-zA-Z0-9_$]*)?\s*$/
  );
  if (match) {
    return `class ${match[1]}`;
  }

  // Control statements
  match = textBefore.match(
    /(if|else\s+if|for|while|switch|try|catch)\s*\([^)]*\)\s*$/
  );
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
function extractFromPreviousLines(
  lines: string[],
  currentLineIndex: number,
  currentTextBefore: string
): string {
  for (let i = 1; i <= 3 && currentLineIndex - i >= 0; i++) {
    const prevLine = lines[currentLineIndex - i].trim();

    if (
      !prevLine ||
      prevLine.startsWith('//') ||
      prevLine.startsWith('/*') ||
      prevLine.endsWith('*/')
    ) {
      continue;
    }

    // Function declarations
    let match = prevLine.match(
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/
    );
    if (match) {
      return `function ${match[1]} {}`;
    }

    // Arrow function assignments
    match = prevLine.match(
      /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*)?=>/
    );
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
    match = prevLine.match(
      /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/
    );
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
  const words = textBefore.split(/\s+/).filter((word) => word.length > 0);

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
    'const',
    'let',
    'var',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'default',
    'break',
    'continue',
    'return',
    'function',
    'class',
    'import',
    'export',
    'from',
    'as',
    'async',
    'await',
    'try',
    'catch',
    'finally',
    'throw',
    'new',
    'this',
    'super',
    'extends',
    'implements',
    'interface',
    'type',
    'enum',
    'public',
    'private',
    'protected',
    'static',
    'readonly',
    'abstract',
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
      if (ch === '\\') {
        escape = true;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inBacktick) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === '`') {
        inBacktick = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inBacktick = true;
      continue;
    }

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
      const pythonFuncMatch = textBefore.match(
        /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*:\s*$/
      );
      if (pythonFuncMatch) {
        return `def ${pythonFuncMatch[1]}()`;
      }
      const pythonClassMatch = textBefore.match(
        /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/
      );
      if (pythonClassMatch) {
        return `class ${pythonClassMatch[1]}`;
      }
      break;

    case 'php':
      // PHP functions
      const phpFuncMatch = textBefore.match(
        /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*$/
      );
      if (phpFuncMatch) {
        return `function ${phpFuncMatch[1]}()`;
      }
      break;

    case 'java':
    case 'csharp':
      // Java/C# methods
      const javaMethodMatch = textBefore.match(
        /(?:public|private|protected|static)?\s*(?:\w+\s+)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*$/
      );
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

/*
 * TODO: FUTURE LANGUAGE EXTENSIONS: Add more language patterns here as needed
 */

// =============== MARK: ASTRO =============== (build)


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
      const isCSS = ['css', 'scss', 'sass', 'less', 'stylus'].includes(
        languageId
      );
      const insideStyle = isInsideStyleBlock(text, openPos, languageId);

      if (isCSS || insideStyle) {
        contextInfo = getCSSContext(lineText, openCharIndex, text, openPos);
      } else {
        contextInfo = getJavaScriptContext(
          lineText,
          openCharIndex,
          text,
          openPos
        );
      }
    } else if (openChar === '['.charCodeAt(0)) {
      // Arrays and object property access
      contextInfo = getJavaScriptContext(
        lineText,
        openCharIndex,
        text,
        openPos
      );
      if (!contextInfo) {
        const beforeBracket = lineText.substring(0, openCharIndex).trim();
        const arrayMatch = beforeBracket.match(
          /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/
        );
        if (arrayMatch) {
          contextInfo = `${arrayMatch[1]}[]`;
        }
      }
    } else if (openChar === '('.charCodeAt(0)) {
      // Function calls and parameter lists
      contextInfo = getJavaScriptContext(
        lineText,
        openCharIndex,
        text,
        openPos
      );
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
      contextInfo = getLanguageSpecificContext(
        languageId,
        lineText,
        openCharIndex,
        text,
        openPos
      );
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

// ===== CONSTANTS =====
const DEBOUNCE_DELAY = 300;
const HASH_PREFIX = '<~ #';

const MIN_TOTAL_LINES_FOR_CURLY_DECORATION = 4; // Minimum number of lines
const MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION = 7; // Minimum number of lines in  tags HTML/XML

// Cache configuration
const PARSE_CACHE_INTERVAL = 100; // Cache state every 100 characters
const PARSE_CACHE_MAX_AGE = 2 * 60 * 1000; // 2 minutes
const CACHE_MAX_SIZE = 50; // Maximum 50 files in cache
const DECORATION_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const INCREMENTAL_CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

// ===== INTERFACES & TYPES =====
interface BracketPair {
  open: number;
  close: number;
}

interface BracketCharPair {
  open: number;
  close: number;
}

interface StackItem {
  char: number;
  pos: number;
}

interface ParseState {
  position: number;
  inString: boolean;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inTemplateString: boolean;
  inBlockComment: boolean;
  inLineComment: boolean;
}

interface TextParseCache {
  textHash: string;
  states: ParseState[];
  timestamp: number;
}

interface CacheEntry {
  textHash: string;
  brackets: BracketPair[];
  decorations: vscode.DecorationOptions[];
  timestamp: number;
}

interface IncrementalCache {
  textHash: string;
  brackets: BracketPair[];
  lineCount: number;
  timestamp: number;
}

interface ChangeRegion {
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

// ===== GLOBAL VARIABLES =====
const bracketPairs: BracketCharPair[] = [
  { open: '{'.charCodeAt(0), close: '}'.charCodeAt(0) },
  { open: '['.charCodeAt(0), close: ']'.charCodeAt(0) },
  { open: '('.charCodeAt(0), close: ')'.charCodeAt(0) },
  { open: '<'.charCodeAt(0), close: '>'.charCodeAt(0) },
];

// Cache maps
const parseStateCache = new Map<string, TextParseCache>();
const decorationCache = new Map<string, CacheEntry>();
const incrementalCache = new Map<string, IncrementalCache>();

// Global state
let decorationType: vscode.TextEditorDecorationType | undefined;
let throttleTimer: NodeJS.Timeout | undefined;

// ===== UTILITY FUNCTIONS =====

/**
 * Generate a simple hash for text content
 */
function generateTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

function createDecorationStyle(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    after: {
      color: '#515151',
      margin: '0 0 0 1ch',
      fontStyle: 'italic',
      // fontWeight: 'bold',
    },
  });
}

function formatLineRange(
  startLine: number,
  endLine: number,
  contextInfo: string = ''
): string {
  const baseRange = `${HASH_PREFIX}${startLine}-${endLine}`;

  // Clean and validate contextInfo
  const cleanContextInfo = contextInfo.trim();

  if (cleanContextInfo) {
    // Check if contextInfo already starts with the bullet symbol (for CSS)
    if (cleanContextInfo.startsWith(HASH_PREFIX_SYMBOL)) {
      return `${baseRange} ${cleanContextInfo}`;
    } else {
      return `${baseRange} ${HASH_PREFIX_SYMBOL}${cleanContextInfo}`;
    }
  }

  // Return just the range if no context info
  return baseRange;
}

// ===== CACHE MANAGEMENT FUNCTIONS =====

/**
 * Get cached decorations if available and valid
 */
function getCachedDecorations(
  editor: vscode.TextEditor
): vscode.DecorationOptions[] | null {
  try {
    const document = editor.document;
    const fileUri = document.uri.toString();
    const text = document.getText();
    const textHash = generateTextHash(text);

    const cached = decorationCache.get(fileUri);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > DECORATION_CACHE_MAX_AGE) {
      decorationCache.delete(fileUri);
      return null;
    }

    // Check if text content has changed
    if (cached.textHash !== textHash) {
      decorationCache.delete(fileUri);
      return null;
    }

    // Move to end for LRU (delete and re-add)
    decorationCache.delete(fileUri);
    decorationCache.set(fileUri, cached);

    return cached.decorations;
  } catch (error) {
    console.error('Bracket Lens: Error getting cached decorations:', error);
    return null;
  }
}

/**
 * Cache decorations for future use with LRU eviction
 */
function cacheDecorations(
  editor: vscode.TextEditor,
  brackets: BracketPair[],
  decorations: vscode.DecorationOptions[]
): void {
  try {
    const document = editor.document;
    const fileUri = document.uri.toString();
    const text = document.getText();
    const textHash = generateTextHash(text);

    // Implement LRU cache - remove oldest entries if cache is full
    if (decorationCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = decorationCache.keys().next().value;
      if (oldestKey) {
        decorationCache.delete(oldestKey);
        console.log(
          `Bracket Lens: Evicted decoration cache entry for ${oldestKey}`
        );
      }
    }

    decorationCache.set(fileUri, {
      textHash,
      brackets,
      decorations,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Bracket Lens: Error caching decorations:', error);
  }
}

/**
 * Clear cache for a specific file
 */
function clearFileCache(fileUri: string): void {
  decorationCache.delete(fileUri);
  parseStateCache.delete(fileUri); // Also clear parsing state cache
  incrementalCache.delete(fileUri); // Also clear incremental cache
}

/**
 * Clear old cache entries and enforce size limits
 */
function cleanupCache(): void {
  try {
    const now = Date.now();
    const decorationEntriesToDelete: string[] = [];
    const parseEntriesToDelete: string[] = [];

    // Find expired decoration cache entries
    for (const [fileUri, entry] of decorationCache) {
      if (now - entry.timestamp > DECORATION_CACHE_MAX_AGE) {
        decorationEntriesToDelete.push(fileUri);
      }
    }

    // Find expired parse cache entries
    for (const [fileUri, entry] of parseStateCache) {
      if (now - entry.timestamp > PARSE_CACHE_MAX_AGE) {
        parseEntriesToDelete.push(fileUri);
      }
    }

    // Find expired incremental cache entries
    const incrementalEntriesToDelete: string[] = [];
    for (const [fileUri, entry] of incrementalCache) {
      if (now - entry.timestamp > INCREMENTAL_CACHE_MAX_AGE) {
        incrementalEntriesToDelete.push(fileUri);
      }
    }

    // Delete expired decoration entries
    decorationEntriesToDelete.forEach((fileUri) => {
      decorationCache.delete(fileUri);
    });

    // Delete expired parse entries
    parseEntriesToDelete.forEach((fileUri) => {
      parseStateCache.delete(fileUri);
    });

    // Delete expired incremental entries
    incrementalEntriesToDelete.forEach((fileUri) => {
      incrementalCache.delete(fileUri);
    });

    // Enforce size limit for decoration cache
    while (decorationCache.size > CACHE_MAX_SIZE) {
      const oldestKey = decorationCache.keys().next().value;
      if (oldestKey) {
        decorationCache.delete(oldestKey);
      } else {
        break; // Safety break
      }
    }

    // Enforce size limit for parse cache
    while (parseStateCache.size > CACHE_MAX_SIZE) {
      const oldestKey = parseStateCache.keys().next().value;
      if (oldestKey) {
        parseStateCache.delete(oldestKey);
      } else {
        break; // Safety break
      }
    }

    // Enforce size limit for incremental cache
    while (incrementalCache.size > CACHE_MAX_SIZE) {
      const oldestKey = incrementalCache.keys().next().value;
      if (oldestKey) {
        incrementalCache.delete(oldestKey);
      } else {
        break; // Safety break
      }
    }

    const totalCleaned =
      decorationEntriesToDelete.length +
      parseEntriesToDelete.length +
      incrementalEntriesToDelete.length;
    if (totalCleaned > 0) {
      console.log(
        `Bracket Lens: Cleaned up ${totalCleaned} expired cache entries (${decorationEntriesToDelete.length} decoration, ${parseEntriesToDelete.length} parse, ${incrementalEntriesToDelete.length} incremental)`
      );
    }
  } catch (error) {
    console.error('Bracket Lens: Error during cache cleanup:', error);
  }
}

// ===== PARSING STATE FUNCTIONS =====

/**
 * Get or create parsing state cache for a text
 */
function getOrCreateParseCache(text: string, fileUri: string): TextParseCache {
  const textHash = generateTextHash(text);
  const cached = parseStateCache.get(fileUri);

  // Check if cache is valid
  if (
    cached &&
    cached.textHash === textHash &&
    Date.now() - cached.timestamp < PARSE_CACHE_MAX_AGE
  ) {
    return cached;
  }

  // Create new cache
  const states: ParseState[] = [];
  let inString = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  let inBlockComment = false;
  let inLineComment = false;

  // Parse text and cache states at intervals
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i < text.length - 1 ? text[i + 1] : '';

    // Handle line comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
    } else if (inLineComment && char === '\n') {
      inLineComment = false;
    }

    // Handle block comments
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
    } else if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++; // Skip the '/' character
      continue;
    }

    // Handle strings (only if not in comments)
    if (!inBlockComment && !inLineComment) {
      // Handle escape sequences
      if (prevChar !== '\\') {
        if (char === '"' && !inSingleQuote && !inTemplateString) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
          inTemplateString = !inTemplateString;
        }
      }
    }

    inString = inSingleQuote || inDoubleQuote || inTemplateString;

    // Cache state at intervals
    if (i % PARSE_CACHE_INTERVAL === 0 || i === text.length - 1) {
      states.push({
        position: i,
        inString,
        inSingleQuote,
        inDoubleQuote,
        inTemplateString,
        inBlockComment,
        inLineComment,
      });
    }
  }

  const newCache: TextParseCache = {
    textHash,
    states,
    timestamp: Date.now(),
  };

  // Implement LRU for parse cache
  if (parseStateCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = parseStateCache.keys().next().value;
    if (oldestKey) {
      parseStateCache.delete(oldestKey);
    }
  }

  parseStateCache.set(fileUri, newCache);
  return newCache;
}

/**
 * Find the closest cached state before the given position
 */
function findClosestState(
  states: ParseState[],
  position: number
): ParseState | null {
  let closest: ParseState | null = null;

  for (const state of states) {
    if (state.position <= position) {
      closest = state;
    } else {
      break; // States are ordered by position
    }
  }

  return closest;
}

/**
 * Calculate parsing state from a starting point to target position
 */
function calculateStateFromPosition(
  text: string,
  startState: ParseState,
  targetPosition: number
): ParseState {
  let inString = startState.inString;
  let inSingleQuote = startState.inSingleQuote;
  let inDoubleQuote = startState.inDoubleQuote;
  let inTemplateString = startState.inTemplateString;
  let inBlockComment = startState.inBlockComment;
  let inLineComment = startState.inLineComment;

  for (let i = startState.position + 1; i <= targetPosition; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i < text.length - 1 ? text[i + 1] : '';

    // Handle line comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
    } else if (inLineComment && char === '\n') {
      inLineComment = false;
    }

    // Handle block comments
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
    } else if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++; // Skip the '/' character
      continue;
    }

    // Handle strings (only if not in comments)
    if (!inBlockComment && !inLineComment) {
      // Handle escape sequences
      if (prevChar !== '\\') {
        if (char === '"' && !inSingleQuote && !inTemplateString) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
          inTemplateString = !inTemplateString;
        }
      }
    }

    inString = inSingleQuote || inDoubleQuote || inTemplateString;
  }

  return {
    position: targetPosition,
    inString,
    inSingleQuote,
    inDoubleQuote,
    inTemplateString,
    inBlockComment,
    inLineComment,
  };
}

// ===== COMMENT AND STRING DETECTION =====

function isInsideComment(
  text: string,
  position: number,
  fileUri?: string
): boolean {
  try {
    // Safety checks
    if (position < 0 || position >= text.length) {
      return false;
    }

    // Use optimized parsing if fileUri is provided
    if (fileUri) {
      const parseCache = getOrCreateParseCache(text, fileUri);
      const closestState = findClosestState(parseCache.states, position);

      if (closestState) {
        if (closestState.position === position) {
          return closestState.inBlockComment || closestState.inLineComment;
        }

        const currentState = calculateStateFromPosition(
          text,
          closestState,
          position
        );
        return currentState.inBlockComment || currentState.inLineComment;
      }
    }

    // Fallback to original method for backward compatibility
    // Check for line comments
    const lineStart = text.lastIndexOf('\n', position - 1) + 1;
    const lineText = text.substring(lineStart, position);
    const lineCommentIndex = lineText.indexOf('//');

    if (lineCommentIndex !== -1) {
      return true;
    }

    // Check for block comments
    let searchPos = 0;
    while (searchPos < position) {
      const startIndex = text.indexOf('/*', searchPos);
      if (startIndex === -1 || startIndex >= position) {
        break;
      }

      const endIndex = text.indexOf('*/', startIndex + 2);
      if (endIndex === -1) {
        // Unclosed block comment - everything after is commented
        return startIndex < position;
      } else if (endIndex >= position) {
        // Position is inside this block comment
        return true;
      }

      searchPos = endIndex + 2;
    }

    return false;
  } catch (error) {
    console.error('Bracket Lens: Error checking comment state:', error);
    return false; // Assume not in comment if error occurs
  }
}

function isInsideString(
  text: string,
  position: number,
  fileUri?: string
): boolean {
  try {
    // Safety checks
    if (position < 0 || position >= text.length) {
      return false;
    }

    // Use optimized parsing if fileUri is provided
    if (fileUri) {
      const parseCache = getOrCreateParseCache(text, fileUri);
      const closestState = findClosestState(parseCache.states, position);

      if (closestState) {
        if (closestState.position === position) {
          return closestState.inString;
        }

        const currentState = calculateStateFromPosition(
          text,
          closestState,
          position
        );
        return currentState.inString;
      }
    }

    // Fallback to original method for backward compatibility
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let inTemplateString = false;

    for (let i = 0; i < position; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Handle escape sequences
      if (prevChar === '\\') {
        continue;
      }

      if (char === '"' && !inSingleQuote && !inTemplateString) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
        inTemplateString = !inTemplateString;
      }
    }

    return inDoubleQuote || inSingleQuote || inTemplateString;
  } catch (error) {
    console.error('Bracket Lens: Error checking string state:', error);
    return false; // Assume not in string if error occurs
  }
}

// ===== BRACKET PARSING FUNCTIONS =====

function findBrackets(text: string, fileUri?: string): BracketPair[] {
  try {
    const stack: StackItem[] = [];
    const results: BracketPair[] = [];

    // Safety check for extremely large files
    if (text.length > 10 * 1024 * 1024) {
      // 10MB
      console.warn('Bracket Lens: File too large for bracket parsing');
      return [];
    }

    for (let i = 0; i < text.length; i++) {
      // Skip brackets inside comments or strings - now optimized!
      if (
        isInsideComment(text, i, fileUri) ||
        isInsideString(text, i, fileUri)
      ) {
        continue;
      }

      const code = text.charCodeAt(i);
      const opening = bracketPairs.find((p) => p.open === code);
      if (opening) {
        stack.push({ char: code, pos: i });
        continue;
      }
      const closing = bracketPairs.find((p) => p.close === code);
      if (closing) {
        for (let j = stack.length - 1; j >= 0; j--) {
          const candidatePair = bracketPairs.find(
            (p) => p.open === stack[j].char
          );
          if (candidatePair && candidatePair.close === code) {
            results.push({ open: stack[j].pos, close: i });
            stack.splice(j, 1);
            break;
          }
        }
      }
    }
    return results;
  } catch (error) {
    console.error('Bracket Lens: Error parsing brackets:', error);
    return []; // Return empty array to fail gracefully
  }
}

// ===== INCREMENTAL ANALYSIS FUNCTIONS =====

/**
 * Detect what changed in the document
 */
function detectChangeRegions(
  document: vscode.TextDocument,
  changes: readonly vscode.TextDocumentContentChangeEvent[]
): ChangeRegion[] {
  const regions: ChangeRegion[] = [];

  for (const change of changes) {
    if (!change.range) {
      // If no range, entire document changed
      return [
        {
          startLine: 0,
          endLine: document.lineCount - 1,
          startChar: 0,
          endChar: document.getText().length,
        },
      ];
    }

    const startLine = change.range.start.line;
    const endLine = change.range.end.line;
    const startChar = document.offsetAt(change.range.start);
    const endChar = document.offsetAt(change.range.end);

    regions.push({
      startLine,
      endLine: Math.max(
        endLine,
        startLine + change.text.split('\n').length - 1
      ),
      startChar,
      endChar: startChar + change.text.length,
    });
  }

  return regions;
}

/**
 * Expand change region to include potentially affected brackets
 */
function expandChangeRegion(
  region: ChangeRegion,
  document: vscode.TextDocument,
  existingBrackets: BracketPair[]
): ChangeRegion {
  const text = document.getText();

  // Find brackets that might be affected by this change
  let minStart = region.startChar;
  let maxEnd = region.endChar;

  // Look for brackets that cross the change boundary
  for (const bracket of existingBrackets) {
    const openLine = document.positionAt(bracket.open).line;
    const closeLine = document.positionAt(bracket.close).line;

    // If bracket spans across or near the change region
    if (
      (openLine <= region.endLine + 2 && closeLine >= region.startLine - 2) ||
      (bracket.open >= region.startChar - 200 &&
        bracket.open <= region.endChar + 200) ||
      (bracket.close >= region.startChar - 200 &&
        bracket.close <= region.endChar + 200)
    ) {
      minStart = Math.min(minStart, bracket.open - 100); // Extra buffer
      maxEnd = Math.max(maxEnd, bracket.close + 100);
    }
  }

  // Ensure we don't go out of bounds
  minStart = Math.max(0, minStart);
  maxEnd = Math.min(text.length, maxEnd);

  const expandedStartLine = Math.max(0, document.positionAt(minStart).line - 1);
  const expandedEndLine = Math.min(
    document.lineCount - 1,
    document.positionAt(maxEnd).line + 1
  );

  return {
    startLine: expandedStartLine,
    endLine: expandedEndLine,
    startChar: minStart,
    endChar: maxEnd,
  };
}

/**
 * Find brackets in a specific region of text
 */
function findBracketsInRegion(
  text: string,
  region: ChangeRegion,
  fileUri?: string
): BracketPair[] {
  const regionText = text.substring(region.startChar, region.endChar);
  const stack: StackItem[] = [];
  const results: BracketPair[] = [];

  for (let i = 0; i < regionText.length; i++) {
    const absolutePos = region.startChar + i;

    // Skip brackets inside comments or strings
    if (
      isInsideComment(text, absolutePos, fileUri) ||
      isInsideString(text, absolutePos, fileUri)
    ) {
      continue;
    }

    const code = regionText.charCodeAt(i);
    const opening = bracketPairs.find((p) => p.open === code);
    if (opening) {
      stack.push({ char: code, pos: absolutePos });
      continue;
    }

    const closing = bracketPairs.find((p) => p.close === code);
    if (closing) {
      // Look for matching opening bracket in stack
      for (let j = stack.length - 1; j >= 0; j--) {
        const candidatePair = bracketPairs.find(
          (p) => p.open === stack[j].char
        );
        if (candidatePair && candidatePair.close === code) {
          results.push({ open: stack[j].pos, close: absolutePos });
          stack.splice(j, 1);
          break;
        }
      }
    }
  }

  // Also look for brackets that might have their pair outside the region
  // This is a simplified approach - in a full implementation, we'd do more sophisticated matching
  return results;
}

/**
 * Merge new brackets with existing brackets, removing overlaps
 */
function mergeBrackets(
  existingBrackets: BracketPair[],
  newBrackets: BracketPair[],
  affectedRegion: ChangeRegion
): BracketPair[] {
  // Remove brackets that are in or overlap with the affected region
  const unaffectedBrackets = existingBrackets.filter((bracket) => {
    return !(
      (bracket.open >= affectedRegion.startChar &&
        bracket.open <= affectedRegion.endChar) ||
      (bracket.close >= affectedRegion.startChar &&
        bracket.close <= affectedRegion.endChar) ||
      (bracket.open < affectedRegion.startChar &&
        bracket.close > affectedRegion.endChar)
    );
  });

  // Combine unaffected brackets with new brackets
  const allBrackets = [...unaffectedBrackets, ...newBrackets];

  // Sort by opening position
  allBrackets.sort((a, b) => a.open - b.open);

  return allBrackets;
}

/**
 * Get or update incremental cache
 */
function getOrUpdateIncrementalCache(
  document: vscode.TextDocument,
  changes?: readonly vscode.TextDocumentContentChangeEvent[]
): BracketPair[] {
  const fileUri = document.uri.toString();
  const text = document.getText();
  const textHash = generateTextHash(text);
  const cached = incrementalCache.get(fileUri);

  // If no changes provided or cache is invalid, do full analysis
  if (
    !changes ||
    !cached ||
    cached.textHash !== textHash ||
    Date.now() - cached.timestamp > INCREMENTAL_CACHE_MAX_AGE
  ) {
    // Fallback to full analysis
    const fullBrackets = findBrackets(text, fileUri);

    // Update incremental cache
    if (incrementalCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = incrementalCache.keys().next().value;
      if (oldestKey) {
        incrementalCache.delete(oldestKey);
      }
    }

    incrementalCache.set(fileUri, {
      textHash,
      brackets: fullBrackets,
      lineCount: document.lineCount,
      timestamp: Date.now(),
    });

    return fullBrackets;
  }

  // Incremental analysis
  try {
    const changeRegions = detectChangeRegions(document, changes);
    let resultBrackets = cached.brackets;

    for (const region of changeRegions) {
      // Expand region to include potentially affected brackets
      const expandedRegion = expandChangeRegion(
        region,
        document,
        cached.brackets
      );

      // Find brackets in the expanded region
      const newBrackets = findBracketsInRegion(text, expandedRegion, fileUri);

      // Merge with existing brackets
      resultBrackets = mergeBrackets(
        resultBrackets,
        newBrackets,
        expandedRegion
      );
    }

    // Update cache with new results
    incrementalCache.set(fileUri, {
      textHash,
      brackets: resultBrackets,
      lineCount: document.lineCount,
      timestamp: Date.now(),
    });

    return resultBrackets;
  } catch (error) {
    console.error(
      'Bracket Lens: Error in incremental analysis, falling back to full:',
      error
    );
    // Fallback to full analysis on error
    return findBrackets(text, fileUri);
  }
}

function getContextualInfo(
  text: string,
  openPos: number,
  closePos: number,
  doc: vscode.TextDocument
): string {
  try {
    // Safety checks
    if (openPos < 0 || closePos >= text.length || openPos >= closePos) {
      return '';
    }

    const openPosition = doc.positionAt(openPos);
    const openLine = doc.lineAt(openPosition.line);

    // ============ JSON CUSTOM CONTEXT =============
    if (doc.languageId === 'json') {
      const textBeforeBracket = openLine.text
        .substring(0, openPosition.character)
        .trim();

      // Detect in "activationEvents": [
      if (
        textBeforeBracket.includes('"activationEvents"') &&
        textBeforeBracket.endsWith(':')
      ) {
        return 'triggers';
      }
    }

    // Use the enhanced extractContextualInfo from language-patterns
    const contextInfo = extractContextualInfo(
      text,
      openPos,
      closePos,
      doc.languageId,
      openLine.text,
      openPosition.character
    );

    // Debug logging
    if (contextInfo) {
      console.debug(
        `Bracket Lens: Found context "${contextInfo}" for bracket at line ${
          openPosition.line + 1
        }`
      );
    } else {
      console.debug(
        `Bracket Lens: No context found for bracket at line ${
          openPosition.line + 1
        }, language: ${doc.languageId}`
      );

      // Additional debugging - show what we're working with
      const lineText = openLine.text
        .substring(0, openPosition.character)
        .trim();
      if (lineText) {
        console.debug(`Bracket Lens: Line text before bracket: "${lineText}"`);
      }
    }

    return contextInfo;
  } catch (error) {
    console.error('Bracket Lens: Error extracting contextual info:', error);
    return '';
  }
}

// ===== DECORATION UPDATE FUNCTIONS =====

function scheduleUpdate(editor: vscode.TextEditor): void {
  try {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
    }
    throttleTimer = setTimeout(() => {
      try {
        updateDecorations(editor);
      } catch (error) {
        console.error('Bracket Lens: Error in scheduled update:', error);
      }
    }, DEBOUNCE_DELAY);
  } catch (error) {
    console.error('Bracket Lens: Error scheduling update:', error);
  }
}

function scheduleUpdateIncremental(
  editor: vscode.TextEditor,
  changes: readonly vscode.TextDocumentContentChangeEvent[]
): void {
  try {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
    }
    throttleTimer = setTimeout(() => {
      try {
        updateDecorationsIncremental(editor, changes);
      } catch (error) {
        console.error(
          'Bracket Lens: Error in scheduled incremental update:',
          error
        );
      }
    }, DEBOUNCE_DELAY);
  } catch (error) {
    console.error('Bracket Lens: Error scheduling incremental update:', error);
  }
}

function updateDecorations(editor: vscode.TextEditor): void {
  updateDecorationsIncremental(editor);
}

function updateDecorationsIncremental(
  editor: vscode.TextEditor,
  changes?: readonly vscode.TextDocumentContentChangeEvent[]
): void {
  try {
    if (!decorationType) {
      console.warn('Bracket Lens: Decoration type not initialized');
      return;
    }

    // Check if extension is enabled for this editor before processing
    const { isEditorEnabled } = require('../actions/toggle');
    if (!isEditorEnabled(editor)) {
      // If disabled, clear decorations and return
      editor.setDecorations(decorationType, []);
      return;
    }

    // Try to get cached decorations first (only if no changes provided)
    if (!changes) {
      const cachedDecorations = getCachedDecorations(editor);
      if (cachedDecorations) {
        // Use cached decorations - no processing needed!
        editor.setDecorations(decorationType, cachedDecorations);
        return;
      }
    }

    // Safety check for document validity
    const doc = editor.document;
    const text = doc.getText();

    if (!text || text.length === 0) {
      editor.setDecorations(decorationType, []);
      return;
    }

    const fileUri = doc.uri.toString();

    const brackets = changes
      ? getOrUpdateIncrementalCache(doc, changes)
      : findBrackets(text, fileUri);

    const decorations: vscode.DecorationOptions[] = [];
    const usedLines = new Set<number>();

    brackets.sort((a, b) => a.open - b.open);

    for (const { open, close } of brackets) {
      const startPosition = doc.positionAt(open);
      const endPosition = doc.positionAt(close);

      const startLine = startPosition.line + 1;
      const endLine = endPosition.line + 1;

      const totalLineSpan = endLine - startLine + 1;

      if (totalLineSpan <= 1 && startPosition.line === endPosition.line) {
        continue;
      }

      if (usedLines.has(endLine)) {
        continue;
      }

      const openChar = text.charCodeAt(open);
      let skipDecoration = false;

      if (openChar === '{'.charCodeAt(0)) {
        if (totalLineSpan <= MIN_TOTAL_LINES_FOR_CURLY_DECORATION) {
          skipDecoration = true;
        }
      } else if (openChar === '<'.charCodeAt(0)) {
        const isSelfClosingTag =
          close > 0 && text.charCodeAt(close - 1) === '/'.charCodeAt(0);
        const isActualClosingTagMarker =
          open + 1 < text.length &&
          text.charCodeAt(open + 1) === '/'.charCodeAt(0);

        if (isActualClosingTagMarker) {
          if (totalLineSpan <= MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION) {
          }
        } else if (isSelfClosingTag) {
        } else {
          if (totalLineSpan <= MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION) {
            skipDecoration = true;
          }
        }
      }

      if (skipDecoration) {
        continue;
      }

      // Avoid placing decoration in the middle of the line.
      // If there is any non-whitespace content after the closing bracket
      // (ignoring a trailing comma or semicolon), skip the decoration.
      try {
        const endLineText = doc.lineAt(endPosition.line).text;
        let idx = endPosition.character + 1; // character after the closing bracket

        // Skip whitespace
        while (idx < endLineText.length && /\s/.test(endLineText[idx])) {
          idx++;
        }

        // Optional trailing comma/semicolon
        if (
          idx < endLineText.length &&
          (endLineText[idx] === ',' || endLineText[idx] === ';')
        ) {
          idx++;
          while (idx < endLineText.length && /\s/.test(endLineText[idx])) {
            idx++;
          }
        }

        // If anything else remains on the line, don't render here
        if (idx < endLineText.length) {
          continue;
        }
      } catch (e) {
        // On any error evaluating the line tail, fail safe by skipping decoration
        continue;
      }

      usedLines.add(endLine);

      const contextInfo = getContextualInfo(text, open, close, doc);

      // ============ JSON ========== all
      if (
        doc.languageId !== 'json' &&
        (!contextInfo || contextInfo.trim() === '')
      ) {
        continue;
      }

      let offset = close + 1;
      if (offset < text.length) {
        const nextChar = text[offset];
        if (nextChar === ',' || nextChar === ';') {
          offset += 1;
        }
      }
      const pos = doc.positionAt(offset);

      decorations.push({
        range: new vscode.Range(pos, pos),
        renderOptions: {
          after: {
            contentText: formatLineRange(startLine, endLine, contextInfo),
          },
        },
      });
    }

    // Cache the results for future use
    cacheDecorations(editor, brackets, decorations);

    editor.setDecorations(decorationType, decorations);
  } catch (error) {
    console.error('Bracket Lens: Critical error in updateDecorations:', error);
    // Try to clear decorations to prevent visual artifacts
    try {
      if (decorationType) {
        editor.setDecorations(decorationType, []);
      }
    } catch (clearError) {
      console.error(
        'Bracket Lens: Failed to clear decorations after error:',
        clearError
      );
    }
  }
}

// ===== BRACKET LENS PROVIDER CLASS =====

export class BracketLensProvider {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      decorationType = createDecorationStyle();
      this.registerEventHandlers();

      // Initialize with current editor if available
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        updateDecorations(editor);
      }
    } catch (error) {
      console.error('Bracket Lens: Error during initialization:', error);
    }
  }

  private registerEventHandlers(): void {
    try {
      this.disposables.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
          try {
            if (editor) {
              updateDecorations(editor);
            }
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidChangeActiveTextEditor:',
              error
            );
          }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
          try {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === doc) {
              // Clear cache for saved document to ensure fresh processing
              clearFileCache(doc.uri.toString());
              updateDecorations(editor);
            }
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidSaveTextDocument:',
              error
            );
          }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
          try {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === event.document) {
              // Don't clear incremental cache - we'll update it incrementally
              // Only clear decoration cache since we're about to recalculate
              decorationCache.delete(event.document.uri.toString());

              // Use incremental analysis with the changes
              scheduleUpdateIncremental(editor, event.contentChanges);
            }
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidChangeTextDocument:',
              error
            );
          }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
          try {
            // Clean up cache when document is closed
            clearFileCache(doc.uri.toString());
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidCloseTextDocument:',
              error
            );
          }
        })
      );

      // Set up periodic cache cleanup
      const cacheCleanupInterval = setInterval(() => {
        try {
          cleanupCache();
        } catch (error) {
          console.error(
            'Bracket Lens: Error in cache cleanup interval:',
            error
          );
        }
      }, 60000); // Clean up every minute

      this.disposables.push({
        dispose: () => {
          try {
            clearInterval(cacheCleanupInterval);
          } catch (error) {
            console.error(
              'Bracket Lens: Error disposing cache cleanup interval:',
              error
            );
          }
        },
      });
    } catch (error) {
      console.error('Bracket Lens: Error registering event handlers:', error);
    }
  }

  // ===== PUBLIC METHODS FOR TOGGLE FUNCTIONALITY =====

  /**
   * Force update decorations for a specific editor
   */
  public forceUpdate(editor: vscode.TextEditor): void {
    try {
      updateDecorations(editor);
    } catch (error) {
      console.error('Bracket Lens: Error in forceUpdate:', error);
    }
  }

  /**
   * Clear all decorations from a specific editor
   */
  public clearDecorations(editor: vscode.TextEditor): void {
    try {
      if (decorationType) {
        editor.setDecorations(decorationType, []);
      }
    } catch (error) {
      console.error('Bracket Lens: Error clearing decorations:', error);
    }
  }

  public dispose(): void {
    try {
      this.disposables.forEach((d) => {
        try {
          d.dispose();
        } catch (error) {
          console.error('Bracket Lens: Error disposing resource:', error);
        }
      });

      try {
        decorationType?.dispose();
      } catch (error) {
        console.error('Bracket Lens: Error disposing decoration type:', error);
      }

      try {
        if (throttleTimer) {
          clearTimeout(throttleTimer);
        }
      } catch (error) {
        console.error('Bracket Lens: Error clearing throttle timer:', error);
      }

      try {
        // Clear all caches
        decorationCache.clear();
        parseStateCache.clear();
        incrementalCache.clear();
      } catch (error) {
        console.error('Bracket Lens: Error clearing caches:', error);
      }
    } catch (error) {
      console.error('Bracket Lens: Critical error in dispose:', error);
    }
  }
}
