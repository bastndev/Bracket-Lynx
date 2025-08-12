import * as vscode from 'vscode';

let isEnabled = true;
let bracketLynxProvider: any = undefined;
let astroDecorator: any = undefined;
const disabledEditors = new Map<string, boolean>();

export function toggleBracketLynx(): void {
  isEnabled = !isEnabled;

  if (isEnabled) {
    disabledEditors.clear();
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

export function toggleCurrentEditor(): void {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('📄 No active editor to toggle');
    return;
  }

  if (!isEnabled) {
    vscode.window.showWarningMessage(
      '📄 Cannot toggle individual file: Extension is disabled globally. Enable globally first.'
    );
    return;
  }

  const editorKey = getEditorKey(activeEditor);
  const isCurrentlyDisabled = disabledEditors.get(editorKey) || false;

  if (isCurrentlyDisabled) {
    disabledEditors.delete(editorKey);
    if (bracketLynxProvider) {
      bracketLynxProvider.forceUpdateEditor?.(activeEditor);
    }
    // Update Astro decorations if it's an Astro file
    if (astroDecorator) {
      astroDecorator.forceUpdateEditor?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📄 Bracket Lynx: Enabled for current file'
    );
  } else {
    disabledEditors.set(editorKey, true);
    if (bracketLynxProvider) {
      bracketLynxProvider.clearEditorDecorations?.(activeEditor);
    }
    // Clear Astro decorations if it's an Astro file
    if (astroDecorator) {
      astroDecorator.clearDecorations?.(activeEditor);
    }
    vscode.window.showInformationMessage(
      '📄 Bracket Lynx: Disabled for current file'
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
    const { forceSyncColorWithConfiguration } = require('./colors');
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

  const {
    setBracketLynxProviderForColors,
    initializeColorSystem,
  } = require('./colors');
  setBracketLynxProviderForColors(provider);
  initializeColorSystem();
}

export function setAstroDecorator(decorator: any): void {
  astroDecorator = decorator;
}

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
        case 'color':
          const { changeDecorationColor } = require('./colors');
          changeDecorationColor();
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
 */
export function cleanupClosedEditor(document: vscode.TextDocument): void {
  const documentUri = document.uri.toString();

  const legacyKeysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (key.startsWith(documentUri + ':')) {
      legacyKeysToDelete.push(key);
    }
  }
  legacyKeysToDelete.forEach((key) => disabledEditors.delete(key));
}

/**
 * Clean up temporary/untitled files that are no longer visible
 */
export function cleanupAllClosedEditors(): void {
  const visibleUris = new Set<string>();

  vscode.window.visibleTextEditors.forEach((editor) => {
    visibleUris.add(editor.document.uri.toString());
  });

  const keysToDelete: string[] = [];
  for (const [key] of disabledEditors) {
    if (
      !visibleUris.has(key) &&
      (key.startsWith('untitled:') || key.includes('Untitled'))
    ) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    disabledEditors.delete(key);
  });
}
