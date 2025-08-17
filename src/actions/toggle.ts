import * as vscode from 'vscode';
import { setBracketLynxProviderForColors, initializeColorSystem, changeDecorationColor, setAstroDecoratorForColors, setVueDecoratorForColors, setSvelteDecoratorForColors } from './colors';
import { safeExecute, safeExecuteAsync, validateTextEditor, validateDocument, ConfigurationError, logger, LogCategory } from '../core/performance-config';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
const CONFIG_SECTION = 'bracketLynx';
const GLOBAL_ENABLED_KEY = 'globalEnabled';
const DISABLED_FILES_KEY = 'disabledFiles';
const INDIVIDUALLY_ENABLED_FILES_KEY = 'individuallyEnabledFiles';

// ============================================================================
// TIMING CONSTANTS
// ============================================================================
const DECORATION_UPDATE_DELAY_SHORT = 50;
const DECORATION_UPDATE_DELAY_LONG = 200;

// ============================================================================
// STATE VARIABLES
// ============================================================================
let isEnabled = true;
let bracketLynxProvider: any = undefined;
let universalDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();
const individuallyEnabledEditors = new Map<string, boolean>();

// ============================================================================
// MENU & UI HELPERS
// ============================================================================
function getMenuOptions(): any[] {
  const globalStatus = isEnabled ? '🟢' : '⭕';
  const currentFileStatus = getCurrentFileStatus();

  return [
    {
      label: `🌐 Toggle Global (${globalStatus})`,
      description: isEnabled ? 'Deactivate for all files' : 'Activate for all files',
      action: 'global',
    },
    {
      label: `📝 Toggle Current File (${currentFileStatus})`,
      description: getCurrentFileDescription(),
      action: 'current',
    },
    {
      label: '🎨 Change Color',
      description: 'Change decoration color with preview',
      action: 'color',
    },
    {
      label: '♻️ Restore Default',
      description: 'Reset all changes and restore to initial default state',
      action: 'reset-to-default',
    },
  ];
}

function getCurrentFileStatus(): string {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return '❓ No file';
  }

  const isCurrentEnabled = isEditorEnabled(activeEditor);
  return isCurrentEnabled ? '🟢' : '⭕';
}

function getCurrentFileDescription(): string {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return 'No active file';
  }

  const isCurrentEnabled = isEditorEnabled(activeEditor);
  if (isEnabled) {
    return isCurrentEnabled ? 'Disable for current file' : 'Enable for current file';
  } else {
    return isCurrentEnabled ? 'Disable for current file (individual mode)' : 'Enable for current file (individual mode)';
  }
}

// ============================================================================
// PUBLIC API - MAIN TOGGLE FUNCTIONS
// ============================================================================
export async function toggleBracketLynx(): Promise<void> {
  isEnabled = !isEnabled;
  await saveGlobalEnabledState(isEnabled);

  if (isEnabled) {
    // Clear individual settings when enabling globally
    individuallyEnabledEditors.clear();
    disabledEditors.clear();
    await Promise.all([
      saveIndividuallyEnabledFilesState(),
      saveDisabledFilesState()
    ]);

    // Small delay to ensure state is saved
    setTimeout(() => {
      reactivateExtension();
    }, 50);

    vscode.window.showInformationMessage('Bracket Lynx: (Activated ✅) globally - 🌐');
  } else {
    deactivateExtension();
    vscode.window.showInformationMessage('Bracket Lynx: (Deactivated ❌) globally - 🌐 ');
  }
}

