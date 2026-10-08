import {describe, expect, it} from 'vitest';
import css from '../index.css?raw';

/**
 * O VS Code injeta variáveis --vscode-* em toda webview. Para respeitar o
 * tema claro e escuro (FR-018), as cores base precisam vir dessas variáveis,
 * com fallback para a paleta antiga.
 */
describe('tema da interface (index.css)', () => {
    it('body usa a cor de fundo e de texto do editor', () => {
        const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? '';
        expect(body).toMatch(/background:\s*var\(--vscode-editor-background/);
        expect(body).toMatch(/color:\s*var\(--vscode-(foreground|editor-foreground)/);
    });

    it('declara tokens --msg-* a partir de variáveis --vscode-*', () => {
        const root = css.match(/:root\s*\{[^}]*\}/)?.[0] ?? '';
        for (const token of ['--msg-bg', '--msg-surface', '--msg-fg', '--msg-fg-muted', '--msg-border', '--msg-accent', '--msg-ok', '--msg-warn', '--msg-fail', '--msg-input-bg', '--msg-input-border']) {
            expect(root, `token ${token}`).toContain(`${token}:`);
        }
        expect(root).toMatch(/--msg-ok:\s*var\(--vscode-charts-green/);
        expect(root).toMatch(/--msg-warn:\s*var\(--vscode-charts-yellow/);
        expect(root).toMatch(/--msg-fail:\s*var\(--vscode-charts-red/);
    });

    it('não deixa cor de fundo branca fixa em cartões e inputs', () => {
        const withoutRoot = css.replace(/:root\s*\{[^}]*\}/, '');
        const whiteBg = withoutRoot.match(/background:\s*#FFFFFF\b/gi) ?? [];
        expect(whiteBg, 'background: #FFFFFF fixo fora do :root').toHaveLength(0);
    });

    it('tem estilos para as classes novas (não configurado, meta, selo do yaml)', () => {
        for (const cls of ['.goal-warn', '.nc-list', '.nc-actions', '.btn-secondary', '.link-btn', '.yaml-origin', '.sselect', '.token-status']) {
            expect(css, `classe ${cls}`).toContain(cls);
        }
    });
});
