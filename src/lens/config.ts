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

// Performance constants moved to src/core/utils.ts for centralized performance management

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

// getFunctionSymbols moved to js-ts-decorator-function.ts for centralized management
