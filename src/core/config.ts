/**
 * Centralized configuration for Bracket Lynx
 * This file contains all constants and configuration values used across the extension
 */

// ============================================================================
// SUPPORTED LANGUAGES AND FILES
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  'astro',
  'css',
  'html',
  'javascript',
  'javascriptreact',
  'json',
  'jsonc',
  'less',
  'sass',
  'scss',
  'svelte',
  'typescript',
  'typescriptreact',
  'vue',
] as const;

export const ALLOWED_JSON_FILES = ['package.json'] as const;

// Languages that require special parsing due to mixed content
export const PROBLEMATIC_LANGUAGES = [
  'astro',
  'html',
  'vue',
  'svelte',
  'javascriptreact',
  'typescriptreact',
] as const;

export const PROBLEMATIC_EXTENSIONS = [
  '.astro',
  '.html',
  '.vue',
  '.svelte',
  '.jsx',
  '.tsx',
] as const;

// ============================================================================
// PERFORMANCE LIMITS
// ============================================================================

export const PERFORMANCE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB (reduced from 10MB)
  MAX_DECORATIONS_PER_FILE: 300, // 300 (reduced from 500)
  MIN_BRACKET_SCOPE_LINES: 5, // 5 (increased from 4)
  MAX_CONTENT_ANALYSIS_SIZE: 100 * 1024, // 100KB
  MAX_HEADER_LENGTH: 50,
  DEBOUNCE_DELAY: 150, // Base debounce delay in ms
} as const;

// ============================================================================
// FILTERING AND FORMATTING
// ============================================================================

export const EXCLUDED_SYMBOLS = [
  '!',
  '"',
  '#',
  '$',
  '%',
  '&',
  "'",
  '(',
  ')',
  ',',
  '.',
  '/',
  ':',
  ';',
  '=',
  '>',
  '<',
  '?',
  '@',
  '[',
  '\\',
  ']',
  '^',
  '_',
  '`',
  '{',
  '|',
  '}',
  '//',
  'const',
  '---',
  '--',
  '...',
  'MARK',
] as const;

export const WORD_LIMITS = {
  MAX_HEADER_WORDS: 1,
  MAX_EXCEPTION_WORDS: 2,
  MAX_CSS_WORDS: 2,
} as const;

export const KEYWORDS = {
  EXCEPTION_WORDS: ['export'] as const,
  PROPS_PATTERNS: ['props'] as const,
  CSS_RELATED_WORDS: ['style', 'styles', 'css'] as const,
  TRY_CATCH_KEYWORDS: ['try', 'catch', 'finally'] as const,
  IF_ELSE_KEYWORDS: ['if', 'else', 'switch', 'case'] as const,
} as const;

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export const CACHE_CONFIG = {
  MAX_DOCUMENT_CACHE_SIZE: 50,
  MAX_EDITOR_CACHE_SIZE: 20,
  DOCUMENT_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  EDITOR_CACHE_TTL: 10 * 60 * 1000, // 10 minutes
  CLEANUP_INTERVAL: 60 * 1000, // 1 minute
  MEMORY_PRESSURE_THRESHOLD: 100, // 100MB
  AGGRESSIVE_CLEANUP_THRESHOLD: 200, // 200MB
  MAX_MEMORY_USAGE: 500, // 500MB
} as const;

// ============================================================================
// DEFAULT STYLES
// ============================================================================

export const DEFAULT_STYLES = {
  COLOR: '#515151',
  FONT_STYLE: 'italic',
  PREFIX: '‹~ ',
  UNMATCH_PREFIX: '❌ ',
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ProblematicLanguage = (typeof PROBLEMATIC_LANGUAGES)[number];
export type AllowedJsonFile = (typeof ALLOWED_JSON_FILES)[number];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function isSupportedLanguage(
  languageId: string
): languageId is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(languageId);
}

export function isProblematicLanguage(
  languageId: string
): languageId is ProblematicLanguage {
  return (PROBLEMATIC_LANGUAGES as readonly string[]).includes(languageId);
}

export function isAllowedJsonFile(fileName: string): boolean {
  const baseName = fileName.split('/').pop() || fileName;
  return (ALLOWED_JSON_FILES as readonly string[]).includes(baseName);
}

export function shouldProcessFile(
  languageId: string,
  fileName: string
): boolean {
  // For JSON files, check if it's in the allowed list
  if (languageId === 'json' || languageId === 'jsonc') {
    return isAllowedJsonFile(fileName);
  }

  // For other languages, use the standard check
  return isSupportedLanguage(languageId);
}
