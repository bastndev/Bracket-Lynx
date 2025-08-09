import * as vscode from 'vscode';
import { 
  BracketEntry, 
  TokenEntry, 
  LanguageConfiguration,
  BracketLynxConfig,
  HeaderMode 
} from '../lens/lens';

// ============================================================================
// PARSING STATE INTERFACES
// ============================================================================

export interface ParseState {
  position: number;
  inString: boolean;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inTemplateString: boolean;
  inBlockComment: boolean;
  inLineComment: boolean;
  stringEscapeNext: boolean;
}

export interface ParseStateCache {
  textHash: string;
  states: ParseState[];
  timestamp: number;
  fileSize: number;
}

export interface IncrementalParseResult {
  brackets: BracketEntry[];
  affectedRegions: ChangeRegion[];
  parseTime: number;
}

export interface ChangeRegion {
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

export interface TokenCacheEntry {
  tokens: { index: number; token: string }[];
  pattern: string;
  languageId: string;
  timestamp: number;
}

// ============================================================================
// OPTIMIZED BRACKET PARSER
// ============================================================================

export class OptimizedBracketParser {
  private static instance: OptimizedBracketParser;
  
  // Cache for parsing states
  private parseStateCache = new Map<string, ParseStateCache>();
  private tokenCache = new Map<string, TokenCacheEntry>();
  
  // Configuration
  private readonly PARSE_CACHE_INTERVAL = 100; // Cache state every 100 characters
  private readonly PARSE_CACHE_MAX_AGE = 2 * 60 * 1000; // 2 minutes
  private readonly TOKEN_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_MAX_SIZE = 30; // Maximum 30 files in cache
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
  
  // Performance filter configuration
  private readonly PERFORMANCE_FILTERS = {
    MAX_SAFE_FILE_SIZE: 5 * 1024 * 1024, // 5MB - switch to performance mode
    MAX_EXTREME_FILE_SIZE: 20 * 1024 * 1024, // 20MB - disable completely
    MIN_BRACKET_LINES: 3, // Minimum lines to show decoration
    MAX_DECORATIONS_PER_FILE: 500, // Maximum decorations per file
    MIN_BRACKET_CONTENT_LENGTH: 10, // Minimum content length to show
    SKIP_LARGE_BRACKETS: 1000, // Skip brackets with >1000 lines
    MAX_NESTED_DEPTH: 20, // Maximum nesting depth to process
  };
  
  private constructor() {}
  
  static getInstance(): OptimizedBracketParser {
    if (!OptimizedBracketParser.instance) {
      OptimizedBracketParser.instance = new OptimizedBracketParser();
    }
    return OptimizedBracketParser.instance;
  }

  // ============================================================================
  // MAIN PARSING METHODS
  // ============================================================================
  
  /**
   * Parse brackets with optimizations and performance filters
   */
  parseBrackets(document: vscode.TextDocument): BracketEntry[] {
    const text = document.getText();
    const fileUri = document.uri.toString();
    
    // Apply performance filters
    const filterResult = this.applyPerformanceFilters(document, text);
    if (filterResult.shouldSkip) {
      if (BracketLynxConfig.debug) {
        console.log(`Bracket Lynx: Skipping file due to performance filters: ${filterResult.reason}`);
      }
      return [];
    }
    
    const startTime = Date.now();
    
    try {
      // Get or create parsing state cache
      const parseCache = this.getOrCreateParseStateCache(text, fileUri);
      
      // Get or create token cache
      const tokens = this.getOrCreateTokenCache(document, text);
      
      // Parse with optimized state detection
      let brackets = this.parseTokensOptimized(document, tokens, parseCache);
      
      // Apply post-parsing filters
      brackets = this.applyPostParsingFilters(brackets, document, filterResult.performanceMode);
      
      const parseTime = Date.now() - startTime;
      
      if (BracketLynxConfig.debug) {
        console.log(`Bracket Lynx: Optimized parsing completed in ${parseTime}ms, ${brackets.length} brackets found`);
      }
      
      return brackets;
      
    } catch (error) {
      console.error('Bracket Lynx: Error in optimized parsing, falling back:', error);
      return this.fallbackParsing(document);
    }
  }
  
