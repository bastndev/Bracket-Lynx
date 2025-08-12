/**
 * Core module exports for Bracket Lynx
 * Centralized exports for better organization and maintainability
 */

// Configuration
export * from './config';

// Utilities
export * from './utils';

// Performance components
export { AdvancedCacheManager, SmartDebouncer } from './performance-cache';
export { OptimizedBracketParser } from './performance-parser';
export { ParserExceptionManager, shouldUseOriginalParser } from './parser-exceptions';

// Types
export type {
  CacheConfig,
  CacheMetrics,
  AdvancedDocumentCacheEntry,
  AdvancedEditorCacheEntry
} from './performance-cache';

export type {
  ParseState,
  ParseStateCache,
  IncrementalParseResult,
  ChangeRegion,
  TokenCacheEntry
} from './performance-parser';

export type {
  ParserExceptionConfig
} from './parser-exceptions';