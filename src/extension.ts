import * as vscode from 'vscode';
import { BracketLens } from './lens/lens';
import { showBracketLensMenu, setBracketLensProvider, cleanupClosedEditor } from './actions/toggle';

// ============================================================================
// EXTENSION BRIDGE - Simple interface to the BracketLens functionality
// ============================================================================

export let extensionContext: vscode.ExtensionContext;



// ============================================================================
// EXTENSION ACTIVATION
// ============================================================================

export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;
    
    // Set the bracket lens provider for the toggle system
    setBracketLensProvider(BracketLens);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bracketLens.menu',
            showBracketLensMenu
        )
    );

    // Register event listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(
            async (event) => {
                if (event.affectsConfiguration('bracketLens')) {
                    BracketLens.onDidChangeConfiguration();
                }
            }
        ),
        vscode.workspace.onDidChangeWorkspaceFolders(() => BracketLens.onDidChangeConfiguration()),
        vscode.workspace.onDidChangeTextDocument(event => BracketLens.onDidChangeTextDocument(event.document)),
        vscode.workspace.onDidOpenTextDocument((document) => BracketLens.onDidOpenTextDocument(document)),
        vscode.workspace.onDidSaveTextDocument((document) => BracketLens.onDidSaveTextDocument(document)),
        vscode.workspace.onDidCloseTextDocument((document) => {
            BracketLens.onDidChangeTextDocument(document);
            cleanupClosedEditor(document);
        }),
        vscode.window.onDidChangeActiveTextEditor(() => BracketLens.onDidChangeActiveTextEditor())
    );
    
    // Initialize decorations for visible editors
    vscode.window.visibleTextEditors.forEach(editor => 
        BracketLens.delayUpdateDecoration(editor)
    );
};

export const deactivate = () => {
    // Extension cleanup is handled automatically by VSCode
};
