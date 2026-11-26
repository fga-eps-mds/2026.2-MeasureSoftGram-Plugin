/**
 * Árvore nativa da barra lateral ("Qualidade"), no estilo das extensões
 * Python/Airflow: TreeView com ícones do editor, Quick Pick para trocar
 * organização e repositório, e viewsWelcome quando falta configuração.
 *
 * Os dados vêm dos mesmos serviços do painel (config/settings, msgramApi).
 */
import {
    commands,
    env,
    Event,
    EventEmitter,
    l10n,
    MarkdownString,
    ThemeColor,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    window,
    workspace,
} from 'vscode';
import {FullSettings, isConfigured, loadSettings, SettingsDeps, updateProjectSettings} from '../config/settings';
import {resolveRepoContext} from '../services/repoResolver';
import {
    discoverRepository as defaultDiscover,
    fetchGrafanaDashboards as defaultFetchDashboards,
    fetchRepositories as defaultFetchRepositories,
    fetchScoreForRepo as defaultFetchScoreForRepo,
    GrafanaDashboard,
    RepoContext,
    RepoItem,
    ScoreData,
} from '../services/msgramApi';
import {HttpError} from '../services/httpClient';
import {detectWorkspaceHints} from '../utilities/workspaceRepo';
import {getOutputChannel} from '../utilities/log';
import type {MsgramStatusBar} from '../statusbar/msgramStatusBar';

export type NodeKind =
    | 'product' | 'repo' | 'score' | 'lastAnalysis' | 'characteristics' | 'characteristic'
    | 'dashboards' | 'dashboard' | 'error' | 'loading' | 'noData' | 'actions' | 'action';

export interface QualityNode {
    kind: NodeKind;
    label: string;
    description?: string;
    tooltip?: string;
    icon?: ThemeIcon;
    command?: { command: string; title: string; arguments?: unknown[] };
    children?: QualityNode[];
    contextValue?: string;
}

export interface QualityTreeDeps {
    settingsDeps: SettingsDeps;
    fetchRepositories?: typeof defaultFetchRepositories;
    fetchScoreForRepo?: typeof defaultFetchScoreForRepo;
    fetchDashboards?: typeof defaultFetchDashboards;
    discoverRepository?: typeof defaultDiscover;
    detectHints?: () => Promise<{ remoteName?: string; folderName?: string }>;
    statusBar?: MsgramStatusBar;
    setContext?: (key: string, value: unknown) => Thenable<unknown>;
}

type State = 'not_configured' | 'unregistered' | 'loading' | 'ready' | 'error';

export class QualityTreeProvider implements TreeDataProvider<QualityNode> {
    private readonly _onDidChangeTreeData = new EventEmitter<QualityNode | undefined>();
    public readonly onDidChangeTreeData: Event<QualityNode | undefined> = this._onDidChangeTreeData.event;

    private _state: State = 'loading';
    private _settings: FullSettings | null = null;
    private _context: RepoContext | null = null;
    private _selectedRepo: RepoItem | null = null;
    private _score: ScoreData | null = null;
    private _dashboards: GrafanaDashboard[] | null = null;
    private _error: { message: string; kind: string } | null = null;
    private _orgPkOverride: number | null = null;
    private _loading: Promise<void> | null = null;
    private _unregisteredRepo: string | null = null;

    private readonly _fetchRepositories: typeof defaultFetchRepositories;
    private readonly _fetchScoreForRepo: typeof defaultFetchScoreForRepo;
    private readonly _fetchDashboards: typeof defaultFetchDashboards;
    private readonly _discover: typeof defaultDiscover;
    private readonly _detectHints: () => Promise<{ remoteName?: string; folderName?: string }>;
    private readonly _setContext: (key: string, value: unknown) => Thenable<unknown>;

    constructor(private readonly _deps: QualityTreeDeps) {
        this._fetchRepositories = _deps.fetchRepositories ?? defaultFetchRepositories;
        this._fetchScoreForRepo = _deps.fetchScoreForRepo ?? defaultFetchScoreForRepo;
        this._fetchDashboards = _deps.fetchDashboards ?? defaultFetchDashboards;
        this._discover = _deps.discoverRepository ?? defaultDiscover;
        this._detectHints = _deps.detectHints ?? (async () => {
            const folder = workspace.workspaceFolders?.[0];
            return folder ? detectWorkspaceHints(folder.uri.fsPath) : {};
        });
        this._setContext = _deps.setContext ?? ((key, value) => commands.executeCommand('setContext', key, value));
    }

