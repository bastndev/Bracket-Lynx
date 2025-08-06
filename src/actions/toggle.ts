import * as vscode from 'vscode';

// ===== STATE MANAGEMENT =====
let isEnabled = true;
let bracketLensProvider: any = undefined;

// ===== TOGGLE FUNCTIONS =====

/**
 * Toggle the entire Bracket Lens extension on/off
 */
export function toggleBracketLens(): void {
  isEnabled = !isEnabled;
  
  if (isEnabled) {
    // Reactivate: start processing current editor
    reactivateExtension();
    vscode.window.showInformationMessage('Bracket Lens: Activated');
  } else {
    // Deactivate: stop processing and clear all decorations
    deactivateExtension();
    vscode.window.showInformationMessage('Bracket Lens: Deactivated');
  }
}

/**
 * Check if the extension is currently enabled
 */
export function isExtensionEnabled(): boolean {
  return isEnabled;
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