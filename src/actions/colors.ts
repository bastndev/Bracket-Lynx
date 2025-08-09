import * as vscode from 'vscode';
import { isEditorEnabled, isExtensionEnabled } from './toggle';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface ColorOption extends vscode.QuickPickItem {
    value: string;
}

export interface IBracketLynxProvider {
    clearAllDecorations(): void;
    updateAllDecoration(): void;
    forceUpdateEditor(editor: vscode.TextEditor): void;
    clearDecorationCache?(document: vscode.TextDocument): void;
    clearEditorDecorations?(editor: vscode.TextEditor): void;
    onDidChangeConfiguration?(): void;
    forceColorRefresh?(): void;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let bracketLynxProvider: IBracketLynxProvider | undefined = undefined;
let currentColor: string = '#515151';

// ============================================================================
// COLOR PRESETS
// ============================================================================

/**
 * Available colors for the color picker
 * Add new colors here to extend the picker
 */
function getAvailableColors(): ColorOption[] {
    return [
        { label: '⚫ Default Gray', value: '#515151', description: 'Default bracket color' },
        { label: '⚪ Light Gray', value: '#adb5bd', description: 'Light gray decorations' },
        { label: '🔵 Dark Gray', value: '#535466', description: 'Dark blue decorations' },
        { label: '🟡 Yellow', value: '#f1c40f', description: 'Bright yellow decorations' },
        { label: '✏️ Write Custom', value: 'write-custom', description: 'Enter your own hex color' },
    ];
}

// ============================================================================
// PROVIDER REGISTRATION
// ============================================================================

export function setBracketLynxProviderForColors(provider: IBracketLynxProvider): void {
    bracketLynxProvider = provider;
}

// ============================================================================
// MAIN COLOR CHANGE FUNCTIONALITY
// ============================================================================

export function changeDecorationColor(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showWarningMessage('🎨 No active editor for color preview');
        return;
    }

    if (!isExtensionEnabled()) {
        vscode.window.showWarningMessage('🎨 Bracket Lynx is disabled globally');
        return;
    }

    if (!bracketLynxProvider) {
        vscode.window.showErrorMessage('🎨 Bracket Lynx provider not initialized');
        return;
    }

    const config = vscode.workspace.getConfiguration('bracketLynx');
    const originalColor = config.get('color', '#515151');
    
    const quickPick = vscode.window.createQuickPick<ColorOption>();
    quickPick.items = getAvailableColors();
    quickPick.placeholder = 'Choose a color for bracket decorations';
    quickPick.canSelectMany = false;

    const applyColorToDecorations = async (color: string): Promise<boolean> => {
        try {
            currentColor = color;
            if (bracketLynxProvider && isExtensionEnabled()) {
                await new Promise(resolve => setTimeout(resolve, 50));
                await recreateAllBracketLynxDecorations();
                await new Promise(resolve => setTimeout(resolve, 100));
                return true;
            }
            return false;
        } catch (error) {
            console.error('🎨 Error applying color:', error);
            vscode.window.showErrorMessage(`Failed to apply color: ${error}`);
            return false;
        }
    };

    // Preview colors in real-time
    quickPick.onDidChangeActive(async (items) => {
        if (items.length > 0) {
            const item = items[0];
            if (item.value !== 'write-custom') {
                await applyColorToDecorations(item.value);
            }
        }
    });

