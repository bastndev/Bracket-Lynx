import * as vscode from 'vscode';
import { LanguageFormatter } from './language-formatter';
import { OptimizedBracketParser } from '../core/performance-parser';
import { getEffectiveColor, onConfigurationChanged } from '../actions/colors';
import { AdvancedCacheManager, SmartDebouncer } from '../core/performance-cache';
import { isExtensionEnabled, isEditorEnabled, isDocumentEnabled } from '../actions/toggle';
import { PositionUtils, regExpExecToArray, makeRegExpPart, PERFORMANCE_LIMITS, SUPPORTED_LANGUAGES, ALLOWED_JSON_FILES, PROBLEMATIC_LANGUAGES, PROBLEMATIC_EXTENSIONS, SupportedLanguage, ProblematicLanguage, AllowedJsonFile,safeExecute, safeExecuteAsync, validateDocument, validateTextEditor, validateFileSize,ParseError, DecorationError, PerformanceError,logger, LogCategory,createRecoveryChain} from '../core/performance-config';
import { FILTER_RULES, shouldExcludeSymbol, filterContent, isLanguageSupported as isLanguageSupportedRules, shouldProcessFile as shouldProcessFileRules, applyWordLimit, containsControlFlowKeyword, formatArrowFunction } from './lens-rules';

// RE-EXPORT CONSTANTS FOR EASY ACCESS
export {
  SUPPORTED_LANGUAGES,
  ALLOWED_JSON_FILES,
  PROBLEMATIC_LANGUAGES,
  PROBLEMATIC_EXTENSIONS,
  SupportedLanguage,
  ProblematicLanguage,
  AllowedJsonFile,
} from '../core/performance-config';

// ============================================================================
// CONFIGURATION UTILITY FUNCTIONS
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

export function shouldProcessFileConfig(
  languageId: string,
  fileName: string
): boolean {
  if (languageId === 'json' || languageId === 'jsonc') {
    return isAllowedJsonFile(fileName);
  }
  return isSupportedLanguage(languageId);
}

// ============================================================================
// EXPORTED UTILITIES (for backward compatibility)
// ============================================================================

export { PositionUtils, regExpExecToArray } from '../core/performance-config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ScopeTerms {
  opening: string;
  closing: string;
}

export type HeaderMode = 'before' | 'smart' | 'inner';

export interface BracketTrait extends ScopeTerms {
  headerMode?: HeaderMode;
  inters?: string[];
}

export interface StringTrait extends ScopeTerms {
  escape: string[];
}

export interface LanguageConfiguration {
  ignoreCase: boolean;
  comments?: {
    block?: ScopeTerms[];
    line?: string[];
  };
  brackets?: {
    symbol?: BracketTrait[];
    word?: BracketTrait[];
  };
  strings?: {
    inline?: StringTrait[];
    multiline?: StringTrait[];
  };
  terminators?: string[];
  ignoreSymbols?: string[];
}

export interface TokenEntry {
  position: vscode.Position;
  token: string;
}

export interface BracketEntry {
  start: TokenEntry;
  end: TokenEntry;
  headerMode: HeaderMode;
  isUnmatchBrackets: boolean;
  items: BracketEntry[];
}

export interface BracketContext {
  parentEntry: BracketEntry | undefined;
  previousEntry: BracketEntry | undefined;
  entry: BracketEntry;
  nextEntry: BracketEntry | undefined;
}

export interface BracketDecorationSource {
  range: vscode.Range;
  bracketHeader: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================
export class BracketLynxConfig {
  private static getConfig() {
    return vscode.workspace.getConfiguration('bracketLynx');
  }

  static get mode(): string {
    return this.getConfig().get('mode', 'auto');
  }

  static get debug(): boolean {
    return this.getConfig().get('debug', false);
  }

  static get color(): string {
    try {
      const effectiveColor = getEffectiveColor();
      if (effectiveColor) {
        return effectiveColor;
      }
    } catch (error) {
      // Fallback silently
    }

    try {
      return this.getConfig().get('color', '#515151');
    } catch {
      return '#515151';
    }
  }

  static get fontStyle(): string {
    return this.getConfig().get('fontStyle', 'italic');
  }

  static get prefix(): string {
    return this.getConfig().get('prefix', '‹~ ');
  }

  static get unmatchBracketsPrefix(): string {
    return this.getConfig().get('unmatchBracketsPrefix', '❌ ');
  }

  static get maxBracketHeaderLength(): number {
    return this.getConfig().get(
      'maxBracketHeaderLength',
      PERFORMANCE_LIMITS.MAX_HEADER_LENGTH
    );
  }

  static get minBracketScopeLines(): number {
    return this.getConfig().get(
      'minBracketScopeLines',
      PERFORMANCE_LIMITS.MIN_BRACKET_SCOPE_LINES
    );
  }

  static get enablePerformanceFilters(): boolean {
    return this.getConfig().get('enablePerformanceFilters', true);
  }

  static get maxFileSize(): number {
    return this.getConfig().get(
      'maxFileSize',
      PERFORMANCE_LIMITS.MAX_FILE_SIZE
    );
  }

  static get maxDecorationsPerFile(): number {
    return this.getConfig().get(
      'maxDecorationsPerFile',
      PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE
    );
  }

  static get languageConfiguration(): LanguageConfiguration {
    return this.getConfig().get(
      'languageConfiguration',
      this.getDefaultLanguageConfig()
    );
  }

