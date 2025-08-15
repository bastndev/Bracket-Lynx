import * as vscode from 'vscode';
import { isExtensionEnabled } from './toggle';

// Configuration constants
const DEFAULT_COLOR = '#515151';
const DECORATION_CLEAR_DELAY = 50;
const INITIALIZATION_DELAY = 100;

interface ColorOption extends vscode.QuickPickItem {
  value: string;
}

export interface IBracketLynxProvider {
  clearAllDecorations(): void;
  updateAllDecoration(): void;
  clearEditorDecorations?(editor: vscode.TextEditor): void;
  onDidChangeConfiguration?(): void;
  forceColorRefresh?(): void;
}

let bracketLynxProvider: IBracketLynxProvider | undefined = undefined;
let astroDecorator: any = undefined;
let currentColor: string = DEFAULT_COLOR;

/**
 * Get available color presets for the color picker
 */
function getAvailableColors(): ColorOption[] {
  return [
    {
      label: '⚫ Default Gray',
      value: '#515151',
      description: 'Default bracket color',
    },
    {
      label: '⚪ Light Gray',
      value: '#adb5bd',
      description: 'Light gray decorations',
    },
    {
      label: '🔵 Dark Blue',
      value: '#4a4d66',
      description: 'Dark blue decorations',
    },
    {
      label: '🟡 Muted Yellow',
      value: '#9d956b',
      description: 'Subtle yellow-beige',
    },
    {
      label: '🟢 Sage Green',
      value: '#6b7c5d',
      description: 'Muted sage green decorations',
    },
    {
      label: '🟣 Dusty Purple',
      value: '#6d5d73',
      description: 'Soft purple-gray decorations',
    },
    {
      label: '✏️ Write Custom',
      value: 'write-custom',
      description: 'Enter your own hex color',
    },
  ];
}

export function setBracketLynxProviderForColors(
  provider: IBracketLynxProvider
): void {
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

  let previewState: { isActive: boolean; originalColor: string } = {
    isActive: false,
    originalColor: currentColor,
  };

  const applyColorToDecorations = async (
    color: string,
    isPreview: boolean = false
  ): Promise<boolean> => {
    try {
      if (isPreview && !previewState.isActive) {
        previewState = { isActive: true, originalColor: currentColor };
      }

      if (!isPreview) {
        previewState.isActive = false;
      }

      currentColor = color;

      if (bracketLynxProvider && isExtensionEnabled()) {
        await recreateAllBracketLynxDecorations(color);
        return true;
      }
      return false;
    } catch (error) {
      console.error('🎨 Error applying color:', error);
      vscode.window.showErrorMessage(`Failed to apply color: ${error}`);
      return false;
    }
  };

  const restoreOriginalColor = async (): Promise<void> => {
    if (previewState.isActive) {
      currentColor = previewState.originalColor;
      previewState.isActive = false;
      await recreateAllBracketLynxDecorations(previewState.originalColor);
    }
  };

  quickPick.onDidChangeActive(async (items) => {
    if (items.length > 0) {
      const item = items[0];
      if (item.value !== 'write-custom') {
        // Apply color as preview (temporary)
        await applyColorToDecorations(item.value, true);
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
          if (!value) {
            return 'Color is required';
          }
          if (!isValidHexColor(value)) {
            return 'Please enter a valid hex color (e.g., #ff6b6b)';
          }
          return null;
        },
      });

      quickPick.dispose();

      if (!customColor) {
        // Restore original color if user cancels
        await restoreOriginalColor();
        return;
      }

      // Apply final color (not preview)
      const success = await applyColorToDecorations(customColor, false);
      if (success) {
        await saveColorToConfiguration(customColor);
        vscode.window.showInformationMessage(
          `🎨 Bracket Lynx: Color changed to ${customColor}`
        );
      } else {
        vscode.window.showErrorMessage('🎨 Failed to change color');
        await restoreOriginalColor();
      }
    } else {
      quickPick.dispose();

      // Apply final color (not preview)
      const finalColor = selectedItem.value;
      const success = await applyColorToDecorations(finalColor, false);
      if (success) {
        await saveColorToConfiguration(finalColor);
        vscode.window.showInformationMessage(
          `🎨 Bracket Lynx: Color changed to ${selectedItem.label}`
        );
      } else {
        vscode.window.showErrorMessage('🎨 Failed to change color');
        await restoreOriginalColor();
      }
    }
  });

  quickPick.onDidHide(() => {
    if (quickPick.selectedItems.length === 0) {
      // User cancelled without selecting - restore original color
      restoreOriginalColor().catch((error) => {
        console.error('🎨 Error restoring original color:', error);
      });
    }
    quickPick.dispose();
  });

  quickPick.show();
}

