import * as vscode from 'vscode';

// ===== STATE MANAGEMENT =====
let isEnabled = true;
let bracketLensProvider: any = undefined;
// Map to track per-file disabled state (keyed by document URI)
const disabledEditors = new Map<string, boolean>();

// ===== TOGGLE FUNCTIONS =====

/**
 * Show main menu with all toggle options
 */
export function showBracketLensMenu(): void {
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
  ];

  vscode.window
    .showQuickPick(options, {
      placeHolder: 'Choose Bracket Lens action...',
    })
    .then((selected) => {
      if (!selected) {
        return;
      }

      switch (selected.action) {
        case 'global':
          toggleBracketLens();
          break;
        case 'current':
          toggleCurrentEditor();
          break;
        case 'refresh':
          refreshBrackets();
          break;
      }
    });
}

/**
 * Toggle the entire Bracket Lens extension on/off
 */
export function toggleBracketLens(): void {
  isEnabled = !isEnabled;

  if (isEnabled) {
    // Reactivate: start processing current editor
    reactivateExtension();
    vscode.window.showInformationMessage('🌐 Bracket Lens: Activated globally');
  } else {
    // Deactivate: stop processing and clear all decorations
    deactivateExtension();
    vscode.window.showInformationMessage(
      '🌐 Bracket Lens: Deactivated globally'
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
 * Toggle Bracket Lens for the current active editor only
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
    if (bracketLensProvider && isEnabled) {
      bracketLensProvider.setEditorMuted?.(activeEditor, false);
      bracketLensProvider.delayUpdateDecoration?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📄 Bracket Lens: Enabled for current file'
    );
  } else {
    // Disable this editor
    disabledEditors.set(editorKey, true);
    if (bracketLensProvider) {
      bracketLensProvider.setEditorMuted?.(activeEditor, true);
      bracketLensProvider.clearDecorations?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📄 Bracket Lens: Disabled for current file'
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

  if (bracketLensProvider && isEditorEnabled(activeEditor)) {
    // Clear cache and force update
    bracketLensProvider.clearDecorationCache?.(activeEditor.document);
    bracketLensProvider.delayUpdateDecoration?.(activeEditor);
    vscode.window.showInformationMessage('♻️ Bracket Lens: Refreshed');
  } else {
    vscode.window.showInformationMessage(
      '♻️ Bracket Lens: Cannot refresh (disabled)'
    );
  }
}

/**
 * Set the bracket lens provider reference
 */
export function setBracketLensProvider(provider: any): void {
  bracketLensProvider = provider;
}

// ===== INTERNAL FUNCTIONS =====

function reactivateExtension(): void {
  if (bracketLensProvider) {
    // Set global mute to false
    bracketLensProvider.setMutedAll?.(false);
  }
}

function deactivateExtension(): void {
  if (bracketLensProvider) {
    // Set global mute to true (this will also clear decorations)
    bracketLensProvider.setMutedAll?.(true);
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
 */
export function cleanupClosedEditor(document: vscode.TextDocument): void {
  const documentUri = document.uri.toString();

  // Remove per-file key
  const removed = disabledEditors.delete(documentUri);

  // Backward-compat: also remove any legacy keys that included viewColumn
  const legacyKeysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (key.startsWith(documentUri + ':')) {
      legacyKeysToDelete.push(key);
    }
  }
  legacyKeysToDelete.forEach((key) => disabledEditors.delete(key));

  // Optional: Log cleanup for debugging (remove in production)
  if (removed || legacyKeysToDelete.length > 0) {
    console.debug(
      `Bracket Lens: Cleaned up disabled state for closed document (legacy keys removed: ${legacyKeysToDelete.length})`
    );
  }
}

/**
 * Clean up all disabled editor states for editors that are no longer visible
 */
export function cleanupAllClosedEditors(): void {
  const visibleUris = new Set<string>();

  // Collect URIs of all currently visible editors
  vscode.window.visibleTextEditors.forEach((editor) => {
    visibleUris.add(editor.document.uri.toString());
  });

  // Find keys that are no longer visible
  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (!visibleUris.has(key)) {
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
      `Bracket Lens: Cleaned up ${keysToDelete.length} stale editor states`
    );
  }
}
