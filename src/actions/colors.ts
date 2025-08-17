import * as vscode from 'vscode';
import { isExtensionEnabled } from './toggle';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
const DEFAULT_COLOR = '#515151';
const DECORATION_CLEAR_DELAY = 50;
const INITIALIZATION_DELAY = 100;

// ============================================================================
// INTERFACES
// ============================================================================
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

// ============================================================================
// STATE VARIABLES
// ============================================================================
let bracketLynxProvider: IBracketLynxProvider | undefined = undefined;
let universalDecorator: any = undefined;
let currentColor: string = DEFAULT_COLOR;

// ============================================================================
// PROVIDER SETTERS
// ============================================================================
export function setBracketLynxProviderForColors(provider: IBracketLynxProvider): void {
	bracketLynxProvider = provider;
}

export function setAstroDecoratorForColors(decorator: any): void {
	universalDecorator = decorator;
}

export function setVueDecoratorForColors(decorator: any): void {
	universalDecorator = decorator;
}

export function setSvelteDecoratorForColors(decorator: any): void {
	universalDecorator = decorator;
}

// ============================================================================
// COLOR PICKER SYSTEM
// ============================================================================
function getAvailableColors(): ColorOption[] {
  return [
    { label: '⚫ Default Gray', value: '#515151', description: 'Default bracket color' },
    { label: '⚪ Light Gray', value: '#adb5bd', description: 'Light gray decorations' },
    { label: '🔵 Blue', value: '#4a4d66', description: 'Dark blue decorations' },
    { label: '🟡 Yellow', value: '#9d956b', description: 'Subtle yellow-beige' },
    { label: '🟢 Green', value: '#6b7c5d', description: 'Muted sage green decorations' },
    { label: '🟣 Purple', value: '#6d5d73', description: 'Soft purple-gray decorations' },
    { label: '✏️ Write Custom', value: 'write-custom', description: 'Enter your own hex color' },
  ];
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

  const applyColorToDecorations = async (color: string, isPreview: boolean = false): Promise<boolean> => {
    try {
      if (isPreview && !previewState.isActive) {
        previewState = { isActive: true, originalColor: currentColor };
        console.log(`🎨 Starting color preview: ${color} (was: ${currentColor})`);
      }

      if (!isPreview) {
        previewState.isActive = false;
        console.log(`🎨 Applying final color: ${color}`);
      }

      currentColor = color;

      if (bracketLynxProvider && isExtensionEnabled()) {
        await recreateAllBracketLynxDecorations(color);
        console.log(`🎨 Color ${isPreview ? 'preview' : 'application'} completed successfully`);
        return true;
      } else {
        const reason = !bracketLynxProvider ? 'Provider not initialized' : 'Extension disabled';
        console.warn(`🎨 Cannot apply color: ${reason}`);
        return false;
      }
    } catch (error) {
      console.error('🎨 Error applying color:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`🎨 Failed to apply color: ${errorMessage}`);

      // Try to restore previous state on error
      if (isPreview && previewState.isActive) {
        try {
          currentColor = previewState.originalColor;
          await recreateAllBracketLynxDecorations(previewState.originalColor);
          console.log('🎨 Restored original color after error');
        } catch (restoreError) {
          console.error('🎨 Failed to restore original color:', restoreError);
        }
      }

      return false;
    }
  };

  const restoreOriginalColor = async (): Promise<void> => {
    if (previewState.isActive) {
      try {
        console.log(`🎨 Restoring original color: ${previewState.originalColor}`);
        currentColor = previewState.originalColor;
        previewState.isActive = false;
        await recreateAllBracketLynxDecorations(previewState.originalColor);
        console.log('🎨 Original color restored successfully');
      } catch (error) {
        console.error('🎨 Error restoring original color:', error);
        vscode.window.showErrorMessage('🎨 Failed to restore original color');
      }
    }
  };

  quickPick.onDidChangeActive(async (items) => {
    if (items.length > 0) {
      const item = items[0];
      if (item.value !== 'write-custom') {
        try {
          const success = await applyColorToDecorations(item.value, true);
          if (!success) {
            console.warn(`🎨 Preview failed for color: ${item.value}`);
          }
        } catch (error) {
          console.error('🎨 Error during color preview:', error);
        }
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
        await restoreOriginalColor();
        return;
      }

      const success = await applyColorToDecorations(customColor, false);
      if (success) {
        await saveColorToConfiguration(customColor);
        vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${customColor}`);
      } else {
        vscode.window.showErrorMessage('🎨 Failed to change color');
        await restoreOriginalColor();
      }
    } else {
      quickPick.dispose();

      const finalColor = selectedItem.value;
      const success = await applyColorToDecorations(finalColor, false);
      if (success) {
        await saveColorToConfiguration(finalColor);
        vscode.window.showInformationMessage(`🎨 Bracket Lynx: Color changed to ${selectedItem.label}`);
      } else {
        vscode.window.showErrorMessage('🎨 Failed to change color');
        await restoreOriginalColor();
      }
    }
  });

  quickPick.onDidHide(() => {
    if (quickPick.selectedItems.length === 0) {
      restoreOriginalColor().catch((error) => {
        console.error('🎨 Error restoring original color:', error);
      });
    }
    quickPick.dispose();
  });

  quickPick.show();
}

// ============================================================================
// DECORATION MANAGEMENT
// ============================================================================
async function recreateAllBracketLynxDecorations(overrideColor?: string): Promise<void> {
  if (!bracketLynxProvider) {
    console.warn('🎨 No bracket provider available for color refresh');
    return;
  }

  try {
    if (overrideColor) {
      currentColor = overrideColor;
    }

    console.log(`🎨 Recreating decorations with color: ${currentColor}`);

    // Clear all existing decorations from all providers simultaneously
    const decorators = [
      { name: 'Main', decorator: bracketLynxProvider },
      { name: 'Universal', decorator: universalDecorator }
    ];

    // Clear all decorators
    decorators.forEach(({ name, decorator }) => {
      if (decorator && decorator.clearAllDecorations) {
        try {
          decorator.clearAllDecorations();
          console.log(`🎨 Cleared ${name} decorator decorations`);
        } catch (error) {
          console.warn(`🎨 Warning: Error clearing ${name} decorator decorations:`, error);
        }
      }
    });

    // Wait for all clears to complete
    await new Promise((resolve) => setTimeout(resolve, DECORATION_CLEAR_DELAY));

    // Refresh main provider
    try {
      if (bracketLynxProvider.forceColorRefresh) {
        bracketLynxProvider.forceColorRefresh();
        console.log('🎨 Main provider color refreshed');
      } else {
        if (bracketLynxProvider.onDidChangeConfiguration) {
          bracketLynxProvider.onDidChangeConfiguration();
        }
        await new Promise((resolve) => setTimeout(resolve, DECORATION_CLEAR_DELAY));
        bracketLynxProvider.updateAllDecoration();
        console.log('🎨 Main provider fallback refresh completed');
      }
    } catch (error) {
      console.error('🎨 Error refreshing main provider:', error);
    }

    // Small delay to ensure main provider refresh is complete
    await new Promise((resolve) => setTimeout(resolve, DECORATION_CLEAR_DELAY));

    // Refresh framework-specific decorators
    const refreshPromises = decorators.slice(1).map(async ({ name, decorator }) => {
      if (decorator && decorator.forceColorRefresh) {
        try {
          decorator.forceColorRefresh();
          console.log(`🎨 ${name} decorator color refreshed`);
          return true;
        } catch (error) {
          console.warn(`🎨 Warning: Error refreshing ${name} decorator:`, error);
          return false;
        }
      }
      return null;
    });

    const refreshResults = await Promise.allSettled(refreshPromises);
    const successfulRefreshes = refreshResults.filter(
      (result, index) => result.status === 'fulfilled' && result.value === true
    ).length;

    console.log(`🎨 Color refresh completed: ${successfulRefreshes}/${decorators.length - 1} decorators refreshed successfully`);

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

  // Wait for all decorators to be properly initialized
  setTimeout(async () => {
    try {
      const decoratorStatus = {
        main: !!bracketLynxProvider,
        universal: !!universalDecorator
      };

      console.log('🎨 Decorator initialization status:', decoratorStatus);

      if (bracketLynxProvider) {
        console.log(`🎨 Applying initial color decorations: ${currentColor}`);
        await recreateAllBracketLynxDecorations(currentColor);
        console.log('🎨 Initial color decorations applied successfully');
      } else {
        console.warn('🎨 Main bracket provider not available during initialization');
      }
    } catch (error) {
      console.error('🎨 Error applying initial color decorations:', error);
      try {
        currentColor = DEFAULT_COLOR;
        console.log(`🎨 Falling back to default color: ${DEFAULT_COLOR}`);
      } catch (fallbackError) {
        console.error('🎨 Failed to fallback to default color:', fallbackError);
      }
    }
  }, INITIALIZATION_DELAY);
}

export function getEffectiveColor(): string {
  return currentColor;
}

export function getCurrentColor(): string {
  return currentColor;
}

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
  console.log(`🎨 Configuration changed - new color: ${newColor}, current color: ${currentColor}`);

  if (isValidHexColor(newColor)) {
    const wasColorChanged = newColor !== currentColor;
    currentColor = newColor;

    console.log(`🎨 Color ${wasColorChanged ? 'changed' : 'unchanged'} - updating to: ${currentColor}`);

    if (bracketLynxProvider && wasColorChanged) {
      try {
        await recreateAllBracketLynxDecorations(newColor);
        console.log('🎨 Decorations updated successfully');
      } catch (error) {
        console.error('🎨 Error updating decorations after configuration change:', error);
      }
    }
  } else {
    console.warn(`🎨 Invalid color detected: ${newColor}`);
    const fallbackColor = isValidHexColor(currentColor) ? currentColor : DEFAULT_COLOR;
    currentColor = fallbackColor;

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
      vscode.window.showWarningMessage('🎨 No valid global color configuration found');
    }
  } catch (error) {
    console.error('🎨 Error restoring color from global:', error);
    vscode.window.showErrorMessage('🎨 Failed to restore color from global settings');
  }
}

export async function resetColorToDefault(): Promise<void> {
  try {
    currentColor = DEFAULT_COLOR;
    await saveColorToConfiguration(DEFAULT_COLOR);

    if (bracketLynxProvider) {
      await recreateAllBracketLynxDecorations(DEFAULT_COLOR);
    }

    console.log(`🎨 Color reset to default: ${DEFAULT_COLOR}`);
  } catch (error) {
    console.error('🎨 Error resetting color to default:', error);
    throw error;
  }
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================
export function getDecoratorDiagnostics(): {
  main: { available: boolean; hasForceRefresh: boolean; hasUpdateAll: boolean; hasClearAll: boolean };
  astro: { available: boolean; hasForceRefresh: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
  vue: { available: boolean; hasForceRefresh: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
  svelte: { available: boolean; hasForceRefresh: boolean; hasUpdateDecorations: boolean; hasClearAll: boolean };
  currentColor: string;
  isExtensionEnabled: boolean;
} {
  return {
    main: {
      available: !!bracketLynxProvider,
      hasForceRefresh: !!(bracketLynxProvider?.forceColorRefresh),
      hasUpdateAll: !!(bracketLynxProvider?.updateAllDecoration),
      hasClearAll: !!(bracketLynxProvider?.clearAllDecorations)
    },
    astro: {
      available: !!universalDecorator,
      hasForceRefresh: !!(universalDecorator?.forceColorRefresh),
      hasUpdateDecorations: !!(universalDecorator?.updateDecorations),
      hasClearAll: !!(universalDecorator?.clearAllDecorations)
    },
    vue: {
      available: !!universalDecorator,
      hasForceRefresh: !!(universalDecorator?.forceColorRefresh),
      hasUpdateDecorations: !!(universalDecorator?.updateDecorations),
      hasClearAll: !!(universalDecorator?.clearAllDecorations)
    },
    svelte: {
      available: !!universalDecorator,
      hasForceRefresh: !!(universalDecorator?.forceColorRefresh),
      hasUpdateDecorations: !!(universalDecorator?.updateDecorations),
      hasClearAll: !!(universalDecorator?.clearAllDecorations)
    },
    currentColor,
    isExtensionEnabled: isExtensionEnabled()
  };
}

export async function debugColorRefresh(): Promise<void> {
  const diagnostics = getDecoratorDiagnostics();
  console.log('🎨 Decorator diagnostics:', diagnostics);

  if (!diagnostics.isExtensionEnabled) {
    console.warn('🎨 Extension is disabled - cannot test color refresh');
    return;
  }

  try {
    console.log('🎨 Testing color refresh for all decorators...');
    await recreateAllBracketLynxDecorations();
    console.log('🎨 ✅ Color refresh test completed successfully - all decorators should be updated');
  } catch (error) {
    console.error('🎨 ❌ Color refresh test failed - check decorator initialization:', error);
  }
}

export function validateDecoratorStatus(): {
  isValid: boolean;
  status: string;
  issues: string[];
  recommendations: string[];
} {
  const diagnostics = getDecoratorDiagnostics();
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check main provider
  if (!diagnostics.main.available) {
    issues.push('Main bracket provider is not initialized');
    recommendations.push('Restart VS Code or reload the extension');
  } else if (!diagnostics.main.hasForceRefresh) {
    issues.push('Main provider missing forceColorRefresh method');
    recommendations.push('Update to latest version of Bracket Lynx');
  }

  // Check framework decorators
  const frameworks = [
    { name: 'Astro', data: diagnostics.astro },
    { name: 'Vue', data: diagnostics.vue },
    { name: 'Svelte', data: diagnostics.svelte }
  ];

  frameworks.forEach(({ name, data }) => {
    if (data.available && !data.hasForceRefresh) {
      issues.push(`${name} decorator missing forceColorRefresh method`);
      recommendations.push(`${name} decorator may need updating`);
    }
  });

  if (!diagnostics.isExtensionEnabled) {
    issues.push('Extension is currently disabled');
    recommendations.push('Enable Bracket Lynx extension in settings or command palette');
  }

  const isValid = issues.length === 0 && diagnostics.main.available;
  const availableDecorators = frameworks.filter(f => f.data.available).length;

  let status: string;
  if (isValid) {
    status = `✅ All decorators ready (${availableDecorators + 1}/4 loaded)`;
  } else {
    status = `⚠️ ${issues.length} issue(s) detected`;
  }

  return {
    isValid,
    status,
    issues,
    recommendations
  };
}
