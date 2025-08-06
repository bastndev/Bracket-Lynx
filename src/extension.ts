import * as vscode from 'vscode';

// ===== CONSTANTS =====
const DEBOUNCE_DELAY = 300;
const HASH_PREFIX = '<~ #';
const HASH_PREFIX_SYMBOL = '•';

const MIN_TOTAL_LINES_FOR_CURLY_DECORATION = 5;
const MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION = 7;

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

// ===== BRACKET PAIRS =====

const bracketPairs: BracketCharPair[] = [
  { open: '{'.charCodeAt(0), close: '}'.charCodeAt(0) },
  { open: '['.charCodeAt(0), close: ']'.charCodeAt(0) },
  { open: '('.charCodeAt(0), close: ')'.charCodeAt(0) },
  { open: '<'.charCodeAt(0), close: '>'.charCodeAt(0) },
];

let decorationType: vscode.TextEditorDecorationType | undefined;
let throttleTimer: NodeJS.Timeout | undefined;

function findBrackets(text: string): BracketPair[] {
  const stack: StackItem[] = [];
  const results: BracketPair[] = [];

  for (let i = 0; i < text.length; i++) {
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
}

// ===== CONTEXT FUNCTIONS =====

/**
 * Get CSS context info (selectors with cleaned symbols)
 */
function getCSSContext(lineText: string, openCharIndex: number): string {
  const textBefore = lineText.substring(0, openCharIndex).trim();
  
  if (!textBefore) {
    return '';
  }

  // Remove comments and clean up the text
  const cleanText = textBefore.replace(/\/\*.*?\*\//g, '').trim();
  
  // Extract CSS selectors - handle multiple selectors separated by commas
  const selectors = cleanText.split(',').map(s => s.trim()).filter(s => s.length > 0);
  
  if (selectors.length === 0) {
    return '';
  }

  // Process the last selector (the one closest to the opening brace)
  const lastSelector = selectors[selectors.length - 1];
  
  // Split by spaces to get individual selector parts in order
  const selectorParts = lastSelector.trim().split(/\s+/).filter(part => part.length > 0);
  
  if (selectorParts.length === 0) {
    return '';
  }

  // Clean each selector part (remove . # : symbols)
  const cleanedParts = selectorParts.map(part => {
    // Remove CSS selector symbols but keep the name
    return part.replace(/^[.#:]+/, '').replace(/:[a-zA-Z-]*$/, '');
  }).filter(part => part.length > 0 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(part));

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
    return cleanedParts.map(part => `${HASH_PREFIX_SYMBOL}${part}`).join(' ');
  }
}

/**
 * Check if current position is inside a <style> block
 */
function isInsideStyleBlock(text: string, currentPos: number, languageId: string): boolean {
  const supportedLanguages = [
    'html', 'htm', 'astro', 'vue', 'svelte', 'xml', 
    'php', 'jsp', 'erb', 'ejs', 'handlebars', 'mustache'
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

  // We're inside a style block if:
  // 1. There's an opening <style> before us
  // 2. No closing </style> between opening and current position  
  // 3. There's a closing </style> after current position
  return hasClosingStyleAfter;
}

// ===== MAIN LOGIC =====

function getContextualInfo(
  text: string,
  openPos: number,
  closePos: number,
  doc: vscode.TextDocument
): string {
  const openChar = text.charCodeAt(openPos);
  const openPosition = doc.positionAt(openPos);
  const content = text.substring(openPos + 1, closePos).trim();

  if (openChar === '{'.charCodeAt(0)) {
    // Check if this is a CSS file or inside a <style> block
    const isCSS = ['css', 'scss', 'sass', 'less', 'stylus'].includes(doc.languageId);
    const insideStyle = isInsideStyleBlock(text, openPos, doc.languageId);
    
    if (isCSS || insideStyle) {
      const openLine = doc.lineAt(openPosition.line);
      return getCSSContext(openLine.text, openPosition.character);
    } else {
      // JavaScript/TypeScript context
      const openLine = doc.lineAt(openPosition.line);
      return getContextBeforeOpening(
        openLine.text,
        openPosition.character,
        text,
        openPos
      );
    }
  } else if (openChar === '['.charCodeAt(0)) {
    const openLine = doc.lineAt(openPosition.line);
    const openLineText = openLine.text;
    return getContextBeforeOpening(
      openLineText,
      openPosition.character,
      text,
      openPos
    );
  } else if (openChar === '('.charCodeAt(0)) {
    const openLine = doc.lineAt(openPosition.line);
    const openLineText = openLine.text;
    return getContextBeforeOpening(
      openLineText,
      openPosition.character,
      text,
      openPos
    );
  } else if (openChar === '<'.charCodeAt(0)) {
    let componentContent = content;
    const isClosingTag = componentContent.startsWith('/');

    if (isClosingTag) {
      componentContent = componentContent.substring(1).trim();
    }

    const jsxComponentMatch = componentContent.match(/^[a-zA-Z_$][\w$.]*/);
    return jsxComponentMatch ? jsxComponentMatch[0] : '';
  }

  return '';
}

function getContextBeforeOpening(
  lineText: string,
  openCharIndex: number,
  text: string,
  openPos: number
): string {
  const textBefore = lineText.substring(0, openCharIndex).trim();

  if (!textBefore) {
    return '';
  }

  // Define patterns with their return formats
  const patterns = [
    // ComponentName: ({ ...props }) => (
    { regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/, format: (m: RegExpMatchArray) => `${m[1]} ()=>` },
    // export const ObjectName = {
    { regex: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/, format: (m: RegExpMatchArray) => `export ${m[1]}` },
    // export const ComponentName = ({ ...props }) => (
    { regex: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/, format: (m: RegExpMatchArray) => `${m[1]} ()=>` },
    // const ComponentName = ({ ...props }) => (
    { regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/, format: (m: RegExpMatchArray) => `${m[1]} ()=>` },
    // const ObjectName = {
    { regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/, format: (m: RegExpMatchArray) => m[1] },
    // export function FunctionName
    { regex: /export\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/, format: (m: RegExpMatchArray) => m[1] },
    // function FunctionName
    { regex: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/, format: (m: RegExpMatchArray) => m[1] },
    // export default
    { regex: /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/, format: (m: RegExpMatchArray) => m[1] },
  ];

  // Test patterns
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

  // Final fallback - get last identifier
  const contextMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (contextMatch) {
    return hasArrow ? `${contextMatch[1]} ()=>` : contextMatch[1];
  }

  // Last word fallback
  const words = textBefore.split(/\s+/).filter(word => word.length > 0);
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    const skipKeywords = ['const', 'let', 'var', 'if', 'for', 'while', 'import', 'from'];
    if (!skipKeywords.includes(lastWord) && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastWord)) {
      return hasArrow ? `${lastWord} ()=>` : lastWord;
    }
  }

  return hasArrow ? '()=>' : '';
}

// ===== DECORATION LOGIC =====

function formatLineRange(
  startLine: number,
  endLine: number,
  contextInfo: string = ''
): string {
  const baseRange = `${HASH_PREFIX}${startLine}-${endLine}`;
  if (contextInfo) {
    // Check if contextInfo already starts with the bullet symbol (for CSS)
    if (contextInfo.startsWith(HASH_PREFIX_SYMBOL)) {
      return `${baseRange} ${contextInfo}`;
    } else {
      return `${baseRange} ${HASH_PREFIX_SYMBOL}${contextInfo}`;
    }
  }
  return baseRange;
}

function updateDecorations(editor: vscode.TextEditor): void {
  if (!decorationType) {
    return;
  }

  const doc = editor.document;
  const text = doc.getText();
  const brackets = findBrackets(text);
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

    usedLines.add(endLine);

    const contextInfo = getContextualInfo(text, open, close, doc);

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

  editor.setDecorations(decorationType, decorations);
}

function scheduleUpdate(editor: vscode.TextEditor): void {
  if (throttleTimer) {
    clearTimeout(throttleTimer);
  }
  throttleTimer = setTimeout(() => updateDecorations(editor), DEBOUNCE_DELAY);
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

// ===== EXTENSION LIFECYCLE =====

function registerEventHandlers(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDecorations(editor);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === doc) {
        updateDecorations(editor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        scheduleUpdate(editor);
      }
    })
  );
}

export function activate(context: vscode.ExtensionContext): void {
  decorationType = createDecorationStyle();
  registerEventHandlers(context);
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    updateDecorations(editor);
  }
}

export function deactivate(): void {
  decorationType?.dispose();
  if (throttleTimer) {
    clearTimeout(throttleTimer);
  }
}
