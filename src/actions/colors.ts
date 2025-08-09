import * as vscode from 'vscode';
import { isEditorEnabled, isExtensionEnabled } from './toggle';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface ColorOption extends vscode.QuickPickItem {
    value: string;
}

export interface IBracketLynxProvider {
    // Clear all decorations from all editors
    clearAllDecorations(): void;
    
    // Update all decorations for all visible editors  
    updateAllDecoration(): void;
    
    // Force update decorations for a specific editor
    forceUpdateEditor(editor: vscode.TextEditor): void;
    
    // Clear decoration cache for a specific document
    clearDecorationCache?(document: vscode.TextDocument): void;
    
    // Clear decorations for a specific editor
    clearEditorDecorations?(editor: vscode.TextEditor): void;
    
    // Force configuration change handling
    onDidChangeConfiguration?(): void;

    // NEW: Force color refresh
    forceColorRefresh?(): void;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let bracketLynxProvider: IBracketLynxProvider | undefined = undefined;
// Store current color in memory since configuration might not be registered
let currentColor: string = '#515151';

// ============================================================================
// PROVIDER REGISTRATION
// ============================================================================

/**
 * Set the Bracket Lynx provider reference for color operations
 */
export function setBracketLynxProviderForColors(provider: IBracketLynxProvider): void {
    bracketLynxProvider = provider;
}

// ============================================================================
// MAIN COLOR CHANGE FUNCTIONALITY
// ============================================================================

/**
 * Show color picker with instant preview for Bracket Lynx decorations
 */
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

    // ----- ---- --- custom colors and select color
    const colorOptions: ColorOption[] = [
        ...getSuggestedColors(),
        { label: '✏️ Write Custom', value: 'write-custom', description: 'Enter your own hex color' },
        { label: '🔧 Diagnostics', value: 'diagnostics', description: 'Show color system status' },
    ];

    const config = vscode.workspace.getConfiguration('bracketLynx');
    const originalColor = config.get('color', '#515151');

    const quickPick = vscode.window.createQuickPick<ColorOption>();
    quickPick.items = colorOptions;
    quickPick.placeholder = 'Choose a color for bracket decorations';
    quickPick.canSelectMany = false;