export async function toggleCurrentEditor(): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('📝 No active editor to toggle');
    return;
  }

  const editorKey = getEditorKey(activeEditor);

  if (isEnabled) {
    // Global mode: toggle individual file in disabledEditors
    const isCurrentlyDisabled = disabledEditors.get(editorKey) || false;

    if (isCurrentlyDisabled) {
      disabledEditors.delete(editorKey);
      await saveDisabledFilesState();

      // Force update all decorators for this file
      setTimeout(() => {
        updateEditorDecorations(activeEditor);
      }, 100);

      vscode.window.showInformationMessage('📝 Bracket Lynx: Enabled for current file');
    } else {
      disabledEditors.set(editorKey, true);
      await saveDisabledFilesState();

      try {
        clearEditorDecorations(activeEditor);
        vscode.window.showInformationMessage('📝 Bracket Lynx: Disabled for current file');
      } catch (error) {
        console.error('Error deactivating file in global mode:', error);
        vscode.window.showErrorMessage('📝 Error deactivating Bracket Lynx for current file');
      }
    }
  } else {
    // Individual mode: toggle individual file in individuallyEnabledEditors
    const isCurrentlyEnabled = individuallyEnabledEditors.get(editorKey) || false;

    if (isCurrentlyEnabled) {
      individuallyEnabledEditors.delete(editorKey);
      await saveIndividuallyEnabledFilesState();

      try {
        clearEditorDecorations(activeEditor);
        vscode.window.showInformationMessage('📝 Bracket Lynx: Disabled for current file');
      } catch (error) {
        console.error('Error deactivating individual file:', error);
        vscode.window.showErrorMessage('📝 Error deactivating Bracket Lynx for current file');
      }
    } else {
      individuallyEnabledEditors.set(editorKey, true);
      await saveIndividuallyEnabledFilesState();

      // Activate decorations for this specific file
      try {
        console.log(`🔄 Activating individual file: ${activeEditor.document.fileName}`);

        // Force immediate update for main provider
        if (bracketLynxProvider) {
          if (bracketLynxProvider.updateDecoration) {
            bracketLynxProvider.updateDecoration(activeEditor);
          } else if (bracketLynxProvider.delayUpdateDecoration) {
            bracketLynxProvider.delayUpdateDecoration(activeEditor);
          }
        }

        // Force immediate update for all framework decorators
        updateEditorDecorations(activeEditor);

        // Multiple delayed updates to ensure all decorators respond
        setTimeout(() => {
          console.log(`🔄 Delayed update 1 for: ${activeEditor.document.fileName}`);
          updateEditorDecorations(activeEditor);
        }, DECORATION_UPDATE_DELAY_SHORT);

        setTimeout(() => {
          console.log(`🔄 Delayed update 2 for: ${activeEditor.document.fileName}`);
          updateEditorDecorations(activeEditor);
        }, DECORATION_UPDATE_DELAY_LONG);

        // Final update to ensure framework decorators are active
        setTimeout(() => {
          console.log(`🔄 Final update for: ${activeEditor.document.fileName}`);
          updateEditorDecorations(activeEditor);
        }, DECORATION_UPDATE_DELAY_LONG + 100);

        vscode.window.showInformationMessage('📝 Bracket Lynx: Enabled for current file (individual mode)');
      } catch (error) {
        console.error('Error activating individual file:', error);
        vscode.window.showErrorMessage('📝 Error activating Bracket Lynx for current file');
      }
    }
  }
}

