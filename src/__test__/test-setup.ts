// Test setup file with comprehensive VSCode mocking
import * as path from 'path';

// Mock VSCode API
const mockVscode = {
  // Core classes
  Range: class MockRange {
    constructor(
      public start: any,
      public end: any,
    ) {}
    isEmpty = false;
    isSingleLine = true;
    contains(positionOrRange: any): boolean {
      return false;
    }
    intersection(range: any): any {
      return undefined;
    }
    union(other: any): any {
      return this;
    }
    with(start?: any, end?: any): any {
      return new mockVscode.Range(start || this.start, end || this.end);
    }
  },

  Position: class MockPosition {
    constructor(
      public line: number,
      public character: number,
    ) {}
    isBefore(other: any): boolean {
      return this.line < other.line || (this.line === other.line && this.character < other.character);
    }
    isBeforeOrEqual(other: any): boolean {
      return this.isBefore(other) || this.isEqual(other);
    }
    isAfter(other: any): boolean {
      return !this.isBeforeOrEqual(other);
    }
    isAfterOrEqual(other: any): boolean {
      return !this.isBefore(other);
    }
    isEqual(other: any): boolean {
      return this.line === other.line && this.character === other.character;
    }
    compareTo(other: any): number {
      if (this.line < other.line) return -1;
      if (this.line > other.line) return 1;
      if (this.character < other.character) return -1;
      if (this.character > other.character) return 1;
      return 0;
    }
    translate(lineDelta?: number, characterDelta?: number): any {
      return new mockVscode.Position(
        this.line + (lineDelta || 0),
        this.character + (characterDelta || 0)
      );
    }
    with(line?: number, character?: number): any {
      return new mockVscode.Position(
        line !== undefined ? line : this.line,
        character !== undefined ? character : this.character
      );
    }
  },

  // URI handling
  Uri: {
    file: (path: string) => ({
      scheme: 'file',
      authority: '',
      path: path,
      query: '',
      fragment: '',
      fsPath: path,
      with: (change: any) => mockVscode.Uri.file(path),
      toString: (skipEncoding?: boolean) => `file://${path}`,
      toJSON: () => ({ scheme: 'file', path }),
    }),
    parse: (value: string) => ({
      scheme: value.split(':')[0] || 'file',
      authority: '',
      path: value.split('://')[1] || value,
      query: '',
      fragment: '',
      fsPath: value.split('://')[1] || value,
      toString: () => value,
      toJSON: () => ({ scheme: 'file', path: value }),
    }),
  },

  // Configuration
  workspace: {
    getConfiguration: (section?: string) => ({
      get: (key: string, defaultValue?: any) => {
        // Mock default configuration values
        const defaults: any = {
          'bracketLynx.prefix': '‹~ ',
          'bracketLynx.color': '#515151',
          'bracketLynx.fontStyle': 'italic',
          'bracketLynx.unmatchBracketsPrefix': '❌ ',
          'bracketLynx.mode': 'auto',
          'bracketLynx.debug': false,
          'bracketLynx.maxBracketHeaderLength': 50,
          'bracketLynx.minBracketScopeLines': 4,
          'bracketLynx.enablePerformanceFilters': true,
          'bracketLynx.maxFileSize': 10485760,
          'bracketLynx.maxDecorationsPerFile': 500,
          'bracketLynx.globalEnabled': true,
          'bracketLynx.disabledFiles': [],
          'bracketLynx.individuallyEnabledFiles': [],
          prefix: '‹~ ',
          color: '#515151',
          fontStyle: 'italic',
          unmatchBracketsPrefix: '❌ ',
          mode: 'auto',
          debug: false,
          maxBracketHeaderLength: 50,
          minBracketScopeLines: 4,
          enablePerformanceFilters: true,
          maxFileSize: 10485760,
          maxDecorationsPerFile: 500,
          globalEnabled: true,
          disabledFiles: [],
          individuallyEnabledFiles: [],
        };
        const fullKey = section ? `${section}.${key}` : key;
        return defaults[fullKey] !== undefined ? defaults[fullKey] : defaultValue;
      },
      has: (key: string) => true,
      inspect: (key: string) => ({
        key,
        defaultValue: undefined,
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
      update: (key: string, value: any) => Promise.resolve(),
    }),
    workspaceFolders: undefined,
    onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    getWorkspaceFolder: () => undefined,
    asRelativePath: (pathOrUri: any) => pathOrUri.toString(),
    findFiles: () => Promise.resolve([]),
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose: () => {} }),
      onDidChange: () => ({ dispose: () => {} }),
      onDidDelete: () => ({ dispose: () => {} }),
      dispose: () => {},
    }),
  },

  // Window and UI
  window: {
    showInformationMessage: (message: string, ...items: string[]) => Promise.resolve(undefined),
    showWarningMessage: (message: string, ...items: string[]) => Promise.resolve(undefined),
    showErrorMessage: (message: string, ...items: string[]) => Promise.resolve(undefined),
    showQuickPick: (items: any[]) => Promise.resolve(undefined),
    showInputBox: (options?: any) => Promise.resolve(undefined),
    createOutputChannel: (name: string) => ({
      name,
      append: (value: string) => {},
      appendLine: (value: string) => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
    onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
    onDidChangeTextEditorVisibleRanges: () => ({ dispose: () => {} }),
    visibleTextEditors: [],
    setStatusBarMessage: (text: string, hideAfterTimeout?: number) => ({ dispose: () => {} }),
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      color: '',
      command: '',
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    createTextEditorDecorationType: (options: any) => ({
      key: 'mock-decoration-type',
      dispose: () => {},
    }),
  },

  // Commands
  commands: {
    registerCommand: (command: string, callback: Function) => ({ dispose: () => {} }),
    executeCommand: (command: string, ...rest: any[]) => Promise.resolve(undefined),
    getCommands: () => Promise.resolve([]),
  },

  // Languages
  languages: {
    createDiagnosticCollection: (name?: string) => ({
      name: name || '',
      set: (uri: any, diagnostics: any[]) => {},
      delete: (uri: any) => {},
      clear: () => {},
      forEach: (callback: Function) => {},
      get: (uri: any) => [],
      has: (uri: any) => false,
      dispose: () => {},
    }),
    registerDocumentSymbolProvider: () => ({ dispose: () => {} }),
    registerDefinitionProvider: () => ({ dispose: () => {} }),
    registerHoverProvider: () => ({ dispose: () => {} }),
    registerCompletionItemProvider: () => ({ dispose: () => {} }),
  },

  // Extensions
  extensions: {
    getExtension: (extensionId: string) => undefined,
    all: [],
    onDidChange: () => ({ dispose: () => {} }),
  },

  // Environment
  env: {
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
    language: 'en',
    appName: 'Visual Studio Code',
    appRoot: '/mock/vscode',
    uriScheme: 'vscode',
    clipboard: {
      readText: () => Promise.resolve(''),
      writeText: (text: string) => Promise.resolve(),
    },
    openExternal: (target: any) => Promise.resolve(true),
  },

  // Version
  version: '1.74.0',

  // Constants
  EndOfLine: {
    LF: 1,
    CRLF: 2,
  },

  TextEditorRevealType: {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3,
  },

  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },

  CompletionItemKind: {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
  },

  SymbolKind: {
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
  },

  // Text document related
  TextDocument: class MockTextDocument {
    uri: any;
    fileName: string;
    isUntitled: boolean = false;
    languageId: string;
    version: number = 1;
    isDirty: boolean = false;
    isClosed: boolean = false;
    eol: number;
    lineCount: number;

    constructor(uri: any, content: string, languageId: string = 'plaintext') {
      this.uri = uri;
      this.fileName = uri.fsPath || uri.path || 'untitled';
      this.languageId = languageId;
      this.eol = mockVscode.EndOfLine.LF;
      this._content = content;
      this.lineCount = content.split('\n').length;
    }

    private _content: string;

    save(): Thenable<boolean> {
      return Promise.resolve(true);
    }

    getText(range?: any): string {
      if (!range) return this._content;
      // Simplified range handling
      return this._content.substring(0, 100);
    }

    getWordRangeAtPosition(position: any, regex?: RegExp): any {
      return undefined;
    }

    validateRange(range: any): any {
      return range;
    }

    validatePosition(position: any): any {
      return position;
    }

    offsetAt(position: any): number {
      return position.line * 10 + position.character;
    }

    positionAt(offset: number): any {
      return new mockVscode.Position(Math.floor(offset / 10), offset % 10);
    }

    lineAt(line: number | any): any {
      const lines = this._content.split('\n');
      const lineNumber = typeof line === 'number' ? line : line.line;
      const text = lines[lineNumber] || '';
      return {
        lineNumber,
        text,
        range: new mockVscode.Range(
          new mockVscode.Position(lineNumber, 0),
          new mockVscode.Position(lineNumber, text.length)
        ),
        rangeIncludingLineBreak: new mockVscode.Range(
          new mockVscode.Position(lineNumber, 0),
          new mockVscode.Position(lineNumber + 1, 0)
        ),
        firstNonWhitespaceCharacterIndex: text.search(/\S/) !== -1 ? text.search(/\S/) : text.length,
        isEmptyOrWhitespace: text.trim().length === 0,
      };
    }
  },

  // Event emitters
  EventEmitter: class MockEventEmitter {
    private _listeners: Function[] = [];

    event = (listener: Function) => {
      this._listeners.push(listener);
      return { dispose: () => {
        const index = this._listeners.indexOf(listener);
        if (index > -1) this._listeners.splice(index, 1);
      }};
    };

    fire(data?: any) {
      this._listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          // Ignore listener errors in tests
        }
      });
    }

    dispose() {
      this._listeners = [];
    }
  },

  // Disposable
  Disposable: class MockDisposable {
    constructor(private callOnDispose: Function) {}

    dispose() {
      if (this.callOnDispose) {
        this.callOnDispose();
      }
    }

    static from(...disposableLikes: any[]): any {
      return new mockVscode.Disposable(() => {
        disposableLikes.forEach(d => {
          if (d && typeof d.dispose === 'function') {
            d.dispose();
          }
        });
      });
    }
  },
};

