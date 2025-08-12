import * as vscode from 'vscode';
import {
  forceSyncColorWithConfiguration,
  setBracketLynxProviderForColors,
  initializeColorSystem,
  changeDecorationColor,
} from './colors';

let isEnabled = true;
let bracketLynxProvider: any = undefined;
let astroDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();

// Configuration keys for persistence
const CONFIG_SECTION = 'bracketLynx';
const GLOBAL_ENABLED_KEY = 'globalEnabled';
const DISABLED_FILES_KEY = 'disabledFiles';

// Memory optimization: Periodic cleanup timer
let memoryCleanupTimer: NodeJS.Timeout | undefined;
const MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function toggleBracketLynx(): Promise<void> {
  isEnabled = !isEnabled;

  // Persist global state
  await saveGlobalEnabledState(isEnabled);

  if (isEnabled) {
    disabledEditors.clear();
    await saveDisabledFilesState();
    reactivateExtension();
    vscode.window.showInformationMessage(
      '🌐 Bracket Lynx: Activated globally (all files enabled)'
    );
  } else {
    deactivateExtension();
    vscode.window.showInformationMessage(
      '🌐 Bracket Lynx: Deactivated globally'
    );
  }
}

export function isExtensionEnabled(): boolean {
  return isEnabled;
}

export function isEditorEnabled(editor: vscode.TextEditor): boolean {
  if (!isEnabled) {
    return false;
  }
  const editorKey = getEditorKey(editor);
  return !disabledEditors.get(editorKey);
}

export function isDocumentEnabled(document: vscode.TextDocument): boolean {
  if (!isEnabled) {
    return false;
  }
  const documentUri = document.uri.toString();
  return !disabledEditors.get(documentUri);
}

export async function toggleCurrentEditor(): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('📝 No active editor to toggle');
    return;
  }

  if (!isEnabled) {
    vscode.window.showWarningMessage(
      '📝 Cannot toggle individual file: Extension is disabled globally. Enable globally first.'
    );
    return;
  }

  const editorKey = getEditorKey(activeEditor);
  const isCurrentlyDisabled = disabledEditors.get(editorKey) || false;

  if (isCurrentlyDisabled) {
    disabledEditors.delete(editorKey);
    await saveDisabledFilesState();
    if (bracketLynxProvider) {
      bracketLynxProvider.forceUpdateEditor?.(activeEditor);
    }
    // Update Astro decorations if it's an Astro file
    if (astroDecorator) {
      astroDecorator.forceUpdateEditor?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📝 Bracket Lynx: Enabled for current file'
    );
  } else {
    disabledEditors.set(editorKey, true);
    await saveDisabledFilesState();
    if (bracketLynxProvider) {
      bracketLynxProvider.clearEditorDecorations?.(activeEditor);
    }
    // Clear Astro decorations if it's an Astro file
    if (astroDecorator) {
      astroDecorator.clearDecorations?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📝 Bracket Lynx: Disabled for current file'
    );
  }
}

export function refreshBrackets(): void {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('♻️ No active editor to refresh');
    return;
  }

  if (bracketLynxProvider && isEditorEnabled(activeEditor)) {
    forceSyncColorWithConfiguration()
      .then(() => {
        bracketLynxProvider.clearDecorationCache?.(activeEditor.document);
        bracketLynxProvider.forceUpdateEditor?.(activeEditor);

        // Refresh Astro decorations if it's an Astro file
        if (astroDecorator) {
          astroDecorator.forceUpdateEditor?.(activeEditor);
        }

        vscode.window.showInformationMessage('♻️ Bracket Lynx: Refreshed');
      })
      .catch((error: any) => {
        console.error('♻️ Error during refresh:', error);
        bracketLynxProvider.clearDecorationCache?.(activeEditor.document);
        bracketLynxProvider.forceUpdateEditor?.(activeEditor);

        // Refresh Astro decorations even with errors
        if (astroDecorator) {
          astroDecorator.forceUpdateEditor?.(activeEditor);
        }

        vscode.window.showInformationMessage(
          '♻️ Bracket Lynx: Refreshed (with warnings)'
        );
      });
  } else {
    vscode.window.showInformationMessage(
      '♻️ Bracket Lynx: Cannot refresh (disabled)'
    );
  }
}

export function setBracketLynxProvider(provider: any): void {
  bracketLynxProvider = provider;

  setBracketLynxProviderForColors(provider);
  initializeColorSystem();

  // Initialize memory cleanup timer
  startMemoryCleanupTimer();
}

