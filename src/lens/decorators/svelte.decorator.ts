import * as vscode from 'vscode';
import { getCurrentColor } from '../../actions/colors';
import { isEditorEnabled, isExtensionEnabled } from '../../actions/toggle';
import { BracketLynxConfig } from '../lens';

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
		if (!isExtensionEnabled() || !isEditorEnabled(editor)) {
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
		const svelteElements = [
			'script', 'style', 'main', 'section', 'header', 'footer', 'aside', 'nav', 'slot',
			'svelte:head', 'svelte:body', 'svelte:window', 'svelte:options', 'svelte:fragment'
		];
		return svelteElements.includes(tagName) || (tagName[0] === tagName[0].toUpperCase());
	}

	private static isTargetHtmlElement(tagName: string): boolean {
		const targetHtmlElements = [
			'div', 'span', 'section', 'article', 'main', 'ul', 'li', 'button', 'form', 'table', 'p'
		];
		return targetHtmlElements.includes(tagName);
	}

	private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number): boolean {
		for (let i = startIndex + 1; i < endIndex; i++) {
			const line = lines[i];
			if (line && line.trim() !== '') {
				return true;
			}
		}
		return false;
	}

	private static shouldShowDecoration(component: ComponentRange): boolean {
		return typeof component.lineSpan === 'number' && component.lineSpan >= BracketLynxConfig.minBracketScopeLines;
	}

	private static isSupportedFile(document: vscode.TextDocument): boolean {
		return this.SUPPORTED_EXTENSIONS.some(ext => document.fileName.endsWith(ext)) ||
			this.SUPPORTED_LANGUAGE_IDS.includes(document.languageId);
	}

	private static shouldProcessFile(document: vscode.TextDocument): boolean {
		return this.isSupportedFile(document);
	}

	public static clearDecorations(editor: vscode.TextEditor): void {
		if (this.decorationType) {
			editor.setDecorations(this.decorationType, []);
		}
	}

	public static clearAllDecorations(): void {
		vscode.window.visibleTextEditors.forEach(editor => {
			this.clearDecorations(editor);
		});
	}

	public static onDidChangeConfiguration(): void {
		this.clearAllDecorations();
		vscode.window.visibleTextEditors.forEach(editor => {
			this.updateDecorations(editor);
		});
	}

	public static dispose(): void {
		if (this.decorationType) {
			this.decorationType.dispose();
			this.decorationType = undefined;
		}
	}
}

export default SvelteDecorator;
