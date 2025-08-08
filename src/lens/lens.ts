import * as vscode from 'vscode';

// ===== CONSTANTS =====
const DEBOUNCE_DELAY = 300;
const HASH_PREFIX = '<~ #';
const HASH_PREFIX_SYMBOL = '•';

const MIN_TOTAL_LINES_FOR_CURLY_DECORATION = 5;
const MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION = 7;

// Cache configuration
const PARSE_CACHE_INTERVAL = 100; // Cache state every 100 characters
const PARSE_CACHE_MAX_AGE = 2 * 60 * 1000; // 2 minutes
const CACHE_MAX_SIZE = 50; // Maximum 50 files in cache
const DECORATION_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const INCREMENTAL_CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

// ===== INTERFACES & TYPES =====
interface BracketPair {
  open: number;
  close: number;
}

interface BracketCharPair {
  open: number;
  close: number;
}

interface StackItem {
  char: number;
  pos: number;
}

interface ParseState {
  position: number;
  inString: boolean;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inTemplateString: boolean;
  inBlockComment: boolean;
  inLineComment: boolean;
}

interface TextParseCache {
  textHash: string;
  states: ParseState[];
  timestamp: number;
}

interface CacheEntry {
  textHash: string;
  brackets: BracketPair[];
  decorations: vscode.DecorationOptions[];
  timestamp: number;
}

interface IncrementalCache {
  textHash: string;
  brackets: BracketPair[];
  lineCount: number;
  timestamp: number;
}

interface ChangeRegion {
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

// ===== GLOBAL VARIABLES =====
const bracketPairs: BracketCharPair[] = [
  { open: '{'.charCodeAt(0), close: '}'.charCodeAt(0) },
  { open: '['.charCodeAt(0), close: ']'.charCodeAt(0) },
  { open: '('.charCodeAt(0), close: ')'.charCodeAt(0) },
  { open: '<'.charCodeAt(0), close: '>'.charCodeAt(0) },
];

// Cache maps
const parseStateCache = new Map<string, TextParseCache>();
const decorationCache = new Map<string, CacheEntry>();
const incrementalCache = new Map<string, IncrementalCache>();

// Global state
let decorationType: vscode.TextEditorDecorationType | undefined;
let throttleTimer: NodeJS.Timeout | undefined;

// ===== UTILITY FUNCTIONS =====

/**
 * Generate a simple hash for text content
 */
function generateTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

function createDecorationStyle(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    after: {
      color: '#515151',
      margin: '0 0 0 1ch',
      fontStyle: 'italic',
      // fontWeight: 'bold',
    },
  });
}

function formatLineRange(
  startLine: number,
  endLine: number,
  contextInfo: string = ''
): string {
  const baseRange = `${HASH_PREFIX}${startLine}-${endLine}`;
  if (contextInfo) {
    // Check if contextInfo already starts with the bullet symbol (for CSS)
    if (contextInfo.startsWith(HASH_PREFIX_SYMBOL)) {
      return `${baseRange} ${contextInfo}`;
    } else {
      return `${baseRange} ${HASH_PREFIX_SYMBOL}${contextInfo}`;
    }
  }
  return baseRange;
}

// ===== CACHE MANAGEMENT FUNCTIONS =====

/**
 * Get cached decorations if available and valid
 */
function getCachedDecorations(
  editor: vscode.TextEditor
): vscode.DecorationOptions[] | null {
  try {
    const document = editor.document;
    const fileUri = document.uri.toString();
    const text = document.getText();
    const textHash = generateTextHash(text);

    const cached = decorationCache.get(fileUri);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > DECORATION_CACHE_MAX_AGE) {
      decorationCache.delete(fileUri);
      return null;
    }

    // Check if text content has changed
    if (cached.textHash !== textHash) {
      decorationCache.delete(fileUri);
      return null;
    }

    // Move to end for LRU (delete and re-add)
    decorationCache.delete(fileUri);
    decorationCache.set(fileUri, cached);

    return cached.decorations;
  } catch (error) {
    console.error('Bracket Lens: Error getting cached decorations:', error);
    return null;
  }
}

/**
 * Cache decorations for future use with LRU eviction
 */