export async function resetToDefault(): Promise<void> {
  try {
    // Show confirmation dialog with performance info
    const confirmation = await vscode.window.showWarningMessage(
      '♻️ Reset Bracket Lynx to factory defaults?\n\nThis will:\n• Reset all settings and clear files\n• Clear caches and free memory',
      { modal: true },
      'Reset to Default'
    );

    if (confirmation !== 'Reset to Default') {
      return;
    }

    // 📊 Get memory usage before reset for reporting
    let memoryBefore = 0;
    try {
      const { AdvancedCacheManager } = await import('../core/performance-cache.js');
      memoryBefore = AdvancedCacheManager.getInstance().getEstimatedMemoryUsage();
    } catch (error) {
      console.log('Could not get memory usage before reset:', error);
    }

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    // Reset all configuration values to their defaults
    await Promise.all([
      // Core toggle settings
      config.update(GLOBAL_ENABLED_KEY, true, vscode.ConfigurationTarget.Global),
      config.update(DISABLED_FILES_KEY, [], vscode.ConfigurationTarget.Global),
      config.update(INDIVIDUALLY_ENABLED_FILES_KEY, [], vscode.ConfigurationTarget.Global),

      // Visual settings
      config.update('prefix', '‹~ ', vscode.ConfigurationTarget.Global),
      config.update('color', '#515151', vscode.ConfigurationTarget.Global),
      config.update('fontStyle', 'italic', vscode.ConfigurationTarget.Global),
      config.update('unmatchBracketsPrefix', '❌ ', vscode.ConfigurationTarget.Global),

      // Behavior settings
      config.update('mode', 'auto', vscode.ConfigurationTarget.Global),
      config.update('debug', false, vscode.ConfigurationTarget.Global),

      // Performance settings
      config.update('maxBracketHeaderLength', 50, vscode.ConfigurationTarget.Global),
      config.update('minBracketScopeLines', 4, vscode.ConfigurationTarget.Global),
      config.update('enablePerformanceFilters', true, vscode.ConfigurationTarget.Global),
      config.update('maxFileSize', 10485760, vscode.ConfigurationTarget.Global),
      config.update('maxDecorationsPerFile', 500, vscode.ConfigurationTarget.Global),
    ]);

    // Reset internal state
    isEnabled = true;
    disabledEditors.clear();
    individuallyEnabledEditors.clear();

    // Reactivate extension with default settings
    reactivateExtension();

    // Reset color system to default
    const { resetColorToDefault } = await import('./colors.js');
    await resetColorToDefault();

    // 🚀 PERFORMANCE RESET - Clear all caches and optimize memory
    try {
      const { AdvancedCacheManager } = await import('../core/performance-cache.js');
      const { OptimizedBracketParser } = await import('../core/performance-parser.js');

      const cacheManager = AdvancedCacheManager.getInstance();
      const parser = OptimizedBracketParser.getInstance();

      // 🧹 Clear all performance caches
      cacheManager.clearAllCache();
      parser.clearAllCache();

      // 🔄 Force memory cleanup
      cacheManager.forceMemoryCleanup();
      cacheManager.forceGarbageCollection();

      // 📊 Restore normal memory mode
      cacheManager.restoreNormalMemoryMode();

      // 📊 Get memory usage after reset
      const memoryAfter = cacheManager.getEstimatedMemoryUsage();
      const memoryFreed = Math.max(0, memoryBefore - memoryAfter);

      // 🎉 Simple and clean success message
      const memoryInfo = memoryFreed > 0.1 ? ` (${memoryFreed.toFixed(1)}MB freed)` : '';

      vscode.window.showInformationMessage(`🎉 Bracket Lynx reset to defaults${memoryInfo}`);

      console.log(`🔄 Performance reset completed - Memory freed: ${memoryFreed.toFixed(1)}MB`);

    } catch (error) {
      console.error('Error during performance reset:', error);
      // Still show success message even if performance reset fails
      vscode.window.showInformationMessage('🎉 Bracket Lynx reset to defaults');
    }

  } catch (error) {
    console.error('Error resetting to default:', error);
    vscode.window.showErrorMessage('♻️ Error resetting Bracket Lynx to defaults. Please try again.');
  }
}

// ============================================================================
// PUBLIC API - STATE QUERIES
// ============================================================================
export function isExtensionEnabled(): boolean {
  // Extension is considered enabled if:
  // 1. Global mode is enabled, OR
  // 2. Individual mode with at least one enabled file
  return isEnabled || individuallyEnabledEditors.size > 0;
}

export function isEditorEnabled(editor: vscode.TextEditor): boolean {
  const editorKey = getEditorKey(editor);

  if (isEnabled) {
    return !disabledEditors.get(editorKey);
  } else {
    return individuallyEnabledEditors.get(editorKey) || false;
  }
}

export function isDocumentEnabled(document: vscode.TextDocument): boolean {
  const documentUri = document.uri.toString();

  if (isEnabled) {
    return !disabledEditors.get(documentUri);
  } else {
    return individuallyEnabledEditors.get(documentUri) || false;
  }
}

export function getCurrentState(): {
  isEnabled: boolean;
  isExtensionEnabled: boolean;
  activeEditorEnabled: boolean | null;
  disabledFilesCount: number;
  individuallyEnabledFilesCount: number;
} {
  const activeEditor = vscode.window.activeTextEditor;

  return {
    isEnabled,
    isExtensionEnabled: isExtensionEnabled(),
    activeEditorEnabled: activeEditor ? isEditorEnabled(activeEditor) : null,
    disabledFilesCount: disabledEditors.size,
    individuallyEnabledFilesCount: individuallyEnabledEditors.size,
  };
}

