import React from 'react';
import type {ScoreData} from '../types';
import {formatAbsolute, formatRelative, getCharStatus} from '../utils/helpers';

interface DashboardViewProps {
    scoreData: ScoreData | null;
    scoreLoading: boolean;
    productName: string;
    notifText: string;
    notifType: 'ok' | 'error';
    onRetry?: () => void;
    /** só para testes: "agora" usado no cálculo do tempo relativo */
    now?: Date;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
                                                                scoreData,
                                                                scoreLoading,
                                                                productName,
                                                                notifText,
                                                                notifType,
                                                                onRetry,
                                                                now,
                                                            }) => {
    const score = scoreData?.score ?? 0;
    const scorePct = (score * 100).toFixed(0);
    const hasGoal = !!scoreData?.hasGoal;

    const withGoal = (scoreData?.characteristics ?? []).filter(
        (c): c is typeof c & {goal: number} => c.goal !== null,
    );
    const avgGoal = withGoal.length
        ? withGoal.reduce((s, c) => s + c.goal, 0) / withGoal.length
        : null;

    // Característica mais distante da meta (só conta quem tem meta e está abaixo dela)
    const belowGoal = withGoal.filter((c) => c.value < c.goal);
    const worstChar = belowGoal.length
        ? belowGoal.reduce((worst, c) => (c.value - c.goal < worst.value - worst.goal ? c : worst), belowGoal[0])
        : undefined;

    const productLabel = productName || 'sem produto configurado';

    let metaStatus: React.ReactNode = '—';
    if (scoreData && avgGoal !== null) {
        metaStatus = score >= avgGoal
            ? <span className="ok">acima ✓</span>
            : <span className="fail">abaixo ✗</span>;
    }

    const lastAnalysis = scoreData?.lastAnalysisAt
        ? <span title={formatAbsolute(scoreData.lastAnalysisAt)}>última análise: {formatRelative(scoreData.lastAnalysisAt, now)}</span>
        : <span>nunca analisado</span>;

    const showRetry = notifType === 'error' && !!notifText && !!onRetry;

    return (
        <div className="vw on" id="view-dashboard">
            {/* Header */}
            <div className="view-header">
                <div>
                    <div className="view-title">
                        <i className="ti ti-chart-radar" aria-hidden="true"/>
                        <span>MeasureSoftGram</span>
                    </div>
                    <div className="view-sub">
                        {productLabel} · {lastAnalysis}
                    </div>
                </div>
            </div>

            {/* Loading state */}
            {scoreLoading && (
                <div className="notif" style={{marginBottom: 14}}>
                    <i className="ti ti-loader run-anim" aria-hidden="true"/>
                    <span>Carregando dados do produto...</span>
                </div>
            )}

            {/* No data warning */}
            {!scoreLoading && scoreData?.noData && (
                <div className="notif warn-n" id="notif-no-data">
                    <i className="ti ti-alert-circle" aria-hidden="true"/>
                    <span>
                        Este repositório ainda não possui métricas calculadas no MeasureSoftGram.
                        Execute a Action para gerar os dados.
                    </span>
                </div>
            )}

            {/* Característica abaixo da meta */}
            {!scoreLoading && hasGoal && worstChar && (
                <div className="goal-warn show" id="goal-warn">
                    <div className="cw-title">
                        <i className="ti ti-target-arrow" aria-hidden="true"/> Atenção: característica abaixo da meta
                    </div>
                    <div className="cw-desc">
                        <strong className="warn-strong">{worstChar.name}</strong> está em{' '}
                        {worstChar.value.toFixed(2)}, abaixo da meta {worstChar.goal.toFixed(2)} definida pela equipe.
                    </div>
                </div>
            )}

            {/* Notification */}
            {notifText && (
                <div className={`notif${notifType === 'error' ? ' warn-n' : ''}`} id="notif-ok" role="status">
                    <i
                        className={`ti ${notifType === 'error' ? 'ti-alert-circle' : 'ti-circle-check'}`}
                        aria-hidden="true"
                    />
                    <span>{notifText}</span>
                    {showRetry && (
                        <button className="btn btn-small" type="button" onClick={onRetry} style={{marginLeft: 'auto'}}>
                            <i className="ti ti-refresh" aria-hidden="true"/> Tentar de novo
                        </button>
                    )}
                </div>
            )}

            {/* Score hero */}
            {!scoreLoading && (
                <div className="score-hero">
                    <div className="hero-num" id="hero-score">
                        {scoreData ? score.toFixed(2) : '—'}
                    </div>
                    <div className="hero-right">
                        <div className="hero-lbl">TSQMI do produto</div>
                        <div className="hero-bar">
                            <div className="hero-fill" id="hero-fill" style={{width: `${scorePct}%`}}/>
                        </div>
                        <div className="hero-meta">
                            {scoreData && !hasGoal
                                ? <span>sem meta definida para este produto</span>
                                : <>meta da release: {avgGoal !== null ? avgGoal.toFixed(2) : '—'} · {metaStatus}</>}
                        </div>
                    </div>
                </div>
            )}

            <div id="chars-dashboard">
                {scoreData?.characteristics.map((c) => {
                    const status = getCharStatus(c.value, c.goal);
                    const mark = c.goal === null || c.value >= c.goal ? '✓' : '~';
                    return (
                        <div key={c.key} className={`char-row ${status}`}>
                            <i className={`ti ti-chart-dots char-icon ${status}`} aria-hidden="true"/>
                            <span className="char-name">{c.name}</span>
                            <span className={`char-val ${status}`}>{c.value.toFixed(2)}</span>
                            <span className="char-goal">
                                meta {c.goal === null ? '—' : c.goal.toFixed(2)} {mark}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
