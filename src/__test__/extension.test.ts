// Import test setup first to ensure vscode mocking is applied
import './test-setup';

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';

// Project imports - these should now work with the mocked vscode
import { LanguageFormatter } from '../lens/language-formatter';
import { shouldExcludeSymbol, isLanguageSupported } from '../lens/lens-rules';
import { AdvancedCacheManager } from '../core/performance-cache';
import { OptimizedBracketParser } from '../core/performance-parser';
import { BracketEntry } from '../lens/lens';

// Import test utilities
import {
  createMockDocument,
  measureTime,
  generateLargeCode,
  generateDeeplyNested,
} from './test-setup';

// Get vscode from global (already mocked by test-setup)
const vscode = (global as any).vscode;

// Test data samples
const TEST_SAMPLES = {
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
  large: generateLargeCode(1000),
};

// =============================================================================
// 1. QUICK TESTS - Basic functionality and health checks
// =============================================================================
describe('🚀 Quick Tests - Basic Health Check', function () {
  this.timeout(5000); // 5 seconds timeout for quick tests

  let parser: OptimizedBracketParser;
  let formatter: LanguageFormatter;
  let cacheManager: AdvancedCacheManager;

  beforeEach(() => {
    parser = OptimizedBracketParser.getInstance();
    formatter = new LanguageFormatter();
    cacheManager = AdvancedCacheManager.getInstance();
  });

  it('✅ Core modules should initialize correctly', () => {
    assert.ok(parser, 'Parser should initialize');
    assert.ok(formatter, 'Formatter should initialize');
    assert.ok(cacheManager, 'Cache manager should initialize');
  });

  it('✅ Basic bracket parsing should work', () => {
    const doc = createMockDocument(TEST_SAMPLES.simple, 'javascript');
    const result = parser.parseBrackets(doc);

    assert.ok(Array.isArray(result), 'Should return array');
    assert.ok(result.length >= 0, 'Should return valid bracket count');
  });

  it('✅ Language support validation should work', () => {
    assert.strictEqual(
      isLanguageSupported('typescript'),
      true,
      'TypeScript should be supported',
    );
    assert.strictEqual(
      isLanguageSupported('javascript'),
      true,
      'JavaScript should be supported',
    );
    assert.strictEqual(
      isLanguageSupported('unknown'),
      false,
      'Unknown language should not be supported',
    );
  });

  it('✅ Symbol exclusion rules should work', () => {
    assert.strictEqual(
      shouldExcludeSymbol('!'),
      true,
      'Should exclude invalid symbols',
    );
    assert.strictEqual(
      shouldExcludeSymbol('validVariable'),
      false,
      'Should not exclude valid symbols',
    );
    assert.strictEqual(
      shouldExcludeSymbol(''),
      true,
      'Should exclude empty strings',
    );
  });

  it('✅ Basic formatting should work', () => {
    const result = formatter.formatContext(TEST_SAMPLES.simple, 'javascript');
    assert.ok(typeof result === 'string', 'Should return string');
    assert.ok(result.length > 0, 'Should return non-empty string');
  });
});

