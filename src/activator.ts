export interface ActivatorVscode {
    commands: { registerCommand: (id: string, fn: (...args: any[]) => any) => { dispose: () => void } };
    window: {
        registerWebviewViewProvider: (id: string, p: any, o?: any) => { dispose: () => void };
        showWarningMessage?: (msg: string, ...items: string[]) => Thenable<string | undefined>;
        showInformationMessage?: (msg: string, ...items: string[]) => Thenable<string | undefined>;
    };
}

export interface ActivatorContext {
    subscriptions: { push: (d: { dispose: () => void }) => void };
    secrets?: { delete: (key: string) => Thenable<void> };
}

/**
 * Registra comandos, barra lateral e barra de status. Recebe as classes
 * como parâmetro para ser testável sem o módulo `vscode`.
 */
export function activate(
    context: ActivatorContext,
    vscode: ActivatorVscode,
    Panel: { render: (ctx: any, statusBar: any) => void },
    Sidebar: { new(ctx: any, statusBar: any): any; viewType: string },
    StatusBar: { new(): { dispose: () => void } },
) {
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar);

    context.subscriptions.push(
        vscode.commands.registerCommand('msgram.run', () => Panel.render(context, statusBar)),
    );

    const sidebar = new Sidebar(context, statusBar);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(Sidebar.viewType, sidebar, {
            webviewOptions: {retainContextWhenHidden: true},
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('msgram.openSettings', async () => {
            // Foca a barra lateral; a interface abre a aba Settings ao receber foco
            // com o comando abaixo (tratado em US1/US2).
            const {commands} = require('vscode');
            await commands.executeCommand('msgram.sidebarView.focus');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('msgram.clearTokens', async () => {
            const confirm = await vscode.window.showWarningMessage?.(
                'Remover os tokens do MeasureSoftGram e do GitHub salvos no Secret Storage?',
                'Remover',
            );
            if (confirm !== 'Remover' || !context.secrets) {
                return;
            }
            await context.secrets.delete('msgram.token');
            await context.secrets.delete('msgram.githubToken');
            await vscode.window.showInformationMessage?.('Tokens removidos. Configure novamente em Settings.');
        }),
    );
}