function cacheDecorations(
  editor: vscode.TextEditor,
  brackets: BracketPair[],
  decorations: vscode.DecorationOptions[]
): void {
  try {
    const document = editor.document;
    const fileUri = document.uri.toString();
    const text = document.getText();
    const textHash = generateTextHash(text);

    // Implement LRU cache - remove oldest entries if cache is full
    if (decorationCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = decorationCache.keys().next().value;
      if (oldestKey) {
        decorationCache.delete(oldestKey);
        console.log(`Bracket Lens: Evicted decoration cache entry for ${oldestKey}`);
      }
    }

    decorationCache.set(fileUri, {
      textHash,
      brackets,
      decorations,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Bracket Lens: Error caching decorations:', error);
  }
}

/**
 * Clear cache for a specific file
 */
function clearFileCache(fileUri: string): void {
  decorationCache.delete(fileUri);
  parseStateCache.delete(fileUri); // Also clear parsing state cache
  incrementalCache.delete(fileUri); // Also clear incremental cache
}

/**
 * Clear old cache entries and enforce size limits
 */
function cleanupCache(): void {
  try {
    const now = Date.now();
    const decorationEntriesToDelete: string[] = [];
    const parseEntriesToDelete: string[] = [];

    // Find expired decoration cache entries
    for (const [fileUri, entry] of decorationCache) {
      if (now - entry.timestamp > DECORATION_CACHE_MAX_AGE) {
        decorationEntriesToDelete.push(fileUri);
      }
    }

    // Find expired parse cache entries
    for (const [fileUri, entry] of parseStateCache) {
      if (now - entry.timestamp > PARSE_CACHE_MAX_AGE) {
        parseEntriesToDelete.push(fileUri);
      }
    }

    // Find expired incremental cache entries
    const incrementalEntriesToDelete: string[] = [];
    for (const [fileUri, entry] of incrementalCache) {
      if (now - entry.timestamp > INCREMENTAL_CACHE_MAX_AGE) {
        incrementalEntriesToDelete.push(fileUri);
      }
    }

    // Delete expired decoration entries
    decorationEntriesToDelete.forEach((fileUri) => {
      decorationCache.delete(fileUri);
    });

    // Delete expired parse entries
    parseEntriesToDelete.forEach((fileUri) => {
      parseStateCache.delete(fileUri);
    });

    // Delete expired incremental entries
    incrementalEntriesToDelete.forEach((fileUri) => {
      incrementalCache.delete(fileUri);
    });

    // Enforce size limit for decoration cache
    while (decorationCache.size > CACHE_MAX_SIZE) {
      const oldestKey = decorationCache.keys().next().value;
      if (oldestKey) {
        decorationCache.delete(oldestKey);
      } else {
        break; // Safety break
      }
    }

    // Enforce size limit for parse cache
    while (parseStateCache.size > CACHE_MAX_SIZE) {
      const oldestKey = parseStateCache.keys().next().value;
      if (oldestKey) {
        parseStateCache.delete(oldestKey);
      } else {
        break; // Safety break
      }
    }

    // Enforce size limit for incremental cache
    while (incrementalCache.size > CACHE_MAX_SIZE) {
      const oldestKey = incrementalCache.keys().next().value;
      if (oldestKey) {
        incrementalCache.delete(oldestKey);
      } else {
        break; // Safety break
      }
    }

    const totalCleaned =
      decorationEntriesToDelete.length + parseEntriesToDelete.length + incrementalEntriesToDelete.length;
    if (totalCleaned > 0) {
      console.log(
        `Bracket Lens: Cleaned up ${totalCleaned} expired cache entries (${decorationEntriesToDelete.length} decoration, ${parseEntriesToDelete.length} parse, ${incrementalEntriesToDelete.length} incremental)`
      );
    }
  } catch (error) {
    console.error('Bracket Lens: Error during cache cleanup:', error);
  }
}

// ===== PARSING STATE FUNCTIONS =====

/**
 * Get or create parsing state cache for a text
 */
function getOrCreateParseCache(text: string, fileUri: string): TextParseCache {
  const textHash = generateTextHash(text);
  const cached = parseStateCache.get(fileUri);

  // Check if cache is valid
  if (
    cached &&
    cached.textHash === textHash &&
    Date.now() - cached.timestamp < PARSE_CACHE_MAX_AGE
  ) {
    return cached;
  }

  // Create new cache
  const states: ParseState[] = [];
  let inString = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  let inBlockComment = false;
  let inLineComment = false;

  // Parse text and cache states at intervals
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i < text.length - 1 ? text[i + 1] : '';

    // Handle line comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
    } else if (inLineComment && char === '\n') {
      inLineComment = false;
    }

    // Handle block comments
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
    } else if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++; // Skip the '/' character
      continue;
    }

    // Handle strings (only if not in comments)
    if (!inBlockComment && !inLineComment) {
      // Handle escape sequences
      if (prevChar !== '\\') {
        if (char === '"' && !inSingleQuote && !inTemplateString) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
          inTemplateString = !inTemplateString;
        }
      }
    }

    inString = inSingleQuote || inDoubleQuote || inTemplateString;

    // Cache state at intervals
    if (i % PARSE_CACHE_INTERVAL === 0 || i === text.length - 1) {
      states.push({
        position: i,
        inString,
        inSingleQuote,
        inDoubleQuote,
        inTemplateString,
        inBlockComment,
        inLineComment,
      });
    }
  }

  const newCache: TextParseCache = {
    textHash,
    states,
    timestamp: Date.now(),
  };

  // Implement LRU for parse cache
  if (parseStateCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = parseStateCache.keys().next().value;
    if (oldestKey) {
      parseStateCache.delete(oldestKey);
    }
  }

  parseStateCache.set(fileUri, newCache);
  return newCache;
}

/**
 * Find the closest cached state before the given position
 */