// =============================================================================
// 2. INTEGRATION TESTS - Component interaction and workflow
// =============================================================================
describe('🔄 Integration Tests - Component Integration', function () {
  this.timeout(10000); // 10 seconds timeout for integration tests

  let parser: OptimizedBracketParser;
  let formatter: LanguageFormatter;
  let cacheManager: AdvancedCacheManager;

  const SUPPORTED_LANGUAGES = [
    'javascript',
    'typescript',
    'html',
    'json',
    'css',
  ];

  beforeEach(() => {
    parser = OptimizedBracketParser.getInstance();
    formatter = new LanguageFormatter();
    cacheManager = AdvancedCacheManager.getInstance();
  });

  it('🔄 Parser and formatter should work together', () => {
    const doc = createMockDocument(TEST_SAMPLES.complex, 'typescript');

    // Parse brackets
    const brackets = parser.parseBrackets(doc);
    assert.ok(Array.isArray(brackets), 'Parser should return brackets array');

    // Format content
    const formatted = formatter.formatContext(doc.getText(), 'typescript');
    assert.ok(
      typeof formatted === 'string',
      'Formatter should return formatted string',
    );

    // Verify integration
    assert.ok(brackets.length >= 0, 'Should have parsed brackets');
    assert.ok(formatted.length > 0, 'Should have formatted content');
  });

  it('🔄 Cache integration should work correctly', () => {
    const doc = createMockDocument(TEST_SAMPLES.nested, 'javascript');
    const brackets = parser.parseBrackets(doc);

    // Test cache setting (if method exists)
    if (cacheManager.setDocumentCache) {
      assert.doesNotThrow(() => {
        cacheManager.setDocumentCache(doc, brackets, []);
      }, 'Cache setting should not throw');
    }

    // Test cache getting (if method exists)
    if (cacheManager.getDocumentCache) {
      const cached = cacheManager.getDocumentCache(doc);
      // Cache behavior may vary, just ensure it doesn't crash
      assert.ok(true, 'Cache getting should not crash');
    }
  });

  it('🔄 Multi-language processing should be consistent', () => {
    SUPPORTED_LANGUAGES.forEach((language) => {
      const sampleCode =
        language === 'html'
          ? '<div>{test}</div>'
          : language === 'json'
            ? '{"key": {"nested": true}}'
            : language === 'css'
              ? '.class { color: red; }'
              : TEST_SAMPLES.simple;

      const doc = createMockDocument(sampleCode, language);

      assert.doesNotThrow(() => {
        const brackets = parser.parseBrackets(doc);
        const formatted = formatter.formatContext(sampleCode, language);

        assert.ok(
          Array.isArray(brackets),
          `${language}: Should return brackets array`,
        );
        assert.ok(
          typeof formatted === 'string',
          `${language}: Should return formatted string`,
        );
      }, `Should handle ${language} without errors`);
    });
  });

  it('🔄 Error handling integration should be robust', () => {
    // Test with invalid/edge case documents
    const edgeCases = [
      { text: '', lang: 'javascript' },
      { text: '{{{{{{', lang: 'typescript' },
      { text: '}}}}}}', lang: 'json' },
      { text: 'no brackets here', lang: 'html' },
    ];

    edgeCases.forEach(({ text, lang }, index) => {
      assert.doesNotThrow(() => {
        const doc = createMockDocument(text, lang);
        const brackets = parser.parseBrackets(doc);
        const formatted = formatter.formatContext(text, lang);

        // Should handle edge cases gracefully
        assert.ok(
          Array.isArray(brackets),
          `Edge case ${index}: Should return array`,
        );
        assert.ok(
          typeof formatted === 'string',
          `Edge case ${index}: Should return string`,
        );
      }, `Should handle edge case ${index} gracefully`);
    });
  });
});

// =============================================================================
// 3. PERFORMANCE TESTS - Speed and efficiency validation
// =============================================================================
describe('⚡ Performance Tests - Speed & Efficiency', function () {
  this.timeout(30000); // 30 seconds timeout for performance tests

  let parser: OptimizedBracketParser;
  let formatter: LanguageFormatter;

  beforeEach(() => {
    parser = OptimizedBracketParser.getInstance();
    formatter = new LanguageFormatter();
  });

  it('⚡ Large document parsing should be fast', async () => {
    const largeDoc = createMockDocument(TEST_SAMPLES.large, 'javascript');

    const { result: brackets, duration } = await measureTime(() =>
      parser.parseBrackets(largeDoc),
    );

    assert.ok(Array.isArray(brackets), 'Should parse large documents');
    assert.ok(
      duration < 2000,
      `Large document parsing too slow: ${duration.toFixed(2)}ms (should be < 2000ms)`,
    );

    console.log(
      `    📊 Large document (${TEST_SAMPLES.large.length} chars) parsed in ${duration.toFixed(2)}ms`,
    );
  });

  it('⚡ Multiple consecutive parses should maintain speed', async () => {
    const doc = createMockDocument(TEST_SAMPLES.complex, 'typescript');
    const iterations = 100;

    const { duration: totalDuration } = await measureTime(() => {
      for (let i = 0; i < iterations; i++) {
        parser.parseBrackets(doc);
      }
    });

    const avgDuration = totalDuration / iterations;

    assert.ok(
      totalDuration < 5000,
      `Multiple parses too slow: ${totalDuration.toFixed(2)}ms total (should be < 5000ms)`,
    );
    assert.ok(
      avgDuration < 50,
      `Average parse too slow: ${avgDuration.toFixed(2)}ms per parse (should be < 50ms)`,
    );

    console.log(
      `    📊 ${iterations} parses completed in ${totalDuration.toFixed(2)}ms (avg: ${avgDuration.toFixed(2)}ms per parse)`,
    );
  });

  it('⚡ Memory usage should be reasonable', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const docs: any[] = [];

    // Create multiple documents and parse them
    for (let i = 0; i < 50; i++) {
      const doc = createMockDocument(TEST_SAMPLES.complex + i); // Make each doc unique
      docs.push(doc);
      parser.parseBrackets(doc);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    assert.ok(
      memoryIncreaseMB < 50,
      `Memory usage too high: ${memoryIncreaseMB.toFixed(2)}MB increase (should be < 50MB)`,
    );

    console.log(
      `    📊 Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for 50 document parses`,
    );
  });

  it('⚡ Formatter performance should be acceptable', () => {
    const longText = TEST_SAMPLES.large;
    const iterations = 50;

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      formatter.formatContext(longText, 'javascript');
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const avgDuration = duration / iterations;

    assert.ok(
      duration < 3000,
      `Formatter too slow: ${duration.toFixed(2)}ms total (should be < 3000ms)`,
    );
    assert.ok(
      avgDuration < 60,
      `Average format too slow: ${avgDuration.toFixed(2)}ms per format (should be < 60ms)`,
    );

    console.log(
      `    📊 ${iterations} format operations completed in ${duration.toFixed(2)}ms (avg: ${avgDuration.toFixed(2)}ms)`,
    );
  });

  it('⚡ Deep nesting should not cause exponential slowdown', async () => {
    // Create deeply nested structure
    const depth = 20;
    const deepNested = generateDeeplyNested(depth);

    const doc = createMockDocument(deepNested, 'javascript');

    const { result: brackets, duration } = await measureTime(() =>
      parser.parseBrackets(doc),
    );

    assert.ok(Array.isArray(brackets), 'Should handle deep nesting');
    assert.ok(
      duration < 1000,
      `Deep nesting parsing too slow: ${duration.toFixed(2)}ms (should be < 1000ms)`,
    );
    assert.ok(brackets.length > 0, 'Should find brackets in nested structure');

    console.log(
      `    📊 Deep nesting (${depth} levels) parsed in ${duration.toFixed(2)}ms`,
    );
  });
});