// Apply the mock globally
(global as any).vscode = mockVscode;

// Mock module resolution for vscode
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

// Export for potential direct usage
export { mockVscode };

// Additional test utilities
export const createMockDocument = (
  text: string,
  languageId: string = 'typescript',
  fileName?: string
): any => {
  const uri = mockVscode.Uri.file(fileName || `test.${languageId}`);
  return new mockVscode.TextDocument(uri, text, languageId);
};

export const createMockTextEditor = (document: any): any => ({
  document,
  selection: new mockVscode.Range(new mockVscode.Position(0, 0), new mockVscode.Position(0, 0)),
  selections: [],
  visibleRanges: [],
  options: {
    tabSize: 4,
    insertSpaces: true,
    cursorStyle: 1,
    lineNumbers: 1,
  },
  viewColumn: 1,
  edit: (callback: Function) => Promise.resolve(true),
  insertSnippet: () => Promise.resolve(true),
  setDecorations: (decorationType: any, rangesOrOptions: any[]) => {},
  revealRange: (range: any, revealType?: number) => {},
  show: (column?: number) => {},
  hide: () => {},
});

// Performance utilities for tests
export const measureTime = async <T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await Promise.resolve(fn());
  const duration = performance.now() - start;
  return { result, duration };
};

// Test data generators
export const generateLargeCode = (size: number = 1000): string => {
  return 'const data = {' +
    Array(size).fill(0).map((_, i) =>
      `  prop${i}: { value: ${i}, nested: { deep: true, data: [${i}, ${i+1}, ${i+2}] } }`
    ).join(',\n') +
    '\n};';
};

export const generateDeeplyNested = (depth: number = 10): string => {
  let result = 'value';
  for (let i = 0; i < depth; i++) {
    result = `{ level${i}: ${result} }`;
  }
  return result;
};

// Console utilities for tests
export const captureConsole = () => {
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => logs.push(`LOG: ${args.join(' ')}`);
  console.error = (...args) => logs.push(`ERROR: ${args.join(' ')}`);
  console.warn = (...args) => logs.push(`WARN: ${args.join(' ')}`);

  return {
    logs,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
};

console.log('🧪 Test setup loaded with comprehensive VSCode mocking');
