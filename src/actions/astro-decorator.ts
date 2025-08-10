/* import * as vscode from 'vscode';
import { BracketLynxConfig } from '../lens/lens';
import { isAstroEnabled } from '../actions/toggle';

export interface AstroComponentRange {
    name: string;
    startLine: number;
    endLine: number;
    range: vscode.Range;
    hasContent: boolean;
}

export class AstroDecorator {
    private static decorationType: vscode.TextEditorDecorationType | undefined;

    private static ensureDecorationType(): vscode.TextEditorDecorationType {
        if (this.decorationType) {
            this.decorationType.dispose();
        }

        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: BracketLynxConfig.color,
                fontStyle: BracketLynxConfig.fontStyle,
                margin: '0 0 0 1em',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        return this.decorationType;
    }

    public static updateAstroDecorations(editor: vscode.TextEditor): void {
        if (!editor || !editor.document.fileName.endsWith('.astro')) {
            return;
        }

        if (!isAstroEnabled()) {
            this.clearDecorations(editor);
            return;
        }

        const decorationType = this.ensureDecorationType();
        const decorations = this.generateAstroDecorations(editor.document);
        editor.setDecorations(decorationType, decorations);
    }

    private static generateAstroDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        const componentRanges = this.findComponentRanges(lines);

        for (const component of componentRanges) {
            if (component.hasContent) {
                const prefix = BracketLynxConfig.prefix.replace('‹~', '‹~').trim();
                
                const decorationText = `${prefix} #${component.startLine}-${component.endLine} •${component.name}`;
                
                const decoration: vscode.DecorationOptions = {
                    range: component.range,
                    renderOptions: {
                        after: {
                            contentText: decorationText,
                            color: BracketLynxConfig.color,
                            fontStyle: BracketLynxConfig.fontStyle
                        }
                    }
                };
                decorations.push(decoration);
            }
        }

        return decorations;
    }

    private static findComponentRanges(lines: string[]): AstroComponentRange[] {
        const componentStack: { name: string, startLine: number }[] = [];
        const componentRanges: AstroComponentRange[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            const openTagMatch = trimmedLine.match(/<(\w+)(?:\s+[^>]*)?(?<!\/)\s*>/);
            if (openTagMatch) {
                const componentName = openTagMatch[1];
                if (this.isAstroComponent(componentName)) {
                    componentStack.push({ name: componentName, startLine: i + 1 });
                }
            }

            const closeTagMatch = trimmedLine.match(/<\/(\w+)\s*>/);
            if (closeTagMatch) {
                const componentName = closeTagMatch[1];
                
                for (let j = componentStack.length - 1; j >= 0; j--) {
                    if (componentStack[j].name === componentName) {
                        const openComponent = componentStack[j];
                        componentStack.splice(j, 1);

                        const lineSpan = (i + 1) - openComponent.startLine;
                        if (lineSpan > 0) {
                            const hasContent = this.hasSignificantContent(lines, openComponent.startLine - 1, i);
                            
                            if (hasContent) {
                                componentRanges.push({
                                    name: componentName,
                                    startLine: openComponent.startLine,
                                    endLine: i + 1,
                                    range: new vscode.Range(i, line.length, i, line.length),
                                    hasContent: true
                                });
                            }
                        }
                        break;
                    }
                }
            }
        }

        return componentRanges;
    }

    private static isAstroComponent(tagName: string): boolean {
        if (tagName[0] === tagName[0].toUpperCase()) {
            return true;
        }

        const astroElements = [
            'Fragment', 'Astro', 'Code', 'Markdown', 'Debug',
        ];
        
        return astroElements.includes(tagName);
    }

    private static hasSignificantContent(lines: string[], startIndex: number, endIndex: number): boolean {
        for (let i = startIndex + 1; i < endIndex; i++) {
            const contentLine = lines[i].trim();
            if (contentLine && 
                !contentLine.startsWith('<!--') && 
                !contentLine.endsWith('-->') &&
                contentLine !== '{' && 
                contentLine !== '}' &&
                contentLine !== '') {
                return true;
            }
        }
        return false;
    }

    public static clearDecorations(editor: vscode.TextEditor): void {
        if (this.decorationType && editor) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    public static forceRefresh(): void {
        if (this.decorationType) {
            this.decorationType.dispose();
            this.decorationType = undefined;
        }

        if (isAstroEnabled()) {
            vscode.window.visibleTextEditors
                .filter(editor => editor.document.fileName.endsWith('.astro'))
                .forEach(editor => this.updateAstroDecorations(editor));
        }
    }

    public static dispose(): void {
        if (this.decorationType) {
            this.decorationType.dispose();
            this.decorationType = undefined;
        }
    }
} */