function findClosestState(
  states: ParseState[],
  position: number
): ParseState | null {
  let closest: ParseState | null = null;

  for (const state of states) {
    if (state.position <= position) {
      closest = state;
    } else {
      break; // States are ordered by position
    }
  }

  return closest;
}

/**
 * Calculate parsing state from a starting point to target position
 */
function calculateStateFromPosition(
  text: string,
  startState: ParseState,
  targetPosition: number
): ParseState {
  let inString = startState.inString;
  let inSingleQuote = startState.inSingleQuote;
  let inDoubleQuote = startState.inDoubleQuote;
  let inTemplateString = startState.inTemplateString;
  let inBlockComment = startState.inBlockComment;
  let inLineComment = startState.inLineComment;

  for (let i = startState.position + 1; i <= targetPosition; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i < text.length - 1 ? text[i + 1] : '';

    // Handle line comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
    } else if (inLineComment && char === '\n') {
      inLineComment = false;
    }

    // Handle block comments
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
    } else if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++; // Skip the '/' character
      continue;
    }

    // Handle strings (only if not in comments)
    if (!inBlockComment && !inLineComment) {
      // Handle escape sequences
      if (prevChar !== '\\') {
        if (char === '"' && !inSingleQuote && !inTemplateString) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
          inTemplateString = !inTemplateString;
        }
      }
    }

    inString = inSingleQuote || inDoubleQuote || inTemplateString;
  }

  return {
    position: targetPosition,
    inString,
    inSingleQuote,
    inDoubleQuote,
    inTemplateString,
    inBlockComment,
    inLineComment,
  };
}

// ===== COMMENT AND STRING DETECTION =====

function isInsideComment(text: string, position: number, fileUri?: string): boolean {
  try {
    // Safety checks
    if (position < 0 || position >= text.length) {
      return false;
    }

    // Use optimized parsing if fileUri is provided
    if (fileUri) {
      const parseCache = getOrCreateParseCache(text, fileUri);
      const closestState = findClosestState(parseCache.states, position);

      if (closestState) {
        if (closestState.position === position) {
          return closestState.inBlockComment || closestState.inLineComment;
        }

        const currentState = calculateStateFromPosition(
          text,
          closestState,
          position
        );
        return currentState.inBlockComment || currentState.inLineComment;
      }
    }

    // Fallback to original method for backward compatibility
    // Check for line comments
    const lineStart = text.lastIndexOf('\n', position - 1) + 1;
    const lineText = text.substring(lineStart, position);
    const lineCommentIndex = lineText.indexOf('//');

    if (lineCommentIndex !== -1) {
      return true;
    }

    // Check for block comments
    let searchPos = 0;
    while (searchPos < position) {
      const startIndex = text.indexOf('/*', searchPos);
      if (startIndex === -1 || startIndex >= position) {
        break;
      }

      const endIndex = text.indexOf('*/', startIndex + 2);
      if (endIndex === -1) {
        // Unclosed block comment - everything after is commented
        return startIndex < position;
      } else if (endIndex >= position) {
        // Position is inside this block comment
        return true;
      }

      searchPos = endIndex + 2;
    }

    return false;
  } catch (error) {
    console.error('Bracket Lens: Error checking comment state:', error);
    return false; // Assume not in comment if error occurs
  }
}

function isInsideString(text: string, position: number, fileUri?: string): boolean {
  try {
    // Safety checks
    if (position < 0 || position >= text.length) {
      return false;
    }

    // Use optimized parsing if fileUri is provided
    if (fileUri) {
      const parseCache = getOrCreateParseCache(text, fileUri);
      const closestState = findClosestState(parseCache.states, position);

      if (closestState) {
        if (closestState.position === position) {
          return closestState.inString;
        }

        const currentState = calculateStateFromPosition(
          text,
          closestState,
          position
        );
        return currentState.inString;
      }
    }

    // Fallback to original method for backward compatibility
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let inTemplateString = false;

    for (let i = 0; i < position; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Handle escape sequences
      if (prevChar === '\\') {
        continue;
      }

      if (char === '"' && !inSingleQuote && !inTemplateString) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
        inTemplateString = !inTemplateString;
      }
    }

    return inDoubleQuote || inSingleQuote || inTemplateString;
  } catch (error) {
    console.error('Bracket Lens: Error checking string state:', error);
    return false; // Assume not in string if error occurs
  }
}

// ===== BRACKET PARSING FUNCTIONS =====

function findBrackets(text: string, fileUri?: string): BracketPair[] {
  try {
    const stack: StackItem[] = [];
    const results: BracketPair[] = [];

    // Safety check for extremely large files
    if (text.length > 10 * 1024 * 1024) { // 10MB
      console.warn('Bracket Lens: File too large for bracket parsing');
      return [];
    }

    for (let i = 0; i < text.length; i++) {
      // Skip brackets inside comments or strings - now optimized!
      if (isInsideComment(text, i, fileUri) || isInsideString(text, i, fileUri)) {
        continue;
      }

      const code = text.charCodeAt(i);
      const opening = bracketPairs.find((p) => p.open === code);
      if (opening) {
        stack.push({ char: code, pos: i });
        continue;
      }
      const closing = bracketPairs.find((p) => p.close === code);
      if (closing) {
        for (let j = stack.length - 1; j >= 0; j--) {
          const candidatePair = bracketPairs.find(
            (p) => p.open === stack[j].char
          );
          if (candidatePair && candidatePair.close === code) {
            results.push({ open: stack[j].pos, close: i });
            stack.splice(j, 1);
            break;
          }
        }
      }
    }
    return results;
  } catch (error) {
    console.error('Bracket Lens: Error parsing brackets:', error);
    return []; // Return empty array to fail gracefully
  }
}