  /**
   * Incremental parsing for document changes
   */
  parseIncremental(
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[],
    existingBrackets: BracketEntry[]
  ): IncrementalParseResult {
    const startTime = Date.now();
    const text = document.getText();
    const fileUri = document.uri.toString();
    
    try {
      // Detect change regions
      const changeRegions = this.detectChangeRegions(document, changes);
      
      // Expand regions to include potentially affected brackets
      const expandedRegions = changeRegions.map(region => 
        this.expandChangeRegion(region, document, existingBrackets)
      );
      
      // Parse only affected regions
      let resultBrackets = existingBrackets;
      
      for (const region of expandedRegions) {
        // Remove brackets in affected region
        resultBrackets = this.removeBracketsInRegion(resultBrackets, region);
        
        // Parse new brackets in region
        const newBrackets = this.parseBracketsInRegion(document, region);
        
        // Merge with existing brackets
        resultBrackets = this.mergeBrackets(resultBrackets, newBrackets);
      }
      
      // Update parse state cache
      this.updateParseStateCache(text, fileUri);
      
      const parseTime = Date.now() - startTime;
      
      if (BracketLynxConfig.debug) {
        console.log(`Bracket Lynx: Incremental parsing completed in ${parseTime}ms, affected ${expandedRegions.length} regions`);
      }
      
      return {
        brackets: resultBrackets,
        affectedRegions: expandedRegions,
        parseTime
      };
      
    } catch (error) {
      console.error('Bracket Lynx: Error in incremental parsing, falling back to full parse:', error);
      return {
        brackets: this.parseBrackets(document),
        affectedRegions: [],
        parseTime: Date.now() - startTime
      };
    }
  }

  // ============================================================================
  // PARSE STATE CACHE METHODS
  // ============================================================================
  
  /**
   * Generate hash for text content
   */
  private generateTextHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  /**
   * Get or create parsing state cache
   */
  private getOrCreateParseStateCache(text: string, fileUri: string): ParseStateCache {
    const textHash = this.generateTextHash(text);
    const cached = this.parseStateCache.get(fileUri);
    
    // Check if cache is valid
    if (cached && 
        cached.textHash === textHash && 
        Date.now() - cached.timestamp < this.PARSE_CACHE_MAX_AGE) {
      return cached;
    }
    
    // Create new cache
    const states = this.buildParseStates(text);
    const newCache: ParseStateCache = {
      textHash,
      states,
      timestamp: Date.now(),
      fileSize: text.length
    };
    
    // Enforce cache size limit
    if (this.parseStateCache.size >= this.CACHE_MAX_SIZE) {
      const oldestKey = this.parseStateCache.keys().next().value;
      if (oldestKey) {
        this.parseStateCache.delete(oldestKey);
      }
    }
    
    this.parseStateCache.set(fileUri, newCache);
    return newCache;
  }
  
  /**
   * Build parsing states at intervals
   */
  private buildParseStates(text: string): ParseState[] {
    const states: ParseState[] = [];
    let inString = false;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplateString = false;
    let inBlockComment = false;
    let inLineComment = false;
    let stringEscapeNext = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      const nextChar = i < text.length - 1 ? text[i + 1] : '';
      
      // Handle escape sequences in strings
      if (inString && stringEscapeNext) {
        stringEscapeNext = false;
        continue;
      }
      
      if (inString && char === '\\') {
        stringEscapeNext = true;
        continue;
      }
      
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
        if (char === '"' && !inSingleQuote && !inTemplateString) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
          inTemplateString = !inTemplateString;
        }
      }
      
      inString = inSingleQuote || inDoubleQuote || inTemplateString;
      
