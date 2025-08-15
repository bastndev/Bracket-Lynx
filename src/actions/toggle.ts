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
const INDIVIDUALLY_ENABLED_FILES_KEY = 'individuallyEnabledFiles';

// Quick Pick Options
function getMenuOptions(): any[] {
  const globalStatus = isEnabled ? '🟢' : '🔴';
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
  ];
}

function getCurrentFileStatus(): string {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return '❓ No file';
  }
  
  const isCurrentEnabled = isEditorEnabled(activeEditor);
  return isCurrentEnabled ? '🟢' : '🔴';
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

let isEnabled = true;
let bracketLynxProvider: any = undefined;
let astroDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();
const individuallyEnabledEditors = new Map<string, boolean>();

export async function toggleBracketLynx(): Promise<void> {
  isEnabled = !isEnabled;
  await saveGlobalEnabledState(isEnabled);

  if (isEnabled) {
    // When activating globally, clear individually enabled files and reactivate all except disabled ones
    individuallyEnabledEditors.clear();
    await saveIndividuallyEnabledFilesState();
    reactivateExtension();
    vscode.window.showInformationMessage(
      '🌐 Bracket Lynx: Activated globally (all files enabled except disabled ones)'
    );
  } else {
    deactivateExtension();
    vscode.window.showInformationMessage(
      '🌐 Bracket Lynx: Deactivated globally'
    );
  }
}

export function isExtensionEnabled(): boolean {
  // Extension is enabled if either:
  // 1. Global mode is enabled, OR
  // 2. Individual mode is enabled and there are individually enabled files
  return isEnabled || (!isEnabled && individuallyEnabledEditors.size > 0);
}

export function isEditorEnabled(editor: vscode.TextEditor): boolean {
  const editorKey = getEditorKey(editor);
  
  if (isEnabled) {
    // Global mode: enabled for all files except those in disabledEditors
    return !disabledEditors.get(editorKey);
  } else {
    // Individual mode: only enabled for files in individuallyEnabledEditors
    return individuallyEnabledEditors.get(editorKey) || false;
  }
}

export function isDocumentEnabled(document: vscode.TextDocument): boolean {
  const documentUri = document.uri.toString();
  
  if (isEnabled) {
    // Global mode: enabled for all files except those in disabledEditors
    return !disabledEditors.get(documentUri);
  } else {
    // Individual mode: only enabled for files in individuallyEnabledEditors
    return individuallyEnabledEditors.get(documentUri) || false;
  }
}

// Debug function to check current state
export function getCurrentState(): any {
  const activeEditor = vscode.window.activeTextEditor;
  const activeEditorKey = activeEditor ? getEditorKey(activeEditor) : null;
  
  return {
    isEnabled,
    isExtensionEnabled: isExtensionEnabled(),
    activeEditor: activeEditor ? {
      uri: activeEditor.document.uri.toString(),
      languageId: activeEditor.document.languageId,
      fileName: activeEditor.document.fileName,
      key: activeEditorKey
    } : null,
    isActiveEditorEnabled: activeEditor ? isEditorEnabled(activeEditor) : null,
    isActiveEditorInDisabledList: activeEditorKey ? disabledEditors.has(activeEditorKey) : null,
    isActiveEditorInIndividualList: activeEditorKey ? individuallyEnabledEditors.has(activeEditorKey) : null,
    disabledEditors: Array.from(disabledEditors.keys()),
    individuallyEnabledEditors: Array.from(individuallyEnabledEditors.keys()),
    hasBracketProvider: !!bracketLynxProvider,
    hasAstroDecorator: !!astroDecorator,
    bracketProviderMethods: bracketLynxProvider ? {
      hasUpdateDecoration: !!bracketLynxProvider.updateDecoration,
      hasDelayUpdateDecoration: !!bracketLynxProvider.delayUpdateDecoration,
      hasClearEditorDecorations: !!bracketLynxProvider.clearEditorDecorations
    } : null
  };
}