    // ── Estado público ────────────────────────────────────────────────────

    get state(): State {
        return this._state;
    }

    get selectedRepo(): RepoItem | null {
        return this._selectedRepo;
    }

    get context(): RepoContext | null {
        return this._context;
    }

    private log(msg: string) {
        getOutputChannel().appendLine(`[tree] ${msg}`);
    }

    private fire() {
        this._onDidChangeTreeData.fire(undefined);
    }

    // ── Carga ─────────────────────────────────────────────────────────────

    /** Recarrega tudo (configuração → organização → produto → repositórios → score). */
    refresh(): Promise<void> {
        if (!this._loading) {
            this._loading = this._load().finally(() => (this._loading = null));
        }
        return this._loading;
    }

    private async _load(): Promise<void> {
        this._state = 'loading';
        this._error = null;
        this._dashboards = null;
        this.fire();
        this._deps.statusBar?.setLoading();

        try {
            const base = await loadSettings(this._deps.settingsDeps);
            this._settings = this._orgPkOverride !== null ? {...base, organizationPk: this._orgPkOverride} : base;
            const missing = isConfigured(this._settings);
            const onlyProduct = missing.length === 1 && missing[0] === 'productName';
            await this._setContext('msgram.configured', missing.length === 0 || onlyProduct);
            if (missing.length && !onlyProduct) {
                this._state = 'not_configured';
                this._context = null;
                this._selectedRepo = null;
                this._score = null;
                this._deps.statusBar?.setNotConfigured();
                this.fire();
                return;
            }

            const hints = await this._detectHints();
            const log = (m: string) => getOutputChannel().appendLine(m);
            const result = await resolveRepoContext(this._settings, hints, this._selectedRepo?.id ?? null, {
                fetchRepositories: this._fetchRepositories,
                discoverRepository: this._discover,
                persist: async (patch) => {
                    await updateProjectSettings(patch, this._deps.settingsDeps);
                    this._orgPkOverride = null;
                    const base = await loadSettings(this._deps.settingsDeps);
                    this._settings = base;
                },
                log,
            });

            if (result.kind === 'missingProduct') {
                await this._showMissingProduct(hints);
                return;
            }
            this._context = result.context;
            if (result.kind === 'empty') {
                this._selectedRepo = null;
                this._score = null;
                this._state = 'ready';
                this._deps.statusBar?.setNoData();
                this.fire();
                return;
            }
            if (result.switched) {
                this.log(`produto trocado para "${result.switched.productName}" (${result.switched.orgName}) pela pasta aberta`);
            } else if (result.detected) {
                this.log(`repositório da pasta aberta: ${result.selectedRepo.name}`);
            }
            this._selectedRepo = result.selectedRepo;
            await this._loadScore();
        } catch (err) {
            this._state = 'error';
            this._error = {
                message: err instanceof Error ? err.message : String(err),
                kind: err instanceof HttpError ? err.kind : 'other',
            };
            this._score = null;
            this._deps.statusBar?.setError();
            this.log(`erro: ${this._error.message}`);
            this.fire();
        }
    }

    private async _showMissingProduct(hints: { remoteName?: string; folderName?: string }): Promise<void> {
        this._context = null;
        this._selectedRepo = null;
        this._score = null;
        this._unregisteredRepo = hints.remoteName ?? hints.folderName ?? null;
        if (this._unregisteredRepo) {
            // Há token e pasta aberta, mas o repositório não está em nenhum produto: mostra na árvore.
            await this._setContext('msgram.configured', true);
            this._state = 'unregistered';
            this.log(`"${this._unregisteredRepo}" não está cadastrado em nenhum produto desta conta`);
        } else {
            await this._setContext('msgram.configured', false);
            this._state = 'not_configured';
        }
        this._deps.statusBar?.setNotConfigured();
        this.fire();
    }

