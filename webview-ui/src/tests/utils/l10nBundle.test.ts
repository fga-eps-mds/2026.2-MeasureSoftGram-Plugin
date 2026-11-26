import {afterEach, describe, expect, it} from 'vitest';
import * as l10n from '@vscode/l10n';
import {configureInitialL10n} from '../../utils/l10nBundle';

function withBundle(text: string): Document {
    const doc = document.implementation.createHTMLDocument('');
    const script = doc.createElement('script');
    script.type = 'application/json';
    script.id = 'l10n-bundle';
    script.textContent = text;
    doc.body.appendChild(script);
    return doc;
}

describe('configureInitialL10n', () => {
    afterEach(() => l10n.config({contents: {}}));

    it('traduz antes do primeiro render com o bundle embutido no HTML', () => {
        expect(configureInitialL10n(withBundle(JSON.stringify({Panel: 'Painel'})))).toBe(true);
        expect(l10n.t('Panel')).toBe('Painel');
    });

    it('sem bundle no HTML, segue com o texto em inglês', () => {
        expect(configureInitialL10n(document.implementation.createHTMLDocument(''))).toBe(false);
        expect(l10n.t('Panel')).toBe('Panel');
    });

    it('bundle inválido não quebra o webview', () => {
        expect(configureInitialL10n(withBundle('{'))).toBe(false);
        expect(l10n.t('Panel')).toBe('Panel');
    });
});