// ===== INCREMENTAL ANALYSIS FUNCTIONS =====

/**
 * Detect what changed in the document
 */
function detectChangeRegions(
  document: vscode.TextDocument,
  changes: readonly vscode.TextDocumentContentChangeEvent[]
): ChangeRegion[] {
  const regions: ChangeRegion[] = [];

  for (const change of changes) {
    if (!change.range) {
      // If no range, entire document changed
      return [{
        startLine: 0,
        endLine: document.lineCount - 1,
        startChar: 0,
        endChar: document.getText().length
      }];
    }

    const startLine = change.range.start.line;
    const endLine = change.range.end.line;
    const startChar = document.offsetAt(change.range.start);
    const endChar = document.offsetAt(change.range.end);

    regions.push({
      startLine,
      endLine: Math.max(endLine, startLine + change.text.split('\n').length - 1),
      startChar,
      endChar: startChar + change.text.length
    });
  }

  return regions;
}

/**
 * Expand change region to include potentially affected brackets
 */
function expandChangeRegion(
  region: ChangeRegion,
  document: vscode.TextDocument,
  existingBrackets: BracketPair[]
): ChangeRegion {
  const text = document.getText();
  
  // Find brackets that might be affected by this change
  let minStart = region.startChar;
  let maxEnd = region.endChar;

  // Look for brackets that cross the change boundary
  for (const bracket of existingBrackets) {
    const openLine = document.positionAt(bracket.open).line;
    const closeLine = document.positionAt(bracket.close).line;

    // If bracket spans across or near the change region
    if (
      (openLine <= region.endLine + 2 && closeLine >= region.startLine - 2) ||
      (bracket.open >= region.startChar - 200 && bracket.open <= region.endChar + 200) ||
      (bracket.close >= region.startChar - 200 && bracket.close <= region.endChar + 200)
    ) {
      minStart = Math.min(minStart, bracket.open - 100); // Extra buffer
      maxEnd = Math.max(maxEnd, bracket.close + 100);
    }
  }

  // Ensure we don't go out of bounds
  minStart = Math.max(0, minStart);
  maxEnd = Math.min(text.length, maxEnd);

  const expandedStartLine = Math.max(0, document.positionAt(minStart).line - 1);
  const expandedEndLine = Math.min(document.lineCount - 1, document.positionAt(maxEnd).line + 1);

  return {
    startLine: expandedStartLine,
    endLine: expandedEndLine,
    startChar: minStart,
    endChar: maxEnd
  };
}

/**
 * Find brackets in a specific region of text
 */
function findBracketsInRegion(
  text: string,
  region: ChangeRegion,
  fileUri?: string
): BracketPair[] {
  const regionText = text.substring(region.startChar, region.endChar);
  const stack: StackItem[] = [];
  const results: BracketPair[] = [];

  for (let i = 0; i < regionText.length; i++) {
    const absolutePos = region.startChar + i;
    
    // Skip brackets inside comments or strings
    if (
      isInsideComment(text, absolutePos, fileUri) || 
      isInsideString(text, absolutePos, fileUri)
    ) {
      continue;
    }

    const code = regionText.charCodeAt(i);
    const opening = bracketPairs.find((p) => p.open === code);
    if (opening) {
      stack.push({ char: code, pos: absolutePos });
      continue;
    }
    
    const closing = bracketPairs.find((p) => p.close === code);
    if (closing) {
      // Look for matching opening bracket in stack
      for (let j = stack.length - 1; j >= 0; j--) {
        const candidatePair = bracketPairs.find(
          (p) => p.open === stack[j].char
        );
        if (candidatePair && candidatePair.close === code) {
          results.push({ open: stack[j].pos, close: absolutePos });
          stack.splice(j, 1);
          break;
        }
      }
    }
  }

  // Also look for brackets that might have their pair outside the region
  // This is a simplified approach - in a full implementation, we'd do more sophisticated matching
  return results;
}

/**
 * Merge new brackets with existing brackets, removing overlaps
 */
function mergeBrackets(
  existingBrackets: BracketPair[],
  newBrackets: BracketPair[],
  affectedRegion: ChangeRegion
): BracketPair[] {
  // Remove brackets that are in or overlap with the affected region
  const unaffectedBrackets = existingBrackets.filter(bracket => {
    return !(
      (bracket.open >= affectedRegion.startChar && bracket.open <= affectedRegion.endChar) ||
      (bracket.close >= affectedRegion.startChar && bracket.close <= affectedRegion.endChar) ||
      (bracket.open < affectedRegion.startChar && bracket.close > affectedRegion.endChar)
    );
  });

  // Combine unaffected brackets with new brackets
  const allBrackets = [...unaffectedBrackets, ...newBrackets];
  
  // Sort by opening position
  allBrackets.sort((a, b) => a.open - b.open);
  
  return allBrackets;
}

