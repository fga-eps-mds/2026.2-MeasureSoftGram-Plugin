/**
 * Decide qual organização/produto/repositório mostrar para a pasta aberta.
 *
 * 1. Com produto configurado: carrega o produto; se a pasta aberta casa com
 *    um repositório dele, seleciona; senão tenta descobrir em toda a conta.
 * 2. Sem produto configurado: descobre em toda a conta.
 * 3. Ao descobrir em outro produto/organização, persiste os dois na
 *    configuração do workspace, para a próxima abertura ser direta.
 * 4. Sem casamento em lugar nenhum: fica no produto configurado (primeiro
 *    repositório) ou, sem produto, devolve `missingProduct`.
 *
 * Compartilhado pela classe base (painel) e pela árvore nativa.
 */
import type {Logger, MsgramSettings, RepoContext, RepoItem} from './msgramApi';
import {
    discoverRepository as defaultDiscover,
    fetchRepositories as defaultFetchRepositories,
} from './msgramApi';
import {HttpError} from './httpClient';
import {pickMatchingRepo, WorkspaceHints} from '../utilities/workspaceRepo';

export interface ResolveDeps {
    fetchRepositories?: typeof defaultFetchRepositories;
    discoverRepository?: typeof defaultDiscover;
    /** chamado quando o produto/organização descobertos diferem da configuração */
    persist?: (patch: { productName: string; organizationName: string }) => Promise<void>;
    log?: Logger;
}

export type ResolveResult =
    | {
    kind: 'ok';
    context: RepoContext;
    selectedRepo: RepoItem;
    /** true quando a pasta aberta determinou a escolha */
    detected: boolean;
    /** preenchido quando foi preciso trocar de produto/organização */
    switched?: { productName: string; orgName: string };
}
    | { kind: 'empty'; context: RepoContext }
    | { kind: 'missingProduct' };

type ProductLoad = { context: RepoContext | null; productError: HttpError | null };

/** 1. Carrega o produto configurado, se houver. */
async function loadConfiguredProduct(
    settings: MsgramSettings,
    hasHints: boolean,
    fetchRepositories: typeof defaultFetchRepositories,
    log: Logger,
): Promise<ProductLoad> {
    if (!settings.productName.trim()) {
        return {context: null, productError: null};
    }
    try {
        return {context: await fetchRepositories(settings, log), productError: null};
    } catch (err) {
        // Produto configurado não existe (mais) nesta conta: ainda dá para descobrir.
        if (err instanceof HttpError && err.kind === 'not_found' && hasHints) {
            return {context: null, productError: err};
        }
        throw err;
    }
}

/** Escolhe o repositório dentro do produto configurado: o que já estava selecionado ou o da pasta aberta. */
function pickInProduct(
    context: RepoContext,
    hints: WorkspaceHints,
    hasHints: boolean,
    keepRepoPk: number | null,
): ResolveResult | null {
    // Mantém a escolha da pessoa ao recarregar.
    const keep = keepRepoPk !== null ? context.repos.find((r) => r.id === keepRepoPk) : undefined;
    if (keep) {
        return {kind: 'ok', context, selectedRepo: keep, detected: false};
    }
    const match = hasHints ? pickMatchingRepo(context.repos, hints) : undefined;
    return match ? {kind: 'ok', context, selectedRepo: match, detected: true} : null;
}

/** 2 e 3. Descobre a pasta aberta em toda a conta e persiste o produto quando ele muda. */
async function discoverInAccount(
    settings: MsgramSettings,
    hints: WorkspaceHints,
    context: RepoContext | null,
    discover: typeof defaultDiscover,
    persist: ResolveDeps['persist'],
    log: Logger,
): Promise<ResolveResult | null> {
    const found = await discover(settings, hints, log);
    if (!found) {
        return null;
    }
    const switched = !context || found.productPk !== context.productPk;
    const {repo, ...ctx} = found;
    if (switched) {
        await persist?.({productName: ctx.productName, organizationName: ctx.orgName});
    }
    return {
        kind: 'ok',
        context: ctx,
        selectedRepo: repo,
        detected: true,
        switched: switched ? {productName: ctx.productName, orgName: ctx.orgName} : undefined,
    };
}

/** 4. Sem casamento: primeiro repositório do produto configurado ou `missingProduct`. */
function fallback({context, productError}: ProductLoad): ResolveResult {
    if (context) {
        return context.repos.length
            ? {kind: 'ok', context, selectedRepo: context.repos[0], detected: false}
            : {kind: 'empty', context};
    }
    if (productError) {
        throw productError;
    }
    return {kind: 'missingProduct'};
}

export async function resolveRepoContext(
    settings: MsgramSettings,
    hints: WorkspaceHints,
    keepRepoPk: number | null,
    deps: ResolveDeps = {},
): Promise<ResolveResult> {
    const fetchRepositories = deps.fetchRepositories ?? defaultFetchRepositories;
    const discover = deps.discoverRepository ?? defaultDiscover;
    const log = deps.log ?? (() => {});
    const hasHints = !!(hints.remoteName || hints.folderName);

    const loaded = await loadConfiguredProduct(settings, hasHints, fetchRepositories, log);
    const picked = loaded.context ? pickInProduct(loaded.context, hints, hasHints, keepRepoPk) : null;
    if (picked) {
        return picked;
    }
    const discovered = hasHints
        ? await discoverInAccount(settings, hints, loaded.context, discover, deps.persist, log)
        : null;
    return discovered ?? fallback(loaded);
}