  private static getDefaultLanguageConfig(): LanguageConfiguration {
    return {
      ignoreCase: false,
      brackets: {
        symbol: [
          { opening: '{', closing: '}', headerMode: 'smart' },
          { opening: '[', closing: ']', headerMode: 'smart' },
          { opening: '(', closing: ')', headerMode: 'smart' },
        ],
      },
      terminators: [';', ','],
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

const isInlineScope = (bracket: BracketEntry) =>
  bracket.end.position.line <= bracket.start.position.line;

    interface DebugOutput {
      message: string;
      data?: unknown;
      timestamp: number;
      context?: string;
    }

    const debug = (output: DebugOutput | string) => {
      if (BracketLynxConfig.debug) {
        if (typeof output === 'string') {
          console.debug(output);
        } else {
          console.debug(`[${output.context || 'BracketLynx'}] ${output.message}`, output.data);
        }
      }
    };

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export class DocumentDecorationCacheEntry {
  brackets: BracketEntry[];
  decorationSource: BracketDecorationSource[] = [];

  constructor(document: vscode.TextDocument) {
    // Use parser exception manager
    const optimizedParser = OptimizedBracketParser.getInstance();
    if (optimizedParser.shouldUseOriginalParser(document)) {
      // Use original parser for problematic files
      this.brackets = BracketParser.parseBrackets(document);

      if (BracketLynxConfig.debug) {
        console.log(
          `Bracket Lynx: Using original parser for: ${document.fileName} (${document.languageId})`
        );
      }
    } else {
      // Use optimized parser for other files
      this.brackets = optimizedParser.parseBrackets(document);

      if (BracketLynxConfig.debug) {
        console.log(
          `Bracket Lynx: Using optimized parser for: ${document.fileName} (${document.languageId})`
        );
      }
    }

    this.decorationSource =
      BracketDecorationGenerator.getBracketDecorationSource(
        document,
        this.brackets
      );
    CacheManager.documentCache.set(document, this);
  }
}

export class EditorDecorationCacheEntry {
  isMuted: boolean | undefined;
  private isDirtyValue: boolean = false;
  private bracketHeaderInformationDecoration?: vscode.TextEditorDecorationType;

  constructor(editor: vscode.TextEditor) {
    CacheManager.editorCache.set(editor, this);
  }

  isDirty = () => this.isDirtyValue;

  setDirty = () => {
    this.isDirtyValue = true;
  };

  setBracketHeaderInformationDecoration = (
    decoration?: vscode.TextEditorDecorationType
  ) => {
    this.dispose();
    this.bracketHeaderInformationDecoration = decoration;
  };

  dispose = () => {
    this.bracketHeaderInformationDecoration?.dispose();
    this.bracketHeaderInformationDecoration = undefined;
    this.isDirtyValue = false;
  };
}

export class CacheManager {
  // Legacy cache maps for backward compatibility
  static documentCache = new Map<
    vscode.TextDocument,
    DocumentDecorationCacheEntry
  >();
  static editorCache = new Map<vscode.TextEditor, EditorDecorationCacheEntry>();

  // Advanced cache manager instance
  private static advancedCache = AdvancedCacheManager.getInstance();

  static getDocumentCache = (document: vscode.TextDocument) => {
    // Try advanced cache first
    const advancedEntry = this.advancedCache.getDocumentCache(document);
    if (advancedEntry) {
      return advancedEntry;
    }

    // Fallback to legacy behavior
    const existing = this.documentCache.get(document);
    if (existing) {
      return existing;
    }

    // Create new entry and cache it in both systems
    const newEntry = new DocumentDecorationCacheEntry(document);
    this.advancedCache.setDocumentCache(
      document,
      newEntry.brackets,
      newEntry.decorationSource
    );
    return newEntry;
  };

  static getEditorCache = (textEditor: vscode.TextEditor) => {
    // Try advanced cache first
    const advancedEntry = this.advancedCache.getEditorCache(textEditor);
    if (advancedEntry) {
      return advancedEntry;
    }

    // Create new entry and cache it
    return this.advancedCache.setEditorCache(textEditor);
  };

  static clearAllDecorationCache = (): void => {
    this.advancedCache.clearAllCache();

    // RESTORE: Clear optimized parser cache
    const optimizedParser = OptimizedBracketParser.getInstance();
    optimizedParser.clearAllCache();

    // Keep legacy behavior for compatibility
    this.documentCache.clear();
    for (const textEditor of this.editorCache.keys()) {
      this.editorCache.get(textEditor)?.setDirty();
    }
  };



  // New methods for performance monitoring
  static getCacheMetrics() {
    return this.advancedCache.getMetrics();
  }

  static getCacheHitRatio() {
    return this.advancedCache.getHitRatio();
  }
}

// ============================================================================
// BRACKET PARSING
// ============================================================================

export class BracketParser {
  static parseBrackets(document: vscode.TextDocument): BracketEntry[] {
    const result: BracketEntry[] = [];
    const languageConfiguration = BracketLynxConfig.languageConfiguration;
    const regulate = languageConfiguration.ignoreCase
      ? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
      : (text: string) => text.replace(/\s+/, ' ');

    // Extract language configuration
    const {
      openingBlockComments,
      closingBlockComments,
      lineComments,
      openingSymbolBrackets,
      symbolBracketInters,
      closingSymbolBrackets,
      symbolBracketsHeader,
      openingWordBrackets,
      wordBracketInters,
      closingWordBrackets,
      wordBracketsHeader,
      openingInlineStrings,
      escapeInlineStrings,
      closingInlineStrings,
      openingMultilineStrings,
      escapeMultilineStrings,
      closingMultilineStrings,
      ignoreSymbols,
    } = this.extractLanguageTokens(languageConfiguration, regulate);

    // Create regex pattern
    const pattern = this.createTokenPattern([
      ...ignoreSymbols,
      ...openingBlockComments,
      ...closingBlockComments,
      ...lineComments,
      ...openingSymbolBrackets,
      ...symbolBracketInters,
      ...closingSymbolBrackets,
      ...openingWordBrackets,
      ...wordBracketInters,
      ...closingWordBrackets,
      ...openingInlineStrings,
      ...escapeInlineStrings,
      ...closingInlineStrings,
      ...openingMultilineStrings,
      ...escapeMultilineStrings,
      ...closingMultilineStrings,
    ]);

    // Tokenize document
    const text = document.getText();
    const tokens = this.tokenizeDocument(
      text,
      pattern,
      languageConfiguration.ignoreCase
    );

    // Parse tokens
    return this.parseTokens(
      document,
      tokens,
      regulate,
      {
        openingBlockComments,
        closingBlockComments,
        lineComments,
        openingSymbolBrackets,
        closingSymbolBrackets,
        symbolBracketsHeader,
        openingWordBrackets,
        closingWordBrackets,
        wordBracketsHeader,
        openingInlineStrings,
        closingInlineStrings,
        openingMultilineStrings,
        closingMultilineStrings,
      },
      result
    );
  }

  private static extractLanguageTokens(
    languageConfiguration: LanguageConfiguration,
    regulate: (text: string) => string
  ) {
    return {
      openingBlockComments:
        languageConfiguration.comments?.block?.map((i) =>
          regulate(i.opening)
        ) ?? [],
      closingBlockComments:
        languageConfiguration.comments?.block?.map((i) =>
          regulate(i.closing)
        ) ?? [],
      lineComments: languageConfiguration.comments?.line?.map(regulate) ?? [],
      openingSymbolBrackets:
        languageConfiguration.brackets?.symbol?.map((i) =>
          regulate(i.opening)
        ) ?? [],
      symbolBracketInters:
        languageConfiguration.brackets?.symbol
          ?.map((i) => i.inters?.map(regulate) ?? [])
          ?.reduce((a, b) => a.concat(b), []) ?? [],
      closingSymbolBrackets:
        languageConfiguration.brackets?.symbol?.map((i) =>
          regulate(i.closing)
        ) ?? [],
      symbolBracketsHeader:
        languageConfiguration.brackets?.symbol?.map(
          (i) => i.headerMode ?? 'smart'
        ) ?? [],
      openingWordBrackets:
        languageConfiguration.brackets?.word?.map((i) => regulate(i.opening)) ??
        [],
      wordBracketInters:
        languageConfiguration.brackets?.word
          ?.map((i) => i.inters?.map(regulate) ?? [])
          ?.reduce((a, b) => a.concat(b), []) ?? [],
      closingWordBrackets:
        languageConfiguration.brackets?.word?.map((i) => regulate(i.closing)) ??
        [],
      wordBracketsHeader:
        languageConfiguration.brackets?.word?.map(
          (i) => i.headerMode ?? 'inner'
        ) ?? [],
      openingInlineStrings:
        languageConfiguration.strings?.inline?.map((i) =>
          regulate(i.opening)
        ) ?? [],
      escapeInlineStrings:
        languageConfiguration.strings?.inline
          ?.map((i) => i.escape.map(regulate))
          ?.reduce((a, b) => a.concat(b), []) ?? [],
      closingInlineStrings:
        languageConfiguration.strings?.inline?.map((i) =>
          regulate(i.closing)
        ) ?? [],
      openingMultilineStrings:
        languageConfiguration.strings?.multiline?.map((i) =>
          regulate(i.opening)
        ) ?? [],
      escapeMultilineStrings:
        languageConfiguration.strings?.multiline
          ?.map((i) => i.escape.map(regulate))
          ?.reduce((a, b) => a.concat(b), []) ?? [],
      closingMultilineStrings:
        languageConfiguration.strings?.multiline?.map((i) =>
          regulate(i.closing)
        ) ?? [],
      ignoreSymbols:
        languageConfiguration.ignoreSymbols?.map((i) => regulate(i)) ?? [],
    };
  }

  private static createTokenPattern(tokens: string[]): string {
    return tokens
      .filter(
        (entry, index, array) => '' !== entry && index === array.indexOf(entry)
      )
      .map((i) => `${makeRegExpPart(i)}`)
      .join('|');
  }

  private static tokenizeDocument(
    text: string,
    pattern: string,
    ignoreCase: boolean
  ) {
    return regExpExecToArray(
      new RegExp(pattern, ignoreCase ? 'gui' : 'gu'),
      text
    ).map((match) => ({
      index: match.index,
      token: match[0],
    }));
  }

  private static parseTokens(
    document: vscode.TextDocument,
    tokens: { index: number; token: string }[],
    regulate: (text: string) => string,
    tokenConfig: any,
    result: BracketEntry[]
  ): BracketEntry[] {
    const getCharacter = (index: number) =>
      index < 0
        ? ''
        : document.getText(
            new vscode.Range(
              document.positionAt(index),
              document.positionAt(index + 1)
            )
          );

    const isIncludeWord = (text: string) =>
      text.replace(/\w/, '').length < text.length;
    const isSureMatchWord = (match: { index: number; token: string }) =>
      !isIncludeWord(getCharacter(match.index - 1)) &&
      !isIncludeWord(getCharacter(match.index + match.token.length));

    let scopeStack: {
      start: TokenEntry;
      closing: string;
      headerMode: HeaderMode;
      items: BracketEntry[];
    }[] = [];
    let i = 0;

    const writeCore = (entry: BracketEntry) => {
      if (!isInlineScope(entry) || entry.isUnmatchBrackets) {
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
            position: document.positionAt(
              closingToken.index + closingToken.token.length
            ),
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
            position: document.positionAt(
              closingToken.index + closingToken.token.length
            ),
            token: closingToken.token,
          },
          headerMode: 'smart',
          isUnmatchBrackets: true,
          items: [],
        });
      }
    };

    // Process tokens
    while (i < tokens.length) {
      const token = regulate(tokens[i].token);

      if (this.processBlockComment(i, tokens, token, tokenConfig, regulate)) {
        i = this.skipBlockComment(i, tokens, token, tokenConfig, regulate);
      } else if (
        this.processLineComment(i, tokens, token, tokenConfig, document)
      ) {
        i = this.skipLineComment(i, tokens, document);
      } else if (
        this.processOpeningSymbolBracket(
          i,
          tokens,
          token,
          tokenConfig,
          scopeStack,
          document
        )
      ) {
        i++;
      } else if (
        this.processOpeningWordBracket(
          i,
          tokens,
          token,
          tokenConfig,
          scopeStack,
          document,
          isSureMatchWord
        )
      ) {
        i++;
      } else if (
        this.processClosingBracket(
          i,
          tokens,
          token,
          tokenConfig,
          isSureMatchWord,
          write
        )
      ) {
        i++;
      } else if (
        this.processInlineString(
          i,
          tokens,
          token,
          tokenConfig,
          document,
          regulate
        )
      ) {
        i = this.skipInlineString(
          i,
          tokens,
          token,
          tokenConfig,
          document,
          regulate
        );
      } else if (
        this.processMultilineString(i, tokens, token, tokenConfig, regulate)
      ) {
        i = this.skipMultilineString(i, tokens, token, tokenConfig, regulate);
      } else {
        debug(`unmatch-token: ${JSON.stringify(tokens[i])}`);
        i++;
      }
    }

    // Process remaining scopes
    while (0 < scopeStack.length) {
      write({ index: document.getText().length, token: '' });
    }

    return result;
  }