/**
 * Get or update incremental cache
 */
function getOrUpdateIncrementalCache(
  document: vscode.TextDocument,
  changes?: readonly vscode.TextDocumentContentChangeEvent[]
): BracketPair[] {
  const fileUri = document.uri.toString();
  const text = document.getText();
  const textHash = generateTextHash(text);
  const cached = incrementalCache.get(fileUri);

  // If no changes provided or cache is invalid, do full analysis
  if (!changes || !cached || cached.textHash === textHash || 
      Date.now() - cached.timestamp > INCREMENTAL_CACHE_MAX_AGE) {
    
    // Fallback to full analysis
    const fullBrackets = findBrackets(text, fileUri);
    
    // Update incremental cache
    if (incrementalCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = incrementalCache.keys().next().value;
      if (oldestKey) {
        incrementalCache.delete(oldestKey);
      }
    }

    incrementalCache.set(fileUri, {
      textHash,
      brackets: fullBrackets,
      lineCount: document.lineCount,
      timestamp: Date.now()
    });

    return fullBrackets;
  }

  // Incremental analysis
  try {
    const changeRegions = detectChangeRegions(document, changes);
    let resultBrackets = cached.brackets;

    for (const region of changeRegions) {
      // Expand region to include potentially affected brackets
      const expandedRegion = expandChangeRegion(region, document, cached.brackets);
      
      // Find brackets in the expanded region
      const newBrackets = findBracketsInRegion(text, expandedRegion, fileUri);
      
      // Merge with existing brackets
      resultBrackets = mergeBrackets(resultBrackets, newBrackets, expandedRegion);
    }

    // Update cache with new results
    incrementalCache.set(fileUri, {
      textHash,
      brackets: resultBrackets,
      lineCount: document.lineCount,
      timestamp: Date.now()
    });

    return resultBrackets;
  } catch (error) {
    console.error('Bracket Lens: Error in incremental analysis, falling back to full:', error);
    // Fallback to full analysis on error
    return findBrackets(text, fileUri);
  }
}

// ===== CONTEXT EXTRACTION FUNCTIONS =====

/**
 * Get CSS context info (selectors with cleaned symbols)
 */
