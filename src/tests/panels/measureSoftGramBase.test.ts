import * as assert from 'assert';
import { FetchRepositoriesFn, FetchScoreForRepoFn, MeasureSoftGramBase } from '../../panels/measureSoftGramBase';
import type { SettingsDeps } from '../../config/settings';

function makeWebview() {
    const posted: any[] = [];
    return {
        posted,
        postMessage(msg: any) { posted.push(msg); },
        onDidReceiveMessage() {},
        cspSource: 'vscode-resource:',
        asWebviewUri: (u: any) => u,
    };
}

function makeSecrets(token = '') {
    const store: Record<string, string> = { 'msgram.token': token };
    return {
        get: async (k: string) => store[k],
        store: async (k: string, v: string) => { store[k] = v; },
        delete: async (k: string) => { delete store[k]; },
        onDidChange: () => ({ dispose: () => {} }),
    };
}

/** Deps de configuração falsas: lê/grava num mapa em memória. */
function makeSettingsDepsFor(ctx: any): SettingsDeps {
    const config: Record<string, unknown> = {
        serviceUrl: ctx.workspaceState.get('msgram.serviceUrl', undefined),
        productName: ctx.workspaceState.get('msgram.productName', undefined),
    };
    return {
        getConfiguration: () => ({
            get: <T>(k: string, def?: T) => (config[k] as T) ?? def,
            update: async (k: string, v: unknown) => { config[k] = v; },
        }),
        secrets: ctx.secrets,
        hasWorkspaceFolder: () => true,
        ConfigurationTarget: { Global: 1, Workspace: 2 },
    };
}

function makeWorkspaceState(initial: Record<string, string> = {}) {
    const store: Record<string, string> = { ...initial };
    return {
        get: <T>(k: string, def: T) => (store[k] as any) ?? def,
        update: async (k: string, v: any) => { store[k] = v; },
        keys: () => Object.keys(store) as readonly string[],
        setKeysForSync: () => {},
    };
}

function makeExtensionContext(overrides: Partial<{
    serviceUrl: string;
    productName: string;
    token: string;
}> = {}) {
    const ws: Record<string, string> = {};
    if (overrides.serviceUrl !== undefined) { ws['msgram.serviceUrl'] = overrides.serviceUrl; }
    if (overrides.productName !== undefined) { ws['msgram.productName'] = overrides.productName; }
    return {
        workspaceState: makeWorkspaceState(ws),
        secrets: makeSecrets(overrides.token ?? ''),
        extensionUri: { fsPath: '/ext' } as any,
        subscriptions: [],
    } as any;
}

function makeFetchRepositories(repos: any[] = [{ id: 1, name: 'repo-a' }]) {
    return async (_settings: any, _log?: any) => ({
        orgPk: 10,
        orgName: 'org',
        organizations: [{ id: 10, name: 'org' }],
        productPk: 20,
        productName: 'P',
        repos,
    });
}

function makeFetchScoreForRepo(result: any = { score: 0.85, noData: false }) {
    return async () => result;
}

function makeStatusBar() {
    return {
        calls: [] as string[],
        setLoading()        { this.calls.push('loading'); },
        setScore(_s: number){ this.calls.push('score'); },
        setNoData()         { this.calls.push('noData'); },
        setError()          { this.calls.push('error'); },
        setNotConfigured()  { this.calls.push('notConfigured'); },
        dispose()           {},
    };
}

class TestableBase extends MeasureSoftGramBase {
    public webviewInstance = makeWebview();
    public statusBar = makeStatusBar();
    public loadStartCalled = false;
    public scoreLoadedData: any = null;
    public scoreErrorCalled = false;
    public reposEmptyCalled = false;

    constructor(ctx: any,
                public fetchRepos = makeFetchRepositories(),
                public fetchScore = makeFetchScoreForRepo()) {
        super(ctx, undefined, makeSettingsDepsFor(ctx));
        (this as any)._statusBar = this.statusBar;
    }

