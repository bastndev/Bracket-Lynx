import * as vscode from 'vscode';

const DEBOUNCE_DELAY = 300;
const HASH_PREFIX = '<~ #';
const HASH_PREFIX_SYMBOL = '•';

const MIN_TOTAL_LINES_FOR_CURLY_DECORATION = 3;
const MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION = 7;

interface BracketPair {
  open: number;
  close: number;
}

interface BracketCharPair {
  open: number;
  close: number;
}
// create a new function here
interface StackItem {
  char: number;
  pos: number;
}

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

function getContextualInfo(
  text: string,
  openPos: number,
  closePos: number,
  doc: vscode.TextDocument
): string {
  const openChar = text.charCodeAt(openPos);
  const openPosition = doc.positionAt(openPos);
  const closePosition = doc.positionAt(closePos);
  const openLine = doc.lineAt(openPosition.line);
  const openLineText = openLine.text;
  const content = text.substring(openPos + 1, closePos).trim();

  if (openChar === '{'.charCodeAt(0)) {
    return getContextBeforeOpening(
      openLineText,
      openPosition.character,
      text,
      openPos
    );
  } else if (openChar === '['.charCodeAt(0)) {
    return getContextBeforeOpening(
      openLineText,
      openPosition.character,
      text,
      openPos
    );
  } else if (openChar === '('.charCodeAt(0)) {
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

  const exportConstArrowMatch = textBefore.match(
    /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/
  );
  if (exportConstArrowMatch) {
    return `export ${exportConstArrowMatch[1]} ()=>`;
  }

  const constArrowMatch = textBefore.match(
    /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/
  );
  if (constArrowMatch) {
    return `${constArrowMatch[1]} ()=>`;
  }

  const exportFunctionMatch = textBefore.match(
    /export\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
  );
  if (exportFunctionMatch) {
    return `export ${exportFunctionMatch[1]}`;
  }

  const functionMatch = textBefore.match(
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
  );
  if (functionMatch) {
    return functionMatch[1];
  }

  if (textBefore.includes('export default')) {
    const defaultMatch = textBefore.match(
      /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
    );
    if (defaultMatch) {
      return `export default ${defaultMatch[1]}`;
    }
    return 'export default';
  }

  const hasArrowInLine = textBefore.includes('=>');

  const contextMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (contextMatch) {
    let result = contextMatch[1];
    if (hasArrowInLine) {
      result += ' ()=>';
    }
    return result;
  }

  const words = textBefore.split(/\s+/).filter((word) => word.length > 0);
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    const skipKeywords = [
      'const',
      'let',
      'var',
      'if',
      'for',
      'while',
      'import',
      'from',
    ];
    if (
      !skipKeywords.includes(lastWord) &&
      /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastWord)
    ) {
      let result = lastWord;
      if (hasArrowInLine && !result.includes('=>')) {
        result += ' ()=>';
      }
      return result;
    }
  }

  if (hasArrowInLine) {
    return '()=>';
  }

  return '';
}

function formatLineRange(
  startLine: number,
  endLine: number,
  contextInfo: string = ''
): string {
  const baseRange = `${HASH_PREFIX}${startLine}-${endLine}`;
  return contextInfo
    ? `${baseRange} ${HASH_PREFIX_SYMBOL}${contextInfo}`
    : baseRange;
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
