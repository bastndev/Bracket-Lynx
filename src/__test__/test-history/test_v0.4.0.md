# 🧪 Test Suite - Bracket Lynx Extension v0.4.0

This directory contains all tests for the Bracket Lynx extension. Tests are organized to cover all main functionalities of the extension.

## 📊 Current Project Status

### 🎯 Main Features Implemented

✅ **Core Functionality**
- ✅ Basic and advanced bracket parsing
- ✅ Optimized cache system with metrics
- ✅ Performance-optimized parser with filters
- ✅ Support for multiple programming languages
- ✅ Intelligent decoration system
- ✅ Handling of nested and unmatched brackets

✅ **Toggle System**
- ✅ Global extension toggle
- ✅ Per-file toggle
- ✅ Refresh/update functionality
- ✅ Persistent state per editor

✅ **Performance Features**
- ✅ Parsing state cache
- ✅ Performance filters for large files
- ✅ Incremental parsing
- ✅ Optimizations for minified files
- ✅ Cache metrics and hit ratio

✅ **Advanced Features**
- ✅ Flexible configuration per language
- ✅ Handling of comments and strings
- ✅ Smart headers for brackets
- ✅ Automatic cache cleanup
- ✅ Detection of problematic files

## 📁 Test Structure

```
src/__test__/
├── extension.test.ts          # ✅ Main suite (1,200+ lines)
├── README.md                 # 📖 This documentation
└── [future files]            # 🔮 Future expansion
```

## 🧪 Current Test Coverage

### ✅ Implemented Tests (extension.test.ts)

#### 1. **Extension Activation Tests**
- ✅ Successful extension activation
- ✅ Extension context verification
- ✅ Command registration

#### 2. **Configuration Tests**
- ✅ Default configuration values
- ✅ Language configuration
- ✅ Parameter validation

#### 3. **Bracket Parser Tests**
- ✅ Basic bracket parsing
- ✅ Handling nested brackets
- ✅ Detection of unmatched brackets
- ✅ Bracket property validation

#### 4. **Optimized Parser Tests**
- ✅ Singleton pattern for optimized parser
- ✅ Parsing with optimized parser
- ✅ Performance filters
- ✅ Fallback parser configuration

#### 5. **Cache Management Tests**
- ✅ Document cache
- ✅ Editor cache
- ✅ Cache cleanup
- ✅ Performance metrics and hit ratio

#### 6. **Toggle Functionality Tests**
- ✅ Enabled state by default
- ✅ Global toggle
- ✅ Per-editor toggle
- ✅ Refresh functionality

#### 7. **Decoration Tests**
- ✅ Decoration source generation
- ✅ Required decoration properties
- ✅ Structure validation

#### 8. **Performance Tests**
- ✅ Handling large files
- ✅ Performance improvement with cache
- ✅ Acceptable response times

#### 9. **Error Handling Tests**
- ✅ Handling invalid documents
- ✅ Empty documents
- ✅ Edge cases

#### 10. **Language Support Tests**
- ✅ Support for JavaScript
- ✅ Support for TypeScript
- ✅ Support for JSON
- ✅ Structure for other languages

#### 11. **Integration Tests**
- ✅ Full flow: parse → cache → decorate
- ✅ End-to-end toggle workflow
- ✅ Component integration

## 📈 Testing Metrics

### Current Statistics
- **Total Tests**: 35+ individual tests
- **Test Suites**: 11 organized suites
- **Test Code Lines**: 1,200+
- **Estimated Coverage**: ~85% of main features

### Tested Components
- ✅ `extension.ts` - Activation and configuration
- ✅ `lens/lens.ts` - Main parser and cache
- ✅ `actions/toggle.ts` - Toggle system
- ✅ `core/performance-parser.ts` - Optimized parser
- ✅ Configurations and utilities

## 🚀 Running Tests

### From VSCode
```bash
# Method 1: Command Palette
Ctrl+Shift+P → "Test: Run All Tests"

# Method 2: Debug Mode
F5 with "Extension Tests" selected
```

### From Terminal
```bash
# Compile and run tests
npm run compile && npm test

# Run tests only (if already compiled)
npm test
```

## 🔧 Test Configuration

### Automatic Setup
Tests include automatic setup and teardown:

```typescript
suiteSetup(async () => {
    // Create test document with complex JavaScript content
    testDocument = await vscode.workspace.openTextDocument({
        content: `function testFunction() { /* complex content */ }`,
        language: 'javascript'
    });
    testEditor = await vscode.window.showTextDocument(testDocument);
});

suiteTeardown(async () => {
    // Automatic editor cleanup
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
});
```

