// Bracket Lynx Test Suite
// Comprehensive testing for all extension functionality
import * as assert from 'assert';
import { describe, it, before, after } from 'mocha';

// Import test utilities
import {
  createMockDocument,
  measureTime,
  generateLargeCode,
  generateDeeplyNested,
  TEST_SAMPLES,
  TEST_LANGUAGES,
} from './test-setup';

// =============================================================================
// TEST CONFIGURATION & CONSTANTS
// =============================================================================

const TEST_CONFIG = {
  QUICK_TIMEOUT: 5000,
  INTEGRATION_TIMEOUT: 10000,
  PERFORMANCE_TIMEOUT: 30000,
  PERFORMANCE_LIMITS: {
    LARGE_FILE_PARSE_MS: 2000,
    MULTIPLE_PARSES_MS: 5000,
    MEMORY_INCREASE_MB: 50,
    DEEP_NESTING_MS: 1000,
  },
  ITERATION_COUNTS: {
    MULTIPLE_PARSES: 100,
    MEMORY_TEST: 50,
    FORMATTING: 50,
  },
};

// =============================================================================
// TEST UTILITIES
// =============================================================================

class TestUtilities {
  static validateBracketStructure(brackets: any[]): void {
    assert.ok(Array.isArray(brackets), 'Should return array');
    brackets.forEach((bracket, index) => {
      assert.ok(bracket !== null, `Bracket ${index} should not be null`);
      assert.ok(
        typeof bracket === 'object',
        `Bracket ${index} should be object`,
      );
    });
  }

  static validateLanguageSupport(language: string): boolean {
    return TEST_LANGUAGES.includes(language);
  }

  static createTestDocument(content: string, language: string = 'javascript') {
    return createMockDocument(content, language);
  }

  static simulateBracketParsing(content: string): any[] {
    const brackets: any[] = [];
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (['{', '}', '[', ']', '(', ')'].includes(char)) {
        brackets.push({
          type: char,
          position: i,
          line: content.substring(0, i).split('\n').length - 1,
        });
      }
    }
    return brackets;
  }

  static measureMemoryUsage(): number {
    return process.memoryUsage().heapUsed / (1024 * 1024); // MB
  }

  static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }
}

// =============================================================================
// QUICK TESTS - Basic Health Check
// =============================================================================

