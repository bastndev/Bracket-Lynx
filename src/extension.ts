import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import { showBracketLynxMenu, setBracketLynxProvider, cleanupClosedEditor } from './actions/toggle';

// ============================================================================
// EXTENSION BRIDGE - Simple interface to the BracketLynx functionality
// ============================================================================

export let extensionContext: vscode.ExtensionContext;



// ============================================================================
// EXTENSION ACTIVATION
// ============================================================================

export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;
    
    // Set the bracket lynx provider for the toggle system
    setBracketLynxProvider(BracketLynx);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bracketLynx.menu',
            showBracketLynxMenu
        )
    );

    // Register event listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(
            async (event) => {
                if (event.affectsConfiguration('bracketLynx')) {
                    BracketLynx.onDidChangeConfiguration();
                }
            }
        ),
        vscode.workspace.onDidChangeWorkspaceFolders(() => BracketLynx.onDidChangeConfiguration()),
        vscode.workspace.onDidChangeTextDocument(event => BracketLynx.onDidChangeTextDocument(event.document)),
        vscode.workspace.onDidOpenTextDocument((document) => BracketLynx.onDidOpenTextDocument(document)),
        vscode.workspace.onDidSaveTextDocument((document) => BracketLynx.onDidSaveTextDocument(document)),
        vscode.workspace.onDidCloseTextDocument((document) => {
            BracketLynx.onDidChangeTextDocument(document);
            cleanupClosedEditor(document);
        }),
        vscode.window.onDidChangeActiveTextEditor(() => BracketLynx.onDidChangeActiveTextEditor())
    );
    
    // Initialize decorations for visible editors
    vscode.window.visibleTextEditors.forEach(editor => 
        BracketLynx.delayUpdateDecoration(editor)
    );
};

export const deactivate = () => {
    // Extension cleanup is handled automatically by VSCode
};