  // Token processing helper methods
  private static processBlockComment(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    regulate: Function
  ): boolean {
    return 0 <= tokenConfig.openingBlockComments.indexOf(token);
  }

  private static skipBlockComment(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    regulate: Function
  ): number {
    const closing =
      tokenConfig.closingBlockComments[
        tokenConfig.openingBlockComments.indexOf(token)
      ];
    while (++i < tokens.length) {
      if (closing === regulate(tokens[i].token)) {
        ++i;
        break;
      }
    }
    return i;
  }

  private static processLineComment(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    document: vscode.TextDocument
  ): boolean {
    return 0 <= tokenConfig.lineComments.indexOf(token);
  }

  private static skipLineComment(
    i: number,
    tokens: any[],
    document: vscode.TextDocument
  ): number {
    const line = document.positionAt(tokens[i].index).line;
    while (++i < tokens.length) {
      if (line !== document.positionAt(tokens[i].index).line) {
        break;
      }
    }
    return i;
  }

  private static processOpeningSymbolBracket(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    scopeStack: any[],
    document: vscode.TextDocument
  ): boolean {
    if (0 <= tokenConfig.openingSymbolBrackets.indexOf(token)) {
      const index = tokenConfig.openingSymbolBrackets.indexOf(token);
      scopeStack.push({
        start: {
          position: document.positionAt(tokens[i].index),
          token: tokens[i].token,
        },
        closing: tokenConfig.closingSymbolBrackets[index],
        headerMode: tokenConfig.symbolBracketsHeader[index],
        items: [],
      });
      return true;
    }
    return false;
  }

