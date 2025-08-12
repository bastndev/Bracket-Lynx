/**
 * Utility functions used across the Bracket Lynx extension
 */

import * as vscode from 'vscode';

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
