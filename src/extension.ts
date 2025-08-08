import * as vscode from 'vscode';
import { BracketLensProvider } from './lens/lens';
import { showBracketLensMenu, setBracketLensProvider, cleanupClosedEditor } from './actions/toggle';

// ===== EXTENSION ENTRY POINT =====

let bracketLensProvider: BracketLensProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize the bracket lens provider
  bracketLensProvider = new BracketLensProvider();
  
  // Set provider reference for toggle functionality
  setBracketLensProvider(bracketLensProvider);
  
  // Register main menu command
  const mainMenuCommand = vscode.commands.registerCommand(
    'bracketLens.menu',
    showBracketLensMenu
  );
  
  // Register cleanup event listeners
  const onDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument((document) => {
    cleanupClosedEditor(document);
  });
  
  // Add to subscriptions for proper cleanup
  context.subscriptions.push(
    mainMenuCommand,
  onDidCloseTextDocument
  );
}

export function deactivate(): void {
  bracketLensProvider?.dispose();
}