function getCSSContext(lineText: string, openCharIndex: number): string {
  try {
    const textBefore = lineText.substring(0, openCharIndex).trim();

    if (!textBefore) {
      return '';
    }

    // Remove comments and clean up the text
    const cleanText = textBefore.replace(/\/\*.*?\*\//g, '').trim();

    // Extract CSS selectors - handle multiple selectors separated by commas
    const selectors = cleanText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (selectors.length === 0) {
      return '';
    }

    // Process the last selector (the one closest to the opening brace)
    const lastSelector = selectors[selectors.length - 1];

    // Split by spaces to get individual selector parts in order
    const selectorParts = lastSelector
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (selectorParts.length === 0) {
      return '';
    }

    // Clean each selector part (remove . # : symbols)
    const cleanedParts = selectorParts
      .map((part) => {
        // Remove CSS selector symbols but keep the name
        return part.replace(/^[.#:]+/, '').replace(/:[a-zA-Z-]*$/, '');
      })
      .filter((part) => part.length > 0 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(part));

    if (cleanedParts.length === 0) {
      return '';
    }

    // If we have multiple parts, show only first and last
    if (cleanedParts.length > 2) {
      const firstPart = cleanedParts[0];
      const lastPart = cleanedParts[cleanedParts.length - 1];
      return `${HASH_PREFIX_SYMBOL}${firstPart} ${HASH_PREFIX_SYMBOL}${lastPart}`;
    } else {
      // If we have 1 or 2 parts, show them all
      return cleanedParts.map((part) => `${HASH_PREFIX_SYMBOL}${part}`).join(' ');
    }
  } catch (error) {
    console.error('Bracket Lens: Error extracting CSS context:', error);
    return '';
  }
}

/**
 * Check if current position is inside a <style> block
 */
function isInsideStyleBlock(
  text: string,
  currentPos: number,
  languageId: string
): boolean {
  const supportedLanguages = [
    'html',
    'htm',
    'astro',
    'vue',
    'svelte',
    'xml',
    'php',
    'jsp',
    'erb',
    'ejs',
    'handlebars',
    'mustache',
  ];

  if (!supportedLanguages.includes(languageId)) {
    return false;
  }

  // Get text before current position
  const textBefore = text.substring(0, currentPos);
  const textAfter = text.substring(currentPos);

  // Find the last opening <style> tag before current position
  const styleOpenRegex = /<style[^>]*>/gi;
  let lastStyleOpen = -1;
  let match;

  while ((match = styleOpenRegex.exec(textBefore)) !== null) {
    lastStyleOpen = match.index + match[0].length;
  }

  // If no <style> tag found before current position, we're not in a style block
  if (lastStyleOpen === -1) {
    return false;
  }

  // Check if there's a closing </style> tag between the last opening and current position
  const textBetween = text.substring(lastStyleOpen, currentPos);
  const hasClosingStyle = /<\/style>/i.test(textBetween);

  // If there's a closing tag between, we're not in a style block
  if (hasClosingStyle) {
    return false;
  }

  // Check if there's a closing </style> tag after current position
  const hasClosingStyleAfter = /<\/style>/i.test(textAfter);

  // We're inside a style block if:
  // 1. There's an opening <style> before us
  // 2. No closing </style> between opening and current position
  // 3. There's a closing </style> after current position
  return hasClosingStyleAfter;
}

function getContextBeforeOpening(
  lineText: string,
  openCharIndex: number,
  text: string,
  openPos: number
): string {
  try {
    // Safety checks
    if (openCharIndex < 0 || openCharIndex > lineText.length) {
      return '';
    }

    const textBefore = lineText.substring(0, openCharIndex).trim();

    if (!textBefore) {
      return '';
    }

    // Define patterns with their return formats
    const patterns = [
      // ComponentName: ({ ...props }) => (
      {
        regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/,
        format: (m: RegExpMatchArray) => `${m[1]} ()=>`,
      },
      // export const ObjectName = {
      {
        regex: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/,
        format: (m: RegExpMatchArray) => `export ${m[1]}`,
      },
      // export const ComponentName = ({ ...props }) => (
      {
        regex: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/,
        format: (m: RegExpMatchArray) => `${m[1]} ()=>`,
      },
      // const ComponentName = ({ ...props }) => (
      {
        regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/,
        format: (m: RegExpMatchArray) => `${m[1]} ()=>`,
      },
      // const ObjectName = {
      {
        regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*$/,
        format: (m: RegExpMatchArray) => m[1],
      },
      // export function FunctionName
      {
        regex: /export\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        format: (m: RegExpMatchArray) => m[1],
      },
      // function FunctionName
      {
        regex: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        format: (m: RegExpMatchArray) => m[1],
      },
      // export default
      {
        regex: /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        format: (m: RegExpMatchArray) => m[1],
      },
      // class ClassName
      {
        regex: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        format: (m: RegExpMatchArray) => `class ${m[1]}`,
      },
      // constructor(props)
      {
        regex: /constructor\s*\(/,
        format: () => 'constructor',
      },
      // render() or handleChange = or any method
      {
        regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=(]/,
        format: (m: RegExpMatchArray) => m[1],
      },
    ];

    // Test patterns
    for (const { regex, format } of patterns) {
      const match = textBefore.match(regex);
      if (match) {
        return format(match);
      }
    }

    // Handle export default without identifier
    if (textBefore.includes('export default')) {
      return 'export default';
    }

    const hasArrow = textBefore.includes('=>');

    // Enhanced fallback - try to get meaningful context

    // Look for any identifier before the opening bracket
    const identifierMatch = textBefore.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
    if (identifierMatch) {
      const identifier = identifierMatch[1];
      const skipKeywords = [
        'const',
        'let',
        'var',
        'if',
        'for',
        'while',
        'import',
        'from',
        'return',
      ];

      if (!skipKeywords.includes(identifier)) {
        return hasArrow ? `${identifier} ()=>` : identifier;
      }
    }

    // Look for patterns like "= {" or "=> {"
    if (textBefore.includes('=')) {
      const beforeEquals = textBefore.split('=')[0].trim();
      const lastWordMatch = beforeEquals.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
      if (lastWordMatch) {
        return lastWordMatch[1];
      }
    }

    // Look for method-like patterns
    const methodMatch = textBefore.match(
      /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*$/
    );
    if (methodMatch) {
      return methodMatch[1];
    }

    // Last resort - any word that looks like an identifier
    const words = textBefore.split(/\s+/).filter((word) => word.length > 0);
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word)) {
        const skipKeywords = [
          'const',
          'let',
          'var',
          'if',
          'for',
          'while',
          'import',
          'from',
          'return',
          'this',
        ];
        if (!skipKeywords.includes(word)) {
          return hasArrow ? `${word} ()=>` : word;
        }
      }
    }

    return hasArrow ? '()=>' : '';
  } catch (error) {
    console.error(
      'Bracket Lens: Error extracting context before opening:',
      error
    );
    return '';
  }
}

function getContextualInfo(
  text: string,
  openPos: number,
  closePos: number,
  doc: vscode.TextDocument
): string {
  try {
    // Safety checks
    if (openPos < 0 || closePos >= text.length || openPos >= closePos) {
      return '';
    }

    const openChar = text.charCodeAt(openPos);
    const openPosition = doc.positionAt(openPos);
    const content = text.substring(openPos + 1, closePos).trim();

    let contextInfo = '';

    if (openChar === '{'.charCodeAt(0)) {
      // Check if this is a CSS file or inside a <style> block
      const isCSS = ['css', 'scss', 'sass', 'less', 'stylus'].includes(
        doc.languageId
      );
      const insideStyle = isInsideStyleBlock(text, openPos, doc.languageId);

      if (isCSS || insideStyle) {
        const openLine = doc.lineAt(openPosition.line);
        contextInfo = getCSSContext(openLine.text, openPosition.character);
      } else {
        // JavaScript/TypeScript context
        const openLine = doc.lineAt(openPosition.line);
        contextInfo = getContextBeforeOpening(
          openLine.text,
          openPosition.character,
          text,
          openPos
        );
      }
    } else if (openChar === '['.charCodeAt(0)) {
      const openLine = doc.lineAt(openPosition.line);
      const openLineText = openLine.text;
      contextInfo = getContextBeforeOpening(
        openLineText,
        openPosition.character,
        text,
        openPos
      );
    } else if (openChar === '('.charCodeAt(0)) {
      const openLine = doc.lineAt(openPosition.line);
      const openLineText = openLine.text;
      contextInfo = getContextBeforeOpening(
        openLineText,
        openPosition.character,
        text,
        openPos
      );
    } else if (openChar === '<'.charCodeAt(0)) {
      let componentContent = content;
      const isClosingTag = componentContent.startsWith('/');

      if (isClosingTag) {
        componentContent = componentContent.substring(1).trim();
      }

      const jsxComponentMatch = componentContent.match(/^[a-zA-Z_$][\w$.]*/);
      contextInfo = jsxComponentMatch ? jsxComponentMatch[0] : '';
    }

    return contextInfo;
  } catch (error) {
    console.error('Bracket Lens: Error extracting contextual info:', error);
    return '';
  }
}

// ===== DECORATION UPDATE FUNCTIONS =====

function scheduleUpdate(editor: vscode.TextEditor): void {
  try {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
    }
    throttleTimer = setTimeout(() => {
      try {
        updateDecorations(editor);
      } catch (error) {
        console.error('Bracket Lens: Error in scheduled update:', error);
      }
    }, DEBOUNCE_DELAY);
  } catch (error) {
    console.error('Bracket Lens: Error scheduling update:', error);
  }
}