  private static processOpeningWordBracket(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    scopeStack: any[],
    document: vscode.TextDocument,
    isSureMatchWord: Function
  ): boolean {
    if (
      0 <= tokenConfig.openingWordBrackets.indexOf(token) &&
      isSureMatchWord(tokens[i])
    ) {
      const index = tokenConfig.openingWordBrackets.indexOf(token);
      scopeStack.push({
        start: {
          position: document.positionAt(tokens[i].index),
          token: tokens[i].token,
        },
        closing: tokenConfig.closingWordBrackets[index],
        headerMode: tokenConfig.wordBracketsHeader[index],
        items: [],
      });
      return true;
    }
    return false;
  }

  private static processClosingBracket(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    isSureMatchWord: Function,
    write: Function
  ): boolean {
    if (
      0 <= tokenConfig.closingSymbolBrackets.indexOf(token) ||
      (0 <= tokenConfig.closingWordBrackets.indexOf(token) &&
        isSureMatchWord(tokens[i]))
    ) {
      write(tokens[i]);
      return true;
    }
    return false;
  }

  private static processInlineString(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    document: vscode.TextDocument,
    regulate: Function
  ): boolean {
    return 0 <= tokenConfig.openingInlineStrings.indexOf(token);
  }

  private static skipInlineString(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    document: vscode.TextDocument,
    regulate: Function
  ): number {
    const line = document.positionAt(tokens[i].index).line;
    const closing =
      tokenConfig.closingInlineStrings[
        tokenConfig.openingInlineStrings.indexOf(token)
      ];
    while (++i < tokens.length) {
      if (line !== document.positionAt(tokens[i].index).line) {
        break;
      }
      if (closing === regulate(tokens[i].token)) {
        ++i;
        break;
      }
    }
    return i;
  }

