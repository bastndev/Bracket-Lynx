import * as vscode from 'vscode';
import { containsControlFlowKeyword } from '../lens/lens-rules';
import { BracketEntry,TokenEntry,LanguageConfiguration,BracketLynxConfig,HeaderMode,} from '../lens/lens';
import { PROBLEMATIC_LANGUAGES, PROBLEMATIC_EXTENSIONS,PERFORMANCE_LIMITS,createHash} from './performance-config';

// ============================================================================
// 🚀 OPTIMIZED INTERFACES - Unified and Clean
// ============================================================================

export interface ParserExceptionConfig {
  readonly problematicLanguages: readonly string[];
  readonly problematicExtensions: readonly string[];
  readonly enableContentDetection: boolean;
  readonly maxContentAnalysisSize: number;
}

export interface ParseState {
  readonly position: number;
  readonly inString: boolean;
  readonly inSingleQuote: boolean;
  readonly inDoubleQuote: boolean;
  readonly inTemplateString: boolean;
  readonly inBlockComment: boolean;
  readonly inLineComment: boolean;
  readonly stringEscapeNext: boolean;
}

export interface CacheEntry<T> {
  readonly data: T;
  readonly textHash: string;
  readonly timestamp: number;
  readonly fileSize: number;
  readonly languageId?: string;
}

export interface ChangeRegion {
  readonly startLine: number;
  readonly endLine: number;
  readonly startChar: number;
  readonly endChar: number;
}

export interface ParseResult {
  readonly brackets: BracketEntry[];
  readonly affectedRegions: ChangeRegion[];
  readonly parseTime: number;
  readonly cacheHit: boolean;
}

export interface PerformanceFilterResult {
  readonly shouldSkip: boolean;
  readonly reason?: string;
  readonly performanceMode: 'normal' | 'performance' | 'minimal';
}

// ============================================================================
// 🎯 UNIFIED CACHE MANAGER - Single Source of Truth
// ============================================================================

class UnifiedCacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  constructor(
    private readonly maxSize: number = 30,
    private readonly maxAge: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  get(key: string, textHash: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {return null;}
    
    // Check if expired or content changed
    if (
      Date.now() - entry.timestamp > this.maxAge ||
      entry.textHash !== textHash
    ) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: T, textHash: string, fileSize: number, languageId?: string): void {
    // Enforce size limit with LRU eviction
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      textHash,
      timestamp: Date.now(),
      fileSize,
      languageId
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }

  // 🧹 Cleanup expired entries
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}

// ============================================================================
// 🔥 OPTIMIZED BRACKET PARSER - Clean and Fast
// ============================================================================

export class OptimizedBracketParser {
  private static instance: OptimizedBracketParser;
  
  // 🎯 Unified cache system
  private parseStateCache = new UnifiedCacheManager<ParseState[]>(30, 2 * 60 * 1000);
  private tokenCache = new UnifiedCacheManager<{ index: number; token: string }[]>(30, 5 * 60 * 1000);
  
  // Configuration
  private parserExceptionConfig: ParserExceptionConfig = {
    problematicLanguages: [...PROBLEMATIC_LANGUAGES],
    problematicExtensions: [...PROBLEMATIC_EXTENSIONS],
    enableContentDetection: true,
    maxContentAnalysisSize: PERFORMANCE_LIMITS.MAX_CONTENT_ANALYSIS_SIZE,
  };
  
  // Fallback parser
  private fallbackParser?: (document: vscode.TextDocument) => BracketEntry[];
  
  // 🚀 Performance constants
  private static readonly CONSTANTS = {
    PARSE_CACHE_INTERVAL: 100,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_SAFE_FILE_SIZE: PERFORMANCE_LIMITS.MAX_FILE_SIZE,
    MAX_EXTREME_FILE_SIZE: PERFORMANCE_LIMITS.MAX_FILE_SIZE * 4,
    MIN_BRACKET_LINES: PERFORMANCE_LIMITS.MIN_BRACKET_SCOPE_LINES,
    MAX_DECORATIONS_PER_FILE: PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE,
    MIN_BRACKET_CONTENT_LENGTH: 10,
    SKIP_LARGE_BRACKETS: 1000,
    MAX_NESTED_DEPTH: 20,
  } as const;

