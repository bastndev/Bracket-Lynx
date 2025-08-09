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

    const colorOptions: ColorOption[] = [
        { label: '⚫ Default Gray', value: '#515151', description: 'Default bracket color' },
        { label: '🔵 Dark Gray', value: '#535466', description: 'Dark blue decorations' },
        { label: '⚪ Light Gray', value: '#adb5bd', description: 'Light gray decorations' },
        { label: '✏️ Custom', value: 'custom', description: 'Enter custom hex color' },
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

    // Preview during navigation
    quickPick.onDidChangeActive(async (items) => {
        if (items.length > 0 && items[0].value !== 'custom') {
            await applyColorToDecorations(items[0].value);
        }
    });

    // Final selection
    quickPick.onDidAccept(async () => {
        const selectedItem = quickPick.selectedItems[0];
        if (!selectedItem) {
            quickPick.dispose();
            return;
        }

        let finalColor = selectedItem.value;

        if (selectedItem.value === 'custom') {
            quickPick.hide();
            
            const customColor = await vscode.window.showInputBox({
                prompt: 'Enter hex color for bracket decorations',
                placeHolder: '#ffffff',
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
                quickPick.dispose();
                return;
            }
            
            finalColor = customColor;
        }

        // Apply final color with success feedback
        const success = await applyColorToDecorations(finalColor);
        
        if (success) {
            const colorLabel = selectedItem.value === 'custom' ? finalColor : selectedItem.label;
            vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${colorLabel}`);
        } else {
            vscode.window.showErrorMessage('🎨 Failed to change color');
        }
        
        quickPick.dispose();
    });

    // Cancel - restore original color
    quickPick.onDidHide(() => {
        if (quickPick.selectedItems.length === 0 || 
                quickPick.selectedItems[0]?.value !== 'custom') {
            applyColorToDecorations(originalColor);
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
    
    // Recreate all decorations with the new color
    await recreateAllBracketLynxDecorations(color);
}

/**
 * Reset color to default
 */
export async function resetColorToDefault(): Promise<void> {
    await setColor('#515151');
    vscode.window.showInformationMessage('🎨 Bracket Lynx: Color reset to default gray');
}

/**
 * Initialize color system - call this when the provider is set
 */
export function initializeColorSystem(): void {
    // Set initial color from configuration if available
    try {
        const config = vscode.workspace.getConfiguration('bracketLynx');
        const configColor = config.get('color', '#515151');
        if (configColor && configColor !== '#515151') {
            currentColor = configColor;
        }
    } catch (error) {
        // Use default color
    }
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