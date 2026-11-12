/**
 * Tipos da interface (webview).
 *
 * O contrato de mensagens com a extensão vem de `src/panels/messages.ts`, a fonte única;
 * qualquer mudança nele precisa ser refletida em `specs/.../contracts/webview-messages.md`.
 * Aqui ficam só os tipos que existem apenas na interface.
 */

import type {PanelMessage} from '../../../src/panels/messages';

export type {
    AnalysisBlockedReason,
    Characteristic,
    ExtensionMessage,
    GrafanaDashboard,
    MissingSetting,
    OrgItem,
    PanelMessage,
    ProjectSettings,
    RepoItem,
    ScoreData,
    ScoreErrorKind,
    SecretKey,
    SettingsForUi,
    SettingsPayload,
} from '../../../src/panels/messages';

export interface VSCodeAPI {
    postMessage(message: PanelMessage): void;

    getState(): unknown;

    setState(state: unknown): void;
}

declare global {
    function acquireVsCodeApi(): VSCodeAPI;
}

export type LoadState = 'not_configured' | 'loading' | 'ready' | 'error';

export type ActionRunState = 'idle' | 'checking_docker' | 'running' | 'stopping';

export type TabName = 'dashboard' | 'output' | 'settings' | 'action' | 'grafana';

export interface LogLine {
    time: string;
    text: string;
    isError: boolean;
}
