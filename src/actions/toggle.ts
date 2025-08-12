import * as vscode from 'vscode';
import {
  forceSyncColorWithConfiguration,
  setBracketLynxProviderForColors,
  initializeColorSystem,
  changeDecorationColor,
} from './colors';

// Configuration keys
const CONFIG_SECTION = 'bracketLynx';
const GLOBAL_ENABLED_KEY = 'globalEnabled';
const DISABLED_FILES_KEY = 'disabledFiles';
const MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Quick Pick Options
const MENU_OPTIONS = [
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
    label: '🧹 Clean Memory',
    description: '',
    action: 'cleanup',
  },
  {
    label: '♻️ Refresh',
    description: 'Update decorations for current file',
    action: 'refresh',
  },
];

let isEnabled = true;
let bracketLynxProvider: any = undefined;
let astroDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();
let memoryCleanupTimer: NodeJS.Timeout | undefined;

export async function toggleBracketLynx(): Promise<void> {
  isEnabled = !isEnabled;
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

        if (astroDecorator) {
          astroDecorator.forceUpdateEditor?.(activeEditor);
        }
        vscode.window.showInformationMessage('♻️ Bracket Lynx: Refreshed');
      })
      .catch((error: any) => {
        console.error('♻️ Error during refresh:', error);
        bracketLynxProvider.clearDecorationCache?.(activeEditor.document);
        bracketLynxProvider.forceUpdateEditor?.(activeEditor);

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

  const options = [...MENU_OPTIONS];
  options[3].description = memoryLabel;

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
  if (astroDecorator) {
    astroDecorator.forceRefresh?.();
  }
}

function deactivateExtension(): void {
  if (bracketLynxProvider) {
    bracketLynxProvider.clearAllDecorations?.();
  }
  if (astroDecorator) {
    astroDecorator.clearAllDecorations?.();
  }
}

function getEditorKey(editor: vscode.TextEditor): string {
  return editor.document.uri.toString();
}

export async function cleanupClosedEditor(document: vscode.TextDocument): Promise<void> {
  const documentUri = document.uri.toString();
  let hasChanges = false;

  if (disabledEditors.delete(documentUri)) {
    hasChanges = true;
  }

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

  if (hasChanges) {
    await saveDisabledFilesState();
  }

  if (disabledEditors.size > 100) {
    console.log(
      `⚠️ Bracket Lynx: Large memory footprint detected (${disabledEditors.size} entries), triggering cleanup`
    );
    await cleanupAllClosedEditors();
  }
}

export async function cleanupAllClosedEditors(): Promise<void> {
  const visibleUris = new Set<string>();

  vscode.window.visibleTextEditors.forEach((editor) => {
    visibleUris.add(editor.document.uri.toString());
  });

  vscode.workspace.textDocuments.forEach((document) => {
    visibleUris.add(document.uri.toString());
  });

  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (!visibleUris.has(key)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    disabledEditors.delete(key);
  });

  if (keysToDelete.length > 0) {
    await saveDisabledFilesState();
    console.log(
      `🧹 Bracket Lynx: Cleaned up ${keysToDelete.length} closed editor(s) from memory and persisted changes`
    );
  }
}

function startMemoryCleanupTimer(): void {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
  }

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

export function stopMemoryCleanupTimer(): void {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = undefined;
  }
}

export function getMemoryStats(): {
  disabledEditorsCount: number;
  memoryFootprintKB: number;
  isHealthy: boolean;
} {
  const count = disabledEditors.size;
  const estimatedKB = Math.round((count * 100) / 1024);
  const isHealthy = count < 50;

  return {
    disabledEditorsCount: count,
    memoryFootprintKB: estimatedKB,
    isHealthy,
  };
}

export async function forceMemoryCleanup(): Promise<void> {
  const statsBefore = getMemoryStats();
  await cleanupAllClosedEditors();

  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
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
  console.log(`   Before: ${statsBefore.disabledEditorsCount} entries (${statsBefore.memoryFootprintKB}KB)`);
  console.log(`   After: ${statsAfter.disabledEditorsCount} entries (${statsAfter.memoryFootprintKB}KB)`);
  console.log(`   Freed: ${statsBefore.disabledEditorsCount - statsAfter.disabledEditorsCount} entries`);
}

// ============================================================================
// PERSISTENCE FUNCTIONS
// ============================================================================

async function saveGlobalEnabledState(enabled: boolean): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(GLOBAL_ENABLED_KEY, enabled, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error('Failed to save global enabled state:', error);
  }
}

function loadGlobalEnabledState(): boolean {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<boolean>(GLOBAL_ENABLED_KEY, true);
  } catch (error) {
    console.error('Failed to load global enabled state:', error);
    return true;
  }
}

async function saveDisabledFilesState(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const disabledFilesArray = Array.from(disabledEditors.keys());
    await config.update(DISABLED_FILES_KEY, disabledFilesArray, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error('Failed to save disabled files state:', error);
  }
}

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
  isEnabled = loadGlobalEnabledState();
  loadDisabledFilesState();
  
  console.log(`🔄 Bracket Lynx: Initialized state - Global: ${isEnabled ? 'enabled' : 'disabled'}, Disabled files: ${disabledEditors.size}`);
}