      // Cache state at intervals
      if (i % this.PARSE_CACHE_INTERVAL === 0 || i === text.length - 1) {
        states.push({
          position: i,
          inString,
          inSingleQuote,
          inDoubleQuote,
          inTemplateString,
          inBlockComment,
          inLineComment,
          stringEscapeNext
        });
      }
    }
    
    return states;
  }
  
  /**
   * Find closest cached state before position
   */
  private findClosestState(states: ParseState[], position: number): ParseState | null {
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
   * Calculate parsing state from starting point to target position
   */
  private calculateStateFromPosition(
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
    let stringEscapeNext = startState.stringEscapeNext;
    
    for (let i = startState.position + 1; i <= targetPosition; i++) {
      const char = text[i];
      const nextChar = i < text.length - 1 ? text[i + 1] : '';
      
      // Handle escape sequences
      if (inString && stringEscapeNext) {
        stringEscapeNext = false;
        continue;
      }
      
      if (inString && char === '\\') {
        stringEscapeNext = true;
        continue;
      }
      
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
      
      // Handle strings
      if (!inBlockComment && !inLineComment) {
        if (char === '"' && !inSingleQuote && !inTemplateString) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inTemplateString) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
          inTemplateString = !inTemplateString;
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
      stringEscapeNext
    };
  }

  // ============================================================================
  // TOKEN CACHE METHODS
  // ============================================================================
  
  /**
   * Get or create token cache
   */
  private getOrCreateTokenCache(
    document: vscode.TextDocument, 
    text: string
  ): { index: number; token: string }[] {
    const fileUri = document.uri.toString();
    const languageId = document.languageId;
    const textHash = this.generateTextHash(text);
    const cached = this.tokenCache.get(fileUri);
    
    // Check if cache is valid
    if (cached && 
        cached.languageId === languageId &&
        Date.now() - cached.timestamp < this.TOKEN_CACHE_MAX_AGE) {
      return cached.tokens;
    }
    
    // Create new token cache
    const languageConfiguration = BracketLynxConfig.languageConfiguration;
    const pattern = this.createTokenPattern(languageConfiguration);
    const tokens = this.tokenizeDocument(text, pattern, languageConfiguration.ignoreCase);
    
    const newCache: TokenCacheEntry = {
      tokens,
      pattern,
      languageId,
      timestamp: Date.now()
    };
    
    // Enforce cache size limit
    if (this.tokenCache.size >= this.CACHE_MAX_SIZE) {
      const oldestKey = this.tokenCache.keys().next().value;
      if (oldestKey) {
        this.tokenCache.delete(oldestKey);
      }
    }
    
    this.tokenCache.set(fileUri, newCache);
    return tokens;
  }
  
  /**
   * Create token pattern (reused from original parser)
   */
  private createTokenPattern(languageConfiguration: LanguageConfiguration): string {
    const regulate = languageConfiguration.ignoreCase
      ? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
      : (text: string) => text.replace(/\s+/, ' ');
    
    const tokens = [
      ...(languageConfiguration.ignoreSymbols?.map(regulate) ?? []),
      ...(languageConfiguration.comments?.block?.map(i => regulate(i.opening)) ?? []),
      ...(languageConfiguration.comments?.block?.map(i => regulate(i.closing)) ?? []),
      ...(languageConfiguration.comments?.line?.map(regulate) ?? []),
      ...(languageConfiguration.brackets?.symbol?.map(i => regulate(i.opening)) ?? []),
      ...(languageConfiguration.brackets?.symbol?.map(i => regulate(i.closing)) ?? []),
      ...(languageConfiguration.brackets?.word?.map(i => regulate(i.opening)) ?? []),
      ...(languageConfiguration.brackets?.word?.map(i => regulate(i.closing)) ?? []),
      ...(languageConfiguration.strings?.inline?.map(i => regulate(i.opening)) ?? []),
      ...(languageConfiguration.strings?.inline?.map(i => regulate(i.closing)) ?? []),
      ...(languageConfiguration.strings?.multiline?.map(i => regulate(i.opening)) ?? []),
      ...(languageConfiguration.strings?.multiline?.map(i => regulate(i.closing)) ?? [])
    ];
    
    const makeRegExpPart = (text: string) =>
      text.replace(/([\\\/\*\[\]\(\)\{\}\|])/gmu, '\\$1').replace(/\s+/, '\\s');
    
    return tokens
      .filter((entry, index, array) => '' !== entry && index === array.indexOf(entry))
      .map(i => `${makeRegExpPart(i)}`)
      .join('|');
  }
  
  /**
   * Tokenize document (reused from original parser)
   */
  private tokenizeDocument(
    text: string,
    pattern: string,
    ignoreCase: boolean
  ): { index: number; token: string }[] {
    const result: { index: number; token: string }[] = [];
    const regexp = new RegExp(pattern, ignoreCase ? 'gui' : 'gu');
    
    while (true) {
      const match = regexp.exec(text);
      if (null === match) {
        break;
      }
      result.push({
        index: match.index,
        token: match[0]
      });
    }
    
    return result;
  }

  // ============================================================================
  // OPTIMIZED PARSING METHODS
  // ============================================================================
  
  /**
   * Check if position is inside comment or string using cached states
   */
  private isInsideCommentOrString(
    position: number, 
    text: string, 
    parseCache: ParseStateCache
  ): boolean {
    const closestState = this.findClosestState(parseCache.states, position);
    
    if (!closestState) {
      return false;
    }
    
    if (closestState.position === position) {
      return closestState.inString || closestState.inBlockComment || closestState.inLineComment;
    }
    
    const currentState = this.calculateStateFromPosition(text, closestState, position);
    return currentState.inString || currentState.inBlockComment || currentState.inLineComment;
  }
  
  /**
   * Parse tokens with optimized state detection
   */
  private parseTokensOptimized(
    document: vscode.TextDocument,
    tokens: { index: number; token: string }[],
    parseCache: ParseStateCache
  ): BracketEntry[] {
    const result: BracketEntry[] = [];
    const text = document.getText();
    const languageConfiguration = BracketLynxConfig.languageConfiguration;
    const regulate = languageConfiguration.ignoreCase
      ? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
      : (text: string) => text.replace(/\s+/, ' ');
    
    // Extract language tokens (simplified version)
    const openingSymbolBrackets = languageConfiguration.brackets?.symbol?.map(i => regulate(i.opening)) ?? [];
    const closingSymbolBrackets = languageConfiguration.brackets?.symbol?.map(i => regulate(i.closing)) ?? [];
    const symbolBracketsHeader = languageConfiguration.brackets?.symbol?.map(i => i.headerMode ?? 'smart') ?? [];
    
    let scopeStack: {
      start: TokenEntry;
      closing: string;
      headerMode: HeaderMode;
      items: BracketEntry[];
    }[] = [];
    
    const writeCore = (entry: BracketEntry) => {
      const isInlineScope = entry.end.position.line <= entry.start.position.line;
      if (!isInlineScope || entry.isUnmatchBrackets) {
        const parent = scopeStack[scopeStack.length - 1];
        if (parent) {
          parent.items.push(entry);
        } else {
          result.push(entry);
        }
      }
    };
    
    const write = (closingToken: { index: number; token: string }) => {
      const scope = scopeStack.pop();
      if (scope) {
        writeCore({
          start: scope.start,
          end: {
            position: document.positionAt(closingToken.index + closingToken.token.length),
            token: closingToken.token,
          },
          headerMode: scope.headerMode,
          isUnmatchBrackets: scope.closing !== regulate(closingToken.token),
          items: scope.items,
        });
      } else {
        // Extra closing bracket
        writeCore({
          start: {
            position: document.positionAt(closingToken.index),
            token: closingToken.token,
          },
          end: {
            position: document.positionAt(closingToken.index + closingToken.token.length),
            token: closingToken.token,
          },
          headerMode: 'smart',
          isUnmatchBrackets: true,
          items: [],
        });
      }
    };
    
    // Process tokens with optimized state checking
    for (const tokenData of tokens) {
      const token = regulate(tokenData.token);
      
      // Skip if inside comment or string (optimized check)
      if (this.isInsideCommentOrString(tokenData.index, text, parseCache)) {
        continue;
      }
      
      // Handle opening brackets
      const openingIndex = openingSymbolBrackets.indexOf(token);
      if (openingIndex >= 0) {
        scopeStack.push({
          start: {
            position: document.positionAt(tokenData.index),
            token: tokenData.token,
          },
          closing: closingSymbolBrackets[openingIndex],
          headerMode: symbolBracketsHeader[openingIndex],
          items: [],
        });
        continue;
      }
      
      // Handle closing brackets
      if (closingSymbolBrackets.indexOf(token) >= 0) {
        write(tokenData);
        continue;
      }
    }
    
    // Process remaining scopes
    while (scopeStack.length > 0) {
      write({ index: text.length, token: '' });
    }
    
    return result;
  }
  
  /**
   * Fallback to original parsing method
   */
  private fallbackParsing(document: vscode.TextDocument): BracketEntry[] {
    // Import and use the original BracketParser
    const { BracketParser } = require('../lens/lens');
    return BracketParser.parseBrackets(document);
  }

  // ============================================================================
  // INCREMENTAL PARSING METHODS
  // ============================================================================
  
  /**
   * Detect change regions from document changes
   */
  private detectChangeRegions(
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
          endChar: document.getText().length,
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
        endChar: startChar + change.text.length,
      });
    }
    
    return regions;
  }
  
  /**
   * Expand change region to include potentially affected brackets
   */
  private expandChangeRegion(
    region: ChangeRegion,
    document: vscode.TextDocument,
    existingBrackets: BracketEntry[]
  ): ChangeRegion {
    const text = document.getText();
    let minStart = region.startChar;
    let maxEnd = region.endChar;
    
    // Look for brackets that might be affected by this change
    for (const bracket of existingBrackets) {
      const openPos = document.offsetAt(bracket.start.position);
      const closePos = document.offsetAt(bracket.end.position);
      
      // If bracket spans across or near the change region
      if ((openPos >= region.startChar - 200 && openPos <= region.endChar + 200) ||
          (closePos >= region.startChar - 200 && closePos <= region.endChar + 200)) {
        minStart = Math.min(minStart, openPos - 100);
        maxEnd = Math.max(maxEnd, closePos + 100);
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
      endChar: maxEnd,
    };
  }
  
  /**
   * Remove brackets that are in the affected region
   */
  private removeBracketsInRegion(brackets: BracketEntry[], region: ChangeRegion): BracketEntry[] {
    return brackets.filter(bracket => {
      // Simple check - if bracket overlaps with region, remove it
      return !(bracket.start.position.line >= region.startLine && 
               bracket.end.position.line <= region.endLine);
    });
  }
  
  /**
   * Parse brackets in a specific region
   */
  private parseBracketsInRegion(document: vscode.TextDocument, region: ChangeRegion): BracketEntry[] {
    // For now, use full parsing - this could be optimized further
    return this.parseBrackets(document).filter(bracket => {
      return bracket.start.position.line >= region.startLine && 
             bracket.end.position.line <= region.endLine;
    });
  }
  
  /**
   * Merge new brackets with existing brackets
   */
  private mergeBrackets(existingBrackets: BracketEntry[], newBrackets: BracketEntry[]): BracketEntry[] {
    const allBrackets = [...existingBrackets, ...newBrackets];
    
    // Sort by opening position
    allBrackets.sort((a, b) => {
      if (a.start.position.line !== b.start.position.line) {
        return a.start.position.line - b.start.position.line;
      }
      return a.start.position.character - b.start.position.character;
    });
    
    return allBrackets;
  }
  
  /**
   * Update parse state cache after changes
   */
  private updateParseStateCache(text: string, fileUri: string): void {
    // Invalidate cache to force rebuild on next access
    this.parseStateCache.delete(fileUri);
  }

  // ============================================================================
  // PERFORMANCE FILTERS
  // ============================================================================
  
  /**
   * Apply performance filters to determine if file should be processed
   */
  private applyPerformanceFilters(document: vscode.TextDocument, text: string): {
    shouldSkip: boolean;
    reason?: string;
    performanceMode: 'normal' | 'performance' | 'minimal';
  } {
    const fileSize = text.length;
    const lineCount = document.lineCount;
    const languageId = document.languageId;
    
    // Check extreme file size - completely skip
    if (fileSize > this.PERFORMANCE_FILTERS.MAX_EXTREME_FILE_SIZE) {
      return {
        shouldSkip: true,
        reason: `File too large (${Math.round(fileSize / 1024 / 1024)}MB > ${Math.round(this.PERFORMANCE_FILTERS.MAX_EXTREME_FILE_SIZE / 1024 / 1024)}MB)`,
        performanceMode: 'minimal'
      };
    }
    
    // Check if file is likely problematic (very long lines, minified, etc.)
    const avgLineLength = fileSize / lineCount;
    if (avgLineLength > 500) {
      return {
        shouldSkip: true,
        reason: `Likely minified file (avg line length: ${Math.round(avgLineLength)} chars)`,
        performanceMode: 'minimal'
      };
    }
    
    // Check for known problematic file types
    const problematicExtensions = ['.min.js', '.min.css', '.bundle.js', '.chunk.js'];
    const fileName = document.fileName.toLowerCase();
    if (problematicExtensions.some(ext => fileName.endsWith(ext))) {
      return {
        shouldSkip: true,
        reason: `Problematic file type detected: ${fileName}`,
        performanceMode: 'minimal'
      };
    }
    
    // Determine performance mode
    let performanceMode: 'normal' | 'performance' | 'minimal' = 'normal';
    
    if (fileSize > this.PERFORMANCE_FILTERS.MAX_SAFE_FILE_SIZE) {
      performanceMode = 'performance';
    }
    
    // Special handling for certain languages
    const heavyLanguages = ['json', 'xml', 'html', 'svg'];
    if (heavyLanguages.includes(languageId) && fileSize > 1024 * 1024) { // 1MB
      performanceMode = 'performance';
    }
    
    return {
      shouldSkip: false,
      performanceMode
    };
  }
  
  /**
   * Apply filters after parsing to reduce decorations
   */
  private applyPostParsingFilters(
    brackets: BracketEntry[], 
    document: vscode.TextDocument,
    performanceMode: 'normal' | 'performance' | 'minimal'
  ): BracketEntry[] {
    if (performanceMode === 'normal') {
      return this.applyNormalFilters(brackets, document);
    } else if (performanceMode === 'performance') {
      return this.applyPerformanceModeFilters(brackets, document);
    } else {
      return this.applyMinimalFilters(brackets, document);
    }
  }
  
  /**
   * Apply normal filters (standard behavior)
   */
  private applyNormalFilters(brackets: BracketEntry[], document: vscode.TextDocument): BracketEntry[] {
    const minBracketScopeLines = BracketLynxConfig.minBracketScopeLines;
    
    return brackets.filter(bracket => {
      // Apply minimum line requirement
      const lineSpan = bracket.end.position.line - bracket.start.position.line + 1;
      if (lineSpan < minBracketScopeLines && !bracket.isUnmatchBrackets) {
        return false;
      }
      
      // Skip brackets with very little content
      const content = this.getBracketContent(bracket, document);
      if (content.trim().length < this.PERFORMANCE_FILTERS.MIN_BRACKET_CONTENT_LENGTH) {
        return false;
      }
      
      // Skip if decoration would be in middle of line with content
      if (this.hasContentAfterClosingBracket(bracket, document)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Apply performance mode filters (more aggressive)
   */
  private applyPerformanceModeFilters(brackets: BracketEntry[], document: vscode.TextDocument): BracketEntry[] {
    const filtered = brackets.filter(bracket => {
      // More strict line requirement
      const lineSpan = bracket.end.position.line - bracket.start.position.line + 1;
      if (lineSpan < Math.max(5, BracketLynxConfig.minBracketScopeLines) && !bracket.isUnmatchBrackets) {
        return false;
      }
      
      // Skip very large brackets
      if (lineSpan > this.PERFORMANCE_FILTERS.SKIP_LARGE_BRACKETS) {
        return false;
      }
      
      // Skip deeply nested brackets
      const depth = this.calculateNestingDepth(bracket);
      if (depth > this.PERFORMANCE_FILTERS.MAX_NESTED_DEPTH) {
        return false;
      }
      
      // Skip brackets with minimal content
      const content = this.getBracketContent(bracket, document);
      if (content.trim().length < this.PERFORMANCE_FILTERS.MIN_BRACKET_CONTENT_LENGTH * 2) {
        return false;
      }
      
      return true;
    });
    
    // Limit total number of decorations
    if (filtered.length > this.PERFORMANCE_FILTERS.MAX_DECORATIONS_PER_FILE) {
      // Keep only the most significant brackets (largest ones)
      return filtered
        .sort((a, b) => {
          const aSpan = a.end.position.line - a.start.position.line;
          const bSpan = b.end.position.line - b.start.position.line;
          return bSpan - aSpan;
        })
        .slice(0, this.PERFORMANCE_FILTERS.MAX_DECORATIONS_PER_FILE);
    }
    
    return filtered;
  }
  
  /**
   * Apply minimal filters (most aggressive)
   */
  private applyMinimalFilters(brackets: BracketEntry[], document: vscode.TextDocument): BracketEntry[] {
    // Only show unmatched brackets and very large brackets
    return brackets.filter(bracket => {
      if (bracket.isUnmatchBrackets) {
        return true;
      }
      
      const lineSpan = bracket.end.position.line - bracket.start.position.line + 1;
      return lineSpan > 50; // Only very large brackets
    }).slice(0, 50); // Maximum 50 decorations
  }
  
  /**
   * Get content inside bracket
   */
  private getBracketContent(bracket: BracketEntry, document: vscode.TextDocument): string {
    try {
      const startPos = bracket.start.position;
      const endPos = bracket.end.position;
      
      // Limit content extraction to avoid performance issues
      const maxLines = 10;
      const actualEndPos = startPos.line + maxLines < endPos.line 
        ? new vscode.Position(startPos.line + maxLines, 0)
        : endPos;
      
      return document.getText(new vscode.Range(startPos, actualEndPos));
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Check if there's content after closing bracket on same line
   */
  private hasContentAfterClosingBracket(bracket: BracketEntry, document: vscode.TextDocument): boolean {
    try {
      const endLine = document.lineAt(bracket.end.position.line);
      const afterBracket = endLine.text.substring(bracket.end.position.character);
      
      // Remove whitespace and common trailing characters
      const cleaned = afterBracket.replace(/^\s*[,;]?\s*$/, '');
      return cleaned.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Calculate nesting depth of bracket
   */
  private calculateNestingDepth(bracket: BracketEntry): number {
    let maxDepth = 0;
    
    const calculateDepth = (items: BracketEntry[], currentDepth: number): void => {
      maxDepth = Math.max(maxDepth, currentDepth);
      
      for (const item of items) {
        calculateDepth(item.items, currentDepth + 1);
      }
    };
    
    calculateDepth(bracket.items, 1);
    return maxDepth;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================
  
  /**
   * Clear cache for specific file
   */
  clearFileCache(fileUri: string): void {
    this.parseStateCache.delete(fileUri);
    this.tokenCache.delete(fileUri);
  }
  
  /**
   * Clear all caches
   */
  clearAllCache(): void {
    this.parseStateCache.clear();
    this.tokenCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      parseStateCacheSize: this.parseStateCache.size,
      tokenCacheSize: this.tokenCache.size,
      maxCacheSize: this.CACHE_MAX_SIZE,
      performanceFilters: this.PERFORMANCE_FILTERS
    };
  }
  
  /**
   * Get performance filter statistics
   */
  getPerformanceStats() {
    return {
      maxSafeFileSize: `${Math.round(this.PERFORMANCE_FILTERS.MAX_SAFE_FILE_SIZE / 1024 / 1024)}MB`,
      maxExtremeFileSize: `${Math.round(this.PERFORMANCE_FILTERS.MAX_EXTREME_FILE_SIZE / 1024 / 1024)}MB`,
      maxDecorationsPerFile: this.PERFORMANCE_FILTERS.MAX_DECORATIONS_PER_FILE,
      minBracketLines: this.PERFORMANCE_FILTERS.MIN_BRACKET_LINES,
      maxNestedDepth: this.PERFORMANCE_FILTERS.MAX_NESTED_DEPTH
    };
  }
  
  /**
   * Cleanup expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean parse state cache
    for (const [key, entry] of this.parseStateCache) {
      if (now - entry.timestamp > this.PARSE_CACHE_MAX_AGE) {
        this.parseStateCache.delete(key);
        cleanedCount++;
      }
    }
    
    // Clean token cache
    for (const [key, entry] of this.tokenCache) {
      if (now - entry.timestamp > this.TOKEN_CACHE_MAX_AGE) {
        this.tokenCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0 && BracketLynxConfig.debug) {
      console.log(`Bracket Lynx Parser: Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Perform aggressive cleanup for memory pressure
   */
  aggressiveCleanup(): void {
    const now = Date.now();
    const aggressiveTTL = Math.min(this.PARSE_CACHE_MAX_AGE / 2, 60 * 1000); // 1 minute max
    
    let cleanedCount = 0;
    
    // More aggressive cleanup of parse state cache
    for (const [key, entry] of this.parseStateCache) {
      if (now - entry.timestamp > aggressiveTTL || entry.fileSize > 1024 * 1024) { // Clean large files
        this.parseStateCache.delete(key);
        cleanedCount++;
      }
    }
    
    // More aggressive cleanup of token cache
    for (const [key, entry] of this.tokenCache) {
      if (now - entry.timestamp > aggressiveTTL) {
        this.tokenCache.delete(key);
        cleanedCount++;
      }
    }
    
    console.log(`Bracket Lynx Parser: Aggressive cleanup removed ${cleanedCount} entries`);
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage(): { parseStateCache: string; tokenCache: string; total: string } {
    let parseStateMB = 0;
    let tokenMB = 0;
    
    // Estimate parse state cache memory
    for (const [, entry] of this.parseStateCache) {
      parseStateMB += entry.fileSize || 0;
      parseStateMB += (entry.states?.length || 0) * 100; // Rough estimate per state
    }
    
    // Estimate token cache memory
    for (const [, entry] of this.tokenCache) {
      tokenMB += (entry.tokens?.length || 0) * 50; // Rough estimate per token
      tokenMB += entry.pattern?.length || 0;
    }
    
    const totalMB = (parseStateMB + tokenMB) / 1024 / 1024;
    
    return {
      parseStateCache: `${Math.round(parseStateMB / 1024 / 1024)}MB`,
      tokenCache: `${Math.round(tokenMB / 1024 / 1024)}MB`,
      total: `${Math.round(totalMB)}MB`
    };
  }
  
  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.clearAllCache();
  }
}