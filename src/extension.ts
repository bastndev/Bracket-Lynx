import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import { AstroDecorator } from './lens/decorators/astro-decorator';
import { VueDecorator } from './lens/decorators/vue.decorator';
import SvelteDecorator from './lens/decorators/svelte.decorator';
import { setBracketLynxProviderForColors, setAstroDecoratorForColors, setVueDecoratorForColors, setSvelteDecoratorForColors } from './actions/colors';
import { showBracketLynxMenu, setBracketLynxProvider, setAstroDecorator, setVueDecorator, cleanupClosedEditor, initializePersistedState } from './actions/toggle';
import { initializeErrorHandling, LogLevel, logger } from './core/performance-config';

export let extensionContext: vscode.ExtensionContext;

// ============================================================================
// UNIVERSAL DECORATION UPDATER - Centralized logic for all decorators
// ============================================================================
const updateUniversalDecorations = (editor?: vscode.TextEditor) => {
    if (!editor) {
        return;
    }
    
    const { languageId } = editor.document;
    
    if (languageId === 'astro' || languageId === 'html') {
        AstroDecorator.updateDecorations(editor);
    } else if (languageId === 'vue') {
        VueDecorator.updateDecorations(editor);
    } else if (languageId === 'svelte') {
        SvelteDecorator.updateDecorations(editor);
    }
};

// ============================================================================
// EXTENSION ACTIVATION
// ============================================================================
export const activate = async (context: vscode.ExtensionContext) => {
    extensionContext = context;

    // Initialize error handling system first
    const config = vscode.workspace.getConfiguration('bracketLynx');
    const debugMode = config.get('debug', false);
    initializeErrorHandling({
        logLevel: debugMode ? LogLevel.DEBUG : LogLevel.WARN
    });

    logger.info('Bracket Lynx extension activating...', { version: '0.6.1' });

    // Initialize state and providers
    initializePersistedState();
    setBracketLynxProvider(BracketLynx);
    setAstroDecorator(AstroDecorator);
    setVueDecorator(VueDecorator);
    setSvelteDecoratorForColors(SvelteDecorator);
    setBracketLynxProviderForColors(BracketLynx);
    setAstroDecoratorForColors(AstroDecorator);
    setVueDecoratorForColors(VueDecorator);

    // Initialize color system
    const { initializeColorSystem } = await import('./actions/colors.js');
    initializeColorSystem();

    // Register commands and event listeners
    registerCommands(context);
    registerEventListeners(context);

    // Initialize decorations for all visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
        BracketLynx.delayUpdateDecoration(editor);
        updateUniversalDecorations(editor);
    });
};

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================
function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bracketLynx.menu', showBracketLynxMenu),
        
        vscode.commands.registerCommand('bracketLynx.restoreColor', async () => {
            const { restoreColorFromGlobal } = await import('./actions/colors.js');
            await restoreColorFromGlobal();
        }),
        
        vscode.commands.registerCommand('bracketLynx.diagnostics', async () => {
            const { getDecoratorDiagnostics } = await import('./actions/colors.js');
            const diagnostics = getDecoratorDiagnostics();
            console.log('🔧 Bracket Lynx Diagnostics:', diagnostics);
            vscode.window.showInformationMessage(
                `🔧 Bracket Lynx Diagnostics: Main: ${diagnostics.main.available ? '✅' : '❌'}, ` +
                `Astro: ${diagnostics.astro.available ? '✅' : '❌'}, ` +
                `Vue: ${diagnostics.vue.available ? '✅' : '❌'}, ` +
                `Svelte: ${diagnostics.svelte.available ? '✅' : '❌'}, ` +
                `Color: ${diagnostics.currentColor}`
            );
        }),
        
        vscode.commands.registerCommand('bracketLynx.debugColorRefresh', async () => {
            const { debugColorRefresh } = await import('./actions/colors.js');
            await debugColorRefresh();
            vscode.window.showInformationMessage('🎨 Color refresh debug test completed - check console for details');
        }),
        
        vscode.commands.registerCommand('bracketLynx.toggleDiagnostics', async () => {
            const { getToggleDiagnostics } = await import('./actions/toggle.js');
            const diagnostics = getToggleDiagnostics();
            console.log('🔄 Toggle System Diagnostics:', diagnostics);
            vscode.window.showInformationMessage(
                `🔄 Toggle Status: Global: ${diagnostics.globalEnabled ? '✅' : '❌'}, ` +
                `Current File: ${diagnostics.currentFileStatus}, ` +
                `Main: ${diagnostics.decorators.main.available ? '✅' : '❌'}, ` +
                `Astro: ${diagnostics.decorators.astro.available ? '✅' : '❌'}, ` +
                `Vue: ${diagnostics.decorators.vue.available ? '✅' : '❌'}, ` +
                `Svelte: ${diagnostics.decorators.svelte.available ? '✅' : '❌'}`
            );
        }),
        
        vscode.commands.registerCommand('bracketLynx.debugToggleSync', async () => {
            const { debugToggleSync } = await import('./actions/toggle.js');
            await debugToggleSync();
            vscode.window.showInformationMessage('🔄 Toggle sync debug test completed - check console for details');
        }),
        
        vscode.commands.registerCommand('bracketLynx.validateStatus', async () => {
            const { validateDecoratorStatus } = await import('./actions/colors.js');
            const validation = validateDecoratorStatus();

            let message = validation.status;
            if (validation.issues.length > 0) {
                message += '\n\nIssues:\n' + validation.issues.map(issue => `• ${issue}`).join('\n');
            }
            if (validation.recommendations.length > 0) {
                message += '\n\nRecommendations:\n' + validation.recommendations.map(rec => `• ${rec}`).join('\n');
            }

            if (validation.isValid) {
                vscode.window.showInformationMessage(message);
            } else {
                vscode.window.showWarningMessage(message);
            }
        })
    );
}

// ============================================================================
// EVENT LISTENER REGISTRATION
// ============================================================================
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

// ============================================================================
// EVENT HANDLERS
// ============================================================================
async function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration('bracketLynx')) {
        BracketLynx.onDidChangeConfiguration();
        AstroDecorator.onDidChangeConfiguration();
        VueDecorator.onDidChangeConfiguration();
        SvelteDecorator.onDidChangeConfiguration();
        
        const { onConfigurationChanged } = await import('./actions/colors.js');
        await onConfigurationChanged();
    }
}

function handleWorkspaceFoldersChange() {
    BracketLynx.onDidChangeConfiguration();
    AstroDecorator.onDidChangeConfiguration();
    VueDecorator.onDidChangeConfiguration();
    SvelteDecorator.onDidChangeConfiguration();
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

    // Force color sync if settings were changed
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

// ============================================================================
// EXTENSION DEACTIVATION
// ============================================================================
export const deactivate = () => {
    AstroDecorator.dispose();
    VueDecorator.dispose();
    SvelteDecorator.dispose();
    console.log('🧹 Bracket Lynx: Extension deactivated');
};
