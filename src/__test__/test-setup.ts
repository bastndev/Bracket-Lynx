// Test setup and VSCode mocking utilities
// This file provides all necessary mocks and utilities for testing

// Mock VSCode API with essential functionality
const mockVscode = {
  Range: class MockRange {
    constructor(
      public start: any,
      public end: any,
    ) {}
    isEmpty = false;
    isSingleLine = true;
  },

  Position: class MockPosition {
    constructor(
      public line: number,
      public character: number,
    ) {}
  },

  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
  },

  EndOfLine: { LF: 1, CRLF: 2 },

  window: {
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    createTextEditorDecorationType: () => ({ key: 'mock', dispose: () => {} }),
  },

  workspace: {
    getConfiguration: () => ({
      get: (key: string) => {
        const defaults: Record<string, any> = {
          prefix: '‹~ ',
          color: '#515151',
          fontStyle: 'italic',
          maxBracketHeaderLength: 50,
          minBracketScopeLines: 4,
          enablePerformanceFilters: true,
          maxFileSize: 10485760,
          maxDecorationsPerFile: 500,
          globalEnabled: true,
          disabledFiles: [],
          individuallyEnabledFiles: [],
        };
        return defaults[key] || defaults[key.replace('bracketLynx.', '')];
      },
    }),
  },
};

// Apply mock globally
(global as any).vscode = mockVscode;

// Mock module resolution for vscode
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

// Utility functions for tests
export const createMockDocument = (
  text: string,
  languageId: string = 'javascript',
): any => {
  const lines = text.split('\n');
  return {
    languageId,
    getText: () => text,
    fileName: `test.${languageId}`,
    lineCount: lines.length,
    uri: { fsPath: `/test.${languageId}` },
    version: 1,
    isDirty: false,
    isClosed: false,
    isUntitled: false,
    eol: mockVscode.EndOfLine.LF,
    lineAt: (line: number) => ({
      text: lines[line] || '',
      range: new mockVscode.Range(
        new mockVscode.Position(line, 0),
        new mockVscode.Position(line, (lines[line] || '').length),
      ),
    }),
  };
};

export const measureTime = async <T>(
  fn: () => Promise<T> | T,
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await Promise.resolve(fn());
  const duration = performance.now() - start;
  return { result, duration };
};

export const generateLargeCode = (size: number = 1000): string => {
  return (
    'const data = {' +
    Array(size)
      .fill(0)
      .map((_, i) => `prop${i}: { value: ${i}, nested: { deep: true } }`)
      .join(',\n') +
    '};'
  );
};

export const generateDeeplyNested = (depth: number = 10): string => {
  let content = 'value';
  for (let i = 0; i < depth; i++) {
    content = `{ level${i}: ${content} }`;
  }
  return content;
};

// Test data constants
export const TEST_SAMPLES = {
  simple: 'function test() { return true; }',
  complex: `
    interface Config {
      name: string;
      settings: {
        enabled: boolean;
        options: {
          timeout: number;
          retries: number;
        };
      };
    }

    class TestClass {
      constructor(private config: Config) {}
      process() {
        if (this.config.settings.enabled) {
          return { success: true };
        }
        return { success: false };
      }
    }
  `,
  nested: `{
    level1: {
      level2: {
        level3: {
          level4: {
            data: "deeply nested"
          }
        }
      }
    }
  }`,
};

// Supported languages for testing
export const TEST_LANGUAGES = [
  'javascript',
  'typescript',
  'html',
  'json',
  'css',
];

console.log('🧪 Test setup loaded with VSCode mocking');
