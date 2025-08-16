import * as vscode from 'vscode';

// PERFORMANCE CONFIGURATION
export const PERFORMANCE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_DECORATIONS_PER_FILE: 300,
  MIN_BRACKET_SCOPE_LINES: 5,
  MAX_CONTENT_ANALYSIS_SIZE: 100 * 1024,
  MAX_HEADER_LENGTH: 50,
  DEBOUNCE_DELAY: 150,
} as const;

export const CACHE_CONFIG = {
  MAX_DOCUMENT_CACHE_SIZE: 50,
  MAX_EDITOR_CACHE_SIZE: 20,
  DOCUMENT_CACHE_TTL: 5 * 60 * 1000,
  EDITOR_CACHE_TTL: 10 * 60 * 1000,
  CLEANUP_INTERVAL: 60 * 1000,
} as const;


// ============================================================================
// LANGUAGE AND FILE CONFIGURATION
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

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type ProblematicLanguage = (typeof PROBLEMATIC_LANGUAGES)[number];
export type AllowedJsonFile = (typeof ALLOWED_JSON_FILES)[number];


// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Safely escape a string for use in regular expressions
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize whitespace in a string
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a string is empty or only whitespace
 */
export function isEmpty(text: string | null | undefined): boolean {
  return !text || text.trim().length === 0;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// POSITION UTILITIES
// ============================================================================

export namespace PositionUtils {
  export const nextLine = (position: vscode.Position, increment: number = 1) =>
    new vscode.Position(position.line + increment, 0);

  export const nextCharacter = (
    position: vscode.Position,
    increment: number = 1
  ) => new vscode.Position(position.line, position.character + increment);

  export const min = (positions: vscode.Position[]) =>
    positions.reduce((a, b) => (a.isBefore(b) ? a : b), positions[0]);

  export const max = (positions: vscode.Position[]) =>
    positions.reduce((a, b) => (a.isAfter(b) ? a : b), positions[0]);
}

// ============================================================================
// FILE UTILITIES
// ============================================================================

/**
 * Get the base name of a file from its full path
 */
export function getBaseName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Check if a file is likely minified based on its name
 */
export function isMinifiedFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  const minifiedPatterns = [
    '.min.js',
    '.min.css',
    '.bundle.js',
    '.chunk.js',
    '.min.map',
    '.bundle.css',
    '.dist.js',
    '.prod.js',
  ];

  return minifiedPatterns.some((pattern) => lowerName.endsWith(pattern));
}

/**
 * Calculate average line length for a document
 */
export function getAverageLineLength(document: vscode.TextDocument): number {
  const text = document.getText();
  const lineCount = document.lineCount;

  if (lineCount === 0) {
    return 0;
  }

  return text.length / lineCount;
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Simple debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Create a hash from a string (simple implementation)
 */
export function createHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Check if a value is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * Validate that a number is within a range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Remove duplicates from an array
 */
export function removeDuplicates<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Chunk an array into smaller arrays of specified size
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// REGEX UTILITIES
// ============================================================================

/**
 * Execute a regex and return all matches as an array
 */
export function regExpExecToArray(
  regexp: RegExp,
  text: string
): RegExpExecArray[] {
  const result: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = regexp.exec(text)) !== null) {
    result.push(match);

    // Prevent infinite loop on zero-length matches
    if (match.index === regexp.lastIndex) {
      regexp.lastIndex++;
    }
  }

  return result;
}

/**
 * Create a regex pattern part with proper escaping
 */
export function makeRegExpPart(text: string): string {
  return escapeRegExp(text).replace(/\s+/, '\\s');
}
// ============================================================================
// ERROR HANDLING SYSTEM
// ============================================================================

/**
 * Base error class for all Bracket Lynx errors
 */
export class BracketLynxError extends Error {
  public readonly timestamp: Date;
  public readonly context?: any;