// ============================================================================
// PUBLIC API - PROVIDER SETUP
// ============================================================================
export function setBracketLynxProvider(provider: any): void {
  bracketLynxProvider = provider;
  setBracketLynxProviderForColors(provider);
  initializeColorSystem();
}

export function setAstroDecorator(decorator: any): void {
  universalDecorator = decorator;
  setAstroDecoratorForColors(decorator);
}

export function setVueDecorator(decorator: any): void {
  universalDecorator = decorator;
  setVueDecoratorForColors(decorator);
}

export function setSvelteDecorator(decorator: any): void {
  universalDecorator = decorator;
  setSvelteDecoratorForColors(decorator);
}

export function showBracketLynxMenu(): void {
  safeExecute(
    () => {
      vscode.window
        .showQuickPick(getMenuOptions(), {
          placeHolder: 'Choose Bracket Lynx action...',
        })
        .then(async (selected) => {
          if (!selected) {
            return;
          }

          await safeExecuteAsync(
            async () => {
              switch (selected.action) {
                case 'global':
                  await toggleBracketLynx();
                  break;
                case 'current':
                  await toggleCurrentEditor();
                  break;
                case 'color':
                  changeDecorationColor();
                  break;
                case 'reset-to-default':
                  await resetToDefault();
                  break;
                default:
                  logger.warn(`Unknown menu action: ${selected.action}`,
                    { action: selected.action }, LogCategory.TOGGLE);
              }
            },
            undefined,
            `Executing menu action: ${selected.action}`,
            LogCategory.TOGGLE
          );
        }, (error: any) => {
          logger.error('Failed to show Bracket Lynx menu', {
            error: error instanceof Error ? error.message : String(error)
          }, LogCategory.TOGGLE);
        });
    },
    undefined,
    'Showing Bracket Lynx menu',
    LogCategory.TOGGLE
  );
}

