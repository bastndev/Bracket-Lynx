import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import { 
  showBracketLynxMenu, 
  setBracketLynxProvider, 
  setAstroDecorator, 
  cleanupClosedEditor,
  stopMemoryCleanupTimer,
  forceMemoryCleanup,
  initializePersistedState
} from './actions/toggle';
import { AstroDecorator } from './lens/decorators/astrojs-decorator';
import { setAstroDecoratorForColors } from './actions/colors';

export let extensionContext: vscode.ExtensionContext;

export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;
    
    // Initialize persisted state before setting up providers
    initializePersistedState();
    
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

    // Helper function to update Universal decorations (Astro and HTML)
    const updateUniversalDecorations = (editor?: vscode.TextEditor) => {
        if (editor && (
            editor.document.fileName.endsWith('.astro') || 
            editor.document.fileName.endsWith('.html') ||
            editor.document.languageId === 'astro' || 
            editor.document.languageId === 'html'
        )) {
            AstroDecorator.updateDecorations(editor);
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
            // Update Universal decorations on text changes
            const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
            if (editor) {
                updateUniversalDecorations(editor);
            }
        }),
        vscode.workspace.onDidOpenTextDocument((document) => {
            BracketLynx.onDidOpenTextDocument(document);
            // Update Universal decorations when opening files
            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (editor) {
                updateUniversalDecorations(editor);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            BracketLynx.onDidSaveTextDocument(document);
            // Update Universal decorations on save
            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (editor) {
                updateUniversalDecorations(editor);
            }
        }),
        vscode.workspace.onDidCloseTextDocument(async (document) => {
            BracketLynx.onDidChangeTextDocument(document);
            await cleanupClosedEditor(document);
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            BracketLynx.onDidChangeActiveTextEditor();
            // Update Universal decorations when switching editors
            updateUniversalDecorations(editor);
        }),
        vscode.workspace.onDidSaveTextDocument(handleSettingsFileSave)
    );
    
    vscode.window.visibleTextEditors.forEach(editor => {
        BracketLynx.delayUpdateDecoration(editor);
        // Initialize Universal decorations for visible editors
        updateUniversalDecorations(editor);
    });
};

export const deactivate = async () => {
    // Cleanup Universal decorations
    AstroDecorator.dispose();
    
    // MEMORY OPTIMIZATION: Stop cleanup timer and clear memory
    stopMemoryCleanupTimer();
    await forceMemoryCleanup();
    
    console.log('🧹 Bracket Lynx: Extension deactivated and memory cleaned up');
};
