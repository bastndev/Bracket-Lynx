import * as vscode from 'vscode';
import { BracketLensProvider } from './lens/lens';

// ===== EXTENSION ENTRY POINT =====

let bracketLensProvider: BracketLensProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  bracketLensProvider = new BracketLensProvider();
}

export function deactivate(): void {
  bracketLensProvider?.dispose();
}