  constructor(message: string, public readonly code: string, context?: any) {
    super(message);
    this.name = 'BracketLynxError';
    this.timestamp = new Date();
    this.context = context;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get formatted error message for logging
   */
  public getFormattedMessage(): string {
    return `[${this.code}] ${this.message}${this.context ? ` | Context: ${JSON.stringify(this.context)}` : ''}`;
  }
}

/**
 * Specific error types
 */
export class ParseError extends BracketLynxError {
  constructor(message: string, context?: any) {
    super(message, 'PARSE_ERROR', context);
  }
}

export class CacheError extends BracketLynxError {
  constructor(message: string, context?: any) {
    super(message, 'CACHE_ERROR', context);
  }
}

export class ConfigurationError extends BracketLynxError {
  constructor(message: string, context?: any) {
    super(message, 'CONFIG_ERROR', context);
  }
}

export class PerformanceError extends BracketLynxError {
  constructor(message: string, context?: any) {
    super(message, 'PERFORMANCE_ERROR', context);
  }
}

export class DecorationError extends BracketLynxError {
  constructor(message: string, context?: any) {
    super(message, 'DECORATION_ERROR', context);
  }
}

export class DocumentError extends BracketLynxError {
  constructor(message: string, context?: any) {
    super(message, 'DOCUMENT_ERROR', context);
  }
}

// ============================================================================
// LOGGING SYSTEM
// ============================================================================

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export enum LogCategory {
  PARSER = 'parser',
  CACHE = 'cache',
  TOGGLE = 'toggle',
  COLOR = 'color',
  PERFORMANCE = 'performance',
  DECORATION = 'decoration',
  GENERAL = 'general'
}

/**
 * Simple logger for Bracket Lynx
 */
class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.WARN;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure logging level
   */
  public configure(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log error message
   */
  public error(message: string, context?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.ERROR, category, message, context);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: any, category: LogCategory = LogCategory.GENERAL): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  /**
   * Log BracketLynxError
   */
  public logError(error: BracketLynxError, category?: LogCategory): void {
    const logCategory = category || this.getCategoryFromError(error);
    this.log(LogLevel.ERROR, logCategory, error.getFormattedMessage(), error.context, error);
  }

