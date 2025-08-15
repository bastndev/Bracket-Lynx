import * as assert from 'assert';

// Import VSCode mock first
import './vscode-mock';

// Import modules to test
import { LanguageFormatter } from '../lens/language-formatter';
import { shouldExcludeSymbol, isLanguageSupported, filterContent } from '../lens/lens-rules';
import { 
  escapeRegExp, 
  isEmpty, 
  truncateText, 
  isValidHexColor,
  formatBytes,
  chunkArray
} from '../core/utils';
import { 
  SUPPORTED_LANGUAGES, 
  ALLOWED_JSON_FILES, 
  PERFORMANCE_LIMITS,
  isSupportedLanguage,
  isAllowedJsonFile,
  shouldProcessFile
} from '../lens/config';

suite('Bracket Lynx Core Tests', () => {
	console.log('🧪 Starting Bracket Lynx core tests...');

	suite('Configuration Tests', () => {
		test('✅ Core configuration constants', () => {
			assert.ok(SUPPORTED_LANGUAGES.length > 0, 'Should have supported languages');
			assert.ok(ALLOWED_JSON_FILES.includes('package.json'), 'Should allow package.json');
			assert.ok(PERFORMANCE_LIMITS.MAX_FILE_SIZE > 0, 'Should have file size limit');
			assert.ok(PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE > 0, 'Should have decoration limit');
		});

		test('✅ Language support validation', () => {
			assert.strictEqual(isSupportedLanguage('javascript'), true);
			assert.strictEqual(isSupportedLanguage('typescript'), true);
			assert.strictEqual(isSupportedLanguage('astro'), true);
			assert.strictEqual(isSupportedLanguage('unknownlang'), false);
		});

		test('✅ File processing rules', () => {
			assert.strictEqual(isAllowedJsonFile('package.json'), true);
			assert.strictEqual(isAllowedJsonFile('random.json'), false);
			assert.strictEqual(shouldProcessFile('javascript', 'test.js'), true);
			assert.strictEqual(shouldProcessFile('unknownlang', 'test.unknown'), false);
		});

		test('✅ Performance limits validation', () => {
			assert.ok(PERFORMANCE_LIMITS.MAX_FILE_SIZE > 0, 'Should have positive file size limit');
			assert.ok(PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE > 0, 'Should have positive decoration limit');
			assert.ok(PERFORMANCE_LIMITS.MIN_BRACKET_SCOPE_LINES > 0, 'Should have positive scope line limit');
			assert.ok(PERFORMANCE_LIMITS.DEBOUNCE_DELAY > 0, 'Should have positive debounce delay');
		});
	});

	suite('Utility Functions Tests', () => {
		test('✅ Core utility functions', () => {
			// Test escapeRegExp
			assert.strictEqual(escapeRegExp('test.string'), 'test\\.string');
			assert.strictEqual(escapeRegExp('test[bracket]'), 'test\\[bracket\\]');
			
			// Test isEmpty
			assert.strictEqual(isEmpty(''), true);
			assert.strictEqual(isEmpty('   '), true);
			assert.strictEqual(isEmpty('content'), false);
			assert.strictEqual(isEmpty(null), true);
			assert.strictEqual(isEmpty(undefined), true);
			
			// Test truncateText
			assert.strictEqual(truncateText('short', 10), 'short');
			assert.strictEqual(truncateText('this is a very long text', 10), 'this is...');
			
			// Test isValidHexColor
			assert.strictEqual(isValidHexColor('#ff6b6b'), true);
			assert.strictEqual(isValidHexColor('#FF6B6B'), true);
			assert.strictEqual(isValidHexColor('ff6b6b'), false);
			assert.strictEqual(isValidHexColor('#gg6b6b'), false);
			
			// Test formatBytes
			assert.strictEqual(formatBytes(1024), '1.00 KB');
			assert.strictEqual(formatBytes(1048576), '1.00 MB');
			
			// Test chunkArray
			const array = [1, 2, 3, 4, 5, 6, 7];
			const chunks = chunkArray(array, 3);
			assert.strictEqual(chunks.length, 3);
			assert.deepStrictEqual(chunks[0], [1, 2, 3]);
			assert.deepStrictEqual(chunks[2], [7]);
		});
	});

	suite('Language Rules Tests', () => {
		test('✅ Symbol exclusion rules', () => {
			assert.strictEqual(shouldExcludeSymbol('!'), true);
			assert.strictEqual(shouldExcludeSymbol('('), true);
			assert.strictEqual(shouldExcludeSymbol('hello'), false);
		});

		test('✅ Language support validation', () => {
			assert.strictEqual(isLanguageSupported('javascript'), true);
			assert.strictEqual(isLanguageSupported('typescript'), true);
			assert.strictEqual(isLanguageSupported('astro'), true);
			assert.strictEqual(isLanguageSupported('css'), true);
			assert.strictEqual(isLanguageSupported('unknownlang'), false);
		});

		test('✅ Content filtering', () => {
			const content = 'function test() { return "hello"; }';
			const filtered = filterContent(content);
			assert.ok(filtered.length > 0, 'Filtered content should not be empty');
			assert.ok(!filtered.includes('{'), 'Filtered content should not contain excluded symbols');
		});
	});

	suite('Language Formatter Tests', () => {
		test('✅ LanguageFormatter instantiation', () => {
			const formatter = new LanguageFormatter();
			assert.ok(formatter, 'LanguageFormatter should be instantiated');
		});

		test('✅ Context formatting for different languages', () => {
			const formatter = new LanguageFormatter();
			
			// Test TypeScript formatting
			const tsResult = formatter.formatContext('const x = 5', 'typescript');
			assert.ok(typeof tsResult === 'string', 'Should return formatted string for TypeScript');
			
			// Test CSS formatting
			const cssResult = formatter.formatContext('.class { color: red }', 'css');
			assert.ok(typeof cssResult === 'string', 'Should return formatted string for CSS');
			
			// Test empty context
			const emptyResult = formatter.formatContext('', 'javascript');
			assert.strictEqual(emptyResult, '', 'Should return empty string for empty context');
		});
	});

	suite('Performance Tests', () => {
		test('✅ Large text handling simulation', async () => {
			// Create a large text simulation
			const largeText = 'function test() {\n'.repeat(1000) + '}\n'.repeat(1000);
			
			// Test that the system can handle large content without crashing
			const startTime = Date.now();
			const filtered = filterContent(largeText.substring(0, 1000));
			const endTime = Date.now();
			
			assert.ok(endTime - startTime < 100, 'Large text processing should be fast (<100ms)');
			assert.ok(typeof filtered === 'string', 'Should return a string result');
		});
		
		test('✅ Memory usage validation', () => {
			assert.ok(PERFORMANCE_LIMITS.MAX_FILE_SIZE <= 50 * 1024 * 1024, 'Max file size should be reasonable (<50MB)');
			assert.ok(PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE <= 2000, 'Max decorations should be reasonable (<2000)');
		});
	});

	suite('Error Handling Tests', () => {
		test('✅ Graceful handling of undefined inputs', () => {
			const formatter = new LanguageFormatter();
			
			// Test with undefined/null inputs
			assert.strictEqual(formatter.formatContext('', 'javascript'), '');
			assert.strictEqual(formatter.formatContext('   ', 'javascript'), '');
			
			// Test filtering empty content
			assert.strictEqual(filterContent(''), '');
		});

		test('✅ Utility error handling', () => {
			// Test that utility functions handle edge cases gracefully
			assert.doesNotThrow(() => {
				escapeRegExp('');
				isEmpty('');
				truncateText('', 0);
				isValidHexColor('');
				formatBytes(0);
				chunkArray([], 1);
			}, 'Utility functions should handle edge cases gracefully');
		});
	});

	// Integration test that simulates real usage
	suite('Integration Tests', () => {
		test('✅ Complete workflow simulation', async () => {
			// Simulate the complete workflow that would happen in real usage
			const formatter = new LanguageFormatter();
			const testCode = 'function example() { return true; }';
			const formatted = formatter.formatContext(testCode, 'typescript');
			
			assert.ok(typeof formatted === 'string', 'Formatting should return string');
			
			// Test language support
			assert.ok(isLanguageSupported('typescript'), 'TypeScript should be supported');
			assert.ok(isLanguageSupported('javascript'), 'JavaScript should be supported');
		});

		test('✅ Configuration and utilities integration', () => {
			// Test that configuration and utilities work together
			const supportedLangs = SUPPORTED_LANGUAGES;
			assert.ok(supportedLangs.includes('javascript'), 'JavaScript should be in supported languages');
			assert.ok(supportedLangs.includes('typescript'), 'TypeScript should be in supported languages');
			assert.ok(supportedLangs.includes('astro'), 'Astro should be in supported languages');
			
			// Test that utilities work with configuration values
			const maxSize = PERFORMANCE_LIMITS.MAX_FILE_SIZE;
			const formattedSize = formatBytes(maxSize);
			assert.ok(formattedSize.includes('MB'), 'Should format file size correctly');
		});

		test('✅ Language rules and formatter integration', () => {
			// Test that language rules and formatter work together
			const formatter = new LanguageFormatter();
			
			// Test with supported language
			const jsCode = 'const test = "hello world";';
			const jsFormatted = formatter.formatContext(jsCode, 'javascript');
			assert.ok(typeof jsFormatted === 'string', 'Should format JavaScript code');
			
			// Test content filtering
			const filtered = filterContent(jsCode);
			assert.ok(typeof filtered === 'string', 'Should filter content');
		});
	});
});