    private async _loadScore(): Promise<void> {
        if (!this._settings || !this._context || !this._selectedRepo) {
            return;
        }
        this._score = await this._fetchScoreForRepo(
            this._settings, this._context.orgPk, this._context.productPk,
            this._selectedRepo.id, this._selectedRepo.name, (m) => getOutputChannel().appendLine(m),
        );
        this._state = 'ready';
        if (this._score.noData) {
            this._deps.statusBar?.setNoData();
        } else {
            this._deps.statusBar?.setScore(this._score.score);
        }
        this.fire();
    }

    // ── Comandos ──────────────────────────────────────────────────────────

    async selectRepository(): Promise<void> {
        const repos = this._context?.repos ?? [];
        if (!repos.length) {
            void window.showInformationMessage(l10n.t('No repositories loaded. Configure the product first.'));
            return;
        }
        const picked = await window.showQuickPick(
            repos.map((r) => ({label: r.name, description: r.id === this._selectedRepo?.id ? l10n.t('selected') : undefined, repo: r})),
            {placeHolder: l10n.t('Product repository')},
        );
        if (picked && picked.repo.id !== this._selectedRepo?.id) {
            this._selectedRepo = picked.repo;
            this._state = 'loading';
            this.fire();
            try {
                await this._loadScore();
            } catch (err) {
                this._state = 'error';
                this._error = {message: err instanceof Error ? err.message : String(err), kind: err instanceof HttpError ? err.kind : 'other'};
                this._deps.statusBar?.setError();
                this.fire();
            }
        }
    }

    async selectOrganization(): Promise<void> {
        const orgs = this._context?.organizations ?? [];
        if (orgs.length < 2) {
            void window.showInformationMessage(l10n.t('Your account has only one organization.'));
            return;
        }
        const picked = await window.showQuickPick(
            orgs.map((o) => ({
                label: o.name,
                description: o.id === this._context?.orgPk ? l10n.t('id {0} · selected', o.id) : l10n.t('id {0}', o.id),
                org: o,
            })),
            {placeHolder: l10n.t('Organization')},
        );
        if (picked && picked.org.id !== this._context?.orgPk) {
            this._orgPkOverride = picked.org.id;
            this._selectedRepo = null;
            await this.refresh();
        }
    }

    async loadDashboards(): Promise<GrafanaDashboard[]> {
        if (this._dashboards) {
            return this._dashboards;
        }
        if (!this._settings) {
            return [];
        }
        try {
            this._dashboards = await this._fetchDashboards(this._settings, (m) => getOutputChannel().appendLine(m));
        } catch (err) {
            this.log(`dashboards: ${(err as Error).message}`);
            this._dashboards = [];
        }
        return this._dashboards;
    }

    // ── TreeDataProvider ──────────────────────────────────────────────────

    getTreeItem(node: QualityNode): TreeItem {
        const collapsible = node.children?.length || node.kind === 'dashboards' || node.kind === 'characteristics'
            ? (node.kind === 'actions' ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.Expanded)
            : TreeItemCollapsibleState.None;
        const item = new TreeItem(node.label, collapsible);
        item.description = node.description;
        item.tooltip = node.tooltip ? new MarkdownString(node.tooltip) : undefined;
        item.iconPath = node.icon;
        item.command = node.command;
        item.contextValue = node.contextValue ?? node.kind;
        return item;
    }

    async getChildren(node?: QualityNode): Promise<QualityNode[]> {
        if (node) {
            if (node.kind === 'dashboards') {
                const list = await this.loadDashboards();
                if (!list.length) {
                    return [{kind: 'noData', label: l10n.t('No dashboards available'), icon: new ThemeIcon('info')}];
                }
                return list.map((d) => ({
                    kind: 'dashboard',
                    label: d.title,
                    description: d.has_repo_selector ? l10n.t('by repository') : undefined,
                    icon: new ThemeIcon('graph'),
                    command: {command: 'msgram.openDashboard', title: l10n.t('Open dashboard'), arguments: [d.uid]},
                }));
            }
            return node.children ?? [];
        }
        return this.rootNodes();
    }