  private constructor() {}

  static getInstance(): OptimizedBracketParser {
    if (!OptimizedBracketParser.instance) {
      OptimizedBracketParser.instance = new OptimizedBracketParser();
    }
    return OptimizedBracketParser.instance;
  }

  // ============================================================================
  // 🎯 PUBLIC API - Clean and Simple
  // ============================================================================

  setFallbackParser(parser: (document: vscode.TextDocument) => BracketEntry[]): void {
    this.fallbackParser = parser;
    
    if (BracketLynxConfig.debug) {
      console.log('🔧 Bracket Lynx: Fallback parser configured');
    }
  }

  parseBrackets(document: vscode.TextDocument): BracketEntry[] {
    const text = document.getText();
    const fileUri = document.uri.toString();
    const textHash = createHash(text);

    // 🚀 Apply performance filters first
    const filterResult = this.applyPerformanceFilters(document, text);
    if (filterResult.shouldSkip) {
      if (BracketLynxConfig.debug) {
        console.log(`⚡ Skipping file: ${filterResult.reason}`);
      }
      return [];
    }

    // 🎯 Check if we should use fallback parser
    if (this.shouldUseOriginalParser(document)) {
      return this.fallbackParsing(document);
    }

    const startTime = Date.now();

    try {
      // 🚀 Get cached data or create new
      const parseStates = this.getOrCreateParseStates(text, fileUri, textHash);
      const tokens = this.getOrCreateTokens(document, text, textHash);

      // 🎯 Parse with optimized state detection
      let brackets = this.parseTokensOptimized(document, tokens, parseStates);

      // 🔧 Apply post-parsing filters
      brackets = this.applyPostParsingFilters(brackets, document, filterResult.performanceMode);

      const parseTime = Date.now() - startTime;

      if (BracketLynxConfig.debug) {
        console.log(`⚡ Parsing completed: ${parseTime}ms, ${brackets.length} brackets`);
      }

      return brackets;
    } catch (error) {
      console.error('🚨 Parsing error, using fallback:', error);
      return this.fallbackParsing(document);
    }
  }

  parseIncremental(
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[],
    existingBrackets: BracketEntry[]
  ): ParseResult {
    const startTime = Date.now();
    const text = document.getText();
    const fileUri = document.uri.toString();

    try {
      // 🎯 Detect and expand change regions
      const changeRegions = this.detectChangeRegions(document, changes);
      const expandedRegions = changeRegions.map(region =>
        this.expandChangeRegion(region, document, existingBrackets)
      );

      // 🚀 Process only affected regions
      let resultBrackets = existingBrackets;

      for (const region of expandedRegions) {
        resultBrackets = this.removeBracketsInRegion(resultBrackets, region);
        const newBrackets = this.parseBracketsInRegion(document, region);
        resultBrackets = this.mergeBrackets(resultBrackets, newBrackets);
      }

      // 🧹 Invalidate cache for changed file
      this.parseStateCache.delete(fileUri);

      const parseTime = Date.now() - startTime;

      if (BracketLynxConfig.debug) {
        console.log(`🔄 Incremental parsing: ${parseTime}ms, ${expandedRegions.length} regions`);
      }

      return {
        brackets: resultBrackets,
        affectedRegions: expandedRegions,
        parseTime,
        cacheHit: false
      };
    } catch (error) {
      console.error('🚨 Incremental parsing error, using full parse:', error);
      
      const fallbackBrackets = this.parseBrackets(document);
      return {
        brackets: fallbackBrackets,
        affectedRegions: [],
        parseTime: Date.now() - startTime,
        cacheHit: false
      };
    }
  }

  // ============================================================================
  // 🎯 CACHE MANAGEMENT - Unified and Efficient
  // ============================================================================

