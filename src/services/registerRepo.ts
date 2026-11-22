/**
 * Cadastro automático do repositório da pasta aberta no MeasureSoftGram.
 *
 * Fluxo: organização (Quick Pick se houver mais de uma) → produto (lista,
 * com opção "criar novo") → POST repositório → persiste produto/organização
 * na configuração do workspace. O Service dispara a primeira coleta em
 * segundo plano; o score aparece quando ela terminar.
 *
 * A interface (Quick Pick, input, mensagens) é injetável para os testes.
 */
import {l10n} from 'vscode';
import {getAll} from './httpClient';
import type {Logger, MsgramSettings, OrgItem, RepoItem} from './msgramApi';
import {
    createProduct as defaultCreateProduct,
    createRepository as defaultCreateRepository,
    listProducts as defaultListProducts,
    ProductSummary,
} from './msgramApi';
import type {WorkspaceHints} from '../utilities/workspaceRepo';

export interface RegisterUi {
    pick<T extends { label: string }>(items: T[], placeHolder: string): Promise<T | undefined>;
    input(prompt: string, value?: string): Promise<string | undefined>;
    confirm(message: string, okLabel: string): Promise<boolean>;
    info(message: string): void;
    warn(message: string): void;
}

export interface RegisterDeps {
    ui: RegisterUi;
    listOrganizations?: (settings: MsgramSettings) => Promise<OrgItem[]>;
    listProducts?: typeof defaultListProducts;
    createProduct?: typeof defaultCreateProduct;
    createRepository?: typeof defaultCreateRepository;
    persist: (patch: { productName: string; organizationName: string }) => Promise<void>;
    log?: Logger;
}

export type RegisterResult =
    | { kind: 'registered'; orgName: string; productName: string; repo: RepoItem }
    | { kind: 'cancelled' }
    | { kind: 'no_hints' };

async function defaultListOrganizations(settings: MsgramSettings): Promise<OrgItem[]> {
    return getAll<OrgItem>(`${settings.serviceUrl.replace(/\/+$/, '')}/api/v1/organizations/`, {token: settings.token, timeoutMs: settings.requestTimeoutMs});
}

export async function registerWorkspaceRepo(
    settings: MsgramSettings,
    hints: WorkspaceHints,
    deps: RegisterDeps,
): Promise<RegisterResult> {
    const name = hints.remoteName ?? hints.folderName;
    if (!name) {
        deps.ui.warn(l10n.t('Open a git repository folder before registering.'));
        return {kind: 'no_hints'};
    }
    const log = deps.log ?? (() => {});
    const listOrganizations = deps.listOrganizations ?? defaultListOrganizations;
    const listProducts = deps.listProducts ?? defaultListProducts;
    const createProduct = deps.createProduct ?? defaultCreateProduct;
    const createRepository = deps.createRepository ?? defaultCreateRepository;

    // 1) organização
    const orgs = await listOrganizations(settings);
    if (!orgs.length) {
        deps.ui.warn(l10n.t('Your account has no organization in MeasureSoftGram. Create one on the website first.'));
        return {kind: 'cancelled'};
    }
    let org = orgs[0];
    if (orgs.length > 1) {
        const picked = await deps.ui.pick(orgs.map((o) => ({label: o.name, description: `id ${o.id}`, org: o})), l10n.t('Organization to register "{0}"', name));
        if (!picked) {
            return {kind: 'cancelled'};
        }
        org = picked.org;
    }

    // 2) produto (existente ou novo)
    const products = await listProducts(settings, org.id, log);
    const choice = await deps.ui.pick(
        [
            ...products.map((p) => ({label: p.name, description: `id ${p.id}`, product: p as ProductSummary | null})),
            {label: `$(add) ${l10n.t('Create a new product…')}`, description: l10n.t('creates the product in this organization'), product: null},
        ],
        l10n.t('Product in "{0}" where "{1}" will be added', org.name, name),
    );
    if (!choice) {
        return {kind: 'cancelled'};
    }
    let product = choice.product;
    if (!product) {
        const productName = await deps.ui.input(l10n.t('New product name'), name);
        if (!productName || !productName.trim()) {
            return {kind: 'cancelled'};
        }
        product = await createProduct(settings, org.id, {name: productName.trim(), description: l10n.t('Created by the VS Code extension')}, log);
        log(`[registro] produto criado: ${product.name} (id ${product.id})`);
    }

    // 3) confirmação e criação do repositório
    const ok = await deps.ui.confirm(
        l10n.t('Register "{0}" in product "{1}" ({2})? The first metrics collection runs in the background on MeasureSoftGram.', name, product.name, org.name),
        l10n.t('Register'),
    );
    if (!ok) {
        return {kind: 'cancelled'};
    }
    const repo = await createRepository(settings, org.id, product.id, {
        name,
        url: hints.remoteUrl,
        description: l10n.t('Registered by the VS Code extension from {0}', hints.remoteUrl ?? hints.folderName ?? name),
        platform: 'github',
    }, log);
    log(`[registro] repositório criado: ${repo.name} (id ${repo.id}) em ${org.name}/${product.name}`);

    await deps.persist({productName: product.name, organizationName: org.name});
    deps.ui.info(l10n.t('"{0}" registered in {1} / {2}. The first collection may take a few minutes; click Refresh later.', repo.name, org.name, product.name));
    return {kind: 'registered', orgName: org.name, productName: product.name, repo};
}
