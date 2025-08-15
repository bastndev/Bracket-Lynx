import * as vscode from 'vscode';
import { isEditorEnabled, isExtensionEnabled } from './toggle';

interface ColorOption extends vscode.QuickPickItem {
    value: string;
}

export interface IBracketLynxProvider {
    clearAllDecorations(): void;
    updateAllDecoration(): void;
    clearEditorDecorations?(editor: vscode.TextEditor): void;
    onDidChangeConfiguration?(): void;
}

let bracketLynxProvider: IBracketLynxProvider | undefined = undefined;
let astroDecorator: any = undefined;
let currentColor: string = '#515151';
/**
 * Available color presets
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

export function setBracketLynxProviderForColors(provider: IBracketLynxProvider): void {
    bracketLynxProvider = provider;
}

export function setAstroDecoratorForColors(decorator: any): void {
    astroDecorator = decorator;
}

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

    quickPick.onDidChangeActive(async (items) => {
        if (items.length > 0) {
            const item = items[0];
            if (item.value !== 'write-custom') {
                await applyColorToDecorations(item.value);
            }
        }
    });

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

async function recreateAllBracketLynxDecorations(overrideColor?: string): Promise<void> {
    if (!bracketLynxProvider) {
        return;
    }

    try {
        if (overrideColor) {
            currentColor = overrideColor;
        }
        
                bracketLynxProvider.clearAllDecorations();
        await new Promise(resolve => setTimeout(resolve, 50));

        if (bracketLynxProvider.onDidChangeConfiguration) {
          bracketLynxProvider.onDidChangeConfiguration();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        bracketLynxProvider.updateAllDecoration();
        
        
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
        // First, try saving to Global to ensure persistence after git reset
        const config = vscode.workspace.getConfiguration('bracketLynx');
        await config.update('color', color, vscode.ConfigurationTarget.Global);
    } catch (error) {
        try {
            // If Global fails, use Workspace as a fallback
            const config = vscode.workspace.getConfiguration('bracketLynx');
            await config.update('color', color, vscode.ConfigurationTarget.Workspace);
        } catch (workspaceError) {
            console.warn(`🎨 Failed to save color to configuration:`, workspaceError);
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
    
    // Register listener for configuration changes
    const configListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('bracketLynx.color')) {
            await onConfigurationChanged();
        }
    });
    
    if (bracketLynxProvider) {
        setTimeout(async () => {
            try {
                await recreateAllBracketLynxDecorations(currentColor);
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
 */
export async function forceSyncColorWithConfiguration(): Promise<void> {
    const configColor = loadColorFromConfiguration();
    if (configColor !== currentColor) {
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
    
    if (isValidHexColor(newColor)) {
        const wasColorChanged = newColor !== currentColor;
        currentColor = newColor;
        
        if (bracketLynxProvider && wasColorChanged) {
            try {
                await recreateAllBracketLynxDecorations(newColor);
            } catch (error) {
                console.error('🎨 Error updating decorations after configuration change:', error);
            }
        }
    } else {
        // If the color is invalid, keep the current color and save a valid one
        const fallbackColor = isValidHexColor(currentColor) ? currentColor : '#515151';
        currentColor = fallbackColor;
        
        // Save the valid color back to the configuration
        try {
            await saveColorToConfiguration(fallbackColor);
        } catch (error) {
            console.error('🎨 Error saving fallback color:', error);
        }
        
        if (bracketLynxProvider) {
            try {
                await recreateAllBracketLynxDecorations(fallbackColor);
            } catch (error) {
                console.error('🎨 Error resetting to fallback color:', error);
            }
        }
    }
}

/**
 * Restores the custom color from global configuration
 * Useful after a git reset that may have affected workspace settings
 */
export async function restoreColorFromGlobal(): Promise<void> {
    try {
        const globalConfig = vscode.workspace.getConfiguration('bracketLynx');
        const globalColor = globalConfig.inspect<string>('color')?.globalValue;
        
        if (globalColor && isValidHexColor(globalColor)) {
            currentColor = globalColor;
            
            if (bracketLynxProvider) {
                await recreateAllBracketLynxDecorations(globalColor);
                vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color restored from global settings: ${globalColor}`);
            }
        } else {
            vscode.window.showWarningMessage('🎨 No valid global color configuration found');
        }
    } catch (error) {
        console.error('🎨 Error restoring color from global:', error);
        vscode.window.showErrorMessage('🎨 Failed to restore color from global settings');
    }
}