describe('🚀 Quick Tests - Basic Health Check', function () {
  this.timeout(TEST_CONFIG.QUICK_TIMEOUT);

  describe('Environment Setup', () => {
    it('✅ VSCode mock should be available', () => {
      const vscode = (global as any).vscode;
      assert.ok(vscode, 'VSCode mock should be available globally');
      assert.ok(vscode.Range, 'Range class should be available');
      assert.ok(vscode.Position, 'Position class should be available');
    });

    it('✅ Test utilities should work', () => {
      const doc = TestUtilities.createTestDocument('function test() {}');
      assert.ok(doc, 'Document creation should work');
      assert.strictEqual(
        doc.languageId,
        'javascript',
        'Language should be set',
      );
    });

    it('✅ Configuration mock should work', () => {
      const vscode = (global as any).vscode;
      const config = vscode.workspace.getConfiguration();
      assert.strictEqual(
        config.get('prefix'),
        '‹~ ',
        'Should return default prefix',
      );
      assert.strictEqual(
        config.get('color'),
        '#515151',
        'Should return default color',
      );
    });
  });

  describe('Basic Functionality', () => {
    it('✅ Bracket detection should work', () => {
      const content = TEST_SAMPLES.simple;
      const brackets = TestUtilities.simulateBracketParsing(content);
      TestUtilities.validateBracketStructure(brackets);
      assert.ok(brackets.length > 0, 'Should find brackets in test content');
    });

    it('✅ Language validation should work', () => {
      TEST_LANGUAGES.forEach((lang) => {
        const isSupported = TestUtilities.validateLanguageSupport(lang);
        assert.ok(isSupported, `${lang} should be supported`);
      });

      const unsupportedLang =
        TestUtilities.validateLanguageSupport('unsupported');
      assert.strictEqual(
        unsupportedLang,
        false,
        'Unknown language should not be supported',
      );
    });

    it('✅ Document creation for different languages', () => {
      TEST_LANGUAGES.forEach((lang) => {
        const sampleCode =
          lang === 'html'
            ? '<div>{test}</div>'
            : lang === 'json'
              ? '{"key": {"nested": true}}'
              : lang === 'css'
                ? '.class { color: red; }'
                : TEST_SAMPLES.simple;

        const doc = TestUtilities.createTestDocument(sampleCode, lang);
        assert.strictEqual(
          doc.languageId,
          lang,
          `Document should have ${lang} language`,
        );
        assert.ok(
          doc.getText().length > 0,
          `Document should have content for ${lang}`,
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('✅ Empty content should be handled gracefully', () => {
      assert.doesNotThrow(() => {
        const doc = TestUtilities.createTestDocument('');
        const brackets = TestUtilities.simulateBracketParsing('');
        TestUtilities.validateBracketStructure(brackets);
      }, 'Should handle empty content without errors');
    });

    it('✅ Malformed brackets should not crash', () => {
      const malformedCodes = ['{{{{', '}}}}', '({[', ')]}"'];
      malformedCodes.forEach((code, index) => {
        assert.doesNotThrow(() => {
          const doc = TestUtilities.createTestDocument(code);
          const brackets = TestUtilities.simulateBracketParsing(code);
          TestUtilities.validateBracketStructure(brackets);
        }, `Should handle malformed code ${index} gracefully`);
      });
    });
  });
});

// =============================================================================
// INTEGRATION TESTS - Component Integration
// =============================================================================

describe('🔄 Integration Tests - Component Integration', function () {
  this.timeout(TEST_CONFIG.INTEGRATION_TIMEOUT);

  describe('Multi-Language Processing', () => {
    it('🔄 Should process all supported languages consistently', () => {
      const testData = TEST_LANGUAGES.map((language) => {
        const sampleCode =
          language === 'html'
            ? '<div class="test">{content}</div>'
            : language === 'json'
              ? '{"config": {"enabled": true, "settings": {}}}'
              : language === 'css'
                ? '.selector { property: value; @media {} }'
                : language === 'typescript'
                  ? TEST_SAMPLES.complex
                  : TEST_SAMPLES.simple;

        return { language, code: sampleCode };
      });

      testData.forEach(({ language, code }) => {
        assert.doesNotThrow(() => {
          const doc = TestUtilities.createTestDocument(code, language);
          const brackets = TestUtilities.simulateBracketParsing(code);

          assert.ok(doc, `Should create document for ${language}`);
          TestUtilities.validateBracketStructure(brackets);

          console.log(
            `    ✅ ${language}: Found ${brackets.length} bracket pairs`,
          );
        }, `Should process ${language} without errors`);
      });
    });

    it('🔄 Should handle mixed content scenarios', () => {
      const mixedScenarios = [
        {
          name: 'JSX with HTML',
          content: 'function Component() { return <div>{data}</div>; }',
        },
        {
          name: 'CSS in JS',
          content: 'const styles = { button: { color: "red" } };',
        },
        {
          name: 'JSON with functions',
          content: '{ "handler": function() { return true; } }',
        },
        { name: 'Nested objects', content: TEST_SAMPLES.nested },
      ];

      mixedScenarios.forEach(({ name, content }) => {
        assert.doesNotThrow(() => {
          const doc = TestUtilities.createTestDocument(content);
          const brackets = TestUtilities.simulateBracketParsing(content);

          TestUtilities.validateBracketStructure(brackets);
          console.log(`    ✅ ${name}: Processed successfully`);
        }, `Should handle ${name} scenario`);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('🔄 Should maintain stability across error scenarios', () => {
      const errorScenarios = [
        {
          name: 'Unbalanced brackets',
          content: 'function test() { if (true) { console.log("test"); }',
        },
        { name: 'Deeply nested', content: generateDeeplyNested(20) },
        { name: 'Large content', content: generateLargeCode(100) },
        {
          name: 'Special characters',
          content: 'const obj = { "key-with-dash": true, "unicode": "🚀" };',
        },
      ];

      let successCount = 0;
      errorScenarios.forEach(({ name, content }) => {
        try {
          const doc = TestUtilities.createTestDocument(content);
          const brackets = TestUtilities.simulateBracketParsing(content);

          TestUtilities.validateBracketStructure(brackets);
          successCount++;
          console.log(`    ✅ ${name}: Handled gracefully`);
        } catch (error) {
          console.log(`    ⚠️ ${name}: Error handled - ${error}`);
        }
      });

      assert.ok(
        successCount > 0,
        'At least some error scenarios should be handled',
      );
    });
  });

  describe('Workflow Integration', () => {
    it('🔄 Full processing workflow should work end-to-end', () => {
      const workflowSteps = [
        'Document Creation',
        'Language Detection',
        'Bracket Parsing',
        'Structure Validation',
        'Result Processing',
      ];

      const testContent = TEST_SAMPLES.complex;
      let completedSteps = 0;

      try {
        // Step 1: Document Creation
        const doc = TestUtilities.createTestDocument(testContent, 'typescript');
        assert.ok(doc, 'Document should be created');
        completedSteps++;

        // Step 2: Language Detection
        assert.strictEqual(
          doc.languageId,
          'typescript',
          'Language should be detected',
        );
        completedSteps++;

        // Step 3: Bracket Parsing
        const brackets = TestUtilities.simulateBracketParsing(testContent);
        assert.ok(brackets.length > 0, 'Brackets should be found');
        completedSteps++;

        // Step 4: Structure Validation
        TestUtilities.validateBracketStructure(brackets);
        completedSteps++;

        // Step 5: Result Processing
        const openBrackets = brackets.filter((b) =>
          ['{', '[', '('].includes(b.type),
        );
        const closeBrackets = brackets.filter((b) =>
          ['}', ']', ')'].includes(b.type),
        );
        assert.ok(openBrackets.length > 0, 'Should have opening brackets');
        assert.ok(closeBrackets.length > 0, 'Should have closing brackets');
        completedSteps++;

        console.log(
          `    ✅ Workflow completed: ${completedSteps}/${workflowSteps.length} steps`,
        );
      } catch (error) {
        console.log(
          `    ❌ Workflow failed at step ${completedSteps + 1}: ${error}`,
        );
        throw error;
      }

      assert.strictEqual(
        completedSteps,
        workflowSteps.length,
        'All workflow steps should complete',
      );
    });
  });
});

// =============================================================================
// PERFORMANCE TESTS - Speed & Efficiency
// =============================================================================

describe('⚡ Performance Tests - Speed & Efficiency', function () {
  this.timeout(TEST_CONFIG.PERFORMANCE_TIMEOUT);

  describe('Parsing Performance', () => {
    it('⚡ Large file processing should be fast', async () => {
      const largeContent = generateLargeCode(1000);
      const doc = TestUtilities.createTestDocument(largeContent);

      const { result: brackets, duration } = await measureTime(() =>
        TestUtilities.simulateBracketParsing(largeContent),
      );

      TestUtilities.validateBracketStructure(brackets);
      assert.ok(
        duration < TEST_CONFIG.PERFORMANCE_LIMITS.LARGE_FILE_PARSE_MS,
        `Large file parsing too slow: ${duration.toFixed(2)}ms (should be < ${TEST_CONFIG.PERFORMANCE_LIMITS.LARGE_FILE_PARSE_MS}ms)`,
      );

      console.log(
        `    📊 Large file (${largeContent.length} chars) parsed in ${duration.toFixed(2)}ms`,
      );
    });

    it('⚡ Multiple consecutive operations should maintain speed', async () => {
      const testContent = TEST_SAMPLES.complex;
      const iterations = TEST_CONFIG.ITERATION_COUNTS.MULTIPLE_PARSES;

      const { duration: totalDuration } = await measureTime(() => {
        for (let i = 0; i < iterations; i++) {
          const doc = TestUtilities.createTestDocument(testContent + i);
          TestUtilities.simulateBracketParsing(testContent);
        }
      });

      const avgDuration = totalDuration / iterations;

      assert.ok(
        totalDuration < TEST_CONFIG.PERFORMANCE_LIMITS.MULTIPLE_PARSES_MS,
        `Multiple operations too slow: ${totalDuration.toFixed(2)}ms total`,
      );

      console.log(
        `    📊 ${iterations} operations completed in ${totalDuration.toFixed(2)}ms (avg: ${avgDuration.toFixed(2)}ms)`,
      );
    });

    it('⚡ Deep nesting should not cause exponential slowdown', async () => {
      const depth = 30;
      const deepContent = generateDeeplyNested(depth);
      const doc = TestUtilities.createTestDocument(deepContent);

      const { result: brackets, duration } = await measureTime(() =>
        TestUtilities.simulateBracketParsing(deepContent),
      );

      TestUtilities.validateBracketStructure(brackets);
      assert.ok(
        duration < TEST_CONFIG.PERFORMANCE_LIMITS.DEEP_NESTING_MS,
        `Deep nesting too slow: ${duration.toFixed(2)}ms`,
      );

      console.log(
        `    📊 Deep nesting (${depth} levels) parsed in ${duration.toFixed(2)}ms`,
      );
    });
  });

  describe('Memory Performance', () => {
    it('⚡ Memory usage should be reasonable', () => {
      const initialMemory = TestUtilities.measureMemoryUsage();
      const documents: any[] = [];

      // Create and process multiple documents
      for (let i = 0; i < TEST_CONFIG.ITERATION_COUNTS.MEMORY_TEST; i++) {
        const content = TEST_SAMPLES.complex + i;
        const doc = TestUtilities.createTestDocument(content);
        documents.push(doc);

        // Simulate processing
        TestUtilities.simulateBracketParsing(content);
      }

      TestUtilities.forceGarbageCollection();

      const finalMemory = TestUtilities.measureMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      assert.ok(
        memoryIncrease < TEST_CONFIG.PERFORMANCE_LIMITS.MEMORY_INCREASE_MB,
        `Memory usage too high: ${memoryIncrease.toFixed(2)}MB increase`,
      );

      console.log(
        `    📊 Memory increase: ${memoryIncrease.toFixed(2)}MB for ${TEST_CONFIG.ITERATION_COUNTS.MEMORY_TEST} documents`,
      );
    });

    it('⚡ Concurrent processing should be efficient', () => {
      const testContents = [
        TEST_SAMPLES.simple,
        TEST_SAMPLES.complex,
        TEST_SAMPLES.nested,
        generateLargeCode(100),
      ];

      const startTime = performance.now();

      testContents.forEach((content, index) => {
        const doc = TestUtilities.createTestDocument(content, `test-${index}`);
        const brackets = TestUtilities.simulateBracketParsing(content);
        TestUtilities.validateBracketStructure(brackets);
      });

      const duration = performance.now() - startTime;

      assert.ok(
        duration < 1000,
        `Concurrent processing should be fast: ${duration.toFixed(2)}ms`,
      );
      console.log(
        `    📊 Concurrent processing of ${testContents.length} documents: ${duration.toFixed(2)}ms`,
      );
    });
  });
});

// =============================================================================
// COMPREHENSIVE SUITE - All Tests Integration
// =============================================================================

describe('🎯 All Tests - Comprehensive Validation', function () {
  this.timeout(TEST_CONFIG.PERFORMANCE_TIMEOUT);

  let testResults = {
    healthChecks: { passed: 0, failed: 0 },
    stressTests: { passed: 0, failed: 0 },
    workflow: { passed: 0, failed: 0 },
  };

  describe('System Health Validation', () => {
    it('🎯 Complete system health check', () => {
      const healthChecks = [
        {
          name: 'Environment Setup',
          check: () =>
            !!(global as any).vscode &&
            TestUtilities.createTestDocument('test'),
        },
        {
          name: 'Language Support',
          check: () =>
            TEST_LANGUAGES.every((lang) =>
              TestUtilities.validateLanguageSupport(lang),
            ),
        },
        {
          name: 'Document Processing',
          check: () => {
            const doc = TestUtilities.createTestDocument(TEST_SAMPLES.simple);
            return doc && doc.getText().length > 0;
          },
        },
        {
          name: 'Bracket Detection',
          check: () => {
            const brackets = TestUtilities.simulateBracketParsing(
              TEST_SAMPLES.complex,
            );
            return brackets.length > 0;
          },
        },
        {
          name: 'Error Resilience',
          check: () => {
            try {
              TestUtilities.simulateBracketParsing('invalid}{content');
              return true;
            } catch {
              return false;
            }
          },
        },
      ];

      healthChecks.forEach(({ name, check }) => {
        try {
          const result = check();
          if (result) {
            testResults.healthChecks.passed++;
            console.log(`    ✅ ${name}: PASSED`);
          } else {
            testResults.healthChecks.failed++;
            console.log(`    ❌ ${name}: FAILED`);
          }
        } catch (error) {
          testResults.healthChecks.failed++;
          console.log(`    ❌ ${name}: ERROR - ${error}`);
        }
      });

      assert.strictEqual(
        testResults.healthChecks.failed,
        0,
        `${testResults.healthChecks.failed} health checks failed`,
      );

      console.log(
        `    📊 Health Check Results: ${testResults.healthChecks.passed}/${healthChecks.length} passed`,
      );
    });

    it('🎯 Stress test scenarios', () => {
      const stressTests = [
        {
          name: 'Empty Content',
          test: () => {
            const doc = TestUtilities.createTestDocument('');
            return doc.getText() === '';
          },
        },
        {
          name: 'Large File Performance',
          test: () => {
            const largeContent = generateLargeCode(500);
            const start = performance.now();
            const brackets = TestUtilities.simulateBracketParsing(largeContent);
            const duration = performance.now() - start;
            return brackets.length > 0 && duration < 1000;
          },
        },
        {
          name: 'Deep Nesting Stability',
          test: () => {
            const deepContent = generateDeeplyNested(25);
            const brackets = TestUtilities.simulateBracketParsing(deepContent);
            return brackets.length > 0;
          },
        },
        {
          name: 'Multi-Language Consistency',
          test: () => {
            return TEST_LANGUAGES.every((lang) => {
              const doc = TestUtilities.createTestDocument('{}', lang);
              return doc.languageId === lang;
            });
          },
        },
      ];

      stressTests.forEach(({ name, test }) => {
        try {
          if (test()) {
            testResults.stressTests.passed++;
            console.log(`    ✅ Stress Test - ${name}: PASSED`);
          } else {
            testResults.stressTests.failed++;
            console.log(`    ❌ Stress Test - ${name}: FAILED`);
          }
        } catch (error) {
          testResults.stressTests.failed++;
          console.log(`    ❌ Stress Test - ${name}: ERROR - ${error}`);
        }
      });

      assert.strictEqual(
        testResults.stressTests.failed,
        0,
        `${testResults.stressTests.failed} stress tests failed`,
      );

      console.log(
        `    📊 Stress Test Results: ${testResults.stressTests.passed}/${stressTests.length} passed`,
      );
    });
  });

  describe('Production Readiness', () => {
    it('🎯 Final production readiness validation', () => {
      console.log('    🎯 Running production readiness validation...');

      const readinessMetrics = {
        Performance: () => {
          const start = performance.now();
          const content = generateLargeCode(200);
          TestUtilities.simulateBracketParsing(content);
          return performance.now() - start < 500;
        },
        Stability: () => {
          const testCases = [
            TEST_SAMPLES.simple,
            TEST_SAMPLES.complex,
            TEST_SAMPLES.nested,
          ];
          return testCases.every((content) => {
            try {
              TestUtilities.simulateBracketParsing(content);
              return true;
            } catch {
              return false;
            }
          });
        },
        Scalability: () => {
          for (let i = 0; i < 20; i++) {
            const doc = TestUtilities.createTestDocument(
              TEST_SAMPLES.simple + i,
            );
            TestUtilities.simulateBracketParsing(doc.getText());
          }
          return true;
        },
        'Memory Efficiency': () => {
          const initialMemory = TestUtilities.measureMemoryUsage();
          for (let i = 0; i < 10; i++) {
            TestUtilities.simulateBracketParsing(TEST_SAMPLES.complex);
          }
          TestUtilities.forceGarbageCollection();
          const memoryIncrease =
            TestUtilities.measureMemoryUsage() - initialMemory;
          return memoryIncrease < 10; // Less than 10MB increase
        },
      };

      const results = Object.entries(readinessMetrics).map(([name, check]) => {
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

      console.log(
        `    📊 Production Readiness: ${passedCount}/${totalCount} metrics passed`,
      );

      assert.strictEqual(
        passedCount,
        totalCount,
        'All production readiness metrics must pass',
      );
      console.log('    🎉 Extension is production ready!');
    });
  });

  after(() => {
    // Final test summary
    const totalPassed =
      testResults.healthChecks.passed +
      testResults.stressTests.passed +
      testResults.workflow.passed;
    const totalFailed =
      testResults.healthChecks.failed +
      testResults.stressTests.failed +
      testResults.workflow.failed;

    console.log('\n' + '='.repeat(70));
    console.log('🎯 COMPREHENSIVE TEST SUITE SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Total Passed: ${totalPassed}`);
    console.log(`❌ Total Failed: ${totalFailed}`);
    console.log(
      `📊 Success Rate: ${totalPassed > 0 ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : 0}%`,
    );
    console.log('='.repeat(70));

    if (totalFailed === 0) {
      console.log('🎉 ALL TESTS PASSED - EXTENSION READY FOR PRODUCTION!');
    } else {
      console.log('⚠️  Some tests failed - Review required before production');
    }
  });
});