  private getOrCreateParseStates(text: string, fileUri: string, textHash: string): ParseState[] {
    // 🚀 Try cache first
    const cached = this.parseStateCache.get(fileUri, textHash);
    if (cached) {
      return cached;
    }

    // 🔧 Build new parse states
    const states = this.buildParseStates(text);
    this.parseStateCache.set(fileUri, states, textHash, text.length);
    
    return states;
  }

  private getOrCreateTokens(
    document: vscode.TextDocument, 
    text: string, 
    textHash: string
  ): { index: number; token: string }[] {
    const fileUri = document.uri.toString();
    
    // 🚀 Try cache first
    const cached = this.tokenCache.get(fileUri, textHash);
    if (cached) {
      return cached;
    }

    // 🔧 Create new tokens
    const languageConfiguration = BracketLynxConfig.languageConfiguration;
    const pattern = this.createTokenPattern(languageConfiguration);
    const tokens = this.tokenizeDocument(text, pattern, languageConfiguration.ignoreCase);
    
    this.tokenCache.set(fileUri, tokens, textHash, text.length, document.languageId);
    
    return tokens;
  }

  // ============================================================================
  // 🔧 PARSING LOGIC - Optimized and Clean
  // ============================================================================

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
      const nextChar = i < text.length - 1 ? text[i + 1] : '';

      // 🎯 Handle escape sequences
      if (inString && stringEscapeNext) {
        stringEscapeNext = false;
        continue;
      }

      if (inString && char === '\\') {
        stringEscapeNext = true;
        continue;
      }