/**
 * Recreate all bracket decorations with the specified color
 */
async function recreateAllBracketLynxDecorations(
  overrideColor?: string
): Promise<void> {
  if (!bracketLynxProvider) {
    return;
  }

  try {
    if (overrideColor) {
      currentColor = overrideColor;
    }

    console.log(`🎨 Recreating decorations with color: ${currentColor}`);

    // Clear all existing decorations first
    bracketLynxProvider.clearAllDecorations();

    // Small delay to ensure decorations are cleared
    await new Promise((resolve) => setTimeout(resolve, DECORATION_CLEAR_DELAY));

    // Force color refresh if available (this should handle the cache clearing and updating)
    if (bracketLynxProvider.forceColorRefresh) {
      bracketLynxProvider.forceColorRefresh();
    } else {
      // Fallback: trigger configuration change and update manually
      if (bracketLynxProvider.onDidChangeConfiguration) {
        bracketLynxProvider.onDidChangeConfiguration();
      }

      await new Promise((resolve) =>
        setTimeout(resolve, DECORATION_CLEAR_DELAY)
      );

      // Update all decorations with new color
      bracketLynxProvider.updateAllDecoration();
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
  const config = vscode.workspace.getConfiguration('bracketLynx');
  try {
    await config.update('color', color, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.warn(`🎨 Failed to save color to configuration:`, error);
    throw error;
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

  return DEFAULT_COLOR;
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

  // Register listener for configuration changes
  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('bracketLynx.color')) {
      console.log('🎨 Configuration change detected for bracketLynx.color');
      await onConfigurationChanged();
    }
  });

  if (bracketLynxProvider) {
    setTimeout(async () => {
      try {
        console.log(`🎨 Applying initial color decorations: ${currentColor}`);
        await recreateAllBracketLynxDecorations(currentColor);
      } catch (error) {
        console.error('🎨 Error applying initial color decorations:', error);
      }
    }, INITIALIZATION_DELAY);
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
  console.log(
    `🎨 Configuration changed - new color: ${newColor}, current color: ${currentColor}`
  );

  if (isValidHexColor(newColor)) {
    const wasColorChanged = newColor !== currentColor;
    currentColor = newColor;

    console.log(
      `🎨 Color ${
        wasColorChanged ? 'changed' : 'unchanged'
      } - updating to: ${currentColor}`
    );

    if (bracketLynxProvider && wasColorChanged) {
      try {
        await recreateAllBracketLynxDecorations(newColor);
        console.log('🎨 Decorations updated successfully');
      } catch (error) {
        console.error(
          '🎨 Error updating decorations after configuration change:',
          error
        );
      }
    }
  } else {
    console.warn(`🎨 Invalid color detected: ${newColor}`);
    // If the color is invalid, keep the current color and save a valid one
    const fallbackColor = isValidHexColor(currentColor)
      ? currentColor
      : DEFAULT_COLOR;
    currentColor = fallbackColor;

    // Save the valid color back to the configuration
    try {
      await saveColorToConfiguration(fallbackColor);
      console.log(`🎨 Fallback color saved: ${fallbackColor}`);
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
        vscode.window.showInformationMessage(
          `🎨 Bracket Lynx: Color restored from global settings: ${globalColor}`
        );
      }
    } else {
      vscode.window.showWarningMessage(
        '🎨 No valid global color configuration found'
      );
    }
  } catch (error) {
    console.error('🎨 Error restoring color from global:', error);
    vscode.window.showErrorMessage(
      '🎨 Failed to restore color from global settings'
    );
  }
}
