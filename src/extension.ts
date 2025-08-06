import * as vscode from 'vscode';
import { BracketLensProvider } from './lens/lens';
import { toggleBracketLens, setBracketLensProvider } from './actions/toggle';

// ===== EXTENSION ENTRY POINT =====

let bracketLensProvider: BracketLensProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize [lens]
  bracketLensProvider = new BracketLensProvider();
  
  // Initialize [toggle] functionality
  setBracketLensProvider(bracketLensProvider);
  
  // Register commands
  const toggleCommand = vscode.commands.registerCommand(
    'bracketLens.toggle',
    toggleBracketLens
  );

  context.subscriptions.push(toggleCommand);
}

export function deactivate(): void {
  bracketLensProvider?.dispose();
}
