import React from 'react';
import * as l10n from '@vscode/l10n';
import {renderSlots, slot} from '../utils/l10nSlots';
import type {ScoreData} from '../types';
import {formatAbsolute, formatRelative, getCharStatus} from '../utils/helpers';

interface DashboardViewProps {
    scoreData: ScoreData | null;
    scoreLoading: boolean;
    productName: string;
    repoName?: string;
    notifText: string;
    notifType: 'ok' | 'error';
    onRetry?: () => void;
    /** só para testes: "agora" usado no cálculo do tempo relativo */
    now?: Date;
}

type Characteristic = ScoreData['characteristics'][number];
type ScoreStatus = 'ok' | 'warn' | 'fail' | 'none';

/** Medidor circular do TSQMI. */
const Gauge: React.FC<{ value: number | null; status: ScoreStatus }> = ({value, status}) => {
    const r = 44;
    const c = 2 * Math.PI * r;
    const pct = value === null ? 0 : Math.max(0, Math.min(1, value));
    return (
        <div className={`gauge ${status}`} role="img" aria-label={value === null ? l10n.t('no score') : `TSQMI ${value.toFixed(2)}`}>
            <svg viewBox="0 0 110 110" width="110" height="110">
                <circle className="gauge-track" cx="55" cy="55" r={r} fill="none" strokeWidth="9"/>
                <circle
                    className="gauge-fill"
                    cx="55" cy="55" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${c * pct} ${c}`}
                    transform="rotate(-90 55 55)"
                />
            </svg>
            <div className="gauge-center">
                <div className="hero-num" id="hero-score">{value === null ? '—' : value.toFixed(2)}</div>
                <div className="gauge-lbl">TSQMI</div>
            </div>
        </div>
    );
};

/** Meta média das características com meta e a característica mais abaixo da sua meta. */
function goalSummary(characteristics: Characteristic[]) {
    const withGoal = characteristics.filter(
        (c): c is Characteristic & {goal: number} => c.goal !== null,
    );
    const avgGoal = withGoal.length
        ? withGoal.reduce((s, c) => s + c.goal, 0) / withGoal.length
        : null;

    const belowGoal = withGoal.filter((c) => c.value < c.goal);
    const worstChar = belowGoal.length
        ? belowGoal.reduce((worst, c) => (c.value - c.goal < worst.value - worst.goal ? c : worst), belowGoal[0])
        : undefined;
    return {avgGoal, worstChar};
}

function scoreStatusOf(scoreData: ScoreData | null, score: number, avgGoal: number | null): ScoreStatus {
    if (!scoreData || scoreData.noData) {
        return 'none';
    }
    if (avgGoal === null) {
        return 'warn';
    }
    if (score >= avgGoal) {
        return 'ok';
    }
    return score >= avgGoal * 0.9 ? 'warn' : 'fail';
}

const CharacteristicRow: React.FC<{ c: Characteristic }> = ({c}) => {
    const status = getCharStatus(c.value, c.goal);
    const mark = c.goal === null || c.value >= c.goal ? '✓' : '~';
    const pct = Math.round(Math.max(0, Math.min(1, c.value)) * 100);
    return (
        <div className={`char-row ${status}`}>
            <div className="char-head">
                <i className={`codicon ${status === 'ok' ? 'codicon-pass' : 'codicon-warning'} char-icon ${status}`} aria-hidden="true"/>
                <span className="char-name">{c.name}</span>
                <span className={`char-val ${status}`}>{c.value.toFixed(2)}</span>
                <span className="char-goal">
                    {l10n.t('goal {0}', c.goal === null ? '—' : c.goal.toFixed(2))} {mark}
                </span>
            </div>
            <div className="char-bar">
                <div className={`char-fill ${status}`} style={{width: `${pct}%`}}/>
                {c.goal !== null && (
                    <div className="char-goal-mark" style={{left: `${Math.round(c.goal * 100)}%`}} title={l10n.t('goal {0}', c.goal.toFixed(2))}/>
                )}
            </div>
        </div>
    );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
                                                                scoreData,
                                                                scoreLoading,
                                                                productName,
                                                                repoName,
                                                                notifText,
                                                                notifType,
                                                                onRetry,
                                                                now,
                                                            }) => {
    const score = scoreData?.score ?? 0;
    const hasGoal = !!scoreData?.hasGoal;

    const {avgGoal, worstChar} = goalSummary(scoreData?.characteristics ?? []);

    const productLabel = productName || l10n.t('no product configured');

    const scoreStatus = scoreStatusOf(scoreData, score, avgGoal);

    let metaStatus: React.ReactNode = '—';
    if (scoreData && avgGoal !== null) {
        metaStatus = score >= avgGoal
            ? <span className="chip ok">{l10n.t('above ✓')}</span>
            : <span className="chip fail">{l10n.t('below ✗')}</span>;
    }

    const lastAnalysis = scoreData?.lastAnalysisAt
        ? <span title={formatAbsolute(scoreData.lastAnalysisAt)}>{l10n.t('last analysis: {0}', formatRelative(scoreData.lastAnalysisAt, now))}</span>
        : <span>{l10n.t('never analyzed')}</span>;

    const showRetry = notifType === 'error' && !!notifText && !!onRetry;
    const showHero = !scoreLoading;

    return (
        <div className="vw on" id="view-dashboard">
            {/* Header */}
            <div className="view-header">
                <div>
                    <div className="view-title">
                        <i className="codicon codicon-dashboard" aria-hidden="true"/>
                        <span>MeasureSoftGram</span>
                    </div>
                    <div className="view-sub meta-row">
                        <span className="meta-item"><i className="codicon codicon-package" aria-hidden="true"/> {productLabel}</span>
                        {repoName && <span className="meta-item"><i className="codicon codicon-repo" aria-hidden="true"/> {repoName}</span>}
                        <span className="meta-item"><i className="codicon codicon-history" aria-hidden="true"/> {lastAnalysis}</span>
                    </div>
                </div>
            </div>

            {/* Loading state */}
            {scoreLoading && (
                <div className="notif" style={{marginBottom: 14}}>
                    <i className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true"/>
                    <span>{l10n.t('Loading product data...')}</span>
                </div>
            )}

            {/* No data warning */}
            {!scoreLoading && scoreData?.noData && (
                <div className="notif warn-n" id="notif-no-data">
                    <i className="codicon codicon-warning" aria-hidden="true"/>
                    <span>
                        {l10n.t('This repository does not have calculated metrics in MeasureSoftGram yet. Run the Action to generate data.')}
                    </span>
                </div>
            )}

            {/* Característica abaixo da meta */}
            {!scoreLoading && hasGoal && worstChar && (
                <div className="goal-warn show" id="goal-warn">
                    <div className="cw-title">
                        <i className="codicon codicon-target" aria-hidden="true"/> {l10n.t('Warning: characteristic below goal')}
                    </div>
                    <div className="cw-desc">
                        {renderSlots(l10n.t('{0} is at {1}, below the team goal of {2}.', slot(0), worstChar.value.toFixed(2), worstChar.goal.toFixed(2)), [<strong key="name" className="warn-strong">{worstChar.name}</strong>])}
                    </div>
                </div>
            )}

            {/* Notification */}
            {notifText && (
                <div className={`notif${notifType === 'error' ? ' warn-n' : ''}`} id="notif-ok" role="status">
                    <i
                        className={`codicon ${notifType === 'error' ? 'codicon-warning' : 'codicon-pass'}`}
                        aria-hidden="true"
                    />
                    <span>{notifText}</span>
                    {showRetry && (
                        <button className="btn btn-small" type="button" onClick={onRetry} style={{marginLeft: 'auto'}}>
                            <i className="codicon codicon-refresh" aria-hidden="true"/> {l10n.t('Try again')}
                        </button>
                    )}
                </div>
            )}

            {/* Score hero */}
            {showHero && (
                <div className="score-hero">
                    <Gauge value={scoreData && !scoreData.noData ? score : null} status={scoreStatus}/>
                    <div className="hero-right">
                        <div className="hero-lbl">{l10n.t('Product TSQMI')}</div>
                        <div className="hero-desc">
                            {l10n.t('Multidimensional quality indicator, from 0 to 1, calculated from the characteristics below.')}
                        </div>
                        <div className="hero-meta">
                            {scoreData && !hasGoal
                                ? <span className="chip muted">{l10n.t('no goal defined for this product')}</span>
                                : <>{renderSlots(l10n.t('release goal: {0}', slot(0)), [<strong key="goal">{avgGoal !== null ? avgGoal.toFixed(2) : '—'}</strong>])} · {metaStatus}</>}
                        </div>
                    </div>
                </div>
            )}

            {/* Características */}
            {showHero && scoreData && scoreData.characteristics.length > 0 && (
                <div className="sec-title" style={{marginTop: 4}}>
                    <i className="codicon codicon-list-tree" aria-hidden="true"/> {l10n.t('Characteristics')}
                </div>
            )}
            <div id="chars-dashboard">
                {scoreData?.characteristics.map((c) => <CharacteristicRow key={c.key} c={c}/>)}
            </div>
        </div>
    );
};
