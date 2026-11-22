import React from 'react';
import * as l10n from '@vscode/l10n';

interface RunButtonProps {
    onRun: () => void;
    onStop: () => void;
    running: boolean;
}

/** "Executar" (desabilitado enquanto roda) e "Parar" (só enquanto roda). */
export const RunButton: React.FC<RunButtonProps> = ({onRun, onStop, running}) => (
    <div className="run-row">
        <button className="btn run-btn" type="button" onClick={onRun} disabled={running}>
            <i className={`codicon ${running ? 'codicon-loading codicon-modifier-spin run-anim' : 'codicon-play'}`} aria-hidden="true"/>
            {running ? ` ${l10n.t('Running...')}` : ` ${l10n.t('Run')}`}
        </button>
        {running && (
            <button className="btn btn-secondary stop-btn" type="button" onClick={onStop}>
                <i className="codicon codicon-debug-stop" aria-hidden="true"/> {l10n.t('Stop')}
            </button>
        )}
    </div>
);