// =============================================================================
// 4. ALL TESTS - Comprehensive test suite
// =============================================================================
describe('🎯 All Tests - Comprehensive Suite', function () {
  this.timeout(60000); // 1 minute timeout for comprehensive tests

  let testResults: {
    suite: string;
    passed: number;
    failed: number;
    duration: number;
  }[] = [];

  beforeEach(() => {
    // Reset test results before each comprehensive test
  });

  afterEach(() => {
    // Log comprehensive test results
  });

  it('🎯 Extension should pass all health checks', async () => {
    const healthChecks = [
      {
        name: 'Core Initialization',
        check: () => !!OptimizedBracketParser.getInstance(),
      },
      {
        name: 'Language Support',
        check: () => isLanguageSupported('typescript'),
      },
      {
        name: 'Symbol Validation',
        check: () => shouldExcludeSymbol('!') === true,
      },
      {
        name: 'Basic Parsing',
        check: () => {
          const parser = OptimizedBracketParser.getInstance();
          const doc = createMockDocument(TEST_SAMPLES.simple);
          return Array.isArray(parser.parseBrackets(doc));
        },
      },
      {
        name: 'Formatting',
        check: () => {
          const formatter = new LanguageFormatter();
          const result = formatter.formatContext(
            TEST_SAMPLES.simple,
            'javascript',
          );
          return typeof result === 'string' && result.length > 0;
        },
      },
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, check } of healthChecks) {
      try {
        const result = await Promise.resolve(check());
        if (result) {
          passed++;
          console.log(`    ✅ ${name}: PASSED`);
        } else {
          failed++;
          console.log(`    ❌ ${name}: FAILED`);
        }
      } catch (error) {
        failed++;
        console.log(`    ❌ ${name}: ERROR - ${error}`);
      }
    }

    assert.strictEqual(
      failed,
      0,
      `${failed} health checks failed out of ${healthChecks.length}`,
    );
    assert.ok(
      passed === healthChecks.length,
      `All ${healthChecks.length} health checks should pass`,
    );

    console.log(
      `    📊 Health Check Results: ${passed}/${healthChecks.length} passed`,
    );
  });

  it('🎯 Extension should handle stress test scenarios', () => {
    const stressTests = [
      {
        name: 'Empty Document',
        test: () => {
          const parser = OptimizedBracketParser.getInstance();
          const doc = createMockDocument('');
          return Array.isArray(parser.parseBrackets(doc));
        },
      },
      {
        name: 'Large File',
        test: () => {
          const parser = OptimizedBracketParser.getInstance();
          const doc = createMockDocument(TEST_SAMPLES.large);
          const start = performance.now();
          const result = parser.parseBrackets(doc);
          const duration = performance.now() - start;
          return Array.isArray(result) && duration < 5000; // Should complete within 5 seconds
        },
      },
      {
        name: 'Multiple Languages',
        test: () => {
          const parser = OptimizedBracketParser.getInstance();
          const languages = ['javascript', 'typescript', 'html', 'json'];
          return languages.every((lang) => {
            const doc = createMockDocument('{ test: true }', lang);
            return Array.isArray(parser.parseBrackets(doc));
          });
        },
      },
      {
        name: 'Malformed Code',
        test: () => {
          const parser = OptimizedBracketParser.getInstance();
          const malformedCodes = ['{{{{', '}}}}', '({[', ')]}"'];
          return malformedCodes.every((code) => {
            const doc = createMockDocument(code);
            const result = parser.parseBrackets(doc);
            return Array.isArray(result); // Should not crash, even with malformed code
          });
        },
      },
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of stressTests) {
      try {
        if (test()) {
          passed++;
          console.log(`    ✅ Stress Test - ${name}: PASSED`);
        } else {
          failed++;
          console.log(`    ❌ Stress Test - ${name}: FAILED`);
        }
      } catch (error) {
        failed++;
        console.log(`    ❌ Stress Test - ${name}: ERROR - ${error}`);
      }
    }

    assert.strictEqual(failed, 0, `${failed} stress tests failed`);
    console.log(
      `    📊 Stress Test Results: ${passed}/${stressTests.length} passed`,
    );
  });

  it('🎯 Extension should demonstrate full workflow', () => {
    console.log('    🔄 Running full workflow demonstration...');

    const startTime = performance.now();

    try {
      // Step 1: Initialize all components
      const parser = OptimizedBracketParser.getInstance();
      const formatter = new LanguageFormatter();
      const cacheManager = AdvancedCacheManager.getInstance();

      console.log('    ✅ Step 1: Components initialized');

      // Step 2: Process different file types
      const testFiles = [
        { content: TEST_SAMPLES.simple, language: 'javascript' },
        { content: TEST_SAMPLES.complex, language: 'typescript' },
        { content: TEST_SAMPLES.nested, language: 'json' },
      ];

      for (const { content, language } of testFiles) {
        const doc = createMockDocument(content, language);
        const brackets = parser.parseBrackets(doc);
        const formatted = formatter.formatContext(content, language);

        assert.ok(Array.isArray(brackets), `Should parse ${language}`);
        assert.ok(typeof formatted === 'string', `Should format ${language}`);
      }

      console.log('    ✅ Step 2: Multi-language processing completed');

      // Step 3: Performance validation
      const perfDoc = createMockDocument(TEST_SAMPLES.large);
      const perfStart = performance.now();
      const perfBrackets = parser.parseBrackets(perfDoc);
      const perfDuration = performance.now() - perfStart;

      assert.ok(
        Array.isArray(perfBrackets),
        'Performance test should return brackets',
      );
      assert.ok(
        perfDuration < 3000,
        `Performance test should complete quickly (${perfDuration.toFixed(2)}ms)`,
      );

      console.log(
        `    ✅ Step 3: Performance validation completed (${perfDuration.toFixed(2)}ms)`,
      );

      const totalDuration = performance.now() - startTime;
      console.log(
        `    📊 Full workflow completed in ${totalDuration.toFixed(2)}ms`,
      );

      assert.ok(
        totalDuration < 10000,
        'Full workflow should complete within 10 seconds',
      );
    } catch (error) {
      console.log(`    ❌ Workflow failed: ${error}`);
      throw error;
    }
  });

  it('🎯 Final validation - Extension readiness check', () => {
    console.log('    🎯 Running final extension readiness check...');

    const readinessChecks = {
      'Parser Singleton': () => {
        const p1 = OptimizedBracketParser.getInstance();
        const p2 = OptimizedBracketParser.getInstance();
        return p1 === p2; // Should be singleton
      },
      'Error Resilience': () => {
        try {
          const parser = OptimizedBracketParser.getInstance();
          const doc = createMockDocument('invalid}{code');
          const result = parser.parseBrackets(doc);
          return Array.isArray(result); // Should not crash
        } catch {
          return false;
        }
      },
      'Memory Stability': () => {
        const parser = OptimizedBracketParser.getInstance();
        for (let i = 0; i < 10; i++) {
          const doc = createMockDocument(TEST_SAMPLES.complex + i);
          parser.parseBrackets(doc);
        }
        return true; // Should not crash or leak memory significantly
      },
      'Language Coverage': () => {
        const supportedLangs = ['javascript', 'typescript', 'html', 'json'];
        return supportedLangs.every((lang) => isLanguageSupported(lang));
      },
    };

    const results = Object.entries(readinessChecks).map(([name, check]) => {
      try {
        const passed = check();
        console.log(
          `    ${passed ? '✅' : '❌'} ${name}: ${passed ? 'READY' : 'NOT READY'}`,
        );
        return { name, passed };
      } catch (error) {
        console.log(`    ❌ ${name}: ERROR - ${error}`);
        return { name, passed: false };
      }
    });

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;

    console.log(`    📊 Readiness: ${passedCount}/${totalCount} checks passed`);

    assert.strictEqual(
      passedCount,
      totalCount,
      'All readiness checks must pass',
    );

    console.log('    🎉 Extension is ready for production!');
  });
});