    protected get _webview() { return this.webviewInstance as any; }
    protected override onLoadStart()         { super.onLoadStart(); this.loadStartCalled = true; }
    protected override onScoreLoaded(d: any) { super.onScoreLoaded(d); this.scoreLoadedData = d; }
    protected override onScoreError()        { super.onScoreError(); this.scoreErrorCalled = true; }
    protected override onReposEmpty()        { super.onReposEmpty(); this.reposEmptyCalled = true; }

    public loadPersistedSettings()    { return this._loadPersistedSettings(); }
    public persistSettings(d: any)    { return this._persistSettings(d); }
    public loadReposAndScore(fr = this.fetchRepos, fs = this.fetchScore) {
        return this._loadReposAndScore(fr, fs);
    }
    public loadScoreForSelected(fs = this.fetchScore) {
        return this._loadScoreForSelected(fs);
    }
    public handleCommonMessage(msg: any, fr = this.fetchRepos, fs = this.fetchScore) {
        return this._handleCommonMessage(msg, fr, fs);
    }
    /** Usa os fakes da instância por padrão, para os testes não baterem na rede. */
    public override handleMessage(
        msg: any,
        fr: FetchRepositoriesFn = this.fetchRepos as any,
        fs: FetchScoreForRepoFn = this.fetchScore as any,
        ws?: any, fsys?: any, win?: any,
    ): Promise<boolean> {
        return super.handleMessage(msg, fr, fs, ws, fsys, win);
    }
    public getSettings() { return this._settings!; }
    public getContext()  { return this._context; }
    public getSelectedRepo() { return this._selectedRepo; }
}