    rootNodes(): QualityNode[] {
        if (this._state === 'not_configured') {
            // viewsWelcome cuida da mensagem; a árvore fica vazia.
            return [];
        }
        if (this._state === 'unregistered') {
            return this.unregisteredNodes();
        }
        if (this._state === 'loading' && !this._score) {
            return [{kind: 'loading', label: l10n.t('Loading…'), icon: new ThemeIcon('loading~spin')}];
        }
        if (this._state === 'error' && this._error) {
            return [this.errorNode(this._error), this.actionsNode()];
        }

        const ctx = this._context;
        const nodes: QualityNode[] = [...this.contextNodes(ctx), ...scoreNodes(this._score)];
        if (ctx) {
            nodes.push({kind: 'dashboards', label: l10n.t('Grafana Dashboards'), icon: new ThemeIcon('graph-line')});
        }
        nodes.push(this.actionsNode());
        return nodes;
    }

    private unregisteredNodes(): QualityNode[] {
        return [
            {
                kind: 'error',
                label: l10n.t('"{0}" is not registered', this._unregisteredRepo ?? ''),
                description: l10n.t('in any product of this account'),
                tooltip: l10n.t('Register the repository in a product on the MeasureSoftGram website (Repositories → import) and run the Action once. Or enter the product in Configure.'),
                icon: new ThemeIcon('repo', new ThemeColor('charts.yellow')),
            },
            {kind: 'action', label: l10n.t('Register automatically'), description: l10n.t('creates the repository in the product you choose'), icon: new ThemeIcon('cloud-upload'), command: {command: 'msgram.registerRepo', title: l10n.t('Register')}},
            {kind: 'action', label: l10n.t('Open MeasureSoftGram website'), icon: new ThemeIcon('link-external'), command: {command: 'msgram.openSite', title: l10n.t('Open website')}},
            {kind: 'action', label: l10n.t('Enter product manually'), icon: new ThemeIcon('gear'), command: {command: 'msgram.openSettings', title: l10n.t('Configure')}},
            {kind: 'action', label: l10n.t('Refresh'), icon: new ThemeIcon('refresh'), command: {command: 'msgram.refresh', title: l10n.t('Refresh')}},
        ];
    }

    private errorNode(error: { message: string; kind: string }): QualityNode {
        return {
            kind: 'error',
            label: error.kind === 'auth' ? l10n.t('Invalid or expired token') : l10n.t('Could not load'),
            description: error.kind,
            tooltip: error.message,
            icon: new ThemeIcon('error', new ThemeColor('errorForeground')),
            command: {command: 'msgram.refresh', title: l10n.t('Try again')},
        };
    }

    /** Produto e repositório selecionado. */
    private contextNodes(ctx: RepoContext | null): QualityNode[] {
        const nodes: QualityNode[] = [];
        if (ctx) {
            const manyOrgs = ctx.organizations.length > 1;
            nodes.push({
                kind: 'product',
                label: ctx.productName,
                description: ctx.orgName,
                tooltip: l10n.t('Product **{0}** · organization **{1}**', ctx.productName, ctx.orgName) +
                    (manyOrgs ? `\n\n${l10n.t('Click to switch organization.')}` : ''),
                icon: new ThemeIcon('package'),
                command: manyOrgs ? {command: 'msgram.selectOrganization', title: l10n.t('Switch organization')} : undefined,
            });
        }
        if (this._selectedRepo) {
            const repoCount = ctx?.repos.length ?? 0;
            nodes.push({
                kind: 'repo',
                label: this._selectedRepo.name,
                description: repoCount > 1 ? l10n.t('{0} repositories', repoCount) : undefined,
                tooltip: l10n.t('Click to switch repository.'),
                icon: new ThemeIcon('repo'),
                command: {command: 'msgram.selectRepository', title: l10n.t('Switch repository')},
            });
        } else if (ctx) {
            nodes.push({kind: 'noData', label: l10n.t('Product has no repositories'), icon: new ThemeIcon('info')});
        }
        return nodes;
    }

