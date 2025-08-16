import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import { AstroDecorator } from './lens/decorators/astrojs-decorator';
import { VueDecorator } from './lens/decorators/vue.decorator';
import { setBracketLynxProviderForColors, setAstroDecoratorForColors, setVueDecoratorForColors } from './actions/colors';
import { showBracketLynxMenu, setBracketLynxProvider, setAstroDecorator, setVueDecorator, cleanupClosedEditor, initializePersistedState } from './actions/toggle';
import { initializeErrorHandling, LogLevel, logger } from './core/performance-config';

export let extensionContext: vscode.ExtensionContext;

const updateUniversalDecorations = (editor?: vscode.TextEditor) => {
    if (editor) {
        if (editor.document.languageId === 'astro' || editor.document.languageId === 'html') {
            AstroDecorator.updateDecorations(editor);
        } else if (editor.document.languageId === 'vue') {
            VueDecorator.updateDecorations(editor);
        }
    }
};

export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;

    // Initialize error handling system first
    const config = vscode.workspace.getConfiguration('bracketLynx');
    const debugMode = config.get('debug', false);
    initializeErrorHandling({
        logLevel: debugMode ? LogLevel.DEBUG : LogLevel.WARN
    });

    logger.info('Bracket Lynx extension activating...', { version: '0.6.1' });

    initializePersistedState();

    setBracketLynxProvider(BracketLynx);
    setAstroDecorator(AstroDecorator);
    setVueDecorator(VueDecorator);
    setBracketLynxProviderForColors(BracketLynx);
    setAstroDecoratorForColors(AstroDecorator);
    setVueDecoratorForColors(VueDecorator);

    const { initializeColorSystem } = await import('./actions/colors.js');
    initializeColorSystem();

    registerCommands(context);
    registerEventListeners(context);

    vscode.window.visibleTextEditors.forEach(editor => {
        BracketLynx.delayUpdateDecoration(editor);
        updateUniversalDecorations(editor);
    });
};

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bracketLynx.menu', showBracketLynxMenu),
        vscode.commands.registerCommand('bracketLynx.restoreColor', async () => {
            const { restoreColorFromGlobal } = await import('./actions/colors.js');
            await restoreColorFromGlobal();
        })
    );
}

function registerEventListeners(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(handleConfigurationChange),
        vscode.workspace.onDidChangeWorkspaceFolders(handleWorkspaceFoldersChange),
        vscode.workspace.onDidChangeTextDocument(handleTextDocumentChange),
        vscode.workspace.onDidOpenTextDocument(handleDidOpenTextDocument),
        vscode.workspace.onDidSaveTextDocument(handleDidSaveTextDocument),
        vscode.workspace.onDidCloseTextDocument(handleDidCloseTextDocument),
        vscode.window.onDidChangeActiveTextEditor(handleActiveTextEditorChange)
    );
}

async function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration('bracketLynx')) {
        BracketLynx.onDidChangeConfiguration();
        AstroDecorator.onDidChangeConfiguration();
        VueDecorator.onDidChangeConfiguration();
        const { onConfigurationChanged } = await import('./actions/colors.js');
        await onConfigurationChanged();
    }
}

function handleWorkspaceFoldersChange() {
    BracketLynx.onDidChangeConfiguration();
    AstroDecorator.onDidChangeConfiguration();
    VueDecorator.onDidChangeConfiguration();
}

function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent) {
    BracketLynx.onDidChangeTextDocument(event.document);
    const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
    if (editor) {
        updateUniversalDecorations(editor);
    }
}

function handleDidOpenTextDocument(document: vscode.TextDocument) {
    BracketLynx.onDidOpenTextDocument(document);
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        updateUniversalDecorations(editor);
    }
}

async function handleDidSaveTextDocument(document: vscode.TextDocument) {
    BracketLynx.onDidSaveTextDocument(document);
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        updateUniversalDecorations(editor);
    }

    if (document.fileName.includes('.vscode/settings.json') || document.fileName.includes('settings.json')) {
        const { forceSyncColorWithConfiguration } = await import('./actions/colors.js');
        await forceSyncColorWithConfiguration();
    }
}

async function handleDidCloseTextDocument(document: vscode.TextDocument) {
    BracketLynx.onDidChangeTextDocument(document);
    await cleanupClosedEditor(document);
}

function handleActiveTextEditorChange(editor?: vscode.TextEditor) {
    BracketLynx.onDidChangeActiveTextEditor();
    updateUniversalDecorations(editor);
}

export const deactivate = () => {
    AstroDecorator.dispose();
    VueDecorator.dispose();
    console.log('🧹 Bracket Lynx: Extension deactivated');
};