    // Handle selection
    quickPick.onDidAccept(async () => {
        const selectedItem = quickPick.selectedItems[0];
        if (!selectedItem) {
            quickPick.dispose();
            return;
        }

        if (selectedItem.value === 'write-custom') {
            quickPick.hide();
            
            const customColor = await vscode.window.showInputBox({
                prompt: 'Enter hex color for bracket decorations',
                placeHolder: '#ffffff (example: #ff6b6b, #00ff00, #3498db)',
                value: originalColor,
                validateInput: (value) => {
                    if (!value) { return 'Color is required'; }
                    if (!isValidHexColor(value)) {
                        return 'Please enter a valid hex color (e.g., #ff6b6b)';
                    }
                    return null;
                },
            });

            quickPick.dispose();

            if (!customColor) {
                await applyColorToDecorations(originalColor);
                await saveColorToConfiguration(originalColor);
                return;
            }

            const success = await applyColorToDecorations(customColor);
            if (success) {
                await saveColorToConfiguration(customColor);
                vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${customColor}`);
            } else {
                vscode.window.showErrorMessage('🎨 Failed to change color');
            }
        } else {
            quickPick.dispose();
            
            const finalColor = selectedItem.value;
            const success = await applyColorToDecorations(finalColor);
            if (success) {
                await saveColorToConfiguration(finalColor);
                vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${selectedItem.label}`);
            } else {
                vscode.window.showErrorMessage('🎨 Failed to change color');
            }
        }
    });

    // Restore original color on cancel
    quickPick.onDidHide(() => {
        if (quickPick.selectedItems.length === 0) {
            applyColorToDecorations(originalColor).then(() => {
                saveColorToConfiguration(originalColor);
            });
        }
        quickPick.dispose();
    });

    quickPick.show();
}

// ============================================================================
// DECORATION RECREATION LOGIC
// ============================================================================

async function recreateAllBracketLynxDecorations(overrideColor?: string): Promise<void> {
    if (!bracketLynxProvider) {
        return;
    }

    try {
        if (overrideColor) {
            currentColor = overrideColor;
        }
        
        if (typeof bracketLynxProvider.forceColorRefresh === 'function') {
            bracketLynxProvider.forceColorRefresh();
        } else {
            bracketLynxProvider.clearAllDecorations();
            await new Promise(resolve => setTimeout(resolve, 50));

            if (bracketLynxProvider.clearDecorationCache) {
                vscode.window.visibleTextEditors.forEach(editor => {
                    if (editor.document && bracketLynxProvider) {
                        bracketLynxProvider.clearDecorationCache!(editor.document);
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (bracketLynxProvider.onDidChangeConfiguration) {
                bracketLynxProvider.onDidChangeConfiguration();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            bracketLynxProvider.updateAllDecoration();

            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && isEditorEnabled(activeEditor)) {
                bracketLynxProvider.forceUpdateEditor(activeEditor);
            }
        }
    } catch (error) {
        console.error('🎨 Error recreating decorations:', error);
        throw error;
    }
}

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

async function saveColorToConfiguration(color: string): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('bracketLynx');
        await config.update('color', color, vscode.ConfigurationTarget.Workspace);
        console.log(`🎨 Color saved to configuration: ${color}`);
    } catch (error) {
        try {
            const config = vscode.workspace.getConfiguration('bracketLynx');
            await config.update('color', color, vscode.ConfigurationTarget.Global);
            console.log(`🎨 Color saved to global configuration: ${color}`);
        } catch (globalError) {
            console.warn(`🎨 Failed to save color to configuration:`, globalError);
        }
    }
}

function loadColorFromConfiguration(): string {
    try {
        const config = vscode.workspace.getConfiguration('bracketLynx');
        const savedColor = config.get<string>('color');
        if (savedColor && isValidHexColor(savedColor)) {
            return savedColor;
        }
    } catch (error) {
        console.warn('🎨 Could not load color from configuration:', error);
    }
    return '#515151';
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function setColor(color: string): Promise<void> {
    if (!isValidHexColor(color)) {
        throw new Error(`Invalid hex color: ${color}`);
    }
    currentColor = color;
    await saveColorToConfiguration(color);
    await recreateAllBracketLynxDecorations(color);
}

export function initializeColorSystem(): void {
    currentColor = loadColorFromConfiguration();
    console.log(`🎨 Color system initialized with color: ${currentColor}`);
}

export function getEffectiveColor(): string {
    return currentColor;
}

export function getCurrentColor(): string {
    return currentColor;
}

export function isValidHexColor(color: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(color);
}

export async function onConfigurationChanged(): Promise<void> {
    const newColor = loadColorFromConfiguration();
    if (newColor !== currentColor && isValidHexColor(newColor)) {
        console.log(`🎨 Configuration changed, updating color from ${currentColor} to ${newColor}`);
        currentColor = newColor;
        if (bracketLynxProvider) {
            try {
                await recreateAllBracketLynxDecorations(newColor);
            } catch (error) {
                console.error('🎨 Error updating decorations after configuration change:', error);
            }
        }
    }
}