suite('MeasureSoftGramBase', () => {

    test('carrega as configurações persistidas corretamente', async () => {
        const ctx = makeExtensionContext({ serviceUrl: 'https://custom.com/', productName: 'my-product', token: 'tok123' });
        const base = new TestableBase(ctx);

        await base.loadPersistedSettings();

        assert.strictEqual(base.getSettings().serviceUrl,  'https://custom.com');
        assert.strictEqual(base.getSettings().productName, 'my-product');
        assert.strictEqual(base.getSettings().token,       'tok123');
    });

    test('usa valores padrão quando não há configurações persistidas', async () => {
        const ctx = makeExtensionContext();
        const base = new TestableBase(ctx);

        await base.loadPersistedSettings();

        assert.strictEqual(base.getSettings().serviceUrl,  'https://msgram.lappis.rocks');
        assert.strictEqual(base.getSettings().productName, '');
        assert.strictEqual(base.getSettings().token,       '');
    });

    test('persiste as configurações e atualiza o estado interno', async () => {
        const ctx = makeExtensionContext();
        const base = new TestableBase(ctx);

        await base.persistSettings({ serviceUrl: 'https://new.com/', msgramServiceToken: 'newtoken', productName: 'new-product' });

        assert.strictEqual(base.getSettings().serviceUrl,  'https://new.com');
        assert.strictEqual(base.getSettings().productName, 'new-product');
        assert.strictEqual(base.getSettings().token,       'newtoken');
    });

    test('envia score_loading e repos_loaded ao carregar repositórios', async () => {
        const ctx = makeExtensionContext();
        const base = new TestableBase(ctx);

        await base.loadReposAndScore();

        const commands = base.webviewInstance.posted.map((m: any) => m.command);
        assert.ok(commands.includes('score_loading'));
        assert.ok(commands.includes('repos_loaded'));
    });

    test('chama onLoadStart ao iniciar carregamento', async () => {
        const base = new TestableBase(makeExtensionContext());

        await base.loadReposAndScore();

        assert.strictEqual(base.loadStartCalled, true);
    });

    test('seleciona o primeiro repositório automaticamente', async () => {
        const repos = [{ id: 1, name: 'repo-a' }, { id: 2, name: 'repo-b' }];
        const base = new TestableBase(makeExtensionContext(), makeFetchRepositories(repos));

        await base.loadReposAndScore();

        assert.strictEqual(base.getSelectedRepo()?.id, 1);
    });

    test('envia score_error e chama onReposEmpty quando não há repositórios', async () => {
        const base = new TestableBase(makeExtensionContext(), makeFetchRepositories([]));

        await base.loadReposAndScore();

        assert.strictEqual(base.reposEmptyCalled, true);
        const errorMsg = base.webviewInstance.posted.find((m: any) => m.command === 'score_error');
        assert.ok(errorMsg);
    });

    test('envia score_error e chama onScoreError quando fetchRepositories lança exceção', async () => {
        const failFetch = async () => { throw new Error('network failure'); };
        const base = new TestableBase(makeExtensionContext(), failFetch as any);

        await base.loadReposAndScore();

        assert.strictEqual(base.scoreErrorCalled, true);
        const errorMsg = base.webviewInstance.posted.find((m: any) => m.command === 'score_error');
        assert.strictEqual(errorMsg?.message, 'network failure');
    });

    test('envia score_loaded e chama onScoreLoaded com os dados do score', async () => {
        const scoreData = { score: 0.92, noData: false };
        const base = new TestableBase(makeExtensionContext(), makeFetchRepositories(), makeFetchScoreForRepo(scoreData));
        await base.loadReposAndScore();
        base.webviewInstance.posted.length = 0;

        await base.loadScoreForSelected();

        assert.deepStrictEqual(base.scoreLoadedData, scoreData);
        const loaded = base.webviewInstance.posted.find((m: any) => m.command === 'score_loaded');
        assert.ok(loaded);
    });

    test('envia score_error e chama onScoreError quando fetchScoreForRepo lança exceção', async () => {
        const failScore = async () => { throw new Error('score error'); };
        const base = new TestableBase(makeExtensionContext(), makeFetchRepositories(), failScore as any);
        await base.loadReposAndScore();

        base.scoreErrorCalled = false;
        await base.loadScoreForSelected(failScore as any);

        assert.strictEqual(base.scoreErrorCalled, true);
    });

    test('handleCommonMessage: request_score envia settings_loaded e carrega dados', async () => {
        const ctx = makeExtensionContext({ serviceUrl: 'https://test.com/' });
        const base = new TestableBase(ctx);

        const handled = await base.handleCommonMessage({ command: 'request_score' });

        assert.strictEqual(handled, true);
        const settingsMsg = base.webviewInstance.posted.find((m: any) => m.command === 'settings_loaded');
        assert.strictEqual(settingsMsg?.data.serviceUrl, 'https://test.com');
    });

    test('handleCommonMessage: select_repo muda o repositório selecionado', async () => {
        const repos = [{ id: 1, name: 'repo-a' }, { id: 2, name: 'repo-b' }];
        const base = new TestableBase(makeExtensionContext(), makeFetchRepositories(repos));
        await base.loadReposAndScore();

        await base.handleCommonMessage({ command: 'select_repo', repoPk: 2 });

        assert.strictEqual(base.getSelectedRepo()?.id, 2);
    });

    test('handleCommonMessage: save_settings persiste dados e recarrega', async () => {
        const base = new TestableBase(makeExtensionContext());
        const data = { serviceUrl: 'https://saved.com/', msgramServiceToken: 'tk', productName: 'saved' };

        const handled = await base.handleCommonMessage({ command: 'save_settings', data });

        assert.strictEqual(handled, true);
        assert.strictEqual(base.getSettings().serviceUrl, 'https://saved.com');
        const savedMsg = base.webviewInstance.posted.find((m: any) => m.command === 'settings_saved');
        assert.ok(savedMsg);
    });

    test('handleCommonMessage: retorna false para comandos desconhecidos', async () => {
        const base = new TestableBase(makeExtensionContext());

        const handled = await base.handleCommonMessage({ command: 'unknown_command' });

        assert.strictEqual(handled, false);
    });

    // ── US1: estado "não configurado", organizações, retry, segredos ──────

    test('request_score sem token emite settings_loaded com hasMsgramToken=false e not_configured', async () => {
        const base = new TestableBase(makeExtensionContext({ productName: 'P' }));

        await base.handleMessage({ command: 'request_score' });

        const settings = base.webviewInstance.posted.find((m: any) => m.command === 'settings_loaded');
        assert.strictEqual(settings?.data.hasMsgramToken, false);
        assert.ok(!('token' in (settings?.data ?? {})), 'nunca envia o valor do token');
        const nc = base.webviewInstance.posted.find((m: any) => m.command === 'not_configured');
        assert.deepStrictEqual(nc?.missing, ['token']);
        assert.ok(!base.webviewInstance.posted.some((m: any) => m.command === 'score_loading'), 'não tenta carregar');
        assert.ok(base.statusBar.calls.includes('notConfigured'));
        assert.strictEqual(base.loadState, 'not_configured');
    });

    test('request_score sem produto lista productName entre os faltantes', async () => {
        const base = new TestableBase(makeExtensionContext({ token: 'tok' }));

        await base.handleMessage({ command: 'request_score' });

        const nc = base.webviewInstance.posted.find((m: any) => m.command === 'not_configured');
        assert.deepStrictEqual(nc?.missing, ['productName']);
    });

    test('request_score configurado emite orgs_loaded, repos_loaded e score_loaded', async () => {
        const fetchRepos = async () => ({
            orgPk: 10, orgName: 'org', organizations: [{ id: 10, name: 'org' }, { id: 11, name: 'outra' }],
            productPk: 20, productName: 'P', repos: [{ id: 1, name: 'repo-a' }],
        });
        const base = new TestableBase(makeExtensionContext({ token: 'tok', productName: 'P' }), fetchRepos as any);

        await base.handleMessage({ command: 'request_score' });

        const cmds = base.webviewInstance.posted.map((m: any) => m.command);
        assert.ok(cmds.includes('orgs_loaded'));
        assert.ok(cmds.includes('repos_loaded'));
        assert.ok(cmds.includes('score_loaded'));
        const orgs = base.webviewInstance.posted.find((m: any) => m.command === 'orgs_loaded');
        assert.strictEqual(orgs?.selectedOrgPk, 10);
        assert.strictEqual(orgs?.organizations.length, 2);
        assert.strictEqual(base.loadState, 'ready');
    });

    test('score_error carrega kind derivado de HttpError', async () => {
        const { HttpError } = require('../../services/httpClient');
        const failFetch = async () => { throw new HttpError('HTTP 401', 'auth', 401); };
        const base = new TestableBase(makeExtensionContext({ token: 'tok', productName: 'P' }), failFetch as any);

        await base.handleMessage({ command: 'request_score' });

        const err = base.webviewInstance.posted.find((m: any) => m.command === 'score_error');
        assert.strictEqual(err?.kind, 'auth');
        assert.strictEqual(base.loadState, 'error');
        assert.ok(base.statusBar.calls.includes('error'));
    });

    test('score_error de erro genérico tem kind other', async () => {
        const failFetch = async () => { throw new Error('boom'); };
        const base = new TestableBase(makeExtensionContext({ token: 'tok', productName: 'P' }), failFetch as any);

        await base.handleMessage({ command: 'request_score' });

        const err = base.webviewInstance.posted.find((m: any) => m.command === 'score_error');
        assert.strictEqual(err?.kind, 'other');
        assert.strictEqual(err?.message, 'boom');
    });

    test('retry recarrega repositórios e score', async () => {
        let calls = 0;
        const fetchRepos = async () => { calls++; return { orgPk: 1, orgName: 'o', organizations: [], productPk: 2, productName: 'P', repos: [{ id: 1, name: 'r' }] }; };
        const base = new TestableBase(makeExtensionContext({ token: 'tok', productName: 'P' }), fetchRepos as any);
        await base.handleMessage({ command: 'request_score' });

        const handled = await base.handleMessage({ command: 'retry' });

        assert.strictEqual(handled, true);
        assert.strictEqual(calls, 2);
    });

    test('select_org recarrega usando a organização escolhida', async () => {
        const seen: string[] = [];
        const fetchRepos = async (s: any) => {
            seen.push(s.organizationName);
            return { orgPk: 1, orgName: 'o', organizations: [{ id: 1, name: 'o' }, { id: 2, name: 'dois' }], productPk: 2, productName: 'P', repos: [{ id: 1, name: 'r' }] };
        };
        const base = new TestableBase(makeExtensionContext({ token: 'tok', productName: 'P' }), fetchRepos as any);
        await base.handleMessage({ command: 'request_score' });

        await base.handleMessage({ command: 'select_org', orgPk: 2 });

        assert.strictEqual(seen[seen.length - 1], 'dois');
    });

    test('clear_secret do token apaga o segredo e volta para not_configured', async () => {
        const ctx = makeExtensionContext({ token: 'tok', productName: 'P' });
        const base = new TestableBase(ctx);
        await base.handleMessage({ command: 'request_score' });
        base.webviewInstance.posted.length = 0;

        await base.handleMessage({ command: 'clear_secret', key: 'msgram.token' });

        assert.strictEqual(await ctx.secrets.get('msgram.token'), undefined);
        const settings = base.webviewInstance.posted.find((m: any) => m.command === 'settings_loaded');
        assert.strictEqual(settings?.data.hasMsgramToken, false);
        assert.ok(base.webviewInstance.posted.some((m: any) => m.command === 'not_configured'));
        assert.strictEqual(base.loadState, 'not_configured');
    });

    test('open_vscode_settings executa workbench.action.openSettings com o filtro msgram', async () => {
        const vscode = require('vscode');
        vscode.commands._executed.length = 0;
        const base = new TestableBase(makeExtensionContext());

        await base.handleMessage({ command: 'open_vscode_settings' });

        assert.deepStrictEqual(vscode.commands._executed[0], { command: 'workbench.action.openSettings', args: ['msgram'] });
    });

    test('save_settings com token emite settings_saved e carrega dados', async () => {
        const base = new TestableBase(makeExtensionContext());
        base.webviewInstance.posted.length = 0;

        await base.handleMessage({ command: 'save_settings', data: { serviceUrl: 'https://s.com', productName: 'P', msgramServiceToken: 'tok' } });

        const cmds = base.webviewInstance.posted.map((m: any) => m.command);
        assert.ok(cmds.includes('settings_saved'));
        assert.ok(cmds.includes('score_loaded'));
        assert.ok(!cmds.includes('not_configured'));
    });

    // ── US2: settings completas, request_yaml, show_warning ───────────────

    const FULL_PAYLOAD = {
        serviceUrl: 'https://s.com/', productName: 'P', organizationName: 'O',
        sonarProjectKey: 'S', workflowName: 'W', requestTimeoutMs: 20000, grafanaAllowedHosts: ['g.com'],
        msgramServiceToken: 'tok', githubToken: 'ghp',
    };

    test('save_settings persiste os campos não sensíveis na configuração e os tokens em secrets', async () => {
        const ctx = makeExtensionContext();
        const base = new TestableBase(ctx);

        await base.handleMessage({ command: 'save_settings', data: FULL_PAYLOAD });

        const s = base.getSettings();
        assert.strictEqual(s.serviceUrl, 'https://s.com');
        assert.strictEqual(s.organizationName, 'O');
        assert.strictEqual(s.sonarProjectKey, 'S');
        assert.strictEqual(s.workflowName, 'W');
        assert.strictEqual(s.requestTimeoutMs, 20000);
        assert.deepStrictEqual(s.grafanaAllowedHosts, ['g.com']);
        assert.strictEqual(await ctx.secrets.get('msgram.token'), 'tok');
        assert.strictEqual(await ctx.secrets.get('msgram.githubToken'), 'ghp');
    });

    test('settings_loaded após salvar traz hasGithubToken=true e nunca o valor', async () => {
        const base = new TestableBase(makeExtensionContext());

        await base.handleMessage({ command: 'save_settings', data: FULL_PAYLOAD });

        const msgs = base.webviewInstance.posted.filter((m: any) => m.command === 'settings_loaded');
        const last = msgs[msgs.length - 1];
        assert.strictEqual(last.data.hasGithubToken, true);
        assert.strictEqual(last.data.hasMsgramToken, true);
        assert.strictEqual(last.data.sonarProjectKey, 'S');
        assert.ok(!JSON.stringify(last).includes('ghp'));
        assert.ok(!JSON.stringify(last).includes('"tok"'));
    });

    test('save_settings com token vazio mantém o token anterior', async () => {
        const ctx = makeExtensionContext({ token: 'antigo' });
        const base = new TestableBase(ctx);

        await base.handleMessage({ command: 'save_settings', data: { ...FULL_PAYLOAD, msgramServiceToken: '' } });

        assert.strictEqual(await ctx.secrets.get('msgram.token'), 'antigo');
    });

    test('request_yaml com arquivo existente responde yaml_loaded{exists:true} com o conteúdo', async () => {
        const base = new TestableBase(makeExtensionContext());
        const ws = { workspaceFolders: [{ uri: { fsPath: '/ws' } }] } as any;
        const fs = {
            mkdir: async () => {}, writeFile: async () => {},
            readFile: async (p: string) => { assert.ok(String(p).endsWith('.github/workflows/msgram.yml')); return 'name: meu-workflow'; },
        } as any;

        await base.handleMessage({ command: 'request_yaml' }, undefined, undefined, ws, fs);

        const msg = base.webviewInstance.posted.find((m: any) => m.command === 'yaml_loaded');
        assert.deepStrictEqual(msg, { command: 'yaml_loaded', yaml: 'name: meu-workflow', exists: true });
    });

    test('request_yaml sem arquivo responde exists:false e yaml vazio (a interface usa o modelo)', async () => {
        const base = new TestableBase(makeExtensionContext());
        const ws = { workspaceFolders: [{ uri: { fsPath: '/ws' } }] } as any;
        const enoent = Object.assign(new Error('nope'), { code: 'ENOENT' });
        const fs = { mkdir: async () => {}, writeFile: async () => {}, readFile: async () => { throw enoent; } } as any;

        await base.handleMessage({ command: 'request_yaml' }, undefined, undefined, ws, fs);

        const msg = base.webviewInstance.posted.find((m: any) => m.command === 'yaml_loaded');
        assert.deepStrictEqual(msg, { command: 'yaml_loaded', yaml: '', exists: false });
    });

    test('request_yaml sem workspace responde exists:false sem lançar', async () => {
        const base = new TestableBase(makeExtensionContext());
        const ws = { workspaceFolders: undefined } as any;

        await base.handleMessage({ command: 'request_yaml' }, undefined, undefined, ws, { mkdir: async () => {}, writeFile: async () => {}, readFile: async () => '' } as any);

        const msg = base.webviewInstance.posted.find((m: any) => m.command === 'yaml_loaded');
        assert.strictEqual(msg?.exists, false);
    });

    test('show_warning chama window.showWarningMessage com a mensagem', async () => {
        const base = new TestableBase(makeExtensionContext());
        const shown: string[] = [];
        const win = { createTerminal: () => ({}), showErrorMessage: () => {}, showWarningMessage: (m: string) => { shown.push(m); } } as any;

        const handled = await base.handleMessage({ command: 'show_warning', message: 'Preencha o token' }, undefined, undefined, undefined, undefined, win);

        assert.strictEqual(handled, true);
        assert.deepStrictEqual(shown, ['Preencha o token']);
    });
});