    private actionsNode(): QualityNode {
        return {
            kind: 'actions',
            label: l10n.t('Actions'),
            icon: new ThemeIcon('tools'),
            children: [
                {kind: 'action', label: l10n.t('Open full panel'), icon: new ThemeIcon('window'), command: {command: 'msgram.run', title: l10n.t('Open panel')}},
                {kind: 'action', label: l10n.t('Run Action locally'), description: l10n.t('requires Docker'), icon: new ThemeIcon('play'), command: {command: 'msgram.openActionTab', title: l10n.t('Run')}},
                {kind: 'action', label: l10n.t('Configure'), icon: new ThemeIcon('gear'), command: {command: 'msgram.openSettings', title: l10n.t('Configure')}},
                {kind: 'action', label: l10n.t('Refresh'), icon: new ThemeIcon('refresh'), command: {command: 'msgram.refresh', title: l10n.t('Refresh')}},
            ],
        };
    }
}

/** TSQMI, última análise e características. */
function scoreNodes(s: ScoreData | null): QualityNode[] {
    if (!s) {
        return [];
    }
    if (s.noData) {
        return [{kind: 'noData', label: l10n.t('No calculated metrics'), description: l10n.t('run the Action'), icon: new ThemeIcon('circle-slash')}];
    }
    return [
        tsqmiNode(s),
        {
            kind: 'lastAnalysis',
            label: s.lastAnalysisAt ? l10n.t('Last analysis {0}', relative(s.lastAnalysisAt)) : l10n.t('Never analyzed'),
            tooltip: s.lastAnalysisAt ? new Date(s.lastAnalysisAt).toLocaleString(env?.language || undefined) : undefined,
            icon: new ThemeIcon('history'),
        },
        {
            kind: 'characteristics',
            label: l10n.t('Characteristics'),
            description: `${s.characteristics.length}`,
            icon: new ThemeIcon('list-tree'),
            children: s.characteristics.map(characteristicNode),
        },
    ];
}

function tsqmiNode(s: ScoreData): QualityNode {
    const goals = s.characteristics.filter((c) => c.goal !== null);
    const avgGoal = goals.length ? goals.reduce((a, c) => a + (c.goal ?? 0), 0) / goals.length : null;
    if (avgGoal === null) {
        return scoreNode(s, l10n.t('no goal'), 'charts.yellow');
    }
    const ok = s.score >= avgGoal;
    return scoreNode(s, l10n.t('goal {0} {1}', avgGoal.toFixed(2), ok ? '✓' : '✗'), ok ? 'charts.green' : 'charts.red');
}

function scoreNode(s: ScoreData, description: string, color: string): QualityNode {
    return {
        kind: 'score',
        label: `TSQMI ${s.score.toFixed(2)}`,
        description,
        icon: new ThemeIcon('dashboard', new ThemeColor(color)),
        command: {command: 'msgram.run', title: l10n.t('Open panel')},
    };
}

function characteristicNode(c: ScoreData['characteristics'][number]): QualityNode {
    const value = c.value.toFixed(2);
    const meta = c.goal === null ? null : l10n.t('goal {0}', c.goal.toFixed(2));
    const below = c.goal !== null && c.value < c.goal;
    const near = c.goal !== null && !below && c.value < c.goal * 1.1;
    let color = 'charts.green';
    if (below) {
        color = 'charts.red';
    } else if (near) {
        color = 'charts.yellow';
    }
    return {
        kind: 'characteristic',
        label: c.name,
        description: meta ? `${value} / ${meta}` : value,
        tooltip: l10n.t('**{0}**: {1} ({2})\n\nMeasured on {3}', c.name, value, meta ?? l10n.t('no goal'), new Date(c.measuredAt).toLocaleString(env?.language || undefined)),
        icon: new ThemeIcon(below ? 'warning' : 'pass', new ThemeColor(color)),
    };
}

function relative(iso: string): string {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) {
        return l10n.t('just now');
    }
    if (min < 60) {
        return l10n.t('{0} min ago', min);
    }
    const h = Math.floor(min / 60);
    if (h < 24) {
        return l10n.t('{0} h ago', h);
    }
    const d = Math.floor(h / 24);
    return d === 1 ? l10n.t('1 day ago') : l10n.t('{0} days ago', d);
}