      // 🔧 Handle comments
      if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
        inLineComment = true;
      } else if (inLineComment && char === '\n') {
        inLineComment = false;
      }

      if (!inString && !inLineComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
      } else if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the '/' character
        continue;
      }

      // 🎯 Handle strings (only if not in comments)
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

      // 🚀 Cache state at intervals
      if (i % OptimizedBracketParser.CONSTANTS.PARSE_CACHE_INTERVAL === 0 || i === text.length - 1) {
        states.push({
          position: i,
          inString,
          inSingleQuote,
          inDoubleQuote,
          inTemplateString,
          inBlockComment,
          inLineComment,
          stringEscapeNext,
        });
      }
    }

    return states;
  }

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
      stringEscapeNext,
    };
  }

  private isInsideCommentOrString(position: number, text: string, parseStates: ParseState[]): boolean {
    const closestState = this.findClosestState(parseStates, position);

    if (!closestState) {
      return false;
    }

    if (closestState.position === position) {
      return (
        closestState.inString ||
        closestState.inBlockComment ||
        closestState.inLineComment
      );
    }

    const currentState = this.calculateStateFromPosition(text, closestState, position);
    return (
      currentState.inString ||
      currentState.inBlockComment ||
      currentState.inLineComment
    );
  }

  // ============================================================================
  // 🎯 TOKEN PROCESSING - Optimized
  // ============================================================================

  private createTokenPattern(languageConfiguration: LanguageConfiguration): string {
    const regulate = languageConfiguration.ignoreCase
      ? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
      : (text: string) => text.replace(/\s+/, ' ');

    const tokens = [
      ...(languageConfiguration.ignoreSymbols?.map(regulate) ?? []),
      ...(languageConfiguration.comments?.block?.map((i) => regulate(i.opening)) ?? []),
      ...(languageConfiguration.comments?.block?.map((i) => regulate(i.closing)) ?? []),
      ...(languageConfiguration.comments?.line?.map(regulate) ?? []),
      ...(languageConfiguration.brackets?.symbol?.map((i) => regulate(i.opening)) ?? []),
      ...(languageConfiguration.brackets?.symbol?.map((i) => regulate(i.closing)) ?? []),
      ...(languageConfiguration.brackets?.word?.map((i) => regulate(i.opening)) ?? []),
      ...(languageConfiguration.brackets?.word?.map((i) => regulate(i.closing)) ?? []),
      ...(languageConfiguration.strings?.inline?.map((i) => regulate(i.opening)) ?? []),
      ...(languageConfiguration.strings?.inline?.map((i) => regulate(i.closing)) ?? []),
      ...(languageConfiguration.strings?.multiline?.map((i) => regulate(i.opening)) ?? []),
      ...(languageConfiguration.strings?.multiline?.map((i) => regulate(i.closing)) ?? []),
    ];

    const makeRegExpPart = (text: string) =>
      text.replace(/([\\\/\*\[\]\(\)\{\}\|])/gmu, '\\$1').replace(/\s+/, '\\s');

    return tokens
      .filter((entry, index, array) => '' !== entry && index === array.indexOf(entry))
      .map((i) => `${makeRegExpPart(i)}`)
      .join('|');
  }

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
        token: match[0],
      });
    }

    return result;
  }

  private parseTokensOptimized(
    document: vscode.TextDocument,
    tokens: { index: number; token: string }[],
    parseStates: ParseState[]
  ): BracketEntry[] {
    const result: BracketEntry[] = [];
    const text = document.getText();
    const languageConfiguration = BracketLynxConfig.languageConfiguration;
    const regulate = languageConfiguration.ignoreCase
      ? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
      : (text: string) => text.replace(/\s+/, ' ');

    // 🎯 Extract language tokens (simplified)
    const openingSymbolBrackets = languageConfiguration.brackets?.symbol?.map((i) => regulate(i.opening)) ?? [];
    const closingSymbolBrackets = languageConfiguration.brackets?.symbol?.map((i) => regulate(i.closing)) ?? [];
    const symbolBracketsHeader = languageConfiguration.brackets?.symbol?.map((i) => i.headerMode ?? 'smart') ?? [];

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

    // 🚀 Process tokens with optimized state checking
    for (const tokenData of tokens) {
      const token = regulate(tokenData.token);

      // Skip if inside comment or string (optimized check)
      if (this.isInsideCommentOrString(tokenData.index, text, parseStates)) {
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

  // ============================================================================
  // 🔧 PERFORMANCE FILTERS - Optimized
  // ============================================================================

  private applyPerformanceFilters(document: vscode.TextDocument, text: string): PerformanceFilterResult {
    const fileSize = text.length;
    const lineCount = document.lineCount;
    const fileName = document.fileName.toLowerCase();

    // 🚨 Check extreme file size - completely skip
    if (fileSize > OptimizedBracketParser.CONSTANTS.MAX_EXTREME_FILE_SIZE) {
      return {
        shouldSkip: true,
        reason: `File too large (${Math.round(fileSize / 1024 / 1024)}MB)`,
        performanceMode: 'minimal',
      };
    }

    // 🎯 Check if file is likely minified
    const avgLineLength = fileSize / lineCount;
    if (avgLineLength > 500) {
      return {
        shouldSkip: true,
        reason: `Likely minified file (avg line length: ${Math.round(avgLineLength)} chars)`,
        performanceMode: 'minimal',
      };
    }

    // 🔧 Check for problematic file types
    const problematicExtensions = ['.min.js', '.min.css', '.bundle.js', '.chunk.js'];
    if (problematicExtensions.some((ext) => fileName.endsWith(ext))) {
      return {
        shouldSkip: true,
        reason: `Problematic file type: ${fileName}`,
        performanceMode: 'minimal',
      };
    }

    // 🎯 Determine performance mode
    if (fileSize > OptimizedBracketParser.CONSTANTS.MAX_SAFE_FILE_SIZE) {
      return {
        shouldSkip: false,
        performanceMode: 'performance',
      };
    }

    return {
      shouldSkip: false,
      performanceMode: 'normal',
    };
  }

  private applyPostParsingFilters(
    brackets: BracketEntry[],
    document: vscode.TextDocument,
    performanceMode: 'normal' | 'performance' | 'minimal'
  ): BracketEntry[] {
    switch (performanceMode) {
      case 'minimal':
        return this.applyMinimalFilters(brackets, document);
      case 'performance':
        return this.applyPerformanceModeFilters(brackets, document);
      case 'normal':
      default:
        return this.applyNormalFilters(brackets, document);
    }
  }

  private applyNormalFilters(brackets: BracketEntry[], document: vscode.TextDocument): BracketEntry[] {
    return brackets.filter((bracket) => {
      const lineSpan = bracket.end.position.line - bracket.start.position.line;
      return lineSpan >= OptimizedBracketParser.CONSTANTS.MIN_BRACKET_LINES;
    });
  }

  private applyPerformanceModeFilters(brackets: BracketEntry[], document: vscode.TextDocument): BracketEntry[] {
    return brackets
      .filter((bracket) => {
        const lineSpan = bracket.end.position.line - bracket.start.position.line;
        return lineSpan >= OptimizedBracketParser.CONSTANTS.MIN_BRACKET_LINES + 2;
      })
      .slice(0, Math.floor(OptimizedBracketParser.CONSTANTS.MAX_DECORATIONS_PER_FILE * 0.7));
  }

  private applyMinimalFilters(brackets: BracketEntry[], document: vscode.TextDocument): BracketEntry[] {
    return brackets
      .filter((bracket) => {
        const lineSpan = bracket.end.position.line - bracket.start.position.line;
        return lineSpan >= OptimizedBracketParser.CONSTANTS.MIN_BRACKET_LINES + 5;
      })
      .slice(0, Math.floor(OptimizedBracketParser.CONSTANTS.MAX_DECORATIONS_PER_FILE * 0.3));
  }

  // ============================================================================
  // 🔄 INCREMENTAL PARSING HELPERS
  // ============================================================================

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
      if (
        (openPos >= region.startChar - 200 && openPos <= region.endChar + 200) ||
        (closePos >= region.startChar - 200 && closePos <= region.endChar + 200)
      ) {
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

  private removeBracketsInRegion(brackets: BracketEntry[], region: ChangeRegion): BracketEntry[] {
    return brackets.filter((bracket) => {
      return !(
        bracket.start.position.line >= region.startLine &&
        bracket.end.position.line <= region.endLine
      );
    });
  }

  private parseBracketsInRegion(document: vscode.TextDocument, region: ChangeRegion): BracketEntry[] {
    // For now, use full parsing - this could be optimized further
    return this.parseBrackets(document).filter((bracket) => {
      return (
        bracket.start.position.line >= region.startLine &&
        bracket.end.position.line <= region.endLine
      );
    });
  }

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

  // ============================================================================
  // 🎯 UTILITY METHODS
  // ============================================================================

  shouldUseOriginalParser(document: vscode.TextDocument): boolean {
    const languageId = document.languageId;
    const fileName = document.fileName.toLowerCase();

    // Check if language is problematic
    if (this.parserExceptionConfig.problematicLanguages.includes(languageId)) {
      return true;
    }

    // Check if file extension is problematic
    if (this.parserExceptionConfig.problematicExtensions.some(ext => fileName.endsWith(ext))) {
      return true;
    }

    // Check for mixed content if enabled
    if (this.parserExceptionConfig.enableContentDetection) {
      return this.hasMixedContent(document);
    }

    return false;
  }

  private hasMixedContent(document: vscode.TextDocument): boolean {
    const text = document.getText();
    const sampleSize = Math.min(text.length, this.parserExceptionConfig.maxContentAnalysisSize);
    const sample = text.substring(0, sampleSize);

    // Simple heuristic: check for mixed HTML/JS/CSS patterns
    const hasHtmlTags = /<[^>]+>/.test(sample);
    const hasJsPatterns = /(?:function|const|let|var|=>)/.test(sample);
    const hasCssPatterns = /(?:\{[^}]*:[^}]*\}|@media|@import)/.test(sample);

    // If we have multiple content types, it's mixed
    const contentTypes = [hasHtmlTags, hasJsPatterns, hasCssPatterns].filter(Boolean).length;
    return contentTypes > 1;
  }

  private fallbackParsing(document: vscode.TextDocument): BracketEntry[] {
    if (!this.fallbackParser) {
      console.error('🚨 No fallback parser configured!');
      return [];
    }

    if (BracketLynxConfig.debug) {
      console.log(`🔄 Using fallback parser for: ${document.fileName}`);
    }

    try {
      return this.fallbackParser(document);
    } catch (error) {
      console.error('🚨 Fallback parsing error:', error);
      return [];
    }
  }

  // ============================================================================
  // 🧹 CACHE MANAGEMENT
  // ============================================================================

  clearAllCache(): void {
    this.parseStateCache.clear();
    this.tokenCache.clear();
  }

  clearFileCache(fileUri: string): void {
    this.parseStateCache.delete(fileUri);
    this.tokenCache.delete(fileUri);
  }

  cleanup(): void {
    const parseStatesCleanedCount = this.parseStateCache.cleanup();
    const tokensCleanedCount = this.tokenCache.cleanup();
    
    if (BracketLynxConfig.debug && (parseStatesCleanedCount > 0 || tokensCleanedCount > 0)) {
      console.log(`🧹 Cache cleanup: ${parseStatesCleanedCount + tokensCleanedCount} entries removed`);
    }
  }

  getCacheStats(): {
    parseStatesSize: number;
    tokensSize: number;
    totalSize: number;
  } {
    return {
      parseStatesSize: this.parseStateCache.size(),
      tokensSize: this.tokenCache.size(),
      totalSize: this.parseStateCache.size() + this.tokenCache.size(),
    };
  }

  getMemoryUsage(): number {
    // Rough estimation in MB
    const avgEntrySize = 1024; // 1KB per entry estimate
    const totalEntries = this.parseStateCache.size() + this.tokenCache.size();
    return (totalEntries * avgEntrySize) / (1024 * 1024);
  }

  aggressiveCleanup(): void {
    this.clearAllCache();
    
    if (BracketLynxConfig.debug) {
      console.log('🧹 Aggressive cache cleanup completed');
    }
  }

  dispose(): void {
    this.clearAllCache();
  }

  // ============================================================================
  // 🎯 CONFIGURATION MANAGEMENT
  // ============================================================================

  updateParserExceptionConfig(newConfig: Partial<ParserExceptionConfig>): void {
    this.parserExceptionConfig = { ...this.parserExceptionConfig, ...newConfig };
    
    if (BracketLynxConfig.debug) {
      console.log('🔧 Parser exception config updated');
    }
  }

  addLanguageException(languageId: string): void {
    if (!this.parserExceptionConfig.problematicLanguages.includes(languageId)) {
      this.parserExceptionConfig = {
        ...this.parserExceptionConfig,
        problematicLanguages: [...this.parserExceptionConfig.problematicLanguages, languageId]
      };
    }
  }

  removeLanguageException(languageId: string): void {
    this.parserExceptionConfig = {
      ...this.parserExceptionConfig,
      problematicLanguages: this.parserExceptionConfig.problematicLanguages.filter(lang => lang !== languageId)
    };
  }

  addExtensionException(extension: string): void {
    if (!this.parserExceptionConfig.problematicExtensions.includes(extension)) {
      this.parserExceptionConfig = {
        ...this.parserExceptionConfig,
        problematicExtensions: [...this.parserExceptionConfig.problematicExtensions, extension]
      };
    }
  }

  removeExtensionException(extension: string): void {
    this.parserExceptionConfig = {
      ...this.parserExceptionConfig,
      problematicExtensions: this.parserExceptionConfig.problematicExtensions.filter(ext => ext !== extension)
    };
  }

  hasFallbackParser(): boolean {
    return !!this.fallbackParser;
  }

  getPerformanceStats(): {
    cacheStats: {
      parseStatesSize: number;
      tokensSize: number;
      totalSize: number;
    };
    memoryUsage: number;
    config: ParserExceptionConfig;
  } {
    return {
      cacheStats: this.getCacheStats(),
      memoryUsage: this.getMemoryUsage(),
      config: this.parserExceptionConfig,
    };
  }
}