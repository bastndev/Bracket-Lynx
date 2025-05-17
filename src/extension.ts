import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "bracket-lynx" is now active!');

	const disposable = vscode.commands.registerCommand('bracket-lynx.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Bracket Lynx!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