export function setAstroDecorator(decorator: any): void {
  astroDecorator = decorator;
}

export function showBracketLynxMenu(): void {
  const memoryStats = getMemoryStats();
  const memoryLabel = memoryStats.isHealthy
    ? `🧠 Memory: ${memoryStats.disabledEditorsCount} entries (${memoryStats.memoryFootprintKB}KB)`
    : `⚠️ Memory: ${memoryStats.disabledEditorsCount} entries (${memoryStats.memoryFootprintKB}KB) - Cleanup recommended`;

  const options = [
    {
      label: '🌐 Toggle Global',
      description: 'Activate/deactivate for all files',
      action: 'global',
    },
    {
      label: '📝 Toggle Current File',
      description: 'Activate/deactivate only current file',
      action: 'current',
    },
    {
      label: '🎨 Change Color',
      description: 'Change decoration color with preview',
      action: 'color',
    },
    {
      label: '♻️ Refresh',
      description: 'Update decorations for current file',
      action: 'refresh',
    },
    {
      label: '🧹 Clean Memory',
      description: memoryLabel,
      action: 'cleanup',
    },
  ];

  vscode.window
    .showQuickPick(options, {
      placeHolder: 'Choose Bracket Lynx action...',
    })
    .then(async (selected) => {
      if (!selected) {
        return;
      }

      switch (selected.action) {
        case 'global':
          await toggleBracketLynx();
          break;
        case 'current':
          await toggleCurrentEditor();
          break;
        case 'refresh':
          refreshBrackets();
          break;
        case 'color':
          changeDecorationColor();
          break;
        case 'cleanup':
          await forceMemoryCleanup();
          vscode.window.showInformationMessage(
            '🧹 Bracket Lynx: Memory cleanup completed!'
          );
          break;
      }
    });
}

function reactivateExtension(): void {
  if (bracketLynxProvider) {
    bracketLynxProvider.updateAllDecoration?.();
  }

  // Reactivate Astro decorations
  if (astroDecorator) {
    astroDecorator.forceRefresh?.();
  }
}

function deactivateExtension(): void {
  if (bracketLynxProvider) {
    bracketLynxProvider.clearAllDecorations?.();
  }

  // Deactivate Astro decorations
  if (astroDecorator) {
    astroDecorator.clearAllDecorations?.();
  }
}

function getEditorKey(editor: vscode.TextEditor): string {
  return editor.document.uri.toString();
}

/**
 * Clean up disabled editor state when a document is closed
 * ENHANCED: More thorough cleanup with memory optimization and persistence
 */
export async function cleanupClosedEditor(document: vscode.TextDocument): Promise<void> {
  const documentUri = document.uri.toString();
  let hasChanges = false;

  // Remove the exact document URI
  if (disabledEditors.delete(documentUri)) {
    hasChanges = true;
  }

  // Clean up any legacy keys that might reference this document
  const legacyKeysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (key.startsWith(documentUri + ':') || key.includes(documentUri)) {
      legacyKeysToDelete.push(key);
    }
  }
  
  if (legacyKeysToDelete.length > 0) {
    legacyKeysToDelete.forEach((key) => disabledEditors.delete(key));
    hasChanges = true;
  }

  // Save changes if any were made
  if (hasChanges) {
    await saveDisabledFilesState();
  }

  // Trigger a broader cleanup if we have too many entries
  if (disabledEditors.size > 100) {
    console.log(
      `⚠️ Bracket Lynx: Large memory footprint detected (${disabledEditors.size} entries), triggering cleanup`
    );
    await cleanupAllClosedEditors();
  }
}

/**
 * Clean up all closed editors that are no longer visible
 * FIXED: Now cleans ALL closed editors, not just untitled ones, with persistence
 */
export async function cleanupAllClosedEditors(): Promise<void> {
  const visibleUris = new Set<string>();

  // Get all currently visible editor URIs
  vscode.window.visibleTextEditors.forEach((editor) => {
    visibleUris.add(editor.document.uri.toString());
  });

  // Also include all open tabs (not just visible ones)
  vscode.workspace.textDocuments.forEach((document) => {
    visibleUris.add(document.uri.toString());
  });

  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    // CRITICAL FIX: Remove ALL editors that are no longer open
    if (!visibleUris.has(key)) {
      keysToDelete.push(key);
    }
  }

  // Clean up the memory
  keysToDelete.forEach((key) => {
    disabledEditors.delete(key);
  });

  // Save changes if any were made
  if (keysToDelete.length > 0) {
    await saveDisabledFilesState();
    console.log(
      `🧹 Bracket Lynx: Cleaned up ${keysToDelete.length} closed editor(s) from memory and persisted changes`
    );
  }
}

