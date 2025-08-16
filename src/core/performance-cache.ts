import * as vscode from 'vscode';
import {
  DocumentDecorationCacheEntry,
  EditorDecorationCacheEntry,
  BracketEntry,
  BracketDecorationSource,
} from '../lens/lens';
import { CACHE_CONFIG } from './utils';

// ============================================================================
// PERFORMANCE CACHE INTERFACES
// ============================================================================

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  lastCleanup: number;
}

export interface AdvancedDocumentCacheEntry
  extends DocumentDecorationCacheEntry {
  textHash: string;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  fileSize: number;
}

export interface AdvancedEditorCacheEntry extends EditorDecorationCacheEntry {
  timestamp: number;
  lastAccessed: number;
}

export interface CacheConfig {
  maxDocumentCacheSize: number;
  maxEditorCacheSize: number;
  documentCacheTTL: number; // milliseconds
  editorCacheTTL: number; // milliseconds
  cleanupInterval: number; // milliseconds
  enableMetrics: boolean;
}

// ============================================================================
// ADVANCED CACHE MANAGER
// ============================================================================

export class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;

  // Cache storage
  private documentCache = new Map<string, AdvancedDocumentCacheEntry>();
  private editorCache = new Map<vscode.TextEditor, AdvancedEditorCacheEntry>();

  // Performance metrics
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    lastCleanup: Date.now(),
  };

  // Configuration
  private config: CacheConfig = {
    maxDocumentCacheSize: CACHE_CONFIG.MAX_DOCUMENT_CACHE_SIZE,
    maxEditorCacheSize: CACHE_CONFIG.MAX_EDITOR_CACHE_SIZE,
    documentCacheTTL: CACHE_CONFIG.DOCUMENT_CACHE_TTL,
    editorCacheTTL: CACHE_CONFIG.EDITOR_CACHE_TTL,
    cleanupInterval: CACHE_CONFIG.CLEANUP_INTERVAL,
    enableMetrics: true,
  };

  // Cleanup timer
  private cleanupTimer?: NodeJS.Timeout;



  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager();
    }
    return AdvancedCacheManager.instance;
  }

  // ============================================================================
  // DOCUMENT CACHE METHODS
  // ============================================================================

  /**
   * Generate a hash for document content to detect changes
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
   * Get document cache entry with LRU and TTL logic
   */
  getDocumentCache(
    document: vscode.TextDocument
  ): AdvancedDocumentCacheEntry | null {
    const uri = document.uri.toString();
    const text = document.getText();
    const textHash = this.generateTextHash(text);
    const now = Date.now();

    const cached = this.documentCache.get(uri);

    if (!cached) {
      this.metrics.misses++;
      return null;
    }

    // Check TTL
    if (now - cached.timestamp > this.config.documentCacheTTL) {
      this.documentCache.delete(uri);
      this.metrics.misses++;
      return null;
    }

    // Check content hash
    if (cached.textHash !== textHash) {
      this.documentCache.delete(uri);
      this.metrics.misses++;
      return null;
    }

    // Update LRU data
    cached.lastAccessed = now;
    cached.accessCount++;

    // Move to end for LRU (delete and re-add)
    this.documentCache.delete(uri);
    this.documentCache.set(uri, cached);

    this.metrics.hits++;
    return cached;
  }

  /**
   * Set document cache entry with LRU eviction
   */
  setDocumentCache(
    document: vscode.TextDocument,
    brackets: BracketEntry[],
    decorationSource: BracketDecorationSource[]
  ): AdvancedDocumentCacheEntry {
    const uri = document.uri.toString();
    const text = document.getText();
    const textHash = this.generateTextHash(text);
    const now = Date.now();

    // Enforce cache size limit with LRU eviction
    if (this.documentCache.size >= this.config.maxDocumentCacheSize) {
      const oldestEntry = this.documentCache.keys().next().value;
      if (oldestEntry) {
        this.documentCache.delete(oldestEntry);
        this.metrics.evictions++;
      }
    }

    const entry: AdvancedDocumentCacheEntry = {
      brackets,
      decorationSource,
      textHash,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      fileSize: text.length,
    };

    this.documentCache.set(uri, entry);
    this.updateMetrics();

    return entry;
  }

  // ============================================================================
  // EDITOR CACHE METHODS
  // ============================================================================

  /**
   * Get editor cache entry with TTL logic
   */
  getEditorCache(editor: vscode.TextEditor): AdvancedEditorCacheEntry | null {
    const cached = this.editorCache.get(editor);
    const now = Date.now();

    if (!cached) {
      return null;
    }

    // Check TTL
    if (now - cached.timestamp > this.config.editorCacheTTL) {
      cached.dispose();
      this.editorCache.delete(editor);
      return null;
    }

    // Update access time
    cached.lastAccessed = now;

    return cached;
  }

  /**
   * Set editor cache entry
   */
  setEditorCache(editor: vscode.TextEditor): AdvancedEditorCacheEntry {
    const now = Date.now();

    // Enforce cache size limit
    if (this.editorCache.size >= this.config.maxEditorCacheSize) {
      // Find oldest entry
      let oldestEditor: vscode.TextEditor | null = null;
      let oldestTime = now;

      for (const [editorKey, entry] of this.editorCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestEditor = editorKey;
        }
      }

      if (oldestEditor) {
        const oldEntry = this.editorCache.get(oldestEditor);
        oldEntry?.dispose();
        this.editorCache.delete(oldestEditor);
        this.metrics.evictions++;
      }
    }

    const entry: AdvancedEditorCacheEntry = Object.assign(
      new EditorDecorationCacheEntry(editor),
      {
        timestamp: now,
        lastAccessed: now,
      }
    );

    this.editorCache.set(editor, entry);
    return entry;
  }

  // ============================================================================
  // CACHE MANAGEMENT METHODS
  // ============================================================================

  /**
   * Clear cache for specific document
   */
  clearDocumentCache(document?: vscode.TextDocument): void {
    if (document) {
      const uri = document.uri.toString();
      this.documentCache.delete(uri);

      // Mark related editors as dirty
      for (const [editor, editorEntry] of this.editorCache) {
        if (editor.document === document) {
          editorEntry.setDirty();
        }
      }
    }

    // Clean up invisible editors
    for (const [editor, editorEntry] of this.editorCache) {
      if (vscode.window.visibleTextEditors.indexOf(editor) < 0) {
        editorEntry.dispose();
        this.editorCache.delete(editor);
      }
    }

    this.updateMetrics();
  }

  /**
   * Clear all caches
   */
  clearAllCache(): void {
    this.documentCache.clear();

    for (const [editor, editorEntry] of this.editorCache) {
      editorEntry.setDirty();
    }

    this.updateMetrics();
  }

  /**
   * Automatic cleanup based on TTL and LRU
   */
  private performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean expired document cache entries
    for (const [uri, entry] of this.documentCache) {
      if (now - entry.timestamp > this.config.documentCacheTTL) {
        this.documentCache.delete(uri);
        cleanedCount++;
      }
    }

    // Clean expired editor cache entries
    for (const [editor, entry] of this.editorCache) {
      if (now - entry.timestamp > this.config.editorCacheTTL) {
        entry.dispose();
        this.editorCache.delete(editor);
        cleanedCount++;
      }
    }

    this.metrics.lastCleanup = now;
    this.updateMetrics();

    if (cleanedCount > 0 && this.config.enableMetrics) {
      console.log(
        `Bracket Lynx: Cleaned up ${cleanedCount} expired cache entries`
      );
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    this.metrics.totalSize = this.documentCache.size + this.editorCache.size;
  }









  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Get cache metrics for debugging
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }



  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Dispose all editor entries
    for (const [, entry] of this.editorCache) {
      entry.dispose();
    }

    this.documentCache.clear();
    this.editorCache.clear();
  }
}

// ============================================================================
// DEBOUNCING AND THROTTLING UTILITIES
// ============================================================================

export class SmartDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * Smart debounce based on file size and editor activity
   */
  debounce(
    key: string,
    callback: () => void,
    document: vscode.TextDocument,
    isActiveEditor: boolean = false
  ): void {
    // Clear existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate delay based on file size and editor state
    const fileSize = document.getText().length;
    const baseSizeUnit = 16 * 1024; // 16KB
    const sizeMultiplier = Math.pow(
      Math.max(fileSize, baseSizeUnit) / baseSizeUnit,
      0.5
    );

    const baseDelay = 150; // Base delay in ms
    const sizeDelay = sizeMultiplier * 100;
    const editorMultiplier = isActiveEditor ? 1 : 2;

    const totalDelay = Math.min(
      (baseDelay + sizeDelay) * editorMultiplier,
      2000
    );

    // Set new timer
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, totalDelay);

    this.timers.set(key, timer);
  }

  /**
   * Cancel debounced operation
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Dispose all timers
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
