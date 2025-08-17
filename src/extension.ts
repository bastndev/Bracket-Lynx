import * as vscode from 'vscode';
import { BracketLynx } from './lens/lens';
import FrameworksDecorator from './lens/decorators/frameworks-decorator';
import { setBracketLynxProviderForColors, setFrameworkDecoratorForColors } from './actions/colors';
import { initializeErrorHandling, LogLevel, logger } from './core/performance-config';
import { showBracketLynxMenu, setBracketLynxProvider, setFrameworkDecorator, cleanupClosedEditor, initializePersistedState } from './actions/toggle';

export let extensionContext: vscode.ExtensionContext;

// ============================================================================
// FRAMEWORKS COORDINATOR WITHOUT FLICKERING - Single source of truth
// ============================================================================
class DecorationCoordinator {
    private static updateInProgress = false;
    private static pendingUpdates = new Set<string>();
    private static readonly COORDINATION_DELAY = 16; // ~60fps for smooth visuals

    /**
     * Coordinated update to avoid flickering
     */
    public static async coordinatedUpdate(editor?: vscode.TextEditor): Promise<void> {
        if (!editor) {
            return;
        }

        const editorKey = `${editor.document.uri.toString()}-${editor.document.version}`;
        this.pendingUpdates.add(editorKey);

        if (this.updateInProgress) {
            return;
        }

        setTimeout(async () => {
            await this.processPendingUpdates(editor);
        }, this.COORDINATION_DELAY);
    }

    /**
     * Atomically processes all pending updates
     */
    private static async processPendingUpdates(editor: vscode.TextEditor): Promise<void> {
        if (this.updateInProgress) {
            return;
        }

        this.updateInProgress = true;

        try {
            this.pendingUpdates.clear();

            BracketLynx.delayUpdateDecoration(editor);

            await FrameworksDecorator.updateDecorations(editor);

        } catch (error) {
            console.error('DecorationCoordinator: Error in processPendingUpdates:', error);
        } finally {
            this.updateInProgress = false;
        }
    }

    /**
     * Coordinated cleanup of all decorations
     */
    public static clearAll(): void {
        this.pendingUpdates.clear();
        this.updateInProgress = false;

        BracketLynx.clearAllDecorations();
        FrameworksDecorator.clearAllDecorations();
    }

    /**
     * Coordinated configuration update
     */
    public static onConfigurationChange(): void {
        this.pendingUpdates.clear();
        this.updateInProgress = false;

        BracketLynx.onDidChangeConfiguration();
        FrameworksDecorator.onDidChangeConfiguration();
    }
}

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

    try {
        // Initialize state and providers
        initializePersistedState();

        // Set up providers - unified approach
        setBracketLynxProvider(BracketLynx);
        setBracketLynxProviderForColors(BracketLynx);

        // Set up unified framework decorator
        setFrameworkDecorator(FrameworksDecorator);

        const { initializeColorSystem } = await import('./actions/colors.js');
        initializeColorSystem();

        registerCommands(context);
        registerEventListeners(context);

        // Initialize decorations
        await initializeDecorations();

        logger.info('Bracket Lynx extension activated successfully');

    } catch (error) {
        logger.error('Error during extension activation:', error);
        vscode.window.showErrorMessage(`Bracket Lynx: Activation failed - ${error}`);
    }
};

/**
 * Initialize decorations for all visible editors
 */
async function initializeDecorations(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));

    const visibleEditors = vscode.window.visibleTextEditors;
    if (visibleEditors.length === 0) {return;}

    for (const editor of visibleEditors) {
        try {
            await DecorationCoordinator.coordinatedUpdate(editor);
        } catch (error) {
            console.error(`Error initializing decorations for ${editor.document.fileName}:`, error);
        }
    }
}

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
                `Frameworks: ${diagnostics.astro.available ? '✅' : '❌'}, ` +
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
                `Systems: ${diagnostics.decorators.main.available ? '✅' : '❌'} Main, ` +
                `${diagnostics.decorators.astro.available ? '✅' : '❌'} Frameworks`
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
        }),

        vscode.commands.registerCommand('bracketLynx.refreshDecorations', async () => {
            DecorationCoordinator.clearAll();
            await initializeDecorations();
            vscode.window.showInformationMessage('Decorations refreshed successfully');
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
// EVENT HANDLERS - COORDINATED TO AVOID CONFLICTS
// ============================================================================
async function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration('bracketLynx')) {
        try {
            DecorationCoordinator.onConfigurationChange();
            const { onConfigurationChanged } = await import('./actions/colors.js');
            await onConfigurationChanged();
        } catch (error) {
            console.error('Error handling configuration change:', error);
        }
    }
}

function handleWorkspaceFoldersChange() {
    DecorationCoordinator.onConfigurationChange();
}

function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
    if (editor) {
        DecorationCoordinator.coordinatedUpdate(editor);
    }
}

function handleDidOpenTextDocument(document: vscode.TextDocument) {
    BracketLynx.onDidOpenTextDocument(document);
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        DecorationCoordinator.coordinatedUpdate(editor);
    }
}

async function handleDidSaveTextDocument(document: vscode.TextDocument) {
    BracketLynx.onDidSaveTextDocument(document);
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (editor) {
        DecorationCoordinator.coordinatedUpdate(editor);
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
    if (editor) {
        setTimeout(() => {
            DecorationCoordinator.coordinatedUpdate(editor);
        }, 30);
    }
}

// ============================================================================
// EXTENSION DEACTIVATION
// ============================================================================
export const deactivate = () => {
    try {
        DecorationCoordinator.clearAll();
        FrameworksDecorator.dispose();
        BracketLynx.dispose();

        logger.info('Bracket Lynx: Extension deactivated successfully');
    } catch (error) {
        console.error('Error during extension deactivation:', error);
    }
};