/**
 * Start automatic memory cleanup timer
 */
function startMemoryCleanupTimer(): void {
  // Clear existing timer if any
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
  }

  // Set up periodic cleanup
  memoryCleanupTimer = setInterval(async () => {
    const sizeBefore = disabledEditors.size;
    await cleanupAllClosedEditors();
    const sizeAfter = disabledEditors.size;

    if (sizeBefore !== sizeAfter) {
      console.log(
        `🔄 Bracket Lynx: Periodic cleanup - reduced memory from ${sizeBefore} to ${sizeAfter} entries`
      );
    }
  }, MEMORY_CLEANUP_INTERVAL);
}

/**
 * Stop memory cleanup timer (for cleanup/disposal)
 */
export function stopMemoryCleanupTimer(): void {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = undefined;
  }
}

/**
 * Get current memory usage statistics
 */
export function getMemoryStats(): {
  disabledEditorsCount: number;
  memoryFootprintKB: number;
  isHealthy: boolean;
} {
  const count = disabledEditors.size;
  // Rough estimation: each entry ~100 bytes (URI string + boolean + Map overhead)
  const estimatedKB = Math.round((count * 100) / 1024);
  const isHealthy = count < 50; // Consider healthy if less than 50 entries

  return {
    disabledEditorsCount: count,
    memoryFootprintKB: estimatedKB,
    isHealthy,
  };
}

/**
 * Force immediate memory cleanup and optimization
 */
export async function forceMemoryCleanup(): Promise<void> {
  const statsBefore = getMemoryStats();

  // Clean up closed editors
  await cleanupAllClosedEditors();

  // Additional cleanup: remove any invalid entries
  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    // Remove entries with invalid URIs or empty keys
    if (!key || key.trim() === '' || key.length > 1000) {
      keysToDelete.push(key);
    }
  }

  if (keysToDelete.length > 0) {
    keysToDelete.forEach((key) => disabledEditors.delete(key));
    await saveDisabledFilesState();
  }

  const statsAfter = getMemoryStats();

  console.log(`🚀 Bracket Lynx: Force cleanup completed`);
  console.log(
    `   Before: ${statsBefore.disabledEditorsCount} entries (${statsBefore.memoryFootprintKB}KB)`
  );
  console.log(
    `   After: ${statsAfter.disabledEditorsCount} entries (${statsAfter.memoryFootprintKB}KB)`
  );
  console.log(
    `   Freed: ${
      statsBefore.disabledEditorsCount - statsAfter.disabledEditorsCount
    } entries`
  );
}

// ============================================================================
// PERSISTENCE FUNCTIONS
// ============================================================================

/**
 * Save global enabled state to VSCode configuration
 */
async function saveGlobalEnabledState(enabled: boolean): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(GLOBAL_ENABLED_KEY, enabled, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error('Failed to save global enabled state:', error);
  }
}

/**
 * Load global enabled state from VSCode configuration
 */
function loadGlobalEnabledState(): boolean {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<boolean>(GLOBAL_ENABLED_KEY, true);
  } catch (error) {
    console.error('Failed to load global enabled state:', error);
    return true; // Default to enabled
  }
}

/**
 * Save disabled files state to VSCode configuration
 */
async function saveDisabledFilesState(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const disabledFilesArray = Array.from(disabledEditors.keys());
    await config.update(DISABLED_FILES_KEY, disabledFilesArray, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error('Failed to save disabled files state:', error);
  }
}

/**
 * Load disabled files state from VSCode configuration
 */
function loadDisabledFilesState(): void {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const disabledFilesArray = config.get<string[]>(DISABLED_FILES_KEY, []);
    
    disabledEditors.clear();
    disabledFilesArray.forEach(fileUri => {
      disabledEditors.set(fileUri, true);
    });
  } catch (error) {
    console.error('Failed to load disabled files state:', error);
  }
}

/**
 * Initialize state from persisted configuration
 * This should be called when the extension activates
 */
export function initializePersistedState(): void {
  // Load global enabled state
  isEnabled = loadGlobalEnabledState();
  
  // Load disabled files state
  loadDisabledFilesState();
  
  console.log(`🔄 Bracket Lynx: Initialized state - Global: ${isEnabled ? 'enabled' : 'disabled'}, Disabled files: ${disabledEditors.size}`);
}