  private log(level: LogLevel, category: LogCategory, message: string, context?: any, error?: Error): void {
    // Check if logging is enabled for this level
    if (level > this.logLevel) {
      return;
    }

    const levelName = LogLevel[level];
    const prefix = `[BracketLynx:${levelName}:${category.toUpperCase()}]`;
    const timestamp = new Date().toISOString();
    
    const logMessage = `${prefix} ${message}`;
    const logContext = context ? { context, timestamp } : { timestamp };

    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage, logContext, error);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logContext);
        break;
      case LogLevel.INFO:
        console.info(logMessage, logContext);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage, logContext);
        break;
    }
  }

  private getCategoryFromError(error: BracketLynxError): LogCategory {
    switch (error.code) {
      case 'PARSE_ERROR':
        return LogCategory.PARSER;
      case 'CACHE_ERROR':
        return LogCategory.CACHE;
      case 'CONFIG_ERROR':
        return LogCategory.GENERAL;
      case 'PERFORMANCE_ERROR':
        return LogCategory.PERFORMANCE;
      case 'DECORATION_ERROR':
        return LogCategory.DECORATION;
      case 'DOCUMENT_ERROR':
        return LogCategory.GENERAL;
      default:
        return LogCategory.GENERAL;
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// ============================================================================
// SAFE EXECUTION UTILITIES
// ============================================================================

/**
 * Execute a synchronous operation safely with fallback
 */
export function safeExecute<T>(
  operation: () => T,
  fallback: T,
  context?: string,
  category: LogCategory = LogCategory.GENERAL
): T {
  try {
    return operation();
  } catch (error) {
    const message = `Safe execution failed: ${context || 'Unknown operation'}`;
    
    if (error instanceof BracketLynxError) {
      logger.logError(error, category);
    } else {
      logger.error(message, { 
        originalError: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, category);
    }
    
    return fallback;
  }
}

/**
 * Execute an asynchronous operation safely with fallback
 */
export async function safeExecuteAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string,
  category: LogCategory = LogCategory.GENERAL
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = `Safe async execution failed: ${context || 'Unknown async operation'}`;
    
    if (error instanceof BracketLynxError) {
      logger.logError(error, category);
    } else {
      logger.error(message, { 
        originalError: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, category);
    }
    
    return fallback;
  }
}

/**
 * Execute operation with retry logic
 */
export async function safeExecuteWithRetry<T>(
  operation: () => Promise<T>,
  fallback: T,
  maxRetries: number = 3,
  retryDelay: number = 100,
  context?: string,
  category: LogCategory = LogCategory.GENERAL
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break; // Don't retry on last attempt
      }
      
      logger.warn(`Retry attempt ${attempt}/${maxRetries} failed: ${context || 'Unknown operation'}`, {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error)
      }, category);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  
  // All retries failed
  const message = `All retry attempts failed: ${context || 'Unknown operation'}`;
  
  if (lastError instanceof BracketLynxError) {
    logger.logError(lastError, category);
  } else {
    logger.error(message, { 
      maxRetries,
      originalError: lastError instanceof Error ? lastError.message : String(lastError),
      stack: lastError instanceof Error ? lastError.stack : undefined
    }, category);
  }
  
  return fallback;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate VS Code document
 */
export function validateDocument(document: vscode.TextDocument | undefined): asserts document is vscode.TextDocument {
  if (!document) {
    throw new DocumentError('Document is required but was undefined or null');
  }
  
  if (document.isClosed) {
    throw new DocumentError('Cannot process closed document', { 
      fileName: document.fileName,
      languageId: document.languageId 
    });
  }
}

/**
 * Validate text editor
 */
export function validateTextEditor(editor: vscode.TextEditor | undefined): asserts editor is vscode.TextEditor {
  if (!editor) {
    throw new DocumentError('Text editor is required but was undefined or null');
  }
  
  validateDocument(editor.document);
}

/**
 * Validate file size
 */
export function validateFileSize(document: vscode.TextDocument, maxSize: number): void {
  const text = document.getText();
  const size = Buffer.byteLength(text, 'utf8');
  
  if (size > maxSize) {
    throw new PerformanceError('Document exceeds maximum size limit', {
      fileName: document.fileName,
      actualSize: size,
      maxSize,
      sizeInMB: (size / 1024 / 1024).toFixed(2)
    });
  }
}

/**
 * Validate configuration value
 */
export function validateConfig<T>(value: T | undefined, defaultValue: T, configKey: string): T {
  if (value === undefined || value === null) {
    logger.warn(`Configuration value missing, using default`, { 
      configKey, 
      defaultValue 
    }, LogCategory.GENERAL);
    return defaultValue;
  }
  
  return value;
}

// ============================================================================
// ERROR RECOVERY UTILITIES
// ============================================================================

/**
 * Create a recovery function that attempts multiple strategies
 */
export function createRecoveryChain<T>(...strategies: Array<() => T>): () => T {
  return () => {
    let lastError: any;
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        return strategies[i]();
      } catch (error) {
        lastError = error;
        logger.debug(`Recovery strategy ${i + 1} failed, trying next`, {
          strategyIndex: i,
          totalStrategies: strategies.length,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // All strategies failed
    throw new BracketLynxError('All recovery strategies failed', 'RECOVERY_FAILED', { 
      totalStrategies: strategies.length,
      lastError: lastError instanceof Error ? lastError.message : String(lastError)
    });
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize error handling system
 */
export function initializeErrorHandling(config?: {
  logLevel?: LogLevel;
}): void {
  const logLevel = config?.logLevel ?? LogLevel.WARN;
  
  logger.configure(logLevel);
  
  logger.info('Error handling system initialized', {
    logLevel: LogLevel[logLevel]
  });
}