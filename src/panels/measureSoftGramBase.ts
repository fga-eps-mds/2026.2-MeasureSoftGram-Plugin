import {Disposable, ExtensionContext, Uri, Webview, window, workspace} from 'vscode';
import * as defaultFs from 'fs/promises';
import * as path from 'path';
import {getNonce, getUri} from '../utilities/utilities';
import {getOutputChannel} from '../utilities/log';
import {
    fetchGrafanaDashboard as defaultFetchGrafanaDashboard,
    fetchGrafanaDashboards as defaultFetchGrafanaDashboards,
    fetchRepositories as defaultFetchRepositories,
    fetchScoreForRepo as defaultFetchScoreForRepo,
    RepoContext,
    RepoItem,
} from '../services/msgramApi';
import {HttpError} from '../services/httpClient';
import {
    clearSecret,
    FullSettings,
    isConfigured,
    loadSettings,
    loadSettingsForUi,
    makeSettingsDeps,
    saveSettings,
    SettingsDeps,
} from '../config/settings';
import type {ExtensionMessage, PanelMessage, ScoreErrorKind, SecretKey, SettingsPayload} from './messages';
import type {MsgramStatusBar} from '../statusbar/msgramStatusBar';

export type FetchRepositoriesFn = typeof defaultFetchRepositories;
export type FetchScoreForRepoFn = typeof defaultFetchScoreForRepo;

export const WORKFLOW_REL_PATH = '.github/workflows/msgram.yml';

export type LoadState = 'not_configured' | 'loading' | 'ready' | 'error';
export type ActionRunState = 'idle' | 'checking_docker' | 'running' | 'stopping';

/** Dependências de filesystem/VS Code usadas pela aba Action, injetáveis nos testes. */
export interface ActionDeps {
    workspace: { workspaceFolders: typeof workspace.workspaceFolders };
    fs: {
        mkdir: typeof defaultFs.mkdir;
        writeFile: typeof defaultFs.writeFile;
        readFile?: typeof defaultFs.readFile;
    };
    window: {
        createTerminal: typeof window.createTerminal;
        showErrorMessage: typeof window.showErrorMessage;
        showWarningMessage?: typeof window.showWarningMessage;
    };
}

function defaultActionDeps(): ActionDeps {
    return {
        workspace,
        fs: {mkdir: defaultFs.mkdir, writeFile: defaultFs.writeFile, readFile: defaultFs.readFile},
        window: {
            createTerminal: window.createTerminal.bind(window),
            showErrorMessage: window.showErrorMessage.bind(window),
            showWarningMessage: window.showWarningMessage?.bind(window),
        },
    };
}

/**
 * Classe base de painel e barra lateral.
 *
 * É a única dona de: configurações carregadas, contexto de repositórios,
 * repositório selecionado, estado de carregamento, estado da execução
 * local e da barra de status. As subclasses só expõem o `Webview`.
 */
export abstract class MeasureSoftGramBase {
    protected _settings: FullSettings | null = null;
    protected _context: RepoContext | null = null;
    protected _selectedRepo: RepoItem | null = null;
    protected _loadState: LoadState = 'not_configured';
    protected _actionState: ActionRunState = 'idle';
    /** Organização escolhida pela pessoa nesta sessão (sobrepõe msgram.organizationName). */
    protected _orgNameOverride: string | null = null;
    protected readonly _settingsDeps: SettingsDeps;
    protected readonly _disposables: Disposable[] = [];

    protected constructor(
        protected readonly _extensionContext: ExtensionContext,
        protected readonly _statusBar?: MsgramStatusBar,
        settingsDeps?: SettingsDeps,
    ) {
        this._settingsDeps = settingsDeps ?? makeSettingsDeps(_extensionContext);
    }

    protected abstract get _webview(): Webview | undefined;

    // ── Acesso para subclasses/testes ──────────────────────────────────────

    public get loadState(): LoadState {
        return this._loadState;
    }

    public get actionState(): ActionRunState {
        return this._actionState;
    }

    public dispose(): void {
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }

    // ── Hooks (subclasses podem estender; a base já cuida da status bar) ───

    protected onLoadStart(): void {
        this._loadState = 'loading';
        this._statusBar?.setLoading();
    }

    protected onScoreLoaded(data: { score: number; noData?: boolean }): void {
        this._loadState = 'ready';
        if (data.noData) {
            this._statusBar?.setNoData();
        } else {
            this._statusBar?.setScore(data.score);
        }
    }