  private static processMultilineString(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    regulate: Function
  ): boolean {
    return 0 <= tokenConfig.openingMultilineStrings.indexOf(token);
  }

  private static skipMultilineString(
    i: number,
    tokens: any[],
    token: string,
    tokenConfig: any,
    regulate: Function
  ): number {
    const closing =
      tokenConfig.closingMultilineStrings[
        tokenConfig.openingMultilineStrings.indexOf(token)
      ];
    while (++i < tokens.length) {
      if (closing === regulate(tokens[i].token)) {
        ++i;
        break;
      }
    }
    return i;
  }
}

// ============================================================================
// BRACKET HEADER GENERATION
// ============================================================================

export class BracketHeaderGenerator {
  // NEW: Create language formatter instance
  private static languageFormatter = new LanguageFormatter();

  /**
   * Get the first meaningful word (skip common prefixes/symbols)
   */
  private static getFirstMeaningfulWord(words: string[]): string {
    const skipWords = [
      'export',
      'const',
      'function',
      'async',
      'default',
      'let',
      'var',
    ];

    for (const word of words) {
      const cleanWord = word.toLowerCase().trim();
      if (cleanWord && !skipWords.includes(cleanWord)) {
        return word;
      }
    }

    // If no meaningful word found, return the first word
    return words[0] || '';
  }

  static getBracketHeader(
    document: vscode.TextDocument,
    context: BracketContext
  ): string {
    const maxBracketHeaderLength = BracketLynxConfig.maxBracketHeaderLength;
    const regulateHeader = (text: string) => {
      let result = text.replace(/\s+/gu, ' ').trim();

      // FIRST: Check for arrow functions using unified logic
      const arrowResult = formatArrowFunction(result);
      if (arrowResult) {
        return arrowResult;
      }

      // NEW: Apply rules filtering to remove excluded symbols
      result = filterContent(result);

      // NEW: Apply language-specific formatting before length truncation
      result = this.languageFormatter.formatContext(
        result,
        document.languageId
      );

      // NEW: Apply word limit using rules system
      result = applyWordLimit(result, document.languageId);

      // Apply length truncation if still too long after word limit
      if (maxBracketHeaderLength < result.length) {
        return result.substring(0, maxBracketHeaderLength - 3) + '...';
      }
      return result;
    };

    const isValidHeader = (text: string) =>
      0 < text.replace(/,/gmu, '').trim().length;

    if ('inner' !== context.entry.headerMode) {
      const header = this.getBeforeHeader(
        document,
        context,
        regulateHeader,
        isValidHeader
      );
      if (header) {
        return header;
      }
    }

    if ('before' !== context.entry.headerMode) {
      const header = this.getInnerHeader(
        document,
        context,
        regulateHeader,
        isValidHeader
      );
      if (header) {
        return header;
      }
    }

    return '';
  }

  private static getBeforeHeader(
    document: vscode.TextDocument,
    context: BracketContext,
    regulateHeader: (text: string) => string,
    isValidHeader: (text: string) => boolean
  ): string | null {
    const languageConfiguration = BracketLynxConfig.languageConfiguration;
    const terminators = languageConfiguration.terminators ?? [];
    const topLimit =
      context.previousEntry?.end.position ??
      (undefined !== context.parentEntry
        ? PositionUtils.nextCharacter(
            context.parentEntry.start.position,
            context.parentEntry.start.token.length
          )
        : new vscode.Position(0, 0));

    const lineHead = PositionUtils.max([
      topLimit,
      PositionUtils.nextLine(context.entry.start.position, 0),
    ]);

    const currentLineHeader = regulateHeader(
      document.getText(new vscode.Range(lineHead, context.entry.start.position))
    );
    if (
      isValidHeader(currentLineHeader) &&
      !terminators.some((i) => currentLineHeader.endsWith(i))
    ) {
      return currentLineHeader;
    }

    if (topLimit.line < context.entry.start.position.line) {
      const previousLineHead = PositionUtils.max([
        topLimit,
        PositionUtils.nextLine(context.entry.start.position, -1),
      ]);
      const previousLineHeader = regulateHeader(
        document.getText(new vscode.Range(previousLineHead, lineHead))
      );
      if (
        isValidHeader(previousLineHeader) &&
        !terminators.some((i) => previousLineHeader.endsWith(i))
      ) {
        return previousLineHeader;
      }
    }

    return null;
  }

