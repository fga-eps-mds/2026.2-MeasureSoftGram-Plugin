import React from 'react';

interface RunButtonProps {
    onRun: () => void;
    onStop: () => void;
    running: boolean;
}

/** "Executar" (desabilitado enquanto roda) e "Parar" (só enquanto roda). */
export const RunButton: React.FC<RunButtonProps> = ({onRun, onStop, running}) => (
    <div className="run-row">
        <button className="btn run-btn" type="button" onClick={onRun} disabled={running}>
            <i className={`ti ${running ? 'ti-loader-2 run-anim' : 'ti-player-play'}`} aria-hidden="true"/>
            {running ? ' Executando...' : ' Executar'}
        </button>
        {running && (
            <button className="btn btn-secondary stop-btn" type="button" onClick={onStop}>
                <i className="ti ti-player-stop" aria-hidden="true"/> Parar
            </button>
        )}
    </div>
);