    protected onScoreError(): void {
        this._loadState = 'error';
        this._statusBar?.setError();
    }

    protected onReposEmpty(): void {
        this._loadState = 'error';
        this._statusBar?.setError();
    }

    protected onNotConfigured(): void {
        this._loadState = 'not_configured';
        this._statusBar?.setNotConfigured();
    }

    protected logger(): (msg: string) => void {
        return (msg: string) => getOutputChannel().appendLine(msg);
    }

    protected post(message: ExtensionMessage): void {
        this._webview?.postMessage(message);
    }

    // ── Configurações ──────────────────────────────────────────────────────

    protected async _loadPersistedSettings(): Promise<FullSettings> {
        this._settings = await loadSettings(this._settingsDeps);
        return this._settings;
    }

    protected async _persistSettings(data: SettingsPayload): Promise<void> {
        await saveSettings(data, this._settingsDeps);
        this._settings = await loadSettings(this._settingsDeps);
    }

    protected async _postSettingsLoaded(): Promise<void> {
        this.post({command: 'settings_loaded', data: await loadSettingsForUi(this._settingsDeps)});
    }

    protected async _requireSettings(): Promise<FullSettings> {
        const settings = this._settings ?? (await this._loadPersistedSettings());
        return this._orgNameOverride ? {...settings, organizationName: this._orgNameOverride} : settings;
    }

    /**
     * Recarrega as configurações, avisa a interface e, se faltar algo,
     * emite not_configured. Devolve true quando está tudo configurado.
     */
    protected async _refreshSettingsAndGate(): Promise<boolean> {
        const settings = await this._loadPersistedSettings();
        await this._postSettingsLoaded();
        const missing = isConfigured(settings);
        if (missing.length) {
            this._context = null;
            this._selectedRepo = null;
            this.onNotConfigured();
            this.post({command: 'not_configured', missing});
            return false;
        }
        return true;
    }

    // ── Carregamento de dados ──────────────────────────────────────────────

    protected _errorKind(err: unknown): ScoreErrorKind {
        return err instanceof HttpError ? err.kind : 'other';
    }

    protected _errorMessage(err: unknown, fallback: string): string {
        return err instanceof Error && err.message ? err.message : fallback;
    }

    protected async _loadReposAndScore(
        fetchRepos: FetchRepositoriesFn = defaultFetchRepositories,
        fetchScore: FetchScoreForRepoFn = defaultFetchScoreForRepo,
    ): Promise<void> {
        const webview = this._webview;
        if (!webview) {
            return;
        }

        this.onLoadStart();
        this.post({command: 'score_loading'});

        try {
            const settings = await this._requireSettings();
            this._context = await fetchRepos(settings, this.logger());
            const repos = this._context.repos;
            this.post({
                command: 'orgs_loaded',
                organizations: this._context.organizations ?? [],
                selectedOrgPk: this._context.orgPk,
            });
            this.post({command: 'repos_loaded', repos});

            if (!repos.length) {
                this.onReposEmpty();
                this.post({command: 'score_error', message: 'Nenhum repositório encontrado.', kind: 'not_found'});
                return;
            }

            this._selectedRepo = repos[0];
            await this._loadScoreForSelected(fetchScore);
        } catch (err) {
            const message = this._errorMessage(err, 'Erro ao buscar repositórios.');
            this.logger()(`[ERRO] ${message}`);
            this.onScoreError();
            this.post({command: 'score_error', message, kind: this._errorKind(err)});
        }
    }

    protected async _loadScoreForSelected(
        fetchScore: FetchScoreForRepoFn = defaultFetchScoreForRepo,
    ): Promise<void> {
        const webview = this._webview;
        if (!webview || !this._context || !this._selectedRepo) {
            return;
        }

        this.onLoadStart();
        this.post({command: 'score_loading'});

        try {
            const settings = await this._requireSettings();
            const data = await fetchScore(
                settings,
                this._context.orgPk,
                this._context.productPk,
                this._selectedRepo.id,
                this._selectedRepo.name,
                this.logger(),
            );
            this.onScoreLoaded(data);
            this.post({command: 'score_loaded', data: data as any});
        } catch (err) {
            const message = this._errorMessage(err, 'Erro ao buscar métricas.');
            this.logger()(`[ERRO] ${message}`);
            this.onScoreError();
            this.post({command: 'score_error', message, kind: this._errorKind(err)});
        }
    }