  private static getInnerHeader(
    document: vscode.TextDocument,
    context: BracketContext,
    regulateHeader: (text: string) => string,
    isValidHeader: (text: string) => boolean
  ): string | null {
    const currentLineInnerHeader = regulateHeader(
      document.getText(
        new vscode.Range(
          context.entry.start.position,
          PositionUtils.nextLine(context.entry.start.position, +1)
        )
      )
    );
    if (
      isValidHeader(currentLineInnerHeader) &&
      currentLineInnerHeader !== regulateHeader(context.entry.start.token)
    ) {
      return currentLineInnerHeader;
    }

    const innerHeader = regulateHeader(
      document.getText(
        new vscode.Range(
          context.entry.start.position,
          PositionUtils.min([
            PositionUtils.nextLine(context.entry.start.position, +16),
            context.entry.end.position,
          ])
        )
      )
    );
    if (isValidHeader(innerHeader)) {
      return innerHeader;
    }

    return null;
  }
}

// ============================================================================
// DECORATION GENERATION
// ============================================================================

export class BracketDecorationGenerator {
  static getBracketDecorationSource(
    document: vscode.TextDocument,
    brackets: BracketEntry[]
  ): BracketDecorationSource[] {
    const prefix = BracketLynxConfig.prefix;
    const unmatchBracketsPrefix = BracketLynxConfig.unmatchBracketsPrefix;
    const minBracketScopeLines = BracketLynxConfig.minBracketScopeLines;
    const maxDecorationsPerFile = BracketLynxConfig.maxDecorationsPerFile;
    const result: BracketDecorationSource[] = [];

    const getLineNumbers = (entry: BracketEntry): string => {
      const startLine = entry.start.position.line + 1;
      const endLine = entry.end.position.line + 1;
      return `#${startLine}-${endLine} `;
    };

    const scanner = (context: BracketContext) => {
      const lineSpan =
        context.entry.end.position.line - context.entry.start.position.line + 1;
      const meetsMinLines = minBracketScopeLines <= lineSpan;

      // Check if it's a control flow block (exception to minimum lines rule)
      let isControlFlowException = false;
      if (!meetsMinLines) {
        const startLine = context.entry.start.position.line;
        const endLine = context.entry.end.position.line;
        const content = document.getText(
          new vscode.Range(startLine, 0, endLine + 1, 0)
        );
        isControlFlowException = containsControlFlowKeyword(content);
      }

      if (meetsMinLines || isControlFlowException) {
        if (
          // Skip if next block starts on same line as closing
          context.entry.end.position.line <
            (context.nextEntry?.start.position.line ??
              document.lineCount + 1) &&
          // Prioritize parent if closing on same line
          context.entry.end.position.line <
            (context.parentEntry?.end.position.line ?? document.lineCount + 1)
        ) {
          const bracketHeader = BracketHeaderGenerator.getBracketHeader(
            document,
            context
          );
          if (0 < bracketHeader.length) {
            const lineNumbers = getLineNumbers(context.entry);
            const decorationText = `${
              context.entry.isUnmatchBrackets ? unmatchBracketsPrefix : prefix
            }${lineNumbers}•${bracketHeader}`;

            result.push({
              range: new vscode.Range(
                PositionUtils.nextCharacter(
                  context.entry.end.position,
                  -context.entry.end.token.length
                ),
                context.entry.end.position
              ),
              bracketHeader: decorationText,
            });
          }
        }
        context.entry.items.map((entry, index, array) =>
          scanner({
            parentEntry: context.entry,
            previousEntry: array[index - 1],
            entry,
            nextEntry: array[index + 1],
          })
        );
      }
    };

    brackets.map((entry, index, array) =>
      scanner({
        parentEntry: undefined,
        previousEntry: array[index - 1],
        entry,
        nextEntry: array[index + 1],
      })
    );

    // Apply final decoration limit if performance filters are enabled
    if (
      BracketLynxConfig.enablePerformanceFilters &&
      result.length > maxDecorationsPerFile
    ) {
      if (BracketLynxConfig.debug) {
        console.log(
          `Bracket Lynx: Limiting decorations from ${result.length} to ${maxDecorationsPerFile}`
        );
      }

      // Prioritize unmatched brackets and larger brackets
      const prioritized = result.sort((a, b) => {
        // Extract line numbers from bracket headers
        const aMatch = a.bracketHeader.match(/#(\d+)-(\d+)/);
        const bMatch = b.bracketHeader.match(/#(\d+)-(\d+)/);

        if (aMatch && bMatch) {
          const aSpan = parseInt(bMatch[2]) - parseInt(bMatch[1]);
          const bSpan = parseInt(bMatch[2]) - parseInt(bMatch[1]);

          // Prioritize unmatched brackets
          const aIsUnmatched = a.bracketHeader.includes('❌');
          const bIsUnmatched = b.bracketHeader.includes('❌');

          if (aIsUnmatched && !bIsUnmatched) {
            return -1;
          }
          if (!aIsUnmatched && bIsUnmatched) {
            return 1;
          }

          // Then by size
          return bSpan - aSpan;
        }

        return 0;
      });

      return prioritized.slice(0, maxDecorationsPerFile);
    }

    return result;
  }
}

// ============================================================================
// MAIN BRACKET LYNX CLASS
// ============================================================================

export class BracketLynx {
  private static isMutedAll: boolean = false;
  private static lastUpdateStamp = new Map<vscode.TextEditor, number>();
  private static smartDebouncer = new SmartDebouncer();

  static updateDecoration(textEditor: vscode.TextEditor) {
    // Check if extension is enabled globally and for this specific editor
    if (!isExtensionEnabled() || !isEditorEnabled(textEditor)) {
      const editorCache = CacheManager.editorCache.get(textEditor);
      editorCache?.dispose();
      CacheManager.editorCache.delete(textEditor);
      return;
    }

    // NEW: Check if language is supported by rules
    if (
      !shouldProcessFileConfig(
        textEditor.document.languageId,
        textEditor.document.fileName
      )
    ) {
      const editorCache = CacheManager.editorCache.get(textEditor);
      editorCache?.dispose();
      CacheManager.editorCache.delete(textEditor);
      return;
    }

    const editorCache = CacheManager.editorCache.get(textEditor);
    if ('none' !== BracketLynxConfig.mode) {
      const isMuted =
        undefined !== editorCache?.isMuted
          ? editorCache.isMuted
          : this.isMutedAll;

      if (isMuted) {
        editorCache?.dispose();
        editorCache?.setDirty();
      } else if (undefined === editorCache || editorCache.isDirty()) {
        const bracketHeaderInformationDecoration =
          vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
          });

        const options: vscode.DecorationOptions[] = [];
        const color = BracketLynxConfig.color;

        CacheManager.getDocumentCache(
          textEditor.document
        ).decorationSource.forEach((i) => {
          // NEW: Apply content filtering to remove excluded symbols
          const filteredContent = filterContent(i.bracketHeader);

          // Only add decoration if content is not empty after filtering
          if (filteredContent.trim().length > 0) {
            options.push({
              range: i.range,
              renderOptions: {
                after: {
                  contentText: filteredContent,
                  color,
                },
              },
            });
          }
        });

        CacheManager.getEditorCache(
          textEditor
        ).setBracketHeaderInformationDecoration(
          bracketHeaderInformationDecoration
        );

        textEditor.setDecorations(bracketHeaderInformationDecoration, options);
      }
    } else {
      editorCache?.dispose();
      CacheManager.editorCache.delete(textEditor);
    }
  }

