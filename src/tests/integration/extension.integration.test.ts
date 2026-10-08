/**
 * Teste de integração: roda dentro de um VS Code real via @vscode/test-electron
 * (`npm run test:integration`). Não usa o mock de 'vscode'.
 *
 * Objetivo: garantir que a extensão ativa, registra os comandos, declara a
 * configuração e abre o painel sem lançar. Os fluxos de dados são cobertos
 * pelos testes unitários e de contrato.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'MeasureSoftGram.measuresoftgram';

suite('MeasureSoftGram — integração em VS Code real', () => {
    suiteSetup(async function () {
        this.timeout(60_000);
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext, `extensão ${EXTENSION_ID} não encontrada no host de testes`);
        await ext!.activate();
    });

    test('a extensão está ativa', () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.strictEqual(ext?.isActive, true);
    });

    test('registra os comandos msgram.run, msgram.openSettings e msgram.clearTokens', async () => {
        const all = await vscode.commands.getCommands(true);
        for (const id of ['msgram.run', 'msgram.openSettings', 'msgram.clearTokens']) {
            assert.ok(all.includes(id), `comando ${id} não registrado`);
        }
    });

    test('declara a configuração msgram.* com a URL oficial como padrão', () => {
        const cfg = vscode.workspace.getConfiguration('msgram');
        assert.strictEqual(cfg.get<string>('serviceUrl'), 'https://msgram.lappis.rocks');
        assert.strictEqual(cfg.get<string>('productName'), '');
        assert.strictEqual(cfg.get<string>('workflowName'), 'Build');
        assert.strictEqual(cfg.get<number>('requestTimeoutMs'), 15000);
        assert.deepStrictEqual(cfg.get<string[]>('grafanaAllowedHosts'), []);
    });

    test('msgram.run abre o painel sem lançar', async function () {
        this.timeout(20_000);
        await vscode.commands.executeCommand('msgram.run');
        // Executar de novo deve reutilizar o painel, também sem lançar.
        await vscode.commands.executeCommand('msgram.run');
        assert.ok(true);
    });

    test('a view da barra lateral está declarada no package.json', () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID)!;
        const views = ext.packageJSON?.contributes?.views?.['msgram-sidebar'] ?? [];
        assert.ok(views.some((v: { id: string }) => v.id === 'msgram.sidebarView'));
    });
});
