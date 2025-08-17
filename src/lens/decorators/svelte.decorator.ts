import * as vscode from 'vscode';
import { getCurrentColor } from '../../actions/colors';
import { isEditorEnabled, isExtensionEnabled } from '../../actions/toggle';
import { BracketLynxConfig } from '../lens';

// 🎯 TARGET ELEMENTS CONFIGURATION - GLOBAL MODULE CONSTANTS (Easy to maintain!)
const SVELTE_COMPONENTS = [
	'script', 'style', 'main', 'section', 'header', 'footer', 'aside', 'nav', 'slot',
	'svelte:head', 'svelte:body', 'svelte:window', 'svelte:options', 'svelte:fragment'
];

const TARGET_HTML_ELEMENTS = [
	'div', 'span', 'section', 'article', 'main', 'ul', 'li', 'button', 'form', 'table', 'p'
];

// 🎯 ULTRA-SPECIFIC Types for Svelte components and elements
export type SvelteComponentName = 'script' | 'style' | 'main' | 'header' | 'footer' | 'section' | 'article' | 'aside' | 'nav' | 'slot' | 'svelte:window' | 'svelte:body' | 'svelte:head' | 'svelte:options' | 'svelte:fragment';
export type HtmlElementName = 'div' | 'ul' | 'li' | 'span' | 'button' | 'form' | 'table' | 'p';
export type SupportedExtension = '.svelte';
export type SupportedLanguageId = 'svelte';

export interface ComponentRange {
	readonly name: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly range: vscode.Range;
	readonly hasContent: boolean;
	readonly componentType?: 'svelte' | 'html' | 'custom';
	readonly lineSpan?: number;
}

interface ComponentStackEntry {
	readonly name: string;
	readonly startLine: number;
	readonly timestamp?: number;
}

export class SvelteDecorator {
	private static decorationType: vscode.TextEditorDecorationType | undefined;
	private static readonly SUPPORTED_EXTENSIONS = ['.svelte'];
	private static readonly SUPPORTED_LANGUAGE_IDS = ['svelte'];

