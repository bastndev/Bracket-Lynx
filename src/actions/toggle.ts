import * as vscode from 'vscode';

// ===== STATE MANAGEMENT =====
let isEnabled = true;
let bracketLynxProvider: any = undefined;
// Map to track per-file disabled state (keyed by document URI)
const disabledEditors = new Map<string, boolean>();

// ===== TOGGLE FUNCTIONS =====

/**
 * Show main menu with all toggle options
 */
export function showBracketLynxMenu(): void {
  const options = [
    {
      label: '🌐 Toggle Global',
      description: 'Activate/deactivate for all files',
      action: 'global',
    },
    {
      label: '📄 Toggle Current File',
      description: 'Activate/deactivate only current file',
      action: 'current',
    },
    {
      label: '♻️ Refresh',
      description: 'Update decorations for current file',
      action: 'refresh',
    },
    {
      label: '🔍 Debug Info',
      description: 'Show current toggle states for debugging',
      action: 'debug',
    },
  ];

  vscode.window
    .showQuickPick(options, {
      placeHolder: 'Choose Bracket Lynx action...',
    })
    .then((selected) => {
      if (!selected) {
        return;
      }

      switch (selected.action) {
        case 'global':
          toggleBracketLynx();
          break;
        case 'current':
          toggleCurrentEditor();
          break;
        case 'refresh':
          refreshBrackets();
          break;
        case 'debug':
          showDebugInfo();
          break;
      }
    });
}

/**
 * Toggle the entire Bracket Lynx extension on/off
 */
export function toggleBracketLynx(): void {
  isEnabled = !isEnabled;

  if (isEnabled) {
    // Reactivate: start processing current editor
    reactivateExtension();
    vscode.window.showInformationMessage('🌐 Bracket Lynx: Activated globally');
  } else {
    // Deactivate: stop processing and clear all decorations
    deactivateExtension();
    vscode.window.showInformationMessage(
      '🌐 Bracket Lynx: Deactivated globally'
    );
  }
}

/**
 * Check if the extension is currently enabled globally
 */
export function isExtensionEnabled(): boolean {
  return isEnabled;
}

/**
 * Check if the extension is enabled for a specific editor
 */
export function isEditorEnabled(editor: vscode.TextEditor): boolean {
  if (!isEnabled) {
    return false; // Global disabled overrides everything
  }

  const editorKey = getEditorKey(editor);
  return !disabledEditors.get(editorKey); // If not in map, it's enabled
}

/**
 * Check if a specific document is enabled (using document URI)
 */
export function isDocumentEnabled(document: vscode.TextDocument): boolean {
  if (!isEnabled) {
    return false; // Global disabled overrides everything
  }

  const documentUri = document.uri.toString();
  return !disabledEditors.get(documentUri); // If not in map, it's enabled
}

/**
 * Toggle Bracket Lynx for the current active editor only
 */
export function toggleCurrentEditor(): void {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('📄 No active editor to toggle');
    return;
  }

  const editorKey = getEditorKey(activeEditor);
  const isCurrentlyDisabled = disabledEditors.get(editorKey) || false;

  if (isCurrentlyDisabled) {
    // Enable this editor
    disabledEditors.delete(editorKey);
    if (bracketLynxProvider && isEnabled) {
      // Force update decorations for this editor
      bracketLynxProvider.forceUpdateEditor?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📄 Bracket Lynx: Enabled for current file'
    );
  } else {
    // Disable this editor
    disabledEditors.set(editorKey, true);
    if (bracketLynxProvider) {
      // Clear decorations for this editor
      bracketLynxProvider.clearEditorDecorations?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📄 Bracket Lynx: Disabled for current file'
    );
  }
}

/**
 * Refresh/update brackets for the current active editor
 */
export function refreshBrackets(): void {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('♻️ No active editor to refresh');
    return;
  }

  if (bracketLynxProvider && isEditorEnabled(activeEditor)) {
    // Clear cache and force update
    bracketLynxProvider.clearDecorationCache?.(activeEditor.document);
    bracketLynxProvider.forceUpdateEditor?.(activeEditor);
    vscode.window.showInformationMessage('♻️ Bracket Lynx: Refreshed');
  } else {
    const debugInfo = getDisabledEditorsDebugInfo();
    const editorUri = activeEditor.document.uri.toString();
    console.debug('Refresh blocked. Editor enabled:', isEditorEnabled(activeEditor), 'Extension enabled:', isExtensionEnabled());
    console.debug('Disabled editors:', debugInfo);
    console.debug('Current editor URI:', editorUri);
    vscode.window.showInformationMessage(
      '♻️ Bracket Lynx: Cannot refresh (disabled)'
    );
  }
}

