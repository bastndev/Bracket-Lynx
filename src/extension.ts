import * as vscode from 'vscode';

const DEBOUNCE_DELAY = 300;
const HASH_PREFIX = '<~ #';
const HASH_PREFIX_SYMBOL = '•';

const MIN_TOTAL_LINES_FOR_CURLY_DECORATION = 3; // {} blocks: 4+ lines shown
const MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION = 7; // <...>: 8+ lines shown

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
      // Find the matching opening bracket on the stack
      // Iterate from top of stack to ensure correct pairing for nested structures
      for (let j = stack.length - 1; j >= 0; j--) {
        const candidatePair = bracketPairs.find(
          (p) => p.open === stack[j].char
        );
        if (candidatePair && candidatePair.close === code) {
          results.push({ open: stack[j].pos, close: i });
          stack.splice(j, 1); // Remove the matched opening bracket
          break; // Found the match for this closing bracket
        }
      }
    }
  }
  return results;
}

function getFirstWordFromContent(
  text: string,
  openPos: number,
  closePos: number
): string {
  // Extract content between brackets
  const content = text.substring(openPos + 1, closePos).trim();

  if (!content) {
    return '';
  }

  // Match first typical identifier
  const wordMatch = content.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
  if (wordMatch) {
    return wordMatch[0];
  }

  // Match common symbol patterns
  const symbolMatch = content.match(/^[<>/=!+\-*%&|^~?:.]+/);
  if (symbolMatch) {
    return symbolMatch[0];
  }

  // Fallback: take first non-space characters
  const firstChars = content.substring(0, 10).split(/\s/)[0];
  return firstChars || '';
}

function formatLineRange(
  startLine: number,
  endLine: number,
  firstWord: string = ''
): string {
  const baseRange = `${HASH_PREFIX}${startLine}-${endLine}`;
  return firstWord
    ? `${baseRange} ${HASH_PREFIX_SYMBOL}${firstWord}`
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

    // Skip single-line brackets
    if (totalLineSpan <= 1 && startPosition.line === endPosition.line) {
      continue;
    }

    // If another decoration already ends on this line, skip.
    if (usedLines.has(endLine)) {
      continue;
    }

    const openChar = text.charCodeAt(open);
    let skipDecoration = false;

    if (openChar === '{'.charCodeAt(0)) {
      // {} block: skip if too small
      if (totalLineSpan <= MIN_TOTAL_LINES_FOR_CURLY_DECORATION) {
        skipDecoration = true;
      }
    } else if (openChar === '<'.charCodeAt(0)) {
      const isSelfClosingTag =
        close > 0 && text.charCodeAt(close - 1) === '/'.charCodeAt(0);
      const isActualClosingTagMarker =
        open + 1 < text.length &&
        text.charCodeAt(open + 1) === '/'.charCodeAt(0); // </tag>

      if (isActualClosingTagMarker) {
        // Full tag: optionally skip if too small
        if (totalLineSpan <= MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION) {
          // No skipDecoration here, fallback logic
        }
      } else if (isSelfClosingTag) {
        // Multi-line self-closing tags are shown
      } else {
        // Opening tag: skip if too small
        if (totalLineSpan <= MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION) {
          skipDecoration = true;
        }
      }
    }

    if (skipDecoration) {
      continue;
    }

    usedLines.add(endLine);

    const firstWord = getFirstWordFromContent(text, open, close);

    let offset = close + 1;
    // If the character after the closing bracket is a comma or semicolon,
    // place the decoration after it for better visual alignment.
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
          contentText: formatLineRange(startLine, endLine, firstWord),
          // The image shows the comment slightly offset and less prominent
          // You might want to adjust margin and font weight/opacity
          // margin: "0 0 0 0.5ch",
          // opacity: "0.7"
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
      color: '#6A737D', // A slightly dimmer color, more like typical comments
      margin: '0 0 0 1ch', // Standard margin
      // fontWeight: 'normal', // Normal weight might be less intrusive
      // fontStyle: 'italic' // Optional: make it look more like a comment
    },
    // rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed, // Default
  });
}

function registerEventHandlers(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('bracketLynx.refresh', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        updateDecorations(editor);
      }
    }),
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