    // ── HTML da webview ────────────────────────────────────────────────────

    protected _getWebviewContent(webview: Webview, extensionUri: Uri): string {
        const stylesUri = getUri(webview, extensionUri, ['webview-ui', 'build', 'assets', 'index.css']);
        const scriptUri = getUri(webview, extensionUri, ['webview-ui', 'build', 'assets', 'index.js']);
        const nonce = getNonce();

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; frame-src http: https:;">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>MeasureSoftGram</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    protected _webviewOptions() {
        return {
            enableScripts: true,
            localResourceRoots: [
                Uri.joinPath(this._extensionContext.extensionUri, 'out'),
                Uri.joinPath(this._extensionContext.extensionUri, 'webview-ui/build'),
            ],
        };
    }

    // ── Despacho de mensagens (único ponto de entrada) ─────────────────────

    /**
     * Trata uma mensagem vinda da interface. Os parâmetros extras existem
     * para os testes injetarem fakes; em produção só `message` é passado.
     */
    public async handleMessage(
        message: PanelMessage | { command: string; [k: string]: unknown },
        fetchRepos?: FetchRepositoriesFn,
        fetchScore?: FetchScoreForRepoFn,
        ws?: ActionDeps['workspace'],
        fs?: ActionDeps['fs'],
        win?: ActionDeps['window'],
    ): Promise<boolean> {
        const defaults = defaultActionDeps();
        const actionDeps: ActionDeps = {
            workspace: ws ?? defaults.workspace,
            fs: fs ?? defaults.fs,
            window: win ?? defaults.window,
        };

        switch (message.command) {
            case 'save_action':
                try {
                    await this._saveWorkflowFile(String(message.yaml), actionDeps);
                    this.post({command: 'action_saved'});
                } catch (err) {
                    actionDeps.window.showErrorMessage(`Não foi possível salvar o workflow: ${err}`);
                }
                return true;

            case 'run_action':
                await this._runAction(String(message.yaml), actionDeps);
                return true;

            case 'request_yaml':
                await this._sendExistingWorkflow(actionDeps);
                return true;

            case 'show_warning':
                actionDeps.window.showWarningMessage?.(String(message.message));
                return true;

            default:
                return this._handleCommonMessage(message, fetchRepos, fetchScore);
        }
    }

    protected async _handleCommonMessage(
        message: { command: string; [k: string]: unknown },
        fetchRepos: FetchRepositoriesFn = defaultFetchRepositories,
        fetchScore: FetchScoreForRepoFn = defaultFetchScoreForRepo,
    ): Promise<boolean> {
        const webview = this._webview;
        if (!webview) {
            return false;
        }

        switch (message.command) {
            case 'request_score':
                if (await this._refreshSettingsAndGate()) {
                    await this._loadReposAndScore(fetchRepos, fetchScore);
                }
                return true;

            case 'retry':
                if (await this._refreshSettingsAndGate()) {
                    await this._loadReposAndScore(fetchRepos, fetchScore);
                }
                return true;

            case 'select_org': {
                const org = this._context?.organizations?.find((o) => o.id === message.orgPk);
                if (!org) {
                    return true;
                }
                this._orgNameOverride = org.name;
                await this._loadReposAndScore(fetchRepos, fetchScore);
                return true;
            }

            case 'clear_secret': {
                await clearSecret(message.key as SecretKey, this._settingsDeps);
                if (await this._refreshSettingsAndGate()) {
                    await this._loadReposAndScore(fetchRepos, fetchScore);
                }
                return true;
            }

            case 'open_vscode_settings': {
                const {commands} = require('vscode');
                await commands.executeCommand('workbench.action.openSettings', 'msgram');
                return true;
            }

            case 'select_repo': {
                if (!this._context) {
                    return true;
                }
                const repo = this._context.repos.find((r: RepoItem) => r.id === message.repoPk);
                if (repo) {
                    this._selectedRepo = repo;
                    await this._loadScoreForSelected(fetchScore);
                }
                return true;
            }

            case 'save_settings':
                await this._persistSettings(message.data as SettingsPayload);
                this._context = null;
                this._selectedRepo = null;
                this._orgNameOverride = null;
                this.post({command: 'settings_saved'});
                if (await this._refreshSettingsAndGate()) {
                    await this._loadReposAndScore(fetchRepos, fetchScore);
                }
                return true;

            case 'request_grafana_dashboards':
                await this._loadGrafanaDashboards();
                return true;

            case 'request_grafana_dashboard':
                await this._loadGrafanaDashboardUrl(String(message.uid));
                return true;

            default:
                return false;
        }
    }

