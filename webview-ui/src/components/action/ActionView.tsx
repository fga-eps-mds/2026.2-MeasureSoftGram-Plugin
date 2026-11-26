import React from 'react';
import * as l10n from '@vscode/l10n';
import {renderSlots, slot} from '../../utils/l10nSlots';
import {YamlEditor} from './YamlEditor.tsx';
import {SaveButton} from './SaveButton.tsx';
import {CopyButton} from './CopyButton.tsx';
import {RunButton} from './RunButton.tsx';
import type {AnalysisBlockedReason} from '../../types';

export const DOCKER_INSTALL_URL = 'https://docs.docker.com/get-docker/';

export interface ActionBlocked {
    reason: AnalysisBlockedReason;
    detail?: string;
}

function blockedMessage(b: ActionBlocked): React.ReactNode {
    switch (b.reason) {
        case 'docker_missing':
            return (
                <>
                    {renderSlots(l10n.t('Docker is required to run the Action locally and was not found. {0} and try again.', slot(0)), [
                        <a key="install" href={DOCKER_INSTALL_URL} target="_blank" rel="noreferrer">{l10n.t('Install Docker')}</a>,
                    ])}
                </>
            );
        case 'docker_stopped':
            return (
                <>
                    {l10n.t('Docker is installed but did not respond. Start Docker and try again.')}
                    {b.detail && <span className="blocked-detail"> ({b.detail})</span>}
                </>
            );
        case 'already_running':
            return <>{l10n.t('An execution is already running. Wait for it to finish or click Stop.')}</>;
        case 'no_workspace':
            return <>{l10n.t('Open a folder in VS Code before running.')}{b.detail && <span className="blocked-detail"> ({b.detail})</span>}</>;
        default:
            return <>{l10n.t('Could not run.')}{b.detail && <span className="blocked-detail"> ({b.detail})</span>}</>;
    }
}

interface ActionViewProps {
    yaml: string;
    onChange: (yaml: string) => void;
    onSave: () => void;
    savedFeedback: boolean;
    onRun: () => void;
    onStop?: () => void;
    running: boolean;
    alert?: string | null;
    blocked?: ActionBlocked | null;
    /** true = carregado do msgram.yml do projeto; false = modelo; null = ainda não sabe */
    yamlExists?: boolean | null;
}

export const ActionView: React.FC<ActionViewProps> = ({
                                                          yaml,
                                                          onChange,
                                                          onSave,
                                                          savedFeedback,
                                                          onRun,
                                                          onStop = () => {},
                                                          running,
                                                          alert,
                                                          blocked = null,
                                                          yamlExists = null,
                                                      }) => (
    <div className="vw" id="view-action">
        <div className="sf">
            {alert && (
                <div className="notif err-n" style={{marginBottom: 12}}>
                    <i className="codicon codicon-warning" aria-hidden="true"/>
                    <span>{alert}</span>
                </div>
            )}

            {blocked && (
                <div className="notif warn-n" style={{marginBottom: 12}} data-testid="action-blocked">
                    <i className="codicon codicon-vm" aria-hidden="true"/>
                    <span>{blockedMessage(blocked)}</span>
                </div>
            )}

            <div className="notif" style={{marginBottom: 12}}>
                <i className="codicon codicon-info"/>
                <span>
                    {l10n.t('Edit msgram.yml below.')}
                    {yamlExists !== null && (
                        <span className={`yaml-origin ${yamlExists ? 'existing' : 'new'}`} data-testid="yaml-origin">
                            {yamlExists
                                ? ` ${l10n.t('Existing file at .github/workflows/msgram.yml: saving overwrites it.')}`
                                : ` ${l10n.t('New file: will be created at .github/workflows/msgram.yml.')}`}
                        </span>
                    )}
                </span>
            </div>

            <YamlEditor value={yaml} onChange={onChange}/>

            <div style={{marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8}}>
                <div style={{display: 'flex', gap: 8}}>
                    <div style={{flex: 1}}>
                        <SaveButton onSave={onSave} savedFeedback={savedFeedback}/>
                    </div>
                    <div style={{flex: 1}}>
                        <CopyButton getValue={() => yaml}/>
                    </div>
                </div>
                <div style={{width: '100%'}}>
                    <RunButton onRun={onRun} onStop={onStop} running={running}/>
                </div>
            </div>
        </div>
    </div>
);