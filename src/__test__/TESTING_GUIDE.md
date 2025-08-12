# 🧪 Testing Guide for Bracket Lynx

This guide explains how to run and write tests for the Bracket Lynx extension in a simple and practical way.

## 🚀 Running Tests

### Prerequisites
```bash
# Make sure dependencies are installed
npm install
```

### Basic Commands
```bash
# Run all tests
npm test

# Run tests in watch mode (automatically runs when code changes)
npm run watch-tests

# Check TypeScript types
npm run check-types

# Run linting
npm run lint
```

## 📁 Test Structure

```
src/__test__/
├── extension.test.ts          # Main tests
├── TESTING_GUIDE.md           # This guide
├── test-feature_astro.md      # Astro-specific tests
├── test-refactor.md           # Refactoring tests
├── test-v0.4.0.md             # Version 0.4.0 tests
└── test-v0.5.0.md             # Version 0.5.0 tests
```

## ✍️ Writing Tests

### Basic Structure
```typescript
suite('Test Group Name', () => {
  test('✅ Test description', () => {
    // Your test code here
    assert.strictEqual(actualValue, expectedValue, 'Error message');
  });
});
```

### Practical Example
```typescript
suite('Color Management Tests', () => {
  test('✅ Should return valid hex color', () => {
    const color = getCurrentColor();
    assert.ok(color.startsWith('#'), 'Color should start with #');
    assert.strictEqual(color.length, 7, 'Color should be 7 characters');
  });
});
```

## 🔧 Most Used Assertions

```typescript
// Strict equality
assert.strictEqual(actual, expected, 'message');

// Check if something is true
assert.ok(value, 'message');

// Check that a function does not throw
assert.doesNotThrow(() => {
  myFunction();
}, 'message');

// Deep object comparison
assert.deepStrictEqual(object1, object2, 'message');

// Check if something is false
assert.strictEqual(value, false, 'message');
```

## 📊 Current Test Categories

### 1. Configuration Tests
Test the extension configuration:
```typescript
test('✅ BracketLynxConfig default values', () => {
  assert.strictEqual(BracketLynxConfig.mode, 'auto');
  assert.strictEqual(BracketLynxConfig.debug, false);
});
```

### 2. Utility Functions Tests
Test utility functions:
```typescript
test('✅ Core utility functions', () => {
  assert.strictEqual(isEmpty(''), true);
  assert.strictEqual(isValidHexColor('#ff6b6b'), true);
});
```

### 3. Language Rules Tests
Test supported language rules:
```typescript
test('✅ Language support validation', () => {
  assert.strictEqual(isLanguageSupported('javascript'), true);
  assert.strictEqual(isLanguageSupported('unknownlang'), false);
});
```

### 4. Performance Tests
Test performance and limits:
```typescript
test('✅ Large text handling simulation', async () => {
  const startTime = Date.now();
  const filtered = filterContent(largeText);
  const endTime = Date.now();
  assert.ok(endTime - startTime < 100, 'Should be fast');
});
```

### 5. Integration Tests
Test how components work together:
```typescript
test('✅ Full system integration', () => {
  const cache = AdvancedCacheManager.getInstance();
  const parser = OptimizedBracketParser.getInstance();
  assert.ok(cache, 'Cache should be initialized');
  assert.ok(parser, 'Parser should be initialized');
});
```

## 🎯 Best Practices

### ✅ Do
- Use descriptive names with emoji ✅
- Group related tests in suites
- Test positive and negative cases
- Include performance tests for critical functions
- Test error handling and edge cases

### ❌ Avoid
- Tests that depend on other tests
- Very long tests (split into smaller tests)
- Hardcoding values that may change
- Tests without descriptive error messages

## 🐛 Debugging Tests

### In VS Code:
1. Set breakpoints in test files
2. Use `F5` or "Debug: Start Debugging"
3. Select "Node.js" as environment

### In Terminal:
```bash
# Run a specific test
npm test -- --grep "test name"

# Run with more information
npm test -- --reporter spec
```

## ➕ Adding New Tests

### Step by step:
1. **Identify what to test**: New function, module, or behavior
2. **Choose the appropriate suite**: Or create a new one if needed
3. **Write the test**:
   ```typescript
   test('✅ My new functionality', () => {
     // Arrange (prepare)
     const input = 'test input';
     
     // Act (execute)
     const result = myFunction(input);
     
     // Assert (verify)
     assert.strictEqual(result, 'expected output');
   });
   ```
4. **Run the test**: `npm test`
5. **Verify it passes**: ✅

### Complete Example:
```typescript
suite('New Feature Tests', () => {
  test('✅ Should handle empty input', () => {
    const result = myNewFunction('');
    assert.strictEqual(result, '', 'Should return empty string');
  });

  test('✅ Should handle normal input', () => {
    const result = myNewFunction('hello');
    assert.ok(result.length > 0, 'Should return non-empty result');
  });

  test('✅ Should not throw on invalid input', () => {
    assert.doesNotThrow(() => {
      myNewFunction(null);
    }, 'Should handle null gracefully');
  });
});
```

## 📈 Test Coverage

Current tests cover:
- ✅ Extension configuration
- ✅ Utility functions
- ✅ Language rules
- ✅ Color system
- ✅ Cache management
- ✅ Performance parser
- ✅ Exception handling
- ✅ Universal decorators
- ✅ Integration tests

## 🚨 Common Troubleshooting

### Error: "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Tests fail after changes
```bash
# Check types first
npm run check-types

# Then run tests
npm test
```

### Tests are too slow
- Check for infinite loops
- Make sure there are no heavy synchronous operations
- Use mocks for external operations

## 📝 Important Notes

- Tests use **Mocha** as the framework
- Assertions are from **Node.js** native
- Tests run in a **Node.js** environment, not in VS Code
- Some tests may require mocks for VS Code functionalities

Done! With this guide you should be able to write and run tests easily. 🎉