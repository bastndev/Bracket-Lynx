import * as vscode from 'vscode';

const DEBOUNCE_DELAY = 300;
const HASH_PREFIX = '<~ #';

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

    const openingPair = bracketPairs.find((p) => p.open === code);
    if (openingPair) {
      stack.push({ char: code, pos: i });
      continue;
    }

    const closingPair = bracketPairs.find((p) => p.close === code);
    if (closingPair) {
      for (let j = stack.length - 1; j >= 0; j--) {
        const matchingPair = bracketPairs.find((p) => p.open === stack[j].char);
        if (matchingPair && matchingPair.close === code) {
          results.push({ open: stack[j].pos, close: i });
          stack.splice(j, 1);
          break;
        }
      }
    }
  }

  return results;
}

function formatLineRange(startLine: number, endLine: number): string {
  return `${HASH_PREFIX}${startLine}-${endLine}`;
}

function updateDecorations(editor: vscode.TextEditor): void {
  if (!decorationType) return;

  const doc = editor.document;
  const text = doc.getText();
  const brackets = findBrackets(text);
  const decorations: vscode.DecorationOptions[] = [];

  const usedLines = new Set<number>();

  for (const bracket of brackets) {
    const startLine = doc.positionAt(bracket.open).line + 1;
    const endLine = doc.positionAt(bracket.close).line + 1;
    const position = doc.positionAt(bracket.close + 1);

    if (usedLines.has(endLine)) continue; // evita duplicado por línea

    usedLines.add(endLine);

    decorations.push({
      range: new vscode.Range(position, position),
      renderOptions: {
        after: {
          contentText: formatLineRange(startLine, endLine),
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
      color: '#3d384a',
      margin: '0 0 0 10px',
      fontWeight: 'bold',
    },
  });
}

function registerEventHandlers(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('bracketLynx.refresh', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) updateDecorations(editor);
    }),

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) updateDecorations(editor);
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
  if (editor) updateDecorations(editor);
}

export function deactivate(): void {
  decorationType?.dispose();
  if (throttleTimer) {
    clearTimeout(throttleTimer);
  }
}