    // Apply color with proper error handling - SIMPLIFIED VERSION
    const applyColorToDecorations = async (color: string): Promise<boolean> => {
        try {
            currentColor = color;
            
            if (bracketLynxProvider && isExtensionEnabled()) {
                // Wait a bit
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Force recreation of decorations using Bracket Lynx methods
                await recreateAllBracketLynxDecorations();
                
                // Additional wait to ensure decorations are applied
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

    // No preview needed since we only have 'custom' option
    // quickPick.onDidChangeActive is not needed anymore

    // Preview colors when user navigates through the list (except for special actions)
    quickPick.onDidChangeActive(async (items) => {
        if (items.length > 0) {
            const item = items[0];
            // Preview actual colors, but not special actions
            if (item.value !== 'custom' && item.value !== 'diagnostics' && item.value !== 'write-custom') {
                await applyColorToDecorations(item.value);
            }
        }
    });

    // Final selection
    quickPick.onDidAccept(async () => {
        const selectedItem = quickPick.selectedItems[0];
        if (!selectedItem) {
            quickPick.dispose();
            return;
        }

        if (selectedItem.value === 'custom') {
            // Show custom color picker (recommended colors)
            quickPick.hide();
            
            // Show suggested colors
            const suggestedColors: ColorOption[] = [
                ...getSuggestedColors(),
                { label: '✏️ Write Custom', value: 'write-custom', description: 'Enter your own hex color' },
            ];

            const colorPicker = vscode.window.createQuickPick<ColorOption>();
            colorPicker.items = suggestedColors;
            colorPicker.placeholder = 'Choose a suggested color or write a custom one';
            colorPicker.canSelectMany = false;

            // Preview suggested colors
            colorPicker.onDidChangeActive(async (items) => {
                if (items.length > 0 && items[0].value !== 'write-custom') {
                    await applyColorToDecorations(items[0].value);
                }
            });

            colorPicker.onDidAccept(async () => {
                const selectedColor = colorPicker.selectedItems[0];
                if (!selectedColor) {
                    colorPicker.dispose();
                    await applyColorToDecorations(originalColor);
                    await saveColorToConfiguration(originalColor);
                    quickPick.dispose();
                    return;
                }

                let finalColor: string;

                if (selectedColor.value === 'write-custom') {
                    // Show input box for completely custom color
                    colorPicker.hide();
                    
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

                    if (!customColor) {
                        await applyColorToDecorations(originalColor);
                        await saveColorToConfiguration(originalColor);
                        colorPicker.dispose();
                        quickPick.dispose();
                        return;
                    }
                    
                    finalColor = customColor;
                } else {
                    // User selected a suggested color
                    finalColor = selectedColor.value;
                }

                colorPicker.dispose();
                quickPick.dispose();
                
                // Apply and save the selected color (suggested or custom)
                const success = await applyColorToDecorations(finalColor);
                if (success) {
                    await saveColorToConfiguration(finalColor);
                    const colorLabel = selectedColor.value === 'write-custom' ? finalColor : selectedColor.label;
                    vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${colorLabel}`);
                } else {
                    vscode.window.showErrorMessage('🎨 Failed to change color');
                }
            });

            // Handle cancel for suggested colors
            colorPicker.onDidHide(() => {
                if (colorPicker.selectedItems.length === 0) {
                    applyColorToDecorations(originalColor).then(() => {
                        saveColorToConfiguration(originalColor);
                    });
                }
                colorPicker.dispose();
                quickPick.dispose();
            });

            colorPicker.show();
        } else if (selectedItem.value === 'write-custom') {
            // User selected "Write Custom" directly from main menu
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

            // Apply and save the custom color
            const success = await applyColorToDecorations(customColor);
            if (success) {
                await saveColorToConfiguration(customColor);
                vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${customColor}`);
            } else {
                vscode.window.showErrorMessage('🎨 Failed to change color');
            }
        } else if (selectedItem.value === 'diagnostics') {
            // Show diagnostics
            quickPick.dispose();
            diagnoseColorSystem();
        } else {
            // User selected a direct color (from suggested colors in main menu)
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

    // Cancel - restore original color if user cancels without selecting
    quickPick.onDidHide(() => {
        if (quickPick.selectedItems.length === 0) {
            // User cancelled without selecting anything, restore original color
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

/**
 * Recreate all Bracket Lynx decorations with new color
 * Uses the proper Bracket Lynx methods instead of generic decoration handling
 */
async function recreateAllBracketLynxDecorations(overrideColor?: string): Promise<void> {
    if (!bracketLynxProvider) {
        return;
    }

    try {
        // If we have an override color, temporarily store it
        if (overrideColor) {
            currentColor = overrideColor;
        }
        
        // Step 1: Force color refresh if available
        if (typeof bracketLynxProvider.forceColorRefresh === 'function') {
            bracketLynxProvider.forceColorRefresh();
        } else {
            // Fallback to manual steps
            bracketLynxProvider.clearAllDecorations();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Clear decoration cache for all documents
            if (bracketLynxProvider.clearDecorationCache) {
                vscode.window.visibleTextEditors.forEach(editor => {
                    if (editor.document && bracketLynxProvider) {
                        bracketLynxProvider.clearDecorationCache!(editor.document);
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Trigger configuration change if available
            if (bracketLynxProvider.onDidChangeConfiguration) {
                bracketLynxProvider.onDidChangeConfiguration();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Force update all visible editors
            bracketLynxProvider.updateAllDecoration();

            // Additional force update for active editor
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
// COLOR UTILITIES
// ============================================================================

/**
 * Programmatically set color (for external use)
 */
export async function setColor(color: string): Promise<void> {
    if (!isValidHexColor(color)) {
        throw new Error(`Invalid hex color: ${color}`);
    }

    currentColor = color;
    
    // Save to configuration for persistence
    await saveColorToConfiguration(color);
    
    // Recreate all decorations with the new color
    await recreateAllBracketLynxDecorations(color);
}

/**
 * Save color to VS Code workspace configuration for persistence
 */
async function saveColorToConfiguration(color: string): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('bracketLynx');
        await config.update('color', color, vscode.ConfigurationTarget.Workspace);
        console.log(`🎨 Color saved to configuration: ${color}`);
    } catch (error) {
        // If workspace configuration fails, try global
        try {
            const config = vscode.workspace.getConfiguration('bracketLynx');
            await config.update('color', color, vscode.ConfigurationTarget.Global);
            console.log(`🎨 Color saved to global configuration: ${color}`);
        } catch (globalError) {
            console.warn(`🎨 Failed to save color to configuration:`, globalError);
            // Even if configuration save fails, we keep the color in memory
            // This prevents the "configuration not registered" error
        }
    }
}

/**
 * Load color from VS Code configuration with fallback
 */
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
    
    // Return default color if configuration fails
    return '#515151';
}

/**
 * Reset color to default
 */
export async function resetColorToDefault(): Promise<void> {
    const defaultColor = '#515151';
    await setColor(defaultColor);
    vscode.window.showInformationMessage('🎨 Bracket Lynx: Color reset to default gray');
}

/**
 * Initialize color system - call this when the provider is set
 */
export function initializeColorSystem(): void {
    // Load color from configuration with proper error handling
    currentColor = loadColorFromConfiguration();
    console.log(`🎨 Color system initialized with color: ${currentColor}`);
}

/**
 * Get the effective color that should be used for decorations
 * This function can be called by your lens system to get the current color
 */
export function getEffectiveColor(): string {
    return getCurrentColor();
}

/**
 * Get current color - now uses memory storage
 */
export function getCurrentColor(): string {
    return currentColor;
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * Get predefined color options
 */
export function getColorPresets(): ColorOption[] {
    return [
        { label: '⚫ Default Gray', value: '#515151', description: 'Default bracket color' },
        { label: '🔵 Dark Gray', value: '#535466', description: 'Dark blue decorations' },
        { label: '⚪ Light Gray', value: '#adb5bd', description: 'Light gray decorations' },
    ];
}

/**
 * Get suggested color options for custom color picker
 */
export function getSuggestedColors(): ColorOption[] {
    return [
        { label: '⚪ Light Gray', value: '#adb5bd', description: 'Light gray decorations' },
        { label: '🔵 Dark Gray', value: '#535466', description: 'Dark blue decorations' },
        { label: '🟡 Yellow', value: '#f1c40f', description: 'Bright yellow decorations' },
        { label: '🟢 Green', value: '#2ecc71', description: 'Green decorations' },
    ];
}

/**
 * Handle configuration changes from VS Code settings
 * This should be called when workspace configuration changes
 */
export async function onConfigurationChanged(): Promise<void> {
    const newColor = loadColorFromConfiguration();
    if (newColor !== currentColor && isValidHexColor(newColor)) {
        console.log(`🎨 Configuration changed, updating color from ${currentColor} to ${newColor}`);
        currentColor = newColor;
        
        // Recreate decorations with the new color
        if (bracketLynxProvider) {
            try {
                await recreateAllBracketLynxDecorations(newColor);
            } catch (error) {
                console.error('🎨 Error updating decorations after configuration change:', error);
            }
        }
    }
}

/**
 * Force reload color from configuration
 */
export async function reloadColorFromConfiguration(): Promise<void> {
    const configColor = loadColorFromConfiguration();
    if (configColor !== currentColor) {
        currentColor = configColor;
        if (bracketLynxProvider) {
            await recreateAllBracketLynxDecorations(configColor);
        }
    }
}

/**
 * Diagnose the color system and show status information
 */
async function diagnoseColorSystem(): Promise<void> {
    try {
        const configuration = vscode.workspace.getConfiguration();
        const currentColorFromConfig = configuration.get('bracketLynx.color', '#ffffff');
        const effectiveColor = getEffectiveColor();
        
        const workspaceConfig = vscode.workspace.getConfiguration('bracketLynx', vscode.workspace.workspaceFolders?.[0]?.uri);
        const globalConfig = vscode.workspace.getConfiguration('bracketLynx');
        
        const workspaceColor = workspaceConfig.get('color');
        const globalColor = globalConfig.get('color');
        
        const diagnosticInfo = [
            '🔧 **Bracket Lynx Color System Diagnostics**',
            '',
            `📊 **Current Status:**`,
            `• Current Color: \`${currentColorFromConfig}\``,
            `• Effective Color: \`${effectiveColor}\``,
            `• Is Valid: ${isValidHexColor(currentColorFromConfig) ? '✅ Yes' : '❌ No'}`,
            '',
            `⚙️ **Configuration Sources:**`,
            `• Workspace Color: ${workspaceColor ? `\`${workspaceColor}\`` : '❌ Not Set'}`,
            `• Global Color: ${globalColor ? `\`${globalColor}\`` : '❌ Not Set'}`,
            '',
            `🗂️ **Workspace Info:**`,
            `• Has Workspace: ${vscode.workspace.workspaceFolders ? '✅ Yes' : '❌ No'}`,
            `• Workspace Count: ${vscode.workspace.workspaceFolders?.length || 0}`,
            '',
            `💡 **Quick Actions:**`,
            `• Use "Change Color" to modify the current color`,
            `• Colors are saved automatically when changed`,
            `• Workspace settings override global settings`,
        ].join('\n');

        // Show diagnostics in a webview or information message
        const action = await vscode.window.showInformationMessage(
            `🔧 Color system is ${isValidHexColor(currentColorFromConfig) ? 'working properly' : 'having issues'}. Current color: ${currentColorFromConfig}`,
            'Show Details',
            'Test Color Preview',
            'Reset to Default'
        );

        if (action === 'Show Details') {
            const document = await vscode.workspace.openTextDocument({
                content: diagnosticInfo,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(document);
        } else if (action === 'Test Color Preview') {
            const originalColor = currentColorFromConfig;
            await recreateAllBracketLynxDecorations('#ff0000'); // Red test
            await new Promise(resolve => setTimeout(resolve, 1000));
            await recreateAllBracketLynxDecorations('#00ff00'); // Green test
            await new Promise(resolve => setTimeout(resolve, 1000));
            await recreateAllBracketLynxDecorations(originalColor); // Back to original
            vscode.window.showInformationMessage('🎨 Color preview test completed');
        } else if (action === 'Reset to Default') {
            await recreateAllBracketLynxDecorations('#ffffff');
            await saveColorToConfiguration('#ffffff');
            vscode.window.showInformationMessage('🎨 Color reset to default white');
        }
        
    } catch (error) {
        vscode.window.showErrorMessage(`🔧 Diagnostics failed: ${error}`);
    }
}