export async function toggleCurrentEditor(): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('📝 No active editor to toggle');
    return;
  }

  const editorKey = getEditorKey(activeEditor);
  
  // Debug logging
  console.log(`🔄 Toggle Current Editor:`, {
    editorKey,
    isEnabled,
    isCurrentlyEnabled: isEditorEnabled(activeEditor),
    disabledEditorsSize: disabledEditors.size,
    individuallyEnabledEditorsSize: individuallyEnabledEditors.size,
    hasBracketProvider: !!bracketLynxProvider,
    hasAstroDecorator: !!astroDecorator
  });
  
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
        if (bracketLynxProvider && bracketLynxProvider.clearEditorDecorations) {
          bracketLynxProvider.clearEditorDecorations(activeEditor);
        }
        if (astroDecorator && astroDecorator.clearDecorations) {
          astroDecorator.clearDecorations(activeEditor);
        }
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
        if (bracketLynxProvider && bracketLynxProvider.clearEditorDecorations) {
          bracketLynxProvider.clearEditorDecorations(activeEditor);
        }
        if (astroDecorator && astroDecorator.clearDecorations) {
          astroDecorator.clearDecorations(activeEditor);
        }
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
        // Force immediate update for bracket decorations
        if (bracketLynxProvider) {
          if (bracketLynxProvider.updateDecoration) {
            bracketLynxProvider.updateDecoration(activeEditor);
          } else if (bracketLynxProvider.delayUpdateDecoration) {
            bracketLynxProvider.delayUpdateDecoration(activeEditor);
          }
        }
        
        // Force immediate update for astro decorations
        if (astroDecorator && astroDecorator.updateDecorations) {
          astroDecorator.updateDecorations(activeEditor);
        }
        
        // Force multiple updates to ensure decorations appear
        setTimeout(() => {
          if (bracketLynxProvider && bracketLynxProvider.updateDecoration) {
            bracketLynxProvider.updateDecoration(activeEditor);
          }
          if (astroDecorator && astroDecorator.updateDecorations) {
            astroDecorator.updateDecorations(activeEditor);
          }
        }, 50);
        
        setTimeout(() => {
          if (bracketLynxProvider && bracketLynxProvider.updateDecoration) {
            bracketLynxProvider.updateDecoration(activeEditor);
          }
          if (astroDecorator && astroDecorator.updateDecorations) {
            astroDecorator.updateDecorations(activeEditor);
          }
        }, 200);
        
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
      }
    });
}

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
        if (bracketLynxProvider && bracketLynxProvider.updateDecoration) {
          bracketLynxProvider.updateDecoration(editor);
        }
        if (astroDecorator && astroDecorator.updateDecorations) {
          astroDecorator.updateDecorations(editor);
        }
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

function getEditorKey(editor: vscode.TextEditor): string {
  return editor.document.uri.toString();
}

export async function cleanupClosedEditor(document: vscode.TextDocument): Promise<void> {
  const documentUri = document.uri.toString();
  let hasChanges = false;

  // Clean up from disabledEditors
  if (disabledEditors.delete(documentUri)) {
    hasChanges = true;
  }

  // Clean up from individuallyEnabledEditors
  if (individuallyEnabledEditors.delete(documentUri)) {
    hasChanges = true;
  }

  // Clean up legacy keys from disabledEditors
  const legacyDisabledKeysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (key.startsWith(documentUri + ':') || key.includes(documentUri)) {
      legacyDisabledKeysToDelete.push(key);
    }
  }
  
  if (legacyDisabledKeysToDelete.length > 0) {
    legacyDisabledKeysToDelete.forEach((key) => disabledEditors.delete(key));
    hasChanges = true;
  }

  // Clean up legacy keys from individuallyEnabledEditors
  const legacyIndividualKeysToDelete: string[] = [];
  for (const [key] of individuallyEnabledEditors) {
    if (key.startsWith(documentUri + ':') || key.includes(documentUri)) {
      legacyIndividualKeysToDelete.push(key);
    }
  }
  
  if (legacyIndividualKeysToDelete.length > 0) {
    legacyIndividualKeysToDelete.forEach((key) => individuallyEnabledEditors.delete(key));
    hasChanges = true;
  }

  if (hasChanges) {
    await saveDisabledFilesState();
    await saveIndividuallyEnabledFilesState();
  }
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