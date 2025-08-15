/**
 * Centralized configuration for Bracket Lynx
 * This file contains all constants and configuration values used across the extension
 */

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

export const PERFORMANCE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_DECORATIONS_PER_FILE: 300,
  MIN_BRACKET_SCOPE_LINES: 5,
  MAX_CONTENT_ANALYSIS_SIZE: 100 * 1024,
  MAX_HEADER_LENGTH: 50,
  DEBOUNCE_DELAY: 150,
} as const;

export const EXCLUDED_SYMBOLS = [
  '!',
  '"',
  '#',
  '$',
  '%',
  '&',
  "'",
  ',',
  '.',
  '/',
  ';',
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
  '---',
  '--',
  '...',
  ':',
  '(',
  ')',
  '=',
  '>',
  'MARK',
  // 'const',
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

export const FUNCTION_SYMBOLS = {
  ARROW_FUNCTION: '❨❩➤',
  ASYNC_FUNCTION: '⧘⧙',
  COMPLEX_FUNCTION: '⇄',
  PROPS: '➤',
} as const;

export const CACHE_CONFIG = {
  MAX_DOCUMENT_CACHE_SIZE: 50,
  MAX_EDITOR_CACHE_SIZE: 20,
  DOCUMENT_CACHE_TTL: 5 * 60 * 1000,
  EDITOR_CACHE_TTL: 10 * 60 * 1000,
  CLEANUP_INTERVAL: 60 * 1000,
  MEMORY_PRESSURE_THRESHOLD: 100,
  AGGRESSIVE_CLEANUP_THRESHOLD: 200,
  MAX_MEMORY_USAGE: 500,
} as const;

export const DEFAULT_STYLES = {
  COLOR: '#515151',
  FONT_STYLE: 'italic',
  PREFIX: '‹~ ',
  UNMATCH_PREFIX: '❌ ',
} as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ProblematicLanguage = (typeof PROBLEMATIC_LANGUAGES)[number];
export type AllowedJsonFile = (typeof ALLOWED_JSON_FILES)[number];

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
  if (languageId === 'json' || languageId === 'jsonc') {
    return isAllowedJsonFile(fileName);
  }
  return isSupportedLanguage(languageId);
}

export function getFunctionSymbols(): typeof FUNCTION_SYMBOLS {
  return FUNCTION_SYMBOLS;
}