  static delayUpdateDecoration(textEditor: vscode.TextEditor): void {
    // Check if extension is enabled for this editor before processing
    if (!isExtensionEnabled() || !isEditorEnabled(textEditor)) {
      return;
    }

    if (undefined !== textEditor.viewColumn) {
      const editorKey = textEditor.document.uri.toString();
      const isActiveEditor = vscode.window.activeTextEditor === textEditor;

      // Use smart debouncer for better performance
      this.smartDebouncer.debounce(
        editorKey,
        () => {
          this.updateDecoration(textEditor);
        },
        textEditor.document,
        isActiveEditor
      );
    }
  }

  // ============================================================================
  // METHODS FOR TOGGLE SYSTEM INTEGRATION
  // ============================================================================

  static forceUpdate(textEditor: vscode.TextEditor): void {
    // Clear cache and force update
    CacheManager.clearAllDecorationCache();
    this.updateDecoration(textEditor);
  }

  static clearDecorations(textEditor: vscode.TextEditor): void {
    const editorCache = CacheManager.editorCache.get(textEditor);
    editorCache?.dispose();
    CacheManager.editorCache.delete(textEditor);
  }

  static toggleMute(textEditor: vscode.TextEditor): void {
    const currentEditorDecorationCache =
      CacheManager.getEditorCache(textEditor);
    currentEditorDecorationCache.isMuted =
      undefined === currentEditorDecorationCache.isMuted
        ? !this.isMutedAll
        : !currentEditorDecorationCache.isMuted;
    this.updateDecoration(textEditor);
  }

  static toggleMuteAll(): void {
    this.isMutedAll = !this.isMutedAll;
    CacheManager.editorCache.forEach((i) => (i.isMuted = undefined));
    this.updateAllDecoration();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private static getDocumentTextLength(document: vscode.TextDocument): number {
    return document.offsetAt(document.lineAt(document.lineCount - 1).range.end);
  }

  static updateDecorationByDocument(document: vscode.TextDocument): void {
    // Check if extension is enabled for this document
    if (!isExtensionEnabled() || !isDocumentEnabled(document)) {
      return;
    }

    // NEW: Check if language is supported by rules
    if (!shouldProcessFileConfig(document.languageId, document.fileName)) {
      return;
    }

    vscode.window.visibleTextEditors
      .filter((i) => i.document === document)
      .forEach((i) => this.updateDecoration(i));
  }

  static delayUpdateDecorationByDocument(document: vscode.TextDocument): void {
    // Check if extension is enabled for this document
    if (!isExtensionEnabled() || !isDocumentEnabled(document)) {
      return;
    }

    // NEW: Check if language is supported by rules
    if (!shouldProcessFileConfig(document.languageId, document.fileName)) {
      return;
    }

    vscode.window.visibleTextEditors
      .filter((i) => i.document === document)
      .forEach((i) => this.delayUpdateDecoration(i));
  }

  static updateAllDecoration(): void {
    if (!isExtensionEnabled()) {
      return;
    }

    vscode.window.visibleTextEditors
      .filter((editor) => isEditorEnabled(editor))
      .forEach((i) => this.updateDecoration(i));
  }

  static onDidChangeConfiguration(): void {
    // Sync color system with configuration changes
    try {
      onConfigurationChanged().catch((error: any) => {
        console.error('Error syncing color configuration:', error);
      });
    } catch (error) {
      console.warn('Color system not available during configuration change');
    }

    CacheManager.clearAllDecorationCache();
    this.updateAllDecoration();

    // Log cache metrics if debug is enabled
    if (BracketLynxConfig.debug) {
      const metrics = CacheManager.getCacheMetrics();
      const hitRatio = CacheManager.getCacheHitRatio();
      console.log(`Bracket Lynx Cache Metrics:`, {
        hitRatio: `${(hitRatio * 100).toFixed(1)}%`,
        ...metrics,
      });
    }
  }

  static onDidChangeActiveTextEditor(): void {
    CacheManager.clearAllDecorationCache();
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isExtensionEnabled() && isEditorEnabled(activeEditor)) {
      this.delayUpdateDecoration(activeEditor);
    }
  }