    // ── Grafana ────────────────────────────────────────────────────────────

    private async _loadGrafanaDashboards(): Promise<void> {
        if (!this._webview) {
            return;
        }
        this.post({command: 'grafana_loading'});
        try {
            const settings = await this._requireSettings();
            const dashboards = await defaultFetchGrafanaDashboards(settings, this.logger());
            this.post({command: 'grafana_dashboards_loaded', dashboards});
        } catch (err) {
            this.post({command: 'grafana_error', message: this._errorMessage(err, 'Erro ao buscar dashboards do Grafana.')});
        }
    }

    private async _loadGrafanaDashboardUrl(uid: string): Promise<void> {
        if (!this._webview || !this._context) {
            return;
        }
        this.post({command: 'grafana_loading'});
        try {
            const settings = await this._requireSettings();
            const detail = await defaultFetchGrafanaDashboard(
                settings,
                uid,
                this._context.productPk,
                this._selectedRepo?.id,
                this.logger(),
            );
            this.post({command: 'grafana_dashboard_loaded', url: detail.grafana_url, title: detail.title});
        } catch (err) {
            this.post({command: 'grafana_error', message: this._errorMessage(err, 'Erro ao buscar dashboard do Grafana.')});
        }
    }

    // ── Action (compartilhado por painel e barra lateral) ──────────────────

    protected _workspacePath(deps: ActionDeps): string {
        const folder = deps.workspace.workspaceFolders?.[0];
        if (!folder) {
            throw new Error('Abra uma pasta/workspace antes de salvar o workflow.');
        }
        return folder.uri.fsPath;
    }

    /**
     * Responde a request_yaml com o conteúdo do msgram.yml do projeto, se
     * existir. Sem arquivo (ou sem workspace) responde exists:false e yaml
     * vazio; a interface usa o modelo padrão dela. Assim o arquivo da
     * pessoa nunca é sobrescrito pelo modelo sem ela ver (A5, FR-011).
     */
    protected async _sendExistingWorkflow(deps: ActionDeps): Promise<void> {
        let workspacePath: string;
        try {
            workspacePath = this._workspacePath(deps);
        } catch {
            this.post({command: 'yaml_loaded', yaml: '', exists: false});
            return;
        }
        const workflowAbsPath = path.join(workspacePath, WORKFLOW_REL_PATH);
        try {
            const readFile = deps.fs.readFile ?? defaultFs.readFile;
            const content = await readFile(workflowAbsPath, 'utf-8');
            this.post({command: 'yaml_loaded', yaml: String(content), exists: true});
        } catch (err) {
            const code = (err as NodeJS.ErrnoException)?.code;
            if (code !== 'ENOENT') {
                this.logger()(`[ERRO] Não foi possível ler ${workflowAbsPath}: ${(err as Error).message}`);
            }
            this.post({command: 'yaml_loaded', yaml: '', exists: false});
        }
    }

    protected async _saveWorkflowFile(yaml: string, deps: ActionDeps): Promise<string> {
        const workspacePath = this._workspacePath(deps);
        const workflowAbsPath = path.join(workspacePath, WORKFLOW_REL_PATH);
        await deps.fs.mkdir(path.dirname(workflowAbsPath), {recursive: true});
        await deps.fs.writeFile(workflowAbsPath, yaml, 'utf-8');
        return workspacePath;
    }

    /**
     * Execução local via terminal. Substituída em US5 (T060) pelo
     * ActRunner com saída transmitida à interface.
     */
    protected async _runAction(yaml: string, deps: ActionDeps): Promise<void> {
        let workspacePath: string;
        try {
            workspacePath = await this._saveWorkflowFile(yaml, deps);
        } catch (err) {
            deps.window.showErrorMessage(`${err}`);
            return;
        }

        const dockerDir = Uri.joinPath(this._extensionContext.extensionUri, 'resources', 'docker').fsPath;

        const terminal = deps.window.createTerminal({
            name: 'MeasureSoftGram · Act',
            cwd: dockerDir,
            env: {
                WORKSPACE_PATH: workspacePath,
                WORKFLOW_REL_PATH: WORKFLOW_REL_PATH,
            },
        });

        terminal.show();
        terminal.sendText('docker compose up --build --abort-on-container-exit');
    }
}
