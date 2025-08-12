# Contributing to Bracket Lynx

## Welcome! 🎯

Thank you for your interest in contributing to **Bracket Lynx**! We're excited to have you join our community of developers who are passionate about creating better code visualization tools and enhancing the development experience.

Whether you want to fix bugs, add new features, improve performance, enhance language support, or improve documentation, your contributions are valuable and welcome.

## Understanding the Project 🏗️

Before diving into contributions, we recommend reading our [**Architecture Documentation**](https://github.com/bastndev/Bracket-Lynx/blob/main/ARCHITECTURE.md) to understand:
- How the extension works internally with its dual-parser system
- The relationship between the Core Engine, Lens System, and Control Systems
- Performance optimizations and caching strategies
- The overall project structure and component interactions

This will help you make more effective contributions and understand where your changes fit in the bigger picture.

## Getting Started 🚀

### Prerequisites

- **VS Code** (version 1.74.0 or higher)
- **Node.js** (version 18.x or higher)
- **Git** for version control
- **TypeScript** knowledge (the extension is written in TypeScript)

### Setting Up Your Development Environment

1. **Fork the repository**: Click the "Fork" button on the [Bracket Lynx repository](https://github.com/bastndev/Bracket-Lynx)

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Bracket-Lynx.git
   cd Bracket-Lynx
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Switch to the dev branch** (this is important!):
   ```bash
   git checkout dev
   ```

5. **Open in VS Code**:
   ```bash
   code .
   ```

## Development Workflow 🛠️

### Branch Strategy

**⚠️ IMPORTANT: Always work from the `dev` branch, not `main`!**

1. **Create a feature branch** from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Branch naming conventions**:
   - `feature/language-support-python` - New language support
   - `feature/performance-optimization` - Performance improvements
   - `feature/color-picker-ui` - UI enhancements
   - `bugfix/parser-memory-leak` - Bug fixes
   - `docs/update-readme` - Documentation updates

3. **Examples of good branch names**:
   - `feature/ts-js-improvements`
   - `feature/react-jsx-support`
   - `feature/astro-decorator`
   - `bugfix/cache-invalidation`
   - `performance/parser-optimization`

### Testing Your Changes

1. **Compile the extension**:
   ```bash
   npm run compile
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Test in VS Code**:
   - **Press `F5`** to launch a new VS Code window with your extension loaded
   - Test with different file types: **TypeScript**, **JavaScript**, **React**, **Vue**, **Astro**
   - Test performance with large files
   - Test the toggle functionality and color picker

4. **Check for TypeScript errors**:
   ```bash
   npm run check-types
   ```

5. **Lint your code**:
   ```bash
   npm run lint
   ```

### Making Changes

1. **Write your code** following the existing patterns
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Test thoroughly** with multiple programming languages
5. **Commit your changes** with descriptive messages:
   ```bash
   git add .
   git commit -m "feat: add Python language support with smart bracket detection"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Types of Contributions 📝

### 1. 🌐 Language Support

**Location**: `src/lens/language-formatter.ts`, `src/lens/lens-rules.ts`

Add support for new programming languages:
- Update language detection logic
- Add language-specific formatting rules
- Test with real-world files in that language

**Currently supported**: JavaScript, TypeScript, React, Vue, Svelte, Astro, CSS/SCSS, HTML, JSON, Python, Java, C/C++, C#, Rust, Go, Dart, PHP

### 2. ⚡ Performance Improvements

**Location**: `src/core/performance-*.ts`

Areas for optimization:
- Parser performance for large files
- Caching strategies improvement
- Memory usage optimization
- Background processing enhancements

### 3. 🎯 Core Features

**Parser System** (`src/core/`):
- Bracket parsing algorithms
- Exception handling for edge cases
- Incremental parsing improvements

**Lens System** (`src/lens/`):
- Header generation logic
- Decoration rendering
- Smart filtering rules

**Control Systems** (`src/actions/`):
- Toggle functionality
- Color management
- Configuration handling

### 4. 🎨 UI/UX Improvements

- Color picker enhancements
- Better visual feedback
- Improved user experience
- Accessibility improvements

### 5. 🐛 Bug Fixes

Common areas where bugs might occur:
- Parser edge cases with nested brackets
- Memory leaks in large files
- Decoration positioning issues
- Cache invalidation problems

### 6. 📚 Documentation

Help improve:
- **README.md** - Main project documentation
- **ARCHITECTURE.md** - Technical architecture
- **CONTRIBUTING.md** - This guide
- **CHANGELOG.md** - Version history
- Code comments and inline documentation

## Submitting Your Contribution 🎯

### Pull Request Process

1. **Ensure your feature branch is up to date**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout feature/your-feature-name
   git rebase dev
   ```

2. **Create a Pull Request** targeting the `dev` branch (not `main`!)

3. **PR Title Format**:
   - `feat: add Python language support`
   - `fix: resolve memory leak in parser cache`
   - `perf: optimize bracket parsing for large files`
   - `docs: update architecture documentation`

### PR Requirements

**📋 When creating your PR, please include:**

1. **Clear description** of what you've added/changed
2. **Type of change**:
   - 🚀 New feature
   - 🐛 Bug fix
   - ⚡ Performance improvement
   - 📚 Documentation update
   - 🧹 Code cleanup

3. **Screenshots/GIFs** (highly recommended):
   - Show your feature in action
   - Include examples with different programming languages
   - Demonstrate before/after comparisons

4. **Testing checklist**:
   - ✅ Tested with TypeScript/JavaScript files
   - ✅ Tested with React/JSX components
   - ✅ Tested performance with large files (>1MB)
   - ✅ Tested toggle functionality
   - ✅ No TypeScript errors (`npm run check-types`)
   - ✅ All tests pass (`npm test`)
   - ✅ Code follows linting rules (`npm run lint`)

### Testing Checklist

**Before submitting, please test with:**
- ✅ **JavaScript** (.js) files
- ✅ **TypeScript** (.ts) files  
- ✅ **React/JSX** components
- ✅ **Vue** single-file components
- ✅ **Svelte** components
- ✅ **Astro** files
- ✅ **CSS/SCSS** stylesheets
- ✅ **Large files** (>1MB) for performance
- ✅ **Nested bracket structures**
- ✅ **Toggle functionality** (global/per-file)
- ✅ **Color picker** functionality

## Important Notes ⚠️

### What NOT to Modify

- **`package.json`** - Only maintainers update version numbers and dependencies
- **`dist/`** folder - This is auto-generated during build

### Branch Strategy Details

- **`main`** - Stable release branch (protected)
- **`dev`** - Development branch (where you submit PRs)
- **`feature/*`** - Your feature branches (created from `dev`)

**Flow**: `feature/your-branch` → `dev` → `main`

The maintainer will handle merging `dev` → `main` for releases.

### Code Style Guidelines

- Use **TypeScript** for all new code
- Follow existing naming conventions
- Add appropriate error handling
- Include JSDoc comments for public methods
- Use the existing folder structure

### Performance Considerations

- Test with files larger than 1MB
- Ensure decorations don't exceed the configured limit
- Verify cache performance with repeated operations
- Check memory usage with the VS Code developer tools

## Project Structure Reference 📁

```
bracket-lynx/
├── src/
│   ├── extension.ts              # 🚀 Main entry point
│   ├── core/                     # ⚡ Core systems
│   │   ├── config.ts            # ⚙️ Configuration
│   │   ├── performance-cache.ts  # 💾 Caching
│   │   ├── performance-parser.ts # 🏃 Optimized parsing
│   │   └── parser-exceptions.ts  # 🛡️ Exception handling
│   ├── lens/                     # 👁️ Lens system
│   │   ├── lens.ts              # 🎯 Main lens logic
│   │   ├── language-formatter.ts # 🌐 Language support
│   │   └── lens-rules.ts        # 📋 Filtering rules
│   ├── actions/                  # 🎛️ Control systems
│   │   ├── toggle.ts            # 🔄 Toggle management
│   │   └── colors.ts            # 🎨 Color system
│   └── __test__/                # 🧪 Test suite
└── assets/                      # 🖼️ Resources
```

## Getting Help 🆘

- **Bugs?** Create an [Issue](https://github.com/bastndev/Bracket-Lynx/issues)
- **Architecture questions?** Check the [Architecture docs](https://github.com/bastndev/Bracket-Lynx/blob/main/ARCHITECTURE.md)
- **VS Code Extension API?** Check the [VS Code Extension API docs](https://code.visualstudio.com/api)

## Code of Conduct 📋

Please read and follow our [Code of Conduct](https://github.com/bastndev/Bracket-Lynx/blob/main/CODE_OF_CONDUCT.md) to ensure a welcoming environment for everyone.

## Recognition 🌟

All contributors will be recognized in our project documentation. We appreciate every contribution, whether it's a single-line bug fix or a major feature addition!

## Quick Reference Commands 💻

```bash
# Setup
npm install
git checkout dev

# Development
npm run compile        # Build the extension
npm test              # Run tests
npm run check-types   # Check TypeScript
npm run lint          # Lint code
npm run watch         # Watch mode for development

# Testing
F5                    # Launch extension in VS Code
Ctrl+Shift+P → "Bracket Lynx: Toggle & Refresh 🛠️"
```

---

**Thank you for contributing to Bracket Lynx!** Your work helps developers worldwide have better code visualization and understanding. Every contribution matters, from small bug fixes to major features. 🚀

**Project Link**: https://github.com/bastndev/Bracket-Lynx