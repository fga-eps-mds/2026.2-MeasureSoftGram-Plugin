import * as l10n from '@vscode/l10n';

export function now(): string {
    return new Date().toLocaleTimeString(document.documentElement.lang || undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** "2 days ago", "3 hours ago", "5 minutes ago" or "just now". */
export function formatRelative(iso: string, now: Date = new Date()): string {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return l10n.t('unknown date');
    const diffSec = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
    if (diffSec < 60) return l10n.t('just now');
    const min = Math.floor(diffSec / 60);
    if (min < 60) return min === 1 ? l10n.t('1 minute ago') : l10n.t('{0} minutes ago', min);
    const h = Math.floor(min / 60);
    if (h < 24) return h === 1 ? l10n.t('1 hour ago') : l10n.t('{0} hours ago', h);
    const d = Math.floor(h / 24);
    return d === 1 ? l10n.t('1 day ago') : l10n.t('{0} days ago', d);
}

/** Data e hora absolutas, para tooltips. */
export function formatAbsolute(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(document.documentElement.lang || undefined, {dateStyle: 'short', timeStyle: 'short'});
}

export type StatusColor = 'ok' | 'warn' | 'fail';

export function getCharStatus(value: number, goal: number | null): StatusColor {
    if (goal === null) return 'ok';
    if (value >= goal) return 'ok';
    if (value >= goal * 0.9) return 'warn';
    return 'fail';
}

export function getStatusColor(status: StatusColor): string {
    return {ok: '#4ec9b0', warn: '#cca700', fail: '#f14c4c'}[status];
}

export function colorizeYaml(escaped: string): string {
    return escaped
        .replace(/(#.*)$/gm, '<span class="yaml-cmm">$1</span>')
        .replace(/^([ \t]*)([\w-]+):/gm, '$1<span class="yaml-key">$2</span>:')
        .replace(/:\s+(&quot;.*?&quot;)/g, ': <span class="yaml-val">$1</span>')
        .replace(/:\s+(&#039;.*?&#039;)/g, ': <span class="yaml-val">$1</span>')
        .replace(/:\s+(true|false)/g, ': <span class="yaml-kw">$1</span>')
        .replace(/:\s+(\d+)/g, ': <span class="yaml-num">$1</span>')
        .replace(/(\$\{\{.*?\}\})/g, '<span class="yaml-bl">$1</span>');
}