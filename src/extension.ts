import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import { showBracketLynxMenu, setBracketLynxProvider, cleanupClosedEditor } from './actions/toggle';

export let extensionContext: vscode.ExtensionContext;

export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;
    
    setBracketLynxProvider(BracketLynx);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('bracketLynx.menu', showBracketLynxMenu)
    );

    const handleConfigurationChange = async (event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('bracketLynx')) {
            BracketLynx.onDidChangeConfiguration();
            const { onConfigurationChanged } = await import('./actions/colors.js');
            await onConfigurationChanged();
        }
    };

    const handleSettingsFileSave = async (document: vscode.TextDocument) => {
        if (document.fileName.includes('.vscode/settings.json') || 
            document.fileName.includes('settings.json')) {
            const { forceSyncColorWithConfiguration } = await import('./actions/colors.js');
            await forceSyncColorWithConfiguration();
        }
    };

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(handleConfigurationChange),
        vscode.workspace.onDidChangeWorkspaceFolders(() => BracketLynx.onDidChangeConfiguration()),
        vscode.workspace.onDidChangeTextDocument(event => BracketLynx.onDidChangeTextDocument(event.document)),
        vscode.workspace.onDidOpenTextDocument((document) => BracketLynx.onDidOpenTextDocument(document)),
        vscode.workspace.onDidSaveTextDocument((document) => BracketLynx.onDidSaveTextDocument(document)),
        vscode.workspace.onDidCloseTextDocument((document) => {
            BracketLynx.onDidChangeTextDocument(document);
            cleanupClosedEditor(document);
        }),
        vscode.window.onDidChangeActiveTextEditor(() => BracketLynx.onDidChangeActiveTextEditor()),
        vscode.workspace.onDidSaveTextDocument(handleSettingsFileSave)
    );
    
    vscode.window.visibleTextEditors.forEach(editor => 
        BracketLynx.delayUpdateDecoration(editor)
    );
};

export const deactivate = () => {
    // Cleanup handled automatically by VSCode
};
