# 🧪 Testing Guide for Bracket Lynx Extension

Welcome to the **Bracket Lynx** testing suite! This guide will help new developers understand how to run tests, interpret results, and contribute to the project's quality assurance.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Available Test Commands](#-available-test-commands)
- [Test Categories](#-test-categories)
- [Running Specific Tests](#-running-specific-tests)
- [Understanding Test Results](#-understanding-test-results)
- [Performance Benchmarks](#-performance-benchmarks)
- [Troubleshooting](#-troubleshooting)
- [Contributing New Tests](#-contributing-new-tests)

---

## 🚀 Quick Start

### Prerequisites

```bash
# Make sure dependencies are installed
npm install
```

### Run All Tests (Recommended)

```bash
npm run test:all
```

This runs all test categories in sequence and gives you a complete overview.

---

## 🎯 Available Test Commands

| Command                    | Purpose                   | Timeout | What It Tests                          |
| -------------------------- | ------------------------- | ------- | -------------------------------------- |
| `npm run test`             | **Quick health checks**   | 5s      | Basic functionality, environment setup |
| `npm run test:integration` | **Component integration** | 10s     | Multi-language processing, workflows   |
| `npm run test:performance` | **Speed & efficiency**    | 30s     | Parsing speed, memory usage            |
| `npm run test:all`         | **Complete test suite**   | All     | Runs all tests in sequence             |

---

## 📊 Test Categories

### 🚀 Quick Tests - Basic Health Check

**When to run:** Always run these first when you start working on the project.

```bash
npm run test
```

**What it validates:**

- ✅ VSCode mock environment works
- ✅ Basic bracket parsing functionality
- ✅ Language detection and validation
- ✅ Document creation utilities
- ✅ Edge case handling (empty files, malformed code)

**Expected output:**

```
🚀 Quick Tests - Basic Health Check
  Environment Setup
    ✔ ✅ VSCode mock should be available
    ✔ ✅ Test utilities should work
    ✔ ✅ Configuration mock should work
  Basic Functionality
    ✔ ✅ Bracket detection should work
    ✔ ✅ Language validation should work
    ✔ ✅ Document creation for different languages
  Edge Cases
    ✔ ✅ Empty content should be handled gracefully
    ✔ ✅ Malformed brackets should not crash

8 passing (4ms)
```

### 🔄 Integration Tests - Component Integration

**When to run:** After making changes to multiple components or workflows.

```bash
npm run test:integration
```

**What it validates:**

- ✅ Multi-language processing (JavaScript, TypeScript, HTML, JSON, CSS)
- ✅ Mixed content scenarios (JSX, CSS-in-JS, nested structures)
- ✅ Error handling across different scenarios
- ✅ End-to-end workflow processing

**Expected output:**

```
🔄 Integration Tests - Component Integration
  Multi-Language Processing
    ✅ javascript: Found 4 bracket pairs
    ✅ typescript: Found 24 bracket pairs
    ✅ html: Found 2 bracket pairs
    ✅ json: Found 6 bracket pairs
    ✅ css: Found 4 bracket pairs
      ✔ 🔄 Should process all supported languages consistently

4 passing (6ms)
```

### ⚡ Performance Tests - Speed & Efficiency

**When to run:** Before releasing, after performance optimizations, or when investigating slowdowns.

```bash
npm run test:performance
```

**What it validates:**

- ⚡ Large file processing speed (< 2000ms for large files)
- ⚡ Multiple consecutive operations (< 5000ms for 100 operations)
- ⚡ Deep nesting handling (< 1000ms for 30 levels)
- ⚡ Memory usage efficiency (< 50MB increase for 50 documents)
- ⚡ Concurrent processing performance

**Expected output:**

```
⚡ Performance Tests - Speed & Efficiency
  Parsing Performance
    📊 Large file (48794 chars) parsed in 51.67ms
      ✔ ⚡ Large file processing should be fast (55ms)
    📊 100 operations completed in 3.91ms (avg: 0.04ms)
      ✔ ⚡ Multiple consecutive operations should maintain speed

5 passing (67ms)
```

---

## 🎪 Running Specific Tests

### Target Specific Functionality

```bash
# Test only environment setup
npx mocha --require ts-node/register --extensions ts --grep "Environment Setup" src/__test__/simple.test.ts

# Test only bracket detection
npx mocha --require ts-node/register --extensions ts --grep "Bracket detection" src/__test__/simple.test.ts

# Test only performance parsing
npx mocha --require ts-node/register --extensions ts --grep "Parsing Performance" src/__test__/simple.test.ts
```

### Debug Mode (Verbose Output)

```bash
# Run with detailed logging
DEBUG=* npm run test

# Run single test with timeout extended
npx mocha --require ts-node/register --extensions ts --timeout 10000 --grep "Large file" src/__test__/simple.test.ts
```

---

## 📈 Understanding Test Results

### ✅ Success Indicators

- **Green check marks (✔)**: Test passed
- **Performance metrics**: Timing information (e.g., "parsed in 51.67ms")
- **Memory metrics**: Memory usage (e.g., "Memory increase: 0.82MB")
- **Feature confirmations**: (e.g., "Found 24 bracket pairs")

### ❌ Failure Indicators

- **Red X marks**: Test failed
- **Error messages**: Specific failure reasons
- **Timeout warnings**: Operations taking too long
- **Memory warnings**: Excessive memory usage

### 📊 Performance Benchmarks

| Test Type               | Expected Performance | Warning Threshold | Failure Threshold |
| ----------------------- | -------------------- | ----------------- | ----------------- |
| **Large File Parsing**  | < 100ms              | 500ms             | 2000ms            |
| **Multiple Operations** | < 1ms average        | 10ms average      | 50ms average      |
| **Deep Nesting**        | < 10ms               | 100ms             | 1000ms            |
| **Memory Usage**        | < 5MB increase       | 25MB increase     | 50MB increase     |

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. **Tests not running**

```bash
Error: Cannot find module 'ts-node'
```

**Solution:**

```bash
npm install --save-dev ts-node typescript
npm run test
```

#### 2. **VSCode mock errors**

```bash
Error: Cannot find module 'vscode'
```

**Solution:** This is expected - our mock handles this. If tests still fail:

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run test
```

#### 3. **Timeout errors**

```bash
Error: Timeout of 5000ms exceeded
```

**Solution:**

```bash
# Run performance tests with extended timeout
npx mocha --require ts-node/register --extensions ts --timeout 30000 --grep "Performance" src/__test__/simple.test.ts
```

#### 4. **Memory issues**

```bash
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Solution:**

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 ./node_modules/.bin/mocha --require ts-node/register --extensions ts src/__test__/simple.test.ts
```

### Debug Commands

```bash
# Check test file syntax
npx tsc --noEmit src/__test__/simple.test.ts

# Run single test with stack trace
npx mocha --require ts-node/register --extensions ts --grep "specific test name" --reporter spec src/__test__/simple.test.ts

# Check memory usage during tests
node --inspect ./node_modules/.bin/mocha --require ts-node/register --extensions ts src/__test__/simple.test.ts
```

---

## 🔧 Development Workflow

### Before Starting Development

```bash
# Verify everything works
npm run test:all
```

### During Development

```bash
# Quick sanity check
npm run test

# After major changes
npm run test:integration
```

### Before Committing

```bash
# Full test suite
npm run test:all

# Check performance impact
npm run test:performance
```

### Before Releasing

```bash
# Complete validation
npm run test:all

# Verify no performance regressions
npm run test:performance
```

---

## 📝 Contributing New Tests

### Adding a New Test Category

1. **Add to `simple.test.ts`**:

```typescript
describe('🔥 Your New Test Category', function () {
  this.timeout(10000);

  it('✅ Should test your new feature', () => {
    // Your test logic here
    assert.ok(true, 'Test passed');
  });
});
```

2. **Add to `package.json`**:

```json
{
  "scripts": {
    "test:yourcategory": "mocha --require ts-node/register --extensions ts --timeout 10000 --grep \"Your New Test Category\" src/__test__/simple.test.ts"
  }
}
```

### Test Writing Guidelines

#### ✅ Good Test Practices

```typescript
// Descriptive names with emojis
it('✅ Should parse complex nested structures correctly', () => {
  // Arrange
  const testContent = 'your test content';

  // Act
  const result = TestUtilities.simulateBracketParsing(testContent);

  // Assert
  assert.ok(result.length > 0, 'Should find brackets');
  TestUtilities.validateBracketStructure(result);
});
```

#### ❌ Avoid These Patterns

```typescript
// Too generic
it('test parsing', () => { ... });

// No error context
assert.ok(result, 'failed');

// Hard to debug
assert.strictEqual(result.length, 5);
```

### Performance Test Guidelines

```typescript
it('⚡ Your performance test', async () => {
  const { result, duration } = await measureTime(() => {
    // Your performance-critical code
    return yourFunction(testData);
  });

  assert.ok(result, 'Should return valid result');
  assert.ok(duration < 100, `Too slow: ${duration}ms`);

  console.log(`    📊 Performance: ${duration.toFixed(2)}ms`);
});
```

---

## 🎯 Test Scenarios Coverage

### Currently Tested ✅

- Basic bracket parsing and validation
- Multi-language support (JavaScript, TypeScript, HTML, JSON, CSS)
- Performance with large files (48K+ characters)
- Memory efficiency (50 document processing)
- Deep nesting (30 levels)
- Error handling with malformed code
- Edge cases (empty files, unbalanced brackets)

### Future Test Ideas 💡

- Real VSCode integration tests
- User interaction simulation
- Extension activation/deactivation
- Configuration change handling
- File watching and updates
- Multi-workspace scenarios

---

## 📊 CI/CD Integration (Future)

When we add CI/CD, you'll be able to use:

```bash
# For CI environments
npm run test:ci

# With coverage reporting
npm run test:coverage

# With test artifacts
npm run test:report
```

---

## 🆘 Getting Help

### Internal Resources

- **Test Setup**: `src/__test__/test-setup.ts` - Mock utilities and helpers
- **Main Tests**: `src/__test__/simple.test.ts` - All test implementations
- **Project Config**: `package.json` - Test scripts and dependencies

### External Resources

- [Mocha Documentation](https://mochajs.org/) - Test framework
- [Node.js Assert](https://nodejs.org/api/assert.html) - Assertion library
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html) - TypeScript-specific testing

### Team Support

If you encounter issues not covered in this guide:

1. Check the test output for specific error messages
2. Review recent changes that might affect tests
3. Ask team members who worked on similar features
4. Create an issue with test output and system information

---

## 🎉 Success!

If all tests pass, you should see:

```
🎉 ALL TESTS PASSED - EXTENSION READY FOR PRODUCTION!
```

**Happy Testing! 🧪✨**

---

_Last updated: August 2025_  
_Version: 0.7.0_  
_Maintainer: Development Team_