function scheduleUpdateIncremental(
  editor: vscode.TextEditor, 
  changes: readonly vscode.TextDocumentContentChangeEvent[]
): void {
  try {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
    }
    throttleTimer = setTimeout(() => {
      try {
        updateDecorationsIncremental(editor, changes);
      } catch (error) {
        console.error('Bracket Lens: Error in scheduled incremental update:', error);
      }
    }, DEBOUNCE_DELAY);
  } catch (error) {
    console.error('Bracket Lens: Error scheduling incremental update:', error);
  }
}

function updateDecorations(editor: vscode.TextEditor): void {
  updateDecorationsIncremental(editor);
}

function updateDecorationsIncremental(
  editor: vscode.TextEditor, 
  changes?: readonly vscode.TextDocumentContentChangeEvent[]
): void {
  try {
    if (!decorationType) {
      console.warn('Bracket Lens: Decoration type not initialized');
      return;
    }

    // Check if extension is enabled for this editor before processing
    const { isEditorEnabled } = require('../actions/toggle');
    if (!isEditorEnabled(editor)) {
      // If disabled, clear decorations and return
      editor.setDecorations(decorationType, []);
      return;
    }

    // Try to get cached decorations first (only if no changes provided)
    if (!changes) {
      const cachedDecorations = getCachedDecorations(editor);
      if (cachedDecorations) {
        // Use cached decorations - no processing needed!
        editor.setDecorations(decorationType, cachedDecorations);
        return;
      }
    }

    // Safety check for document validity
    const doc = editor.document;
    const text = doc.getText();
    
    if (!text || text.length === 0) {
      editor.setDecorations(decorationType, []);
      return;
    }

    const fileUri = doc.uri.toString();
    
    const brackets = changes 
      ? getOrUpdateIncrementalCache(doc, changes)
      : findBrackets(text, fileUri);
      
    const decorations: vscode.DecorationOptions[] = [];
    const usedLines = new Set<number>();

    brackets.sort((a, b) => a.open - b.open);

    for (const { open, close } of brackets) {
      const startPosition = doc.positionAt(open);
      const endPosition = doc.positionAt(close);

      const startLine = startPosition.line + 1;
      const endLine = endPosition.line + 1;

      const totalLineSpan = endLine - startLine + 1;

      if (totalLineSpan <= 1 && startPosition.line === endPosition.line) {
        continue;
      }

      if (usedLines.has(endLine)) {
        continue;
      }

      const openChar = text.charCodeAt(open);
      let skipDecoration = false;

      if (openChar === '{'.charCodeAt(0)) {
        if (totalLineSpan <= MIN_TOTAL_LINES_FOR_CURLY_DECORATION) {
          skipDecoration = true;
        }
      } else if (openChar === '<'.charCodeAt(0)) {
        const isSelfClosingTag =
          close > 0 && text.charCodeAt(close - 1) === '/'.charCodeAt(0);
        const isActualClosingTagMarker =
          open + 1 < text.length &&
          text.charCodeAt(open + 1) === '/'.charCodeAt(0);

        if (isActualClosingTagMarker) {
          if (totalLineSpan <= MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION) {
          }
        } else if (isSelfClosingTag) {
        } else {
          if (totalLineSpan <= MIN_TOTAL_LINES_FOR_OPENING_TAG_DECORATION) {
            skipDecoration = true;
          }
        }
      }

      if (skipDecoration) {
        continue;
      }

      usedLines.add(endLine);

      const contextInfo = getContextualInfo(text, open, close, doc);

      let offset = close + 1;
      if (offset < text.length) {
        const nextChar = text[offset];
        if (nextChar === ',' || nextChar === ';') {
          offset += 1;
        }
      }
      const pos = doc.positionAt(offset);

      decorations.push({
        range: new vscode.Range(pos, pos),
        renderOptions: {
          after: {
            contentText: formatLineRange(startLine, endLine, contextInfo),
          },
        },
      });
    }

    // Cache the results for future use
    cacheDecorations(editor, brackets, decorations);

    editor.setDecorations(decorationType, decorations);
  } catch (error) {
    console.error('Bracket Lens: Critical error in updateDecorations:', error);
    // Try to clear decorations to prevent visual artifacts
    try {
      if (decorationType) {
        editor.setDecorations(decorationType, []);
      }
    } catch (clearError) {
      console.error(
        'Bracket Lens: Failed to clear decorations after error:',
        clearError
      );
    }
  }
}

