import * as l10n from '@vscode/l10n';

export function configureInitialL10n(doc: Document = document): boolean {
    const text = doc.getElementById('l10n-bundle')?.textContent;
    if (!text) {
        return false;
    }
    try {
        l10n.config({contents: JSON.parse(text) as Record<string, string>});
        return true;
    } catch {
        return false;
    }
}
