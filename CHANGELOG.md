# Bracket Lynx

Enhances the development experience by displaying a label next to each closing parenthesis, indicating the name of the corresponding block or function, along with the start and end line numbers.

Bracket Lynx is a VS Code extension that provides intelligent bracket decorations for 11 programming languages and frameworks, helping developers quickly understand code structure and scope. It uses optimized parsing, smart filtering, and multi-level caching for high performance and accuracy. Granular control and color customization are available through the command palette.

Discover more extensions at [bastndev.com/extensions](https://bastndev.com/extensions)

## Changelog

</br>

<!-- --- -->
## [0.9.1] - 2025-10-04

### Fixed
- Resolved issue where bracket decorations did not disappear when code is commented and did not reappear when uncommented, ensuring proper visibility based on code state.

### Changed
- Improved documentation in README and CHANGELOG for better clarity on extension behavior, configuration options, and troubleshooting steps.
- Enhanced README with icons or logos for supported technologies such as Astro, Expo, Vite, etc.

---

## [0.8.0] - 2025-08-27

### Added
- Support for additional technologies including Next.js and Expo

### Changed
- Improved performance optimizations
- Enhanced README with updated instructions and technology support

### Fixed
- Decorations no longer appear when code is commented

---

## [0.7.1] - 2025-08-17

### Added
- Extension logo added for improved branding
- Enhanced README with clearer instructions and updated screenshots

### Changed
- Improved documentation structure and formatting

### Fixed
- Minor typos and formatting issues in README

---

## [0.7.0] - 2025-08-12

### Added
- Support for Astro, Vue, and Svelte frameworks
- New color option for bracket decorations

### Changed
- Improved bracket decoration visuals for better clarity and readability


---

## [0.6.1] - 2025-08-12

### Added
- Support for 14 programming languages and frameworks
- Automatic language detection and activation
- Intelligent bracket decoration system

### Changed
- Expanded language support matrix with modern web technologies
- Improved automatic activation system for supported file types

---

## [0.6.0] - 2025-08-11

### Added
- Comprehensive performance metrics and cache optimizations
- Action checklist for maintainability and future improvements
- Advanced caching system (`AdvancedCacheManager`)
- Optimized parser for large files (`OptimizedBracketParser`)
- Smart debouncing and multi-layered cache
- 12 configurable options (colors, performance limits, etc.)
- Input validation for hex colors
- Granular configuration for prefixes, font styles, and limits

### Changed
- Major performance improvements and caching optimizations
- Improved maintainability and documentation
- Refactored long functions and reduced code duplication
- Enhanced error handling and logging
- Optimized circular imports and consolidated interfaces
- Improved UI for bracket decorations
- Added support for new languages and advanced filtering

### Fixed
- VSCode mock for tests
- Test suite now runs in all environments

### TODO
- Add UniversalDecorator tests
- Create architecture diagrams
- Implement real-time metrics system

---

## [0.5.0] - 2025-08-10

### Added
- Comprehensive test suite (40+ tests) covering configuration, utilities, toggles, language rules, formatters, performance, error handling, and integration
- Testing scripts in package.json (`test`, `watch-tests`)
- ts-node dependency for TypeScript test execution
- Performance tests simulating large files
- Edge case and error handling tests

### Changed
- Major performance improvements and caching optimizations
- Refactored architecture for clearer separation of concerns (`actions/`, `core/`, `lens/`)
- Enhanced color management and configuration validation (regex for hex colors)
- Improved documentation and code comments (partial JSDoc)
- Optimized parser for large files (`OptimizedBracketParser`)
- Smart debouncing and multi-layered cache system

### Fixed
- VSCode mock for tests
- Test suite now runs in all environments
- Minor dependency vulnerabilities (run `npm audit fix`)

### TODO
- Add UniversalDecorator tests
- Create architecture diagrams
- Implement real-time metrics system

---

## [0.4.0] - 2025-08-05

### Added
- Full test suite for extension activation, configuration, bracket parsing, cache management, toggles, decorations, performance, error handling, language support, and integration
- 35+ individual tests across 11 organized suites
- Advanced parsing and performance tests for large files and minified content
- Cache validation and metrics tracking
- Test document with complex JavaScript structures for robust coverage

### Changed
- Improved test coverage to ~85% of main features
- Enhanced debugging and troubleshooting information for test runs
- Updated documentation for test structure and configuration

### Fixed
- Automatic setup and teardown for test environments
- Reliable cache cleanup and editor state management

### TODO
- Expand tests for parser, performance, integration, UI, and configuration
- Add regression, compatibility, memory, and concurrency tests
- Improve benchmarks and load testing with real files

**Status**: ✅ Tests fully implemented and functional  
**Maintainer**: @bastndev  
**Last Update**: August 2025

---

## [0.3.0] - 2025-06-15

### Added
- Enhanced lens system and context headers
- Complete TESTING_GUIDE.md and practical examples

### Changed
- Refactored core parsing engine for speed and reliability
- Improved test coverage and integration
- Improved compatibility with large files

### Testing
- 35+ individual tests, 11 organized suites
- Coverage for activation, configuration, parsing, cache, toggles, decorations, performance, error handling, language support, and integration
- Estimated coverage: ~85% of main features

### Performance
- Incremental parsing and performance filters for large files
- Optimizations for minified files
- Cache metrics and hit ratio

---

## [0.2.0] - 2025-06-01

### Added
- Multi-language support (11 programming languages and frameworks)

### Changed
- Implemented smart filtering and error recovery

---

## [0.0.1] - 2025-05-18

### Added
- Initial public release of Bracket Lynx
- Intelligent bracket decorations for 11 programming languages and frameworks
- Core parsing, lens, and caching systems

