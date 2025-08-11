import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import { showBracketLynxMenu, setBracketLynxProvider, setAstroDecorator, cleanupClosedEditor } from './actions/toggle';
import { AstroDecorator } from './actions/astrojs-decorator';
import { setAstroDecoratorForColors } from './actions/colors';

export let extensionContext: vscode.ExtensionContext;

export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;
    
    setBracketLynxProvider(BracketLynx);
    setAstroDecorator(AstroDecorator);
    setAstroDecoratorForColors(AstroDecorator);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('bracketLynx.menu', showBracketLynxMenu),
        vscode.commands.registerCommand('bracketLynx.restoreColor', async () => {
            const { restoreColorFromGlobal } = await import('./actions/colors.js');
            await restoreColorFromGlobal();
        })
    );

    const handleConfigurationChange = async (event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('bracketLynx')) {
            BracketLynx.onDidChangeConfiguration();
            AstroDecorator.onDidChangeConfiguration();
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

    // Helper function to update Astro decorations
    const updateAstroDecorations = (editor?: vscode.TextEditor) => {
        if (editor && (editor.document.fileName.endsWith('.astro') || editor.document.languageId === 'astro')) {
            AstroDecorator.updateAstroDecorations(editor);
        }
    };

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(handleConfigurationChange),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            BracketLynx.onDidChangeConfiguration();
            AstroDecorator.onDidChangeConfiguration();
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            BracketLynx.onDidChangeTextDocument(event.document);
            // Update Astro decorations on text changes
            const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
            if (editor) {
                updateAstroDecorations(editor);
            }
        }),
        vscode.workspace.onDidOpenTextDocument((document) => {
            BracketLynx.onDidOpenTextDocument(document);
            // Update Astro decorations when opening files
            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (editor) {
                updateAstroDecorations(editor);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            BracketLynx.onDidSaveTextDocument(document);
            // Update Astro decorations on save
            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (editor) {
                updateAstroDecorations(editor);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            BracketLynx.onDidChangeTextDocument(document);
            cleanupClosedEditor(document);
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            BracketLynx.onDidChangeActiveTextEditor();
            // Update Astro decorations when switching editors
            updateAstroDecorations(editor);
        }),
        vscode.workspace.onDidSaveTextDocument(handleSettingsFileSave)
    );
    
    vscode.window.visibleTextEditors.forEach(editor => {
        BracketLynx.delayUpdateDecoration(editor);
        // Initialize Astro decorations for visible editors
        updateAstroDecorations(editor);
    });
};

export const deactivate = () => {
    // Cleanup Astro decorations
    AstroDecorator.dispose();
    // Other cleanup handled automatically by VSCode
};
