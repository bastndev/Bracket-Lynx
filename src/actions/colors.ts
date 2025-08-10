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
        { label: '🔵 Dark Blue', value: '#4a4d66', description: 'Dark blue decorations' },
        { label: '🟡 Muted Yellow', value: '#9d956b', description: 'Subtle yellow-beige' },
        { label: '🟢 Sage Green', value: '#6b7c5d', description: 'Muted sage green decorations' },
        { label: '🟣 Dusty Purple', value: '#6d5d73', description: 'Soft purple-gray decorations' },
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
            console.log(`🎨 Loaded color from configuration: ${savedColor}`);
            return savedColor;
        } else if (savedColor) {
            console.warn(`🎨 Invalid color in configuration: ${savedColor}, using default`);
        }
    } catch (error) {
        console.warn('🎨 Could not load color from configuration:', error);
    }
    
    console.log('🎨 Using default color: #515151');
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
    
    // Ensure decorations are updated with the correct color on initialization
    if (bracketLynxProvider) {
        setTimeout(async () => {
            try {
                await recreateAllBracketLynxDecorations(currentColor);
                console.log(`🎨 Initial decorations applied with color: ${currentColor}`);
            } catch (error) {
                console.error('🎨 Error applying initial color decorations:', error);
            }
        }, 100);
    }
}

export function getEffectiveColor(): string {
    return currentColor;
}

export function getCurrentColor(): string {
    return currentColor;
}

/**
 * Force synchronization of color state with configuration
 * Useful after external changes like git reset
 */
export async function forceSyncColorWithConfiguration(): Promise<void> {
    const configColor = loadColorFromConfiguration();
    if (configColor !== currentColor) {
        console.log(`🎨 Force syncing color: ${currentColor} -> ${configColor}`);
        currentColor = configColor;
        
        if (bracketLynxProvider) {
            try {
                await recreateAllBracketLynxDecorations(configColor);
            } catch (error) {
                console.error('🎨 Error during force sync:', error);
            }
        }
    }
}

export function isValidHexColor(color: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(color);
}

export async function onConfigurationChanged(): Promise<void> {
    const newColor = loadColorFromConfiguration();
    
    // Always sync the current color with configuration, even if it seems the same
    // This handles cases where git reset or other external changes occur
    if (isValidHexColor(newColor)) {
        const wasColorChanged = newColor !== currentColor;
        currentColor = newColor;
        
        if (bracketLynxProvider) {
            try {
                // Force refresh decorations to ensure they use the correct color
                await recreateAllBracketLynxDecorations(newColor);
                
                if (wasColorChanged) {
                    console.log(`🎨 Configuration changed, color updated from previous to ${newColor}`);
                } else {
                    console.log(`🎨 Configuration resynced, color confirmed as ${newColor}`);
                }
            } catch (error) {
                console.error('🎨 Error updating decorations after configuration change:', error);
            }
        }
    } else {
        // If configuration has invalid color, reset to default
        console.warn(`🎨 Invalid color in configuration: ${newColor}, resetting to default`);
        currentColor = '#515151';
        if (bracketLynxProvider) {
            try {
                await recreateAllBracketLynxDecorations('#515151');
            } catch (error) {
                console.error('🎨 Error resetting to default color:', error);
            }
        }
    }
}