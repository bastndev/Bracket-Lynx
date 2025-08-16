import * as vscode from 'vscode';
import {
  DocumentDecorationCacheEntry,
  EditorDecorationCacheEntry,
  BracketEntry,
  BracketDecorationSource,
} from '../lens/lens';
import { CACHE_CONFIG, createHash } from './performance-config';

// ============================================================================
// 🎯 UNIFIED CACHE INTERFACES - Clean and Simple
// ============================================================================

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  lastCleanup: number;
}

export interface AdvancedDocumentCacheEntry extends DocumentDecorationCacheEntry {
  readonly textHash: string;
  readonly timestamp: number;
  readonly accessCount: number;
  readonly lastAccessed: number;
  readonly fileSize: number;
}

export interface AdvancedEditorCacheEntry extends EditorDecorationCacheEntry {
  readonly timestamp: number;
  readonly lastAccessed: number;
}

export interface CacheConfig {
  readonly maxDocumentCacheSize: number;
  readonly maxEditorCacheSize: number;
  readonly documentCacheTTL: number; // milliseconds
  readonly editorCacheTTL: number; // milliseconds
  readonly cleanupInterval: number; // milliseconds
  readonly enableMetrics: boolean;
  // 🧠 Advanced memory management
  readonly memoryPressureThreshold: number; // MB
  readonly aggressiveCleanupThreshold: number; // MB
  readonly lowMemoryMode: boolean;
  readonly maxMemoryUsage: number; // MB
}

// ============================================================================
// 🚀 ADVANCED CACHE MANAGER - Unified and Optimized
// ============================================================================

