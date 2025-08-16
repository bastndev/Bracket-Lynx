import * as vscode from 'vscode';
import {
  setBracketLynxProviderForColors,
  initializeColorSystem,
  changeDecorationColor,
} from './colors';

// Configuration constants
const CONFIG_SECTION = 'bracketLynx';
const GLOBAL_ENABLED_KEY = 'globalEnabled';
const DISABLED_FILES_KEY = 'disabledFiles';
const INDIVIDUALLY_ENABLED_FILES_KEY = 'individuallyEnabledFiles';

// Timing constants
const DECORATION_UPDATE_DELAY_SHORT = 50;
const DECORATION_UPDATE_DELAY_LONG = 200;

// STATE VARIABLES
let isEnabled = true;
let bracketLynxProvider: any = undefined;
let astroDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();
const individuallyEnabledEditors = new Map<string, boolean>();

// MENU & UI HELPERS
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
    // Notification in bottom Right
    individuallyEnabledEditors.clear();
    await saveIndividuallyEnabledFilesState();
    reactivateExtension();
    vscode.window.showInformationMessage(
      'Bracket Lynx: (Activated ✅) globally - 🌐'
    );
  } else {
    deactivateExtension();
    vscode.window.showInformationMessage(
      'Bracket Lynx: (Deactivated ❌) globally - 🌐 '
    );
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
      vscode.window.showInformationMessage(
        '📝 Bracket Lynx: Enabled for current file'
      );
    } else {
      disabledEditors.set(editorKey, true);
      await saveDisabledFilesState();
      
      try {
        clearEditorDecorations(activeEditor);
        vscode.window.showInformationMessage(
          '📝 Bracket Lynx: Disabled for current file'
        );
      } catch (error) {
        console.error('Error deactivating file in global mode:', error);
        vscode.window.showErrorMessage(
          '📝 Error deactivating Bracket Lynx for current file'
        );
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
        vscode.window.showInformationMessage(
          '📝 Bracket Lynx: Disabled for current file'
        );
      } catch (error) {
        console.error('Error deactivating individual file:', error);
        vscode.window.showErrorMessage(
          '📝 Error deactivating Bracket Lynx for current file'
        );
      }
    } else {
      individuallyEnabledEditors.set(editorKey, true);
      await saveIndividuallyEnabledFilesState();
      
      // Activate decorations for this specific file
      try {
        if (bracketLynxProvider) {
          if (bracketLynxProvider.updateDecoration) {
            bracketLynxProvider.updateDecoration(activeEditor);
          } else if (bracketLynxProvider.delayUpdateDecoration) {
            bracketLynxProvider.delayUpdateDecoration(activeEditor);
          }
        }
        
        // Initial update
        updateEditorDecorations(activeEditor);
        
        // Force multiple updates to ensure decorations appear
        setTimeout(() => updateEditorDecorations(activeEditor), DECORATION_UPDATE_DELAY_SHORT);
        setTimeout(() => updateEditorDecorations(activeEditor), DECORATION_UPDATE_DELAY_LONG);
        
        vscode.window.showInformationMessage(
          '📝 Bracket Lynx: Enabled for current file (individual mode)'
        );
      } catch (error) {
        console.error('Error activating individual file:', error);
        vscode.window.showErrorMessage(
          '📝 Error activating Bracket Lynx for current file'
        );
      }
    }
  }
}

export async function resetToDefault(): Promise<void> {
  try {
    // Show confirmation dialog
    const confirmation = await vscode.window.showWarningMessage(
      '♻️ Reset Bracket Lynx to factory defaults?\n\nThis will:\n• Enable globally\n• Clear all file-specific settings\n• Reset color to default (#515151)\n• Reset all other settings to defaults',
      { modal: true },
      'Reset to Default'
    );

    if (confirmation !== 'Reset to Default') {
      return;
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

    vscode.window.showInformationMessage(
      '♻️ Bracket Lynx: Successfully reset to factory defaults! 🎉'
    );

  } catch (error) {
    console.error('Error resetting to default:', error);
    vscode.window.showErrorMessage(
      '♻️ Error resetting Bracket Lynx to defaults. Please try again.'
    );
  }
}

// ============================================================================
// PUBLIC API - STATE QUERIES
// ============================================================================

export function isExtensionEnabled(): boolean {
  // Extension is enabled if either:
  // 1. Global mode is enabled, OR
  // 2. Individual mode is enabled and there are individually enabled files
  return isEnabled || (!isEnabled && individuallyEnabledEditors.size > 0);
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

/**
 * Get current extension state for debugging
 */
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
  astroDecorator = decorator;
}

export function showBracketLynxMenu(): void {
  vscode.window
    .showQuickPick(getMenuOptions(), {
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
        case 'color':
          changeDecorationColor();
          break;
        case 'reset-to-default':
          await resetToDefault();
          break;
      }
    });
}

// ============================================================================
// PUBLIC API - CLEANUP
// ============================================================================

/**
 * Clean up editor references when a document is closed
 */
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
    if (bracketLynxProvider) {
      if (bracketLynxProvider.updateAllDecoration) {
        bracketLynxProvider.updateAllDecoration();
      }
    }
    
    // Force update for all visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
      if (isEditorEnabled(editor)) {
        updateEditorDecorations(editor);
      }
    });
  } catch (error) {
    console.error('Error reactivating extension:', error);
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

/**
 * Helper function to update decorations for a specific editor
 */
function updateEditorDecorations(editor: vscode.TextEditor): void {
  if (bracketLynxProvider && bracketLynxProvider.updateDecoration) {
    bracketLynxProvider.updateDecoration(editor);
  }
  if (astroDecorator && astroDecorator.updateDecorations) {
    astroDecorator.updateDecorations(editor);
  }
}

/**
 * Helper function to clear decorations for a specific editor
 */
function clearEditorDecorations(editor: vscode.TextEditor): void {
  if (bracketLynxProvider && bracketLynxProvider.clearEditorDecorations) {
    bracketLynxProvider.clearEditorDecorations(editor);
  }
  if (astroDecorator && astroDecorator.clearDecorations) {
    astroDecorator.clearDecorations(editor);
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

/**
 * Initialize state from persisted configuration
 * This should be called when the extension activates
 */
export function initializePersistedState(): void {
  isEnabled = loadGlobalEnabledState();
  loadDisabledFilesState();
  loadIndividuallyEnabledFilesState();
  
  console.log(`🔄 Bracket Lynx: Initialized state - Global: ${isEnabled ? 'enabled' : 'disabled'}, Disabled files: ${disabledEditors.size}, Individually enabled: ${individuallyEnabledEditors.size}`);
}