  static onDidOpenTextDocument(document: vscode.TextDocument): void {
    const mode = BracketLynxConfig.mode;
    if (
      isExtensionEnabled() &&
      isDocumentEnabled(document) &&
      shouldProcessFileConfig(document.languageId, document.fileName) &&
      ('auto' === mode || 'on-save' === mode)
    ) {
      this.delayUpdateDecorationByDocument(document);
    }
  }

  static onDidSaveTextDocument(document: vscode.TextDocument): void {
    if (
      isExtensionEnabled() &&
      isDocumentEnabled(document) &&
      shouldProcessFileConfig(document.languageId, document.fileName) &&
      'on-save' === BracketLynxConfig.mode
    ) {
      this.updateDecorationByDocument(document);
    }
  }

  static onDidChangeTextDocument(
    document: vscode.TextDocument,
    changes?: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    // Check if extension is enabled for this document
    if (!isExtensionEnabled() || !isDocumentEnabled(document)) {
      return;
    }

    // NEW: Check if language is supported by rules
    if (!shouldProcessFileConfig(document.languageId, document.fileName)) {
      return;
    }

    // RESTORE: Try incremental parsing, but only for non-Astro files
    if (changes && changes.length > 0) {
      this.handleIncrementalChanges(document, changes);
    } else {
      CacheManager.clearAllDecorationCache();
    }

    if ('auto' === BracketLynxConfig.mode) {
      this.delayUpdateDecorationByDocument(document);
    }
  }

  /**
   * Handle incremental document changes
   */
  private static handleIncrementalChanges(
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    try {
      // Use parser exception manager
      const optimizedParser = OptimizedBracketParser.getInstance();
      if (optimizedParser.shouldUseOriginalParser(document)) {
        if (BracketLynxConfig.debug) {
          console.log(
            `Bracket Lynx: Skipping incremental parsing for: ${document.fileName}`
          );
        }
        CacheManager.clearAllDecorationCache();
        return;
      }

      // Use incremental parsing for other files
      const existingCache = CacheManager.documentCache.get(document);

      if (existingCache && existingCache.brackets) {
        // Try incremental parsing
        const incrementalResult = optimizedParser.parseIncremental(
          document,
          changes,
          existingCache.brackets
        );

        // Update cache with incremental results
        existingCache.brackets = incrementalResult.brackets;
        existingCache.decorationSource =
          BracketDecorationGenerator.getBracketDecorationSource(
            document,
            incrementalResult.brackets
          );

        if (BracketLynxConfig.debug) {
          console.log(
            `Bracket Lynx: Incremental update completed in ${incrementalResult.parseTime}ms`
          );
        }

        return;
      }
    } catch (error) {
      console.error(
        'Bracket Lynx: Error in incremental parsing, falling back to full cache clear:',
        error
      );
    }

    // Fallback to full cache clear
    CacheManager.clearAllDecorationCache();
  }

  /**
   * Get performance metrics for debugging
   */
  static getPerformanceMetrics() {
    // RESTORE: OptimizedBracketParser references
    const optimizedParser = OptimizedBracketParser.getInstance();
    const advancedCache = AdvancedCacheManager.getInstance();

    return {
      cache: CacheManager.getCacheMetrics(),
      hitRatio: CacheManager.getCacheHitRatio(),

      // RESTORE: Parser metrics
      parser: {
        ...optimizedParser.getCacheStats(),

      },
      performanceFilters: optimizedParser.getPerformanceStats(),
      config: {
        enablePerformanceFilters: BracketLynxConfig.enablePerformanceFilters,
        maxFileSize: `${Math.round(
          BracketLynxConfig.maxFileSize / 1024 / 1024
        )}MB`,
        maxDecorationsPerFile: BracketLynxConfig.maxDecorationsPerFile,
        minBracketScopeLines: BracketLynxConfig.minBracketScopeLines,
      },
    };
  }



  // ============================================================================
  // METHODS FOR TOGGLE SYSTEM INTEGRATION
  // ============================================================================

  /**
   * Clear all decorations from all visible editors
   */
  static clearAllDecorations(): void {
    vscode.window.visibleTextEditors.forEach((editor) => {
      const editorCache = CacheManager.editorCache.get(editor);
      editorCache?.dispose();
      CacheManager.editorCache.delete(editor);
    });
  }

  /**
   * Clear decorations for a specific editor (used by toggle system)
   */
  static clearEditorDecorations(textEditor: vscode.TextEditor): void {
    const editorCache = CacheManager.editorCache.get(textEditor);
    editorCache?.dispose();
    CacheManager.editorCache.delete(textEditor);
  }

  /**
   * Force refresh color for all decorations - called by color system
   */
  static forceColorRefresh(): void {
    if (!isExtensionEnabled()) {
      return;
    }

    // Clear all existing decorations first
    this.clearAllDecorations();
    
    // Clear all decoration caches to force recreation with new color
    CacheManager.clearAllDecorationCache();
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      // Update all visible editors immediately
      vscode.window.visibleTextEditors
        .filter((editor) => isEditorEnabled(editor))
        .forEach((editor) => {
          // Force immediate update without debouncing for color changes
          this.updateDecoration(editor);
        });
    }, 50);
  }



  /**
   * Dispose and cleanup all resources
   */
  static dispose(): void {
    this.smartDebouncer.dispose();

    // RESTORE: Cleanup optimized parser
    const optimizedParser = OptimizedBracketParser.getInstance();
    optimizedParser.dispose();

    // Advanced cache cleanup is handled automatically
  }


}