/**
 * Set the bracket lens provider reference
 */
export function setBracketLynxProvider(provider: any): void {
  bracketLynxProvider = provider;
}

// ===== INTERNAL FUNCTIONS =====

function reactivateExtension(): void {
  if (bracketLynxProvider) {
    // Update all visible editors
    bracketLynxProvider.updateAllDecoration?.();
  }
}

function deactivateExtension(): void {
  if (bracketLynxProvider) {
    // Clear all decorations
    bracketLynxProvider.clearAllDecorations?.();
  }
}

/**
 * Generate a unique key for an editor (file path + view column)
 */
function getEditorKey(editor: vscode.TextEditor): string {
  return editor.document.uri.toString();
}

// ===== CLEANUP FUNCTIONS =====

/**
 * Clean up disabled editor state when a document is closed
 * NOTE: We DON'T remove the disabled state so it persists when the file is reopened
 */
export function cleanupClosedEditor(document: vscode.TextDocument): void {
  const documentUri = document.uri.toString();

  // DON'T remove the disabled state - we want it to persist
  // const removed = disabledEditors.delete(documentUri);

  // Only remove any legacy keys that included viewColumn (for backward compatibility)
  const legacyKeysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (key.startsWith(documentUri + ':')) {
      legacyKeysToDelete.push(key);
    }
  }
  legacyKeysToDelete.forEach((key) => disabledEditors.delete(key));

  // Optional: Log cleanup for debugging (remove in production)
  if (legacyKeysToDelete.length > 0) {
    console.debug(
      `Bracket Lynx: Cleaned up legacy keys for closed document (legacy keys removed: ${legacyKeysToDelete.length})`
    );
  }
}

/**
 * Clean up all disabled editor states for editors that are no longer visible
 * NOTE: We only clean up temporary/untitled files, not regular files
 * This allows disabled state to persist when files are closed and reopened
 */
export function cleanupAllClosedEditors(): void {
  const visibleUris = new Set<string>();

  // Collect URIs of all currently visible editors
  vscode.window.visibleTextEditors.forEach((editor) => {
    visibleUris.add(editor.document.uri.toString());
  });

  // Find keys that are temporary/untitled files and not visible
  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    // Only cleanup untitled/temporary files that are not visible
    if (!visibleUris.has(key) && (key.startsWith('untitled:') || key.includes('Untitled'))) {
      keysToDelete.push(key);
    }
  }

  // Remove the keys
  keysToDelete.forEach((key) => {
    disabledEditors.delete(key);
  });

  // Optional: Log cleanup for debugging (remove in production)
  if (keysToDelete.length > 0) {
    console.debug(
      `Bracket Lynx: Cleaned up ${keysToDelete.length} temporary/untitled file states`
    );
  }
}

/**
 * Get the current disabled state for debugging
 */
export function getDisabledEditorsDebugInfo(): { [key: string]: boolean } {
  const result: { [key: string]: boolean } = {};
  for (const [key, value] of disabledEditors) {
    result[key] = value;
  }
  return result;
}

/**
 * Show debug information about current toggle states
 */
function showDebugInfo(): void {
  const activeEditor = vscode.window.activeTextEditor;
  const debugInfo = getDisabledEditorsDebugInfo();
  
  let message = `🔍 Debug Info:\n`;
  message += `Global enabled: ${isExtensionEnabled()}\n`;
  
  if (activeEditor) {
    const editorUri = activeEditor.document.uri.toString();
    const fileName = activeEditor.document.fileName.split('/').pop() || 'Unknown';
    message += `Current file: ${fileName}\n`;
    message += `Current editor enabled: ${isEditorEnabled(activeEditor)}\n`;
    message += `Current document enabled: ${isDocumentEnabled(activeEditor.document)}\n`;
  } else {
    message += `No active editor\n`;
  }
  
  message += `\nDisabled files count: ${Object.keys(debugInfo).length}`;
  
  if (Object.keys(debugInfo).length > 0) {
    message += `\nDisabled files:\n`;
    Object.keys(debugInfo).forEach(uri => {
      const fileName = uri.split('/').pop() || uri;
      message += `- ${fileName}\n`;
    });
  }
  
  vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Clear all disabled states (useful for debugging)
 */
export function clearAllDisabledStates(): void {
  const count = disabledEditors.size;
  disabledEditors.clear();
  vscode.window.showInformationMessage(`🧹 Cleared ${count} disabled file states`);
  
  // Re-enable decorations for all visible editors
  if (bracketLynxProvider && isExtensionEnabled()) {
    bracketLynxProvider.updateAllDecoration?.();
  }
}