// ===== BRACKET LENS PROVIDER CLASS =====

export class BracketLensProvider {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      decorationType = createDecorationStyle();
      this.registerEventHandlers();

      // Initialize with current editor if available
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        updateDecorations(editor);
      }
    } catch (error) {
      console.error('Bracket Lens: Error during initialization:', error);
    }
  }

  private registerEventHandlers(): void {
    try {
      this.disposables.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
          try {
            if (editor) {
              updateDecorations(editor);
            }
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidChangeActiveTextEditor:',
              error
            );
          }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
          try {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === doc) {
              // Clear cache for saved document to ensure fresh processing
              clearFileCache(doc.uri.toString());
              updateDecorations(editor);
            }
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidSaveTextDocument:',
              error
            );
          }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
          try {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === event.document) {
              // Don't clear incremental cache - we'll update it incrementally
              // Only clear decoration cache since we're about to recalculate
              decorationCache.delete(event.document.uri.toString());
              
              // Use incremental analysis with the changes
              scheduleUpdateIncremental(editor, event.contentChanges);
            }
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidChangeTextDocument:',
              error
            );
          }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
          try {
            // Clean up cache when document is closed
            clearFileCache(doc.uri.toString());
          } catch (error) {
            console.error(
              'Bracket Lens: Error in onDidCloseTextDocument:',
              error
            );
          }
        })
      );

      // Set up periodic cache cleanup
      const cacheCleanupInterval = setInterval(() => {
        try {
          cleanupCache();
        } catch (error) {
          console.error(
            'Bracket Lens: Error in cache cleanup interval:',
            error
          );
        }
      }, 60000); // Clean up every minute

      this.disposables.push({
        dispose: () => {
          try {
            clearInterval(cacheCleanupInterval);
          } catch (error) {
            console.error(
              'Bracket Lens: Error disposing cache cleanup interval:',
              error
            );
          }
        },
      });
    } catch (error) {
      console.error('Bracket Lens: Error registering event handlers:', error);
    }
  }

  // ===== PUBLIC METHODS FOR TOGGLE FUNCTIONALITY =====

  /**
   * Force update decorations for a specific editor
   */
  public forceUpdate(editor: vscode.TextEditor): void {
    try {
      updateDecorations(editor);
    } catch (error) {
      console.error('Bracket Lens: Error in forceUpdate:', error);
    }
  }

  /**
   * Clear all decorations from a specific editor
   */
  public clearDecorations(editor: vscode.TextEditor): void {
    try {
      if (decorationType) {
        editor.setDecorations(decorationType, []);
      }
    } catch (error) {
      console.error('Bracket Lens: Error clearing decorations:', error);
    }
  }

  public dispose(): void {
    try {
      this.disposables.forEach((d) => {
        try {
          d.dispose();
        } catch (error) {
          console.error('Bracket Lens: Error disposing resource:', error);
        }
      });

      try {
        decorationType?.dispose();
      } catch (error) {
        console.error('Bracket Lens: Error disposing decoration type:', error);
      }

      try {
        if (throttleTimer) {
          clearTimeout(throttleTimer);
        }
      } catch (error) {
        console.error('Bracket Lens: Error clearing throttle timer:', error);
      }
      
      try {
        // Clear all caches
        decorationCache.clear();
        parseStateCache.clear();
        incrementalCache.clear();
      } catch (error) {
        console.error('Bracket Lens: Error clearing caches:', error);
      }
    }catch (error) {
      console.error('Bracket Lens: Critical error in dispose:', error);
    }
  }
}
