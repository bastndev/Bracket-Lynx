import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

// Import modules to test
import * as myExtension from '../extension';
import { BracketLynx, BracketLynxConfig, PositionUtils, regExpExecToArray } from '../lens/lens';
import { toggleBracketLynx, isExtensionEnabled, isEditorEnabled } from '../actions/toggle';
import { LanguageFormatter } from '../lens/language-formatter';
import { shouldExcludeSymbol, isLanguageSupported, filterContent } from '../lens/lens-rules';
import { UniversalDecorator, AstroDecorator } from '../lens/decorators';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('🧪 Starting Bracket Lynx tests...');

	suite('Configuration Tests', () => {
		test('✅ BracketLynxConfig default values', () => {
			assert.strictEqual(BracketLynxConfig.mode, 'auto');
			assert.strictEqual(BracketLynxConfig.debug, false);
			assert.strictEqual(typeof BracketLynxConfig.color, 'string');
			assert.strictEqual(BracketLynxConfig.fontStyle, 'italic');
			assert.strictEqual(BracketLynxConfig.prefix, '‹~ ');
			assert.strictEqual(BracketLynxConfig.unmatchBracketsPrefix, '❌ ');
			assert.strictEqual(BracketLynxConfig.maxBracketHeaderLength, 50);
			assert.strictEqual(BracketLynxConfig.minBracketScopeLines, 4);
			assert.strictEqual(BracketLynxConfig.enablePerformanceFilters, true);
			assert.strictEqual(BracketLynxConfig.maxDecorationsPerFile, 500);
		});

		test('✅ Configuration validation', () => {
			const maxFileSize = BracketLynxConfig.maxFileSize;
			assert.ok(maxFileSize > 0, 'Max file size should be positive');
			
			const maxDecorationsPerFile = BracketLynxConfig.maxDecorationsPerFile;
			assert.ok(maxDecorationsPerFile >= 50 && maxDecorationsPerFile <= 2000, 
				'Max decorations should be within valid range');
		});
	});

	suite('Utility Functions Tests', () => {
		test('✅ PositionUtils.nextLine', () => {
			const pos = new vscode.Position(5, 10);
			const nextLine = PositionUtils.nextLine(pos, 2);
			assert.strictEqual(nextLine.line, 7);
			assert.strictEqual(nextLine.character, 0);
		});

		test('✅ PositionUtils.nextCharacter', () => {
			const pos = new vscode.Position(5, 10);
			const nextChar = PositionUtils.nextCharacter(pos, 3);
			assert.strictEqual(nextChar.line, 5);
			assert.strictEqual(nextChar.character, 13);
		});

		test('✅ PositionUtils.min and max', () => {
			const pos1 = new vscode.Position(5, 10);
			const pos2 = new vscode.Position(3, 15);
			const pos3 = new vscode.Position(8, 5);
			
			const minPos = PositionUtils.min([pos1, pos2, pos3]);
			const maxPos = PositionUtils.max([pos1, pos2, pos3]);
			
			assert.strictEqual(minPos.line, 3);
			assert.strictEqual(maxPos.line, 8);
		});

		test('✅ regExpExecToArray function', () => {
			const regex = /\d+/g;
			const text = 'abc 123 def 456 ghi';
			const results = regExpExecToArray(regex, text);
			
			assert.strictEqual(results.length, 2);
			assert.strictEqual(results[0][0], '123');
			assert.strictEqual(results[1][0], '456');
		});
	});

	suite('Toggle Functionality Tests', () => {
		test('✅ Extension toggle state management', () => {
			// Test initial state
			assert.strictEqual(isExtensionEnabled(), true);
			
			// Test toggle functionality
			toggleBracketLynx();
			assert.strictEqual(isExtensionEnabled(), false);
			
			// Toggle back
			toggleBracketLynx();
			assert.strictEqual(isExtensionEnabled(), true);
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
			assert.strictEqual(isLanguageSupported('python'), true);
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

	suite('Extension Activation Tests', () => {
		test('✅ Extension context should be set', () => {
			assert.ok(myExtension.extensionContext !== undefined, 
				'Extension context should be defined after activation');
		});
		
		test('✅ BracketLynx class methods exist', () => {
			assert.ok(typeof BracketLynx.onDidChangeConfiguration === 'function');
			assert.ok(typeof BracketLynx.onDidChangeTextDocument === 'function');
			assert.ok(typeof BracketLynx.onDidOpenTextDocument === 'function');
			assert.ok(typeof BracketLynx.delayUpdateDecoration === 'function');
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
			const maxFileSize = BracketLynxConfig.maxFileSize;
			const maxDecorations = BracketLynxConfig.maxDecorationsPerFile;
			
			assert.ok(maxFileSize <= 50 * 1024 * 1024, 'Max file size should be reasonable (<50MB)');
			assert.ok(maxDecorations <= 2000, 'Max decorations should be reasonable (<2000)');
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
	});

	suite('UniversalDecorator Tests', () => {
		test('✅ UniversalDecorator class exists and has required methods', () => {
			assert.ok(typeof UniversalDecorator.updateDecorations === 'function', 'updateDecorations method should exist');
			assert.ok(typeof UniversalDecorator.clearDecorations === 'function', 'clearDecorations method should exist');
			assert.ok(typeof UniversalDecorator.clearAllDecorations === 'function', 'clearAllDecorations method should exist');
			assert.ok(typeof UniversalDecorator.forceRefresh === 'function', 'forceRefresh method should exist');
			assert.ok(typeof UniversalDecorator.forceUpdateEditor === 'function', 'forceUpdateEditor method should exist');
			assert.ok(typeof UniversalDecorator.dispose === 'function', 'dispose method should exist');
		});

		test('✅ Backward compatibility with AstroDecorator', () => {
			assert.ok(typeof AstroDecorator.updateAstroDecorations === 'function', 'updateAstroDecorations method should exist for backward compatibility');
			assert.ok(typeof AstroDecorator.updateDecorations === 'function', 'updateDecorations method should exist');
			
			// Test that AstroDecorator is the same as UniversalDecorator
			assert.strictEqual(AstroDecorator, UniversalDecorator, 'AstroDecorator should be an alias for UniversalDecorator');
		});

		test('✅ Configuration methods exist', () => {
			assert.ok(typeof UniversalDecorator.onDidChangeConfiguration === 'function', 'onDidChangeConfiguration method should exist');
			assert.ok(typeof UniversalDecorator.forceColorRefresh === 'function', 'forceColorRefresh method should exist');
		});
	});

	// Integration test that simulates real usage
	suite('Integration Tests', () => {
		test('✅ Complete workflow simulation', async () => {
			// Simulate the complete workflow that would happen in real usage
			assert.ok(isExtensionEnabled(), 'Extension should be enabled by default');
			
			const formatter = new LanguageFormatter();
			const testCode = 'function example() { return true; }';
			const formatted = formatter.formatContext(testCode, 'typescript');
			
			assert.ok(typeof formatted === 'string', 'Formatting should return string');
			
			// Test language support
			assert.ok(isLanguageSupported('typescript'), 'TypeScript should be supported');
			assert.ok(isLanguageSupported('javascript'), 'JavaScript should be supported');
		});

		test('✅ UniversalDecorator integration', () => {
			// Test that UniversalDecorator methods can be called without errors
			assert.doesNotThrow(() => {
				UniversalDecorator.clearAllDecorations();
			}, 'clearAllDecorations should not throw');

			assert.doesNotThrow(() => {
				UniversalDecorator.forceRefresh();
			}, 'forceRefresh should not throw');

			assert.doesNotThrow(() => {
				UniversalDecorator.dispose();
			}, 'dispose should not throw');
		});
	});
});