export class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;

  // 🎯 Cache storage - simplified
  private documentCache = new Map<string, AdvancedDocumentCacheEntry>();
  private editorCache = new Map<vscode.TextEditor, AdvancedEditorCacheEntry>();

  // 📊 Performance metrics
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    lastCleanup: Date.now(),
  };

  // ⚙️ Configuration with memory management
  private config: CacheConfig = {
    maxDocumentCacheSize: CACHE_CONFIG.MAX_DOCUMENT_CACHE_SIZE,
    maxEditorCacheSize: CACHE_CONFIG.MAX_EDITOR_CACHE_SIZE,
    documentCacheTTL: CACHE_CONFIG.DOCUMENT_CACHE_TTL,
    editorCacheTTL: CACHE_CONFIG.EDITOR_CACHE_TTL,
    cleanupInterval: CACHE_CONFIG.CLEANUP_INTERVAL,
    enableMetrics: true,
    // 🧠 Memory management settings
    memoryPressureThreshold: 50, // 50MB
    aggressiveCleanupThreshold: 100, // 100MB
    lowMemoryMode: false,
    maxMemoryUsage: 200, // 200MB
  };

  // ⏰ Cleanup timer
  private cleanupTimer?: NodeJS.Timeout;
  private memoryMonitorTimer?: NodeJS.Timeout;

  private constructor() {
    this.startCleanupTimer();
    this.startMemoryMonitoring();
  }

  static getInstance(): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager();
    }
    return AdvancedCacheManager.instance;
  }

  // ============================================================================
  // 🎯 DOCUMENT CACHE METHODS - Optimized
  // ============================================================================

  /**
   * Get document cache entry with LRU and TTL logic
   */
  getDocumentCache(document: vscode.TextDocument): AdvancedDocumentCacheEntry | null {
    const uri = document.uri.toString();
    const text = document.getText();
    const textHash = createHash(text); // 🚀 Use optimized hash from performance-config
    const now = Date.now();

    const cached = this.documentCache.get(uri);

    if (!cached) {
      this.metrics.misses++;
      return null;
    }

    // 🕐 Check TTL
    if (now - cached.timestamp > this.config.documentCacheTTL) {
      this.documentCache.delete(uri);
      this.metrics.misses++;
      return null;
    }

    // 🔍 Check content hash
    if (cached.textHash !== textHash) {
      this.documentCache.delete(uri);
      this.metrics.misses++;
      return null;
    }

    // 🎯 Update LRU data (mutable update for performance)
    (cached as any).lastAccessed = now;
    (cached as any).accessCount++;

    // 🚀 Move to end for LRU (delete and re-add)
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
    const textHash = createHash(text); // 🚀 Use optimized hash
    const now = Date.now();

    // 🧹 Enforce cache size limit with LRU eviction
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
  // 🎯 EDITOR CACHE METHODS - Optimized
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

    // 🕐 Check TTL
    if (now - cached.timestamp > this.config.editorCacheTTL) {
      cached.dispose();
      this.editorCache.delete(editor);
      return null;
    }

    // 🎯 Update access time (mutable for performance)
    (cached as any).lastAccessed = now;

    return cached;
  }

  /**
   * Set editor cache entry
   */
  setEditorCache(editor: vscode.TextEditor): AdvancedEditorCacheEntry {
    const now = Date.now();

    // 🧹 Enforce cache size limit with LRU eviction
    if (this.editorCache.size >= this.config.maxEditorCacheSize) {
      // 🚀 Find oldest entry efficiently
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
  // 🧹 CACHE MANAGEMENT METHODS - Unified and Efficient
  // ============================================================================

  /**
   * Clear cache for specific document
   */
  clearDocumentCache(document?: vscode.TextDocument): void {
    if (document) {
      const uri = document.uri.toString();
      this.documentCache.delete(uri);

      // 🎯 Mark related editors as dirty
      for (const [editor, editorEntry] of this.editorCache) {
        if (editor.document === document) {
          editorEntry.setDirty();
        }
      }
    }

    // 🧹 Clean up invisible editors
    this.cleanupInvisibleEditors();
    this.updateMetrics();
  }

  /**
   * Clear all caches
   */
  clearAllCache(): void {
    this.documentCache.clear();

    for (const [, editorEntry] of this.editorCache) {
      editorEntry.setDirty();
    }

    this.updateMetrics();
  }

  /**
   * 🧹 Clean up invisible editors (extracted for reuse)
   */
  private cleanupInvisibleEditors(): void {
    const visibleEditors = new Set(vscode.window.visibleTextEditors);
    
    for (const [editor, editorEntry] of this.editorCache) {
      if (!visibleEditors.has(editor)) {
        editorEntry.dispose();
        this.editorCache.delete(editor);
      }
    }
  }

  /**
   * 🕐 Automatic cleanup based on TTL and LRU
   */
  private performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // 🧹 Clean expired document cache entries
    for (const [uri, entry] of this.documentCache) {
      if (now - entry.timestamp > this.config.documentCacheTTL) {
        this.documentCache.delete(uri);
        cleanedCount++;
      }
    }

    // 🧹 Clean expired editor cache entries
    for (const [editor, entry] of this.editorCache) {
      if (now - entry.timestamp > this.config.editorCacheTTL) {
        entry.dispose();
        this.editorCache.delete(editor);
        cleanedCount++;
      }
    }

    // 🧹 Clean invisible editors
    this.cleanupInvisibleEditors();

    this.metrics = {
      ...this.metrics,
      lastCleanup: now,
    };
    this.updateMetrics();

    if (cleanedCount > 0 && this.config.enableMetrics) {
      console.log(`🧹 Bracket Lynx: Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * ⏰ Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 📊 Update cache metrics
   */
  private updateMetrics(): void {
    this.metrics = {
      ...this.metrics,
      totalSize: this.documentCache.size + this.editorCache.size,
    };
  }

  // ============================================================================
  // 🧠 MEMORY MANAGEMENT - Advanced Features
  // ============================================================================

  /**
   * 🧠 Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorTimer = setInterval(() => {
      this.performMemoryCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * 🔍 Check system memory pressure and perform cleanup if needed
   */
  private performMemoryCheck(): void {
    const memoryUsage = this.getEstimatedMemoryUsage();
    
    if (memoryUsage > this.config.aggressiveCleanupThreshold) {
      this.performCriticalCleanup();
      this.showMemoryWarning(memoryUsage, 'critical');
    } else if (memoryUsage > this.config.memoryPressureThreshold) {
      this.performAggressiveCleanup();
      this.showMemoryWarning(memoryUsage, 'high');
    }
  }

  /**
   * 📊 Get estimated memory usage in MB
   */
  getEstimatedMemoryUsage(): number {
    // 🎯 Rough estimation based on cache sizes and average entry size
    const avgDocumentEntrySize = 2048; // 2KB per document entry estimate
    const avgEditorEntrySize = 512; // 512B per editor entry estimate
    
    const documentMemory = this.documentCache.size * avgDocumentEntrySize;
    const editorMemory = this.editorCache.size * avgEditorEntrySize;
    
    return (documentMemory + editorMemory) / (1024 * 1024); // Convert to MB
  }

  /**
   * 🚨 Perform critical memory cleanup
   */
  private performCriticalCleanup(): void {
    // 🔥 Aggressive cleanup - remove 75% of cache
    const documentsToRemove = Math.floor(this.documentCache.size * 0.75);
    const editorsToRemove = Math.floor(this.editorCache.size * 0.75);
    
    // Remove oldest documents
    let removedDocs = 0;
    for (const [uri] of this.documentCache) {
      if (removedDocs >= documentsToRemove) {break;}
      this.documentCache.delete(uri);
      removedDocs++;
    }
    
    // Remove oldest editors
    let removedEditors = 0;
    for (const [editor, entry] of this.editorCache) {
      if (removedEditors >= editorsToRemove) {break;}
      entry.dispose();
      this.editorCache.delete(editor);
      removedEditors++;
    }
    
    this.adjustConfigForLowMemory();
    this.updateMetrics();
    
    console.log(`🚨 Critical memory cleanup: removed ${removedDocs} documents, ${removedEditors} editors`);
  }

  /**
   * ⚡ Perform aggressive cleanup
   */
  private performAggressiveCleanup(): void {
    // 🎯 Medium cleanup - remove 50% of cache
    const documentsToRemove = Math.floor(this.documentCache.size * 0.5);
    const editorsToRemove = Math.floor(this.editorCache.size * 0.5);
    
    let removedDocs = 0;
    for (const [uri] of this.documentCache) {
      if (removedDocs >= documentsToRemove) {break;}
      this.documentCache.delete(uri);
      removedDocs++;
    }
    
    let removedEditors = 0;
    for (const [editor, entry] of this.editorCache) {
      if (removedEditors >= editorsToRemove) {break;}
      entry.dispose();
      this.editorCache.delete(editor);
      removedEditors++;
    }
    
    this.updateMetrics();
    console.log(`⚡ Aggressive cleanup: removed ${removedDocs} documents, ${removedEditors} editors`);
  }

  /**
   * ⚙️ Adjust configuration for low memory mode
   */
  private adjustConfigForLowMemory(): void {
    this.config = {
      ...this.config,
      maxDocumentCacheSize: Math.floor(this.config.maxDocumentCacheSize * 0.5),
      maxEditorCacheSize: Math.floor(this.config.maxEditorCacheSize * 0.5),
      documentCacheTTL: Math.floor(this.config.documentCacheTTL * 0.7),
      editorCacheTTL: Math.floor(this.config.editorCacheTTL * 0.7),
      lowMemoryMode: true,
    };
  }

  /**
   * 🔔 Show memory warning to user
   */
  private showMemoryWarning(usage: number, level: 'high' | 'critical'): void {
    const message = `🧠 Bracket Lynx: ${level === 'critical' ? 'Critical' : 'High'} memory usage detected (${usage.toFixed(1)}MB). Cache cleaned up automatically.`;
    
    if (level === 'critical') {
      vscode.window.showWarningMessage(message);
    } else {
      console.log(message);
    }
  }

  /**
   * 🔄 Force memory cleanup
   */
  forceMemoryCleanup(): void {
    this.performAggressiveCleanup();
  }

  /**
   * 🔄 Force garbage collection if available (Node.js specific)
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }
  }

  // ============================================================================
  // 🎯 PUBLIC API METHODS - Clean and Efficient
  // ============================================================================

  /**
   * Get cache metrics for debugging
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get memory metrics for debugging
   */
  getMemoryMetrics(): {
    estimatedUsage: number;
    documentCacheSize: number;
    editorCacheSize: number;
    isLowMemoryMode: boolean;
  } {
    return {
      estimatedUsage: this.getEstimatedMemoryUsage(),
      documentCacheSize: this.documentCache.size,
      editorCacheSize: this.editorCache.size,
      isLowMemoryMode: this.config.lowMemoryMode,
    };
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
   * Restore normal memory mode settings
   */
  restoreNormalMemoryMode(): void {
    this.config = {
      ...this.config,
      maxDocumentCacheSize: CACHE_CONFIG.MAX_DOCUMENT_CACHE_SIZE,
      maxEditorCacheSize: CACHE_CONFIG.MAX_EDITOR_CACHE_SIZE,
      documentCacheTTL: CACHE_CONFIG.DOCUMENT_CACHE_TTL,
      editorCacheTTL: CACHE_CONFIG.EDITOR_CACHE_TTL,
      lowMemoryMode: false,
    };
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    // 🧹 Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = undefined;
    }

    // 🧹 Dispose all editor entries
    for (const [, entry] of this.editorCache) {
      entry.dispose();
    }

    this.documentCache.clear();
    this.editorCache.clear();
  }
}

// ============================================================================
// 🚀 SMART DEBOUNCER - Optimized and Efficient
// ============================================================================

export class SmartDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * 🎯 Smart debounce based on file size and editor activity
   */
  debounce(
    key: string,
    callback: () => void,
    document: vscode.TextDocument,
    isActiveEditor: boolean = false
  ): void {
    // 🧹 Clear existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 🎯 Calculate delay based on file size and editor state
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

    // ⏰ Set new timer
    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, totalDelay);

    this.timers.set(key, timer);
  }

  /**
   * ❌ Cancel debounced operation
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * 🧹 Dispose all timers
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