	private static ensureDecorationType(): vscode.TextEditorDecorationType {
		if (this.decorationType) {
			this.decorationType.dispose();
		}
		this.decorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: getCurrentColor(),
				fontStyle: BracketLynxConfig.fontStyle,
			},
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
		});
		return this.decorationType;
	}

	public static updateDecorations(editor: vscode.TextEditor): void {
		if (!editor || !this.isSupportedFile(editor.document)) {
			return;
		}
		// Check if this specific editor should have decorations
		const editorEnabled = isEditorEnabled(editor);
		const extensionEnabled = isExtensionEnabled();

		if (!extensionEnabled && !editorEnabled) {
			this.clearDecorations(editor);
			return;
		}

		if (!editorEnabled) {
			this.clearDecorations(editor);
			return;
		}
		if (!this.shouldProcessFile(editor.document)) {
			this.clearDecorations(editor);
			return;
		}
		try {
			const decorationType = this.ensureDecorationType();
			const decorations = this.generateDecorations(editor.document);
			editor.setDecorations(decorationType, decorations);
			if (BracketLynxConfig.debug) {
				console.log(`Svelte Decorator: Applied ${decorations.length} decorations to Svelte file: ${editor.document.fileName}`);
				console.log(`Svelte Decorator: Extension enabled: ${extensionEnabled}, Editor enabled: ${editorEnabled}`);
			}
		} catch (error) {
			console.error('Svelte Decorator: Error updating decorations:', error);
			this.clearDecorations(editor);
		}
	}

	private static generateDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
		const decorations: vscode.DecorationOptions[] = [];
		const text = document.getText();
		const lines = text.split('\n');
		const componentRanges = this.findComponentRanges(lines);

		for (const component of componentRanges) {
			if (component.hasContent && this.shouldShowDecoration(component)) {
				const prefix = BracketLynxConfig.prefix.replace('‹~', '‹~').trim();
				const decorationText = `${prefix} #${component.startLine}-${component.endLine} •${component.name}`;
				const decoration: vscode.DecorationOptions = {
					range: component.range,
					renderOptions: {
						after: {
							contentText: decorationText,
							color: getCurrentColor(),
							fontStyle: BracketLynxConfig.fontStyle
						}
					}
				};
				decorations.push(decoration);
			}
		}
		const maxDecorations = BracketLynxConfig.maxDecorationsPerFile;
		if (decorations.length > maxDecorations) {
			if (BracketLynxConfig.debug) {
				console.log(`Svelte Decorator: Limiting decorations from ${decorations.length} to ${maxDecorations}`);
			}
			return decorations.slice(0, maxDecorations);
		}
		return decorations;
	}

	private static readonly OPEN_TAG_REGEX = /<(\w+)(?:\s+[^>]*)?(?<!\/)\s*>/;
	private static readonly CLOSE_TAG_REGEX = /<\/(\w+)\s*>/;
	private static readonly TAG_DETECTOR_REGEX = /<[^>]+>/;

	private static findComponentRanges(lines: string[]): ComponentRange[] {
		const componentStack: ComponentStackEntry[] = [];
		const componentRanges: ComponentRange[] = [];
		const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line || !this.TAG_DETECTOR_REGEX.test(line)) {continue;}
			const trimmedLine = line.trim();
			const openTagMatch = trimmedLine.match(this.OPEN_TAG_REGEX);
			if (openTagMatch) {
				const componentName = openTagMatch[1];
				if (this.isTargetElement(componentName)) {
					componentStack.push({
						name: componentName,
						startLine: i + 1,
						timestamp: BracketLynxConfig.debug ? Date.now() : undefined
					});
				}
				continue;
			}
			const closeTagMatch = trimmedLine.match(this.CLOSE_TAG_REGEX);
			if (closeTagMatch) {
				const componentName = closeTagMatch[1];
				for (let j = componentStack.length - 1; j >= 0; j--) {
					if (componentStack[j].name === componentName) {
						const openComponent = componentStack[j];
						componentStack.splice(j, 1);
						const lineSpan = (i + 1) - openComponent.startLine;
						if (lineSpan >= minLines && this.hasSignificantContent(lines, openComponent.startLine - 1, i)) {
							const componentType = this.isSvelteComponent(componentName) ? 'svelte' : 'html';
							componentRanges.push({
								name: componentName,
								startLine: openComponent.startLine,
								endLine: i + 1,
								range: new vscode.Range(i, line.length, i, line.length),
								hasContent: true,
								componentType,
								lineSpan
							});
						}
						break;
					}
				}
			}
		}
		return componentRanges;
	}

	private static isTargetElement(tagName: string): boolean {
		return this.isSvelteComponent(tagName) || this.isTargetHtmlElement(tagName);
	}

	private static isSvelteComponent(tagName: string): boolean {
		return SVELTE_COMPONENTS.includes(tagName) || (tagName[0] === tagName[0].toUpperCase());
	}

	private static isTargetHtmlElement(tagName: string): boolean {
		return TARGET_HTML_ELEMENTS.includes(tagName);
	}

	private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number): boolean {
		// 🚀 Quick validation - avoid processing if range is too small
		if (endIndex - startIndex < 2) {
			return false;
		}

		// 🎯 Smart tag detection
		const openingLine = lines[startIndex]?.trim();
		if (!openingLine) {
			return false;
		}

		const tagMatch = openingLine.match(/<(\w+)/);
		const tagName = tagMatch?.[1]?.toLowerCase();
		const isSpecialTag = tagName === 'style' || tagName === 'script';

		// 🔥 OPTIMIZED Content Scanner - Early exit on first significant content
		for (let i = startIndex + 1; i < endIndex; i++) {
			const contentLine = lines[i]?.trim();

			// Skip empty lines and basic symbols
			if (!contentLine || contentLine === '{' || contentLine === '}' ||
				contentLine.startsWith('<!--') || contentLine.endsWith('-->')) {
				continue;
			}

			// 🔥 INSTANT RETURN for special tags - no need to count
			if (isSpecialTag) {
				return true;
			}

			// 🚀 IMMEDIATE SUCCESS - Found significant content!
			return true;
		}

		return false;
	}

	private static shouldShowDecoration(component: ComponentRange): boolean {
		const lineSpan = component.endLine - component.startLine;
		const minLines = Math.max(1, BracketLynxConfig.minBracketScopeLines - 2);

		return lineSpan >= minLines;
	}

	private static isSupportedFile(document: vscode.TextDocument): boolean {
		const hasValidExtension = this.SUPPORTED_EXTENSIONS.some(ext =>
			document.fileName.endsWith(ext)
		);
		const hasValidLanguageId = this.SUPPORTED_LANGUAGE_IDS.includes(document.languageId);

		return hasValidExtension || hasValidLanguageId;
	}

	private static shouldProcessFile(document: vscode.TextDocument): boolean {
		if (!BracketLynxConfig.enablePerformanceFilters) {
			return true;
		}

		const fileSize = document.getText().length;
		const maxFileSize = BracketLynxConfig.maxFileSize;

		if (fileSize > maxFileSize) {
			if (BracketLynxConfig.debug) {
				console.log(`Svelte Decorator: Skipping large Svelte file: ${document.fileName} (${fileSize} bytes)`);
			}
			return false;
		}

		return true;
	}

	public static clearDecorations(editor: vscode.TextEditor): void {
		if (this.decorationType && editor) {
			editor.setDecorations(this.decorationType, []);
		}
	}

	public static clearAllDecorations(): void {
		if (this.decorationType) {
			vscode.window.visibleTextEditors
				.filter(editor => this.isSupportedFile(editor.document))
				.forEach(editor => this.clearDecorations(editor));
		}
	}

	public static onDidChangeConfiguration(): void {
		if (this.decorationType) {
			this.decorationType.dispose();
			this.decorationType = undefined;
		}
	}

	/**
	 * Force refresh color for all decorations - called by color system
	 */
	public static forceColorRefresh(): void {
		// Dispose current decoration type to force recreation with new color
		if (this.decorationType) {
			this.decorationType.dispose();
			this.decorationType = undefined;
		}

		// Clear all existing decorations
		this.clearAllDecorations();

		// Small delay to ensure cleanup is complete
		setTimeout(() => {
			// Update all visible editors with supported files
			vscode.window.visibleTextEditors
				.filter(editor => this.isSupportedFile(editor.document))
				.forEach(editor => {
					// Force update regardless of current state for color refresh
					if (isEditorEnabled(editor)) {
						this.updateDecorations(editor);
						console.log(`Svelte Decorator: Force refreshed color for ${editor.document.fileName}`);
					}
				});
		}, 50);
	}

	public static dispose(): void {
		if (this.decorationType) {
			this.decorationType.dispose();
			this.decorationType = undefined;
		}
	}
}

export default SvelteDecorator;
