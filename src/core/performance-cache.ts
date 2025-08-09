import * as vscode from 'vscode';
import { 
  DocumentDecorationCacheEntry, 
  EditorDecorationCacheEntry,
  BracketEntry,
  BracketDecorationSource 
} from '../lens/lens';

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

export interface AdvancedDocumentCacheEntry extends DocumentDecorationCacheEntry {
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
  documentCacheTTL: number;  // milliseconds
  editorCacheTTL: number;    // milliseconds
  cleanupInterval: number;   // milliseconds
  enableMetrics: boolean;
  // Advanced memory management
  memoryPressureThreshold: number; // MB
  aggressiveCleanupThreshold: number; // MB
  lowMemoryMode: boolean;
  maxMemoryUsage: number; // MB
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
    lastCleanup: Date.now()
  };
  
  // Configuration
  private config: CacheConfig = {
    maxDocumentCacheSize: 50,
    maxEditorCacheSize: 20,
    documentCacheTTL: 5 * 60 * 1000,  // 5 minutes
    editorCacheTTL: 10 * 60 * 1000,   // 10 minutes
    cleanupInterval: 60 * 1000,       // 1 minute
    enableMetrics: true,
    // Advanced memory management
    memoryPressureThreshold: 100,     // 100MB
    aggressiveCleanupThreshold: 200,  // 200MB
    lowMemoryMode: false,
    maxMemoryUsage: 500               // 500MB
  };
  
  // Cleanup timer
  private cleanupTimer?: NodeJS.Timeout;
  
  // Memory management
  private memoryMonitorTimer?: NodeJS.Timeout;
  private lastMemoryCheck = 0;
  private memoryWarningShown = false;
  
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
  getDocumentCache(document: vscode.TextDocument): AdvancedDocumentCacheEntry | null {
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
      fileSize: text.length
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
        lastAccessed: now
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
      console.log(`Bracket Lynx: Cleaned up ${cleanedCount} expired cache entries`);
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
  // ADVANCED MEMORY MANAGEMENT
  // ============================================================================

  /**
   * Get estimated memory usage in MB
   */
  private getEstimatedMemoryUsage(): number {
    let totalSize = 0;
    
    // Estimate document cache memory
    for (const [, entry] of this.documentCache) {
      totalSize += entry.fileSize || 0;
      totalSize += (entry.brackets?.length || 0) * 200; // Rough estimate per bracket
      totalSize += (entry.decorationSource?.length || 0) * 100; // Rough estimate per decoration
    }
    
    // Estimate editor cache memory (smaller)
    totalSize += this.editorCache.size * 1000; // Rough estimate per editor
    
    return Math.round(totalSize / 1024 / 1024); // Convert to MB
  }

  /**
   * Check system memory pressure (simplified estimation)
   */
  private checkMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const estimatedUsage = this.getEstimatedMemoryUsage();
    
    if (estimatedUsage > this.config.maxMemoryUsage) {
      return 'critical';
    } else if (estimatedUsage > this.config.aggressiveCleanupThreshold) {
      return 'high';
    } else if (estimatedUsage > this.config.memoryPressureThreshold) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorTimer = setInterval(() => {
      this.performMemoryCheck();
    }, 30 * 1000); // Check every 30 seconds
  }

  /**
   * Perform memory check and cleanup if needed
   */
  private performMemoryCheck(): void {
    const now = Date.now();
    this.lastMemoryCheck = now;
    
    const memoryPressure = this.checkMemoryPressure();
    const estimatedUsage = this.getEstimatedMemoryUsage();
    
    if (this.config.enableMetrics) {
      console.log(`Bracket Lynx Memory: ${estimatedUsage}MB, Pressure: ${memoryPressure}`);
    }
    
    switch (memoryPressure) {
      case 'critical':
        this.performCriticalCleanup();
        this.showMemoryWarning(estimatedUsage, 'critical');
        break;
        
      case 'high':
        this.performAggressiveCleanup();
        this.showMemoryWarning(estimatedUsage, 'high');
        break;
        
      case 'medium':
        this.performMediumCleanup();
        break;
        
      case 'low':
        // Reset warning flag when memory is low
        this.memoryWarningShown = false;
        break;
    }
  }

  /**
   * Perform critical memory cleanup
   */
  private performCriticalCleanup(): void {
    console.warn('Bracket Lynx: Critical memory usage detected, performing emergency cleanup');
    
    // Clear most of the cache, keep only most recent entries
    const keepDocuments = Math.min(5, this.config.maxDocumentCacheSize);
    const keepEditors = Math.min(3, this.config.maxEditorCacheSize);
    
    // Keep only most recently accessed documents
    const sortedDocs = Array.from(this.documentCache.entries())
      .sort(([,a], [,b]) => b.lastAccessed - a.lastAccessed);
    
    this.documentCache.clear();
    for (let i = 0; i < Math.min(keepDocuments, sortedDocs.length); i++) {
      this.documentCache.set(sortedDocs[i][0], sortedDocs[i][1]);
    }
    
    // Keep only most recently accessed editors
    const sortedEditors = Array.from(this.editorCache.entries())
      .sort(([,a], [,b]) => b.lastAccessed - a.lastAccessed);
    
    // Dispose old editors
    for (let i = keepEditors; i < sortedEditors.length; i++) {
      sortedEditors[i][1].dispose();
    }
    
    this.editorCache.clear();
    for (let i = 0; i < Math.min(keepEditors, sortedEditors.length); i++) {
      this.editorCache.set(sortedEditors[i][0], sortedEditors[i][1]);
    }
    
    // Enable low memory mode
    this.config.lowMemoryMode = true;
    this.adjustConfigForLowMemory();
    
    this.metrics.evictions += sortedDocs.length - keepDocuments + sortedEditors.length - keepEditors;
    this.updateMetrics();
  }

  /**
   * Perform aggressive cleanup
   */
  private performAggressiveCleanup(): void {
    console.warn('Bracket Lynx: High memory usage detected, performing aggressive cleanup');
    
    const now = Date.now();
    
    // Use shorter TTL for aggressive cleanup
    const aggressiveTTL = Math.min(this.config.documentCacheTTL / 2, 2 * 60 * 1000); // 2 minutes max
    
    // Clean documents more aggressively
    const docsToDelete: string[] = [];
    for (const [uri, entry] of this.documentCache) {
      if (now - entry.timestamp > aggressiveTTL || now - entry.lastAccessed > aggressiveTTL) {
        docsToDelete.push(uri);
      }
    }
    
    docsToDelete.forEach(uri => this.documentCache.delete(uri));
    
    // Clean editors more aggressively
    const editorsToDelete: vscode.TextEditor[] = [];
    for (const [editor, entry] of this.editorCache) {
      if (now - entry.timestamp > aggressiveTTL || now - entry.lastAccessed > aggressiveTTL) {
        editorsToDelete.push(editor);
      }
    }
    
    editorsToDelete.forEach(editor => {
      const entry = this.editorCache.get(editor);
      entry?.dispose();
      this.editorCache.delete(editor);
    });
    
    // Reduce cache sizes temporarily
    this.config.maxDocumentCacheSize = Math.max(10, this.config.maxDocumentCacheSize * 0.7);
    this.config.maxEditorCacheSize = Math.max(5, this.config.maxEditorCacheSize * 0.7);
    
    this.metrics.evictions += docsToDelete.length + editorsToDelete.length;
    this.updateMetrics();
  }

  /**
   * Perform medium cleanup
   */
  private performMediumCleanup(): void {
    if (this.config.enableMetrics) {
      console.log('Bracket Lynx: Medium memory pressure detected, performing cleanup');
    }
    
    // Perform regular cleanup but more frequently
    this.performCleanup();
    
    // Slightly reduce cache sizes
    if (!this.config.lowMemoryMode) {
      this.config.maxDocumentCacheSize = Math.max(20, this.config.maxDocumentCacheSize * 0.9);
      this.config.maxEditorCacheSize = Math.max(10, this.config.maxEditorCacheSize * 0.9);
    }
  }

  /**
   * Adjust configuration for low memory mode
   */
  private adjustConfigForLowMemory(): void {
    this.config.maxDocumentCacheSize = 5;
    this.config.maxEditorCacheSize = 3;
    this.config.documentCacheTTL = 2 * 60 * 1000; // 2 minutes
    this.config.editorCacheTTL = 3 * 60 * 1000;   // 3 minutes
    this.config.cleanupInterval = 30 * 1000;      // 30 seconds
  }

  /**
   * Show memory warning to user
   */
  private showMemoryWarning(usage: number, level: 'high' | 'critical'): void {
    if (this.memoryWarningShown) {
      return; // Don't spam warnings
    }
    
    this.memoryWarningShown = true;
    
    const message = level === 'critical' 
      ? `Bracket Lynx: Critical memory usage (${usage}MB). Cache cleared and low memory mode enabled.`
      : `Bracket Lynx: High memory usage (${usage}MB). Performing cleanup.`;
    
    console.warn(message);
    
    // Reset warning flag after 5 minutes
    setTimeout(() => {
      this.memoryWarningShown = false;
    }, 5 * 60 * 1000);
  }

  /**
   * Force garbage collection if available (Node.js specific)
   */
  private forceGarbageCollection(): void {
    try {
      if (global.gc) {
        global.gc();
        if (this.config.enableMetrics) {
          console.log('Bracket Lynx: Forced garbage collection');
        }
      }
    } catch (error) {
      // Ignore errors - GC might not be available
    }
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
   * Get memory metrics for debugging
   */
  getMemoryMetrics() {
    return {
      estimatedUsage: `${this.getEstimatedMemoryUsage()}MB`,
      memoryPressure: this.checkMemoryPressure(),
      lowMemoryMode: this.config.lowMemoryMode,
      lastMemoryCheck: new Date(this.lastMemoryCheck).toISOString(),
      thresholds: {
        memoryPressure: `${this.config.memoryPressureThreshold}MB`,
        aggressiveCleanup: `${this.config.aggressiveCleanupThreshold}MB`,
        maxUsage: `${this.config.maxMemoryUsage}MB`
      }
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
    
    // If low memory mode is disabled, restore normal settings
    if (newConfig.lowMemoryMode === false) {
      this.restoreNormalMemoryMode();
    }
  }

  /**
   * Restore normal memory mode settings
   */
  private restoreNormalMemoryMode(): void {
    this.config.maxDocumentCacheSize = 50;
    this.config.maxEditorCacheSize = 20;
    this.config.documentCacheTTL = 5 * 60 * 1000;
    this.config.editorCacheTTL = 10 * 60 * 1000;
    this.config.cleanupInterval = 60 * 1000;
  }

  /**
   * Force memory cleanup
   */
  forceMemoryCleanup(): void {
    this.performAggressiveCleanup();
    this.forceGarbageCollection();
  }
  
  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = undefined;
    }
    
    // Dispose all editor entries
    for (const [, entry] of this.editorCache) {
      entry.dispose();
    }
    
    this.documentCache.clear();
    this.editorCache.clear();
    
    // Final garbage collection attempt
    this.forceGarbageCollection();
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
    const sizeMultiplier = Math.pow(Math.max(fileSize, baseSizeUnit) / baseSizeUnit, 0.5);
    
    const baseDelay = 150; // Base delay in ms
    const sizeDelay = sizeMultiplier * 100;
    const editorMultiplier = isActiveEditor ? 1 : 2;
    
    const totalDelay = Math.min((baseDelay + sizeDelay) * editorMultiplier, 2000);
    
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