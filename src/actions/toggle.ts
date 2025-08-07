import * as vscode from 'vscode';

// ===== STATE MANAGEMENT =====
let isEnabled = true;
let bracketLensProvider: any = undefined;
// Map to track per-editor disabled state
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
      action: 'global'
    },
    {
      label: '📄 Toggle Current File',
      description: 'Activate/deactivate only current file',
      action: 'current'
    },
    {
      label: '♻️ Refresh',
      description: 'Update decorations for current file',
      action: 'refresh'
    }
  ];

  vscode.window.showQuickPick(options, {
    placeHolder: 'Choose Bracket Lens action...'
  }).then(selected => {
    if (!selected) {return;}
    
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
    vscode.window.showInformationMessage('🌐 Bracket Lens: Deactivated globally');
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
      bracketLensProvider.forceUpdate(activeEditor);
    }
    vscode.window.showInformationMessage('📄 Bracket Lens: Enabled for current file');
  } else {
    // Disable this editor
    disabledEditors.set(editorKey, true);
    if (bracketLensProvider) {
      bracketLensProvider.clearDecorations(activeEditor);
    }
    vscode.window.showInformationMessage('📄 Bracket Lens: Disabled for current file');
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
    bracketLensProvider.forceUpdate(activeEditor);
    vscode.window.showInformationMessage('♻️ Bracket Lens: Refreshed');
  } else {
    vscode.window.showInformationMessage('♻️ Bracket Lens: Cannot refresh (disabled)');
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
    // Trigger immediate update for current active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      // Force update decorations
      bracketLensProvider.forceUpdate?.(activeEditor);
    }
  }
}

function deactivateExtension(): void {
  if (bracketLensProvider) {
    // Clear all decorations from all visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
      bracketLensProvider.clearDecorations?.(editor);
    });
  }
}

/**
 * Generate a unique key for an editor (file path + view column)
 */
function getEditorKey(editor: vscode.TextEditor): string {
  return `${editor.document.uri.toString()}:${editor.viewColumn || 1}`;
}