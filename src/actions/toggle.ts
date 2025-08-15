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
    label: '♻️ Refresh',
    description: 'Update decorations for current file',
    action: 'refresh',
  },
];

let isEnabled = true;
let bracketLynxProvider: any = undefined;
let astroDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();

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
}

export function setAstroDecorator(decorator: any): void {
  astroDecorator = decorator;
}

export function showBracketLynxMenu(): void {
  vscode.window
    .showQuickPick(MENU_OPTIONS, {
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