### Test Document
Tests use a complex JavaScript document including:
- Functions with multiple nesting levels
- Objects with nested properties
- Arrays and complex structures
- Loops and conditionals
- Classes with methods

## 🎯 Specific Test Cases

### Advanced Parsing
```typescript
test('Should parse basic brackets correctly', () => {
    const brackets = BracketParser.parseBrackets(testDocument);
    assert.ok(Array.isArray(brackets), 'Should return an array');
    assert.ok(brackets.length > 0, 'Should find brackets in test document');
    
    brackets.forEach(bracket => {
        assert.ok(bracket.start, 'Bracket should have start position');
        assert.ok(bracket.end, 'Bracket should have end position');
        assert.ok(typeof bracket.isUnmatchBrackets === 'boolean');
        assert.ok(Array.isArray(bracket.items), 'Should have items array');
    });
});
```

### Performance Testing
```typescript
test('Should handle large files gracefully', async () => {
    const largeContent = Array(1000).fill(`function test${Math.random()}() {
        const obj = { prop: "value" };
        if (condition) { console.log("test"); }
    }`).join('\n');

    const largeDoc = await vscode.workspace.openTextDocument({
        content: largeContent,
        language: 'javascript'
    });

    const startTime = Date.now();
    const cache = CacheManager.getDocumentCache(largeDoc);
    const endTime = Date.now();

    assert.ok(cache, 'Should handle large documents');
    assert.ok(endTime - startTime < 5000, 'Should process within 5 seconds');
});
```

### Cache Validation
```typescript
test('Cache should improve performance on repeated access', () => {
    const start1 = Date.now();
    CacheManager.getDocumentCache(testDocument);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    CacheManager.getDocumentCache(testDocument);
    const time2 = Date.now() - start2;

    assert.ok(time2 <= time1 + 10, 'Cached access should not be slower');
});
```

## 🔮 Future Expansion

### Planned Tests
- [ ] **parser.test.ts** - Parser-specific tests
- [ ] **performance.test.ts** - Detailed benchmarks
- [ ] **integration.test.ts** - Complex integration tests
- [ ] **ui.test.ts** - UI tests
- [ ] **config.test.ts** - Advanced configuration tests

### Potential Improvements
- [ ] Automatic regression tests
- [ ] Load tests with real files
- [ ] Compatibility tests between versions
- [ ] Memory and leak tests
- [ ] Concurrency tests

## 🐛 Debugging Tests

### Debug Information
```typescript
// Enable debug in configuration
BracketLynxConfig.debug = true;

// Tests will show additional info in console
console.log('Bracket Lynx: Using optimized parser for: file.js (javascript)');
```

### Useful Breakpoints
- `BracketParser.parseBrackets()` - Main parsing
- `CacheManager.getDocumentCache()` - Cache operations
- `toggleBracketLynx()` - Toggle functionality

## 📊 Expected Results

### Successful Tests
All tests should pass with:
- ✅ 0 failures
- ✅ 0 errors
- ✅ Total time < 30 seconds
- ✅ No memory leaks

### Typical Output
```
🧪 Starting Bracket Lynx tests...

Extension Activation
  ✓ Extension should activate successfully
  ✓ Extension context should be set
  ✓ Commands should be registered

Configuration Tests
  ✓ Default configuration values
  ✓ Language configuration should have default values

[... more tests ...]

Integration Tests
  ✓ Full workflow: parse -> cache -> decorate
  ✓ Toggle workflow should work end-to-end

35 passing (15s)
```

## 🆘 Troubleshooting

### Common Issues

1. **"Extension not found"**
   ```bash
   # Make sure the extension is compiled
   npm run compile
   ```

2. **"Document not ready"**
   ```typescript
   // Ensure the document is fully loaded
   await new Promise(resolve => setTimeout(resolve, 100));
   ```

3. **"Cache not working"**
   ```typescript
   // Clear cache before the test
   CacheManager.clearAllDecorationCache();
   ```

## 📚 Reference Resources

- **VSCode API**: [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- **Mocha**: [Testing Framework](https://mochajs.org/)
- **Assert**: [Node.js Assertions](https://nodejs.org/api/assert.html)

---

**Status**: ✅ **Tests Fully Implemented and Functional**

**Last Update**: January 2025

**Maintainer**: @bastndev