// ============================================================================
// PUBLIC API - CLEANUP
// ============================================================================
export async function cleanupClosedEditor(document: vscode.TextDocument): Promise<void> {
  const documentUri = document.uri.toString();
  let hasChanges = false;

  // Helper function to clean up legacy keys from a Map
  const cleanupLegacyKeys = (map: Map<string, boolean>): string[] => {
    const keysToDelete: string[] = [];
    for (const [key] of map) {
      if (key.startsWith(documentUri + ':') || key.includes(documentUri)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => map.delete(key));
    return keysToDelete;
  };

  // Clean up from both Maps
  if (disabledEditors.delete(documentUri)) {
    hasChanges = true;
  }
  if (individuallyEnabledEditors.delete(documentUri)) {
    hasChanges = true;
  }

  // Clean up legacy keys from both Maps
  const legacyDisabledKeys = cleanupLegacyKeys(disabledEditors);
  const legacyIndividualKeys = cleanupLegacyKeys(individuallyEnabledEditors);

  if (legacyDisabledKeys.length > 0 || legacyIndividualKeys.length > 0) {
    hasChanges = true;
  }

  if (hasChanges) {
    await saveDisabledFilesState();
    await saveIndividuallyEnabledFilesState();
  }
}

// ============================================================================
// INTERNAL HELPERS - EXTENSION CONTROL
// ============================================================================
function reactivateExtension(): void {
  try {
    console.log(`🔄 Reactivating extension - Global: ${isEnabled}, Individual files: ${individuallyEnabledEditors.size}`);

    // First, update main provider
    if (bracketLynxProvider) {
      if (bracketLynxProvider.updateAllDecoration) {
        bracketLynxProvider.updateAllDecoration();
        console.log(`🔄 Main provider reactivated`);
      }
    }

    // Clear universal decorator first to ensure clean state
    if (universalDecorator && universalDecorator.clearAllDecorations) {
      try {
        universalDecorator.clearAllDecorations();
        console.log(`🔄 Universal decorator cleared for reactivation`);
      } catch (error) {
        console.warn(`Toggle: Error clearing Universal decorator:`, error);
      }
    }

    // Small delay to ensure clears are complete
    setTimeout(() => {
      // Now update all editors based on their individual states
      vscode.window.visibleTextEditors.forEach(editor => {
        const editorEnabled = isEditorEnabled(editor);
        console.log(`🔄 Processing ${editor.document.fileName} - Enabled: ${editorEnabled}`);

        if (editorEnabled) {
          // Update main provider for this editor
          if (bracketLynxProvider && bracketLynxProvider.updateDecoration) {
            bracketLynxProvider.updateDecoration(editor);
          }

          // Update universal decorator for this editor
          if (universalDecorator && universalDecorator.updateDecorations) {
            try {
              universalDecorator.updateDecorations(editor);
              console.log(`🔄 Universal decorator updated for ${editor.document.fileName}`);
            } catch (error) {
              console.warn(`Toggle: Error updating Universal decorator:`, error);
            }
          }
        }
      });

      // Final pass to ensure all decorations are correct
      setTimeout(() => {
        vscode.window.visibleTextEditors.forEach(editor => {
          updateEditorDecorations(editor);
        });
        console.log(`🔄 Extension reactivation complete`);
      }, 100);
    }, 50);

  } catch (error) {
    console.error('Error reactivating extension:', error);
  }
}

function deactivateExtension(): void {
  try {
    // Clear main provider decorations
    if (bracketLynxProvider) {
      bracketLynxProvider.clearAllDecorations?.();
    }

    // Clear universal decorator
    if (universalDecorator) {
      try {
        if (universalDecorator.clearAllDecorations) {
          universalDecorator.clearAllDecorations();
        }
        console.log(`Toggle: Universal decorator deactivated`);
      } catch (error) {
        console.warn(`Toggle: Error deactivating Universal decorator:`, error);
      }
    }
  } catch (error) {
    console.error('Error deactivating extension:', error);
  }
}

function updateEditorDecorations(editor: vscode.TextEditor): void {
  const isEditorEnabledForThisFile = isEditorEnabled(editor);
  const editorKey = getEditorKey(editor);

  console.log(`🔄 Updating decorations for ${editor.document.fileName} - Enabled: ${isEditorEnabledForThisFile}`);
  console.log(`🔄 Global enabled: ${isEnabled}, Individual files: ${individuallyEnabledEditors.size}`);

  // Update main provider
  if (bracketLynxProvider) {
    if (isEditorEnabledForThisFile && bracketLynxProvider.updateDecoration) {
      bracketLynxProvider.updateDecoration(editor);
      console.log(`🔄 Main provider updated for ${editor.document.fileName}`);
    } else if (!isEditorEnabledForThisFile && bracketLynxProvider.clearEditorDecorations) {
      bracketLynxProvider.clearEditorDecorations(editor);
      console.log(`🔄 Main provider cleared for ${editor.document.fileName}`);
    }
  }

  // Update universal decorator for all frameworks
  if (universalDecorator) {
    try {
      if (isEditorEnabledForThisFile) {
        // Editor is enabled - update decorations
        if (universalDecorator.updateDecorations) {
          universalDecorator.updateDecorations(editor);
          console.log(`🔄 Universal decorator updated for ${editor.document.fileName}`);
        } else {
          console.warn(`🔄 Universal decorator missing updateDecorations method`);
        }
      } else {
        // Editor is disabled - clear decorations
        if (universalDecorator.clearDecorations) {
          universalDecorator.clearDecorations(editor);
          console.log(`🔄 Universal decorator cleared for ${editor.document.fileName}`);
        }
      }
    } catch (error) {
      console.error(`Toggle: Error updating Universal decorator for editor:`, error);
    }
  } else {
    console.warn(`🔄 Universal decorator not available`);
  }



  // Additional verification for individual mode
  if (!isEnabled && individuallyEnabledEditors.has(editorKey) && universalDecorator) {
    console.log(`🔄 Individual mode verification - forcing universal decorator update`);
    setTimeout(() => {
      if (universalDecorator && universalDecorator.updateDecorations) {
        try {
          universalDecorator.updateDecorations(editor);
          console.log(`🔄 Universal decorator force-updated (individual mode)`);
        } catch (error) {
          console.error(`🔄 Error force-updating Universal decorator:`, error);
        }
      }
    }, 50);
  }
}

export function clearEditorDecorations(editor: vscode.TextEditor): void {
  if (bracketLynxProvider && bracketLynxProvider.clearDecorations) {
    bracketLynxProvider.clearDecorations(editor);
  }
  if (universalDecorator && universalDecorator.clearDecorations) {
    universalDecorator.clearDecorations(editor);
  }
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================
export function getToggleDiagnostics(): {
  globalEnabled: boolean;
  activeEditor: string | null;
  currentFileStatus: string;
  disabledFilesCount: number;
  enabledFilesCount: number;
  decorators: {
    main: { available: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
    astro: { available: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
    vue: { available: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
    svelte: { available: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
  };
} {
  const activeEditor = vscode.window.activeTextEditor;
  const currentFileStatus = activeEditor ?
    (isEditorEnabled(activeEditor) ? 'Enabled' : 'Disabled') :
    'No active editor';

  return {
    globalEnabled: isEnabled,
    activeEditor: activeEditor ? activeEditor.document.fileName : null,
    currentFileStatus,
    disabledFilesCount: disabledEditors.size,
    enabledFilesCount: individuallyEnabledEditors.size,
    decorators: {
      main: {
        available: !!bracketLynxProvider,
        hasUpdateDecorations: !!(bracketLynxProvider?.delayUpdateDecoration),
        hasClearAll: !!(bracketLynxProvider?.clearAllDecorations)
      },
      astro: {
        available: !!universalDecorator,
        hasUpdateDecorations: !!(universalDecorator?.updateDecorations),
        hasClearAll: !!(universalDecorator?.clearAllDecorations)
      },
      vue: {
        available: !!universalDecorator,
        hasUpdateDecorations: !!(universalDecorator?.updateDecorations),
        hasClearAll: !!(universalDecorator?.clearAllDecorations)
      },
      svelte: {
        available: !!universalDecorator,
        hasUpdateDecorations: !!(universalDecorator?.updateDecorations),
        hasClearAll: !!(universalDecorator?.clearAllDecorations)
      }
    }
  };
}

export async function debugToggleSync(): Promise<void> {
  const diagnostics = getToggleDiagnostics();
  console.log('🔄 Toggle System Diagnostics:', diagnostics);

  if (!diagnostics.decorators.main.available) {
    console.warn('🔄 Main decorator not available - toggle may not work properly');
    return;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    console.warn('🔄 No active editor for toggle sync test');
    return;
  }

  console.log('🔄 Testing toggle synchronization...');

  try {
    // Test reactivation
    console.log('🔄 Testing reactivateExtension()...');
    reactivateExtension();

    // Test editor-specific updates
    console.log('🔄 Testing updateEditorDecorations()...');
    updateEditorDecorations(activeEditor);

    // Test clearing
    console.log('🔄 Testing clearEditorDecorations()...');
    clearEditorDecorations(activeEditor);

    // Restore decorations
    console.log('🔄 Restoring decorations...');
    updateEditorDecorations(activeEditor);

    console.log('🔄 ✅ Toggle sync test completed successfully');
  } catch (error) {
    console.error('🔄 ❌ Toggle sync test failed:', error);
  }
}

function getEditorKey(editor: vscode.TextEditor): string {
  return editor.document.uri.toString();
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

async function saveIndividuallyEnabledFilesState(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const individuallyEnabledFilesArray = Array.from(individuallyEnabledEditors.keys());
    await config.update(INDIVIDUALLY_ENABLED_FILES_KEY, individuallyEnabledFilesArray, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error('Failed to save individually enabled files state:', error);
  }
}

function loadIndividuallyEnabledFilesState(): void {
  try {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const individuallyEnabledFilesArray = config.get<string[]>(INDIVIDUALLY_ENABLED_FILES_KEY, []);

    individuallyEnabledEditors.clear();
    individuallyEnabledFilesArray.forEach(fileUri => {
      individuallyEnabledEditors.set(fileUri, true);
    });
  } catch (error) {
    console.error('Failed to load individually enabled files state:', error);
  }
}

// ============================================================================
// PUBLIC API - INITIALIZATION
// ============================================================================
export function initializePersistedState(): void {
  isEnabled = loadGlobalEnabledState();
  loadDisabledFilesState();
  loadIndividuallyEnabledFilesState();

  console.log(`🔄 Bracket Lynx: Initialized state - Global: ${isEnabled ? 'enabled' : 'disabled'}, Disabled files: ${disabledEditors.size}, Individually enabled: ${individuallyEnabledEditors.size}`);
}
