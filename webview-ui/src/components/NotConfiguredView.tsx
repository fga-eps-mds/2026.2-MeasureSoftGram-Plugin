import React from 'react';
import * as l10n from '@vscode/l10n';
import {renderSlots, slot} from '../utils/l10nSlots';
import type {MissingSetting} from '../types';

interface NotConfiguredViewProps {
    missing: MissingSetting[];
    /** repositório da pasta aberta que não está em nenhum produto da conta */
    unregisteredRepo?: string;
    onOpenSettings: () => void;
    onOpenVscodeSettings: () => void;
    onRegisterRepo?: () => void;
}

function labelFor(setting: MissingSetting): string {
    switch (setting) {
        case 'token':
            return l10n.t('MeasureSoftGram Token');
        case 'serviceUrl':
            return l10n.t('Service URL');
        case 'productName':
            return l10n.t('Product Name');
    }
}

/**
 * Tela exibida no lugar do painel quando falta configuração.
 * Nunca mostra score, repositórios ou avisos: não há dado real para mostrar.
 */
export const NotConfiguredView: React.FC<NotConfiguredViewProps> = ({missing, unregisteredRepo, onOpenSettings, onOpenVscodeSettings, onRegisterRepo}) => (
    <div className="vw on" id="view-not-configured">
        <div className="view-header">
            <div>
                <div className="view-title">
                    <i className="codicon codicon-gear" aria-hidden="true"/>
                    <span>{l10n.t('Extension is not configured')}</span>
                </div>
                <div className="view-sub">
                    {l10n.t('Enter the details below to view the real quality of your product.')}
                </div>
            </div>
        </div>

        {unregisteredRepo && (
            <div className="notif warn-n" style={{marginBottom: 14}} data-testid="unregistered-repo">
                <i className="codicon codicon-repo" aria-hidden="true"/>
                <span>
                    {renderSlots(l10n.t('Repository {0} is not registered in any product of this account. Register it with one click, or enter the product below.', slot(0)), [<strong key="repo">{unregisteredRepo}</strong>])}
                </span>
            </div>
        )}

        {unregisteredRepo && onRegisterRepo && (
            <div className="nc-actions">
                <button className="btn" type="button" onClick={onRegisterRepo} data-testid="register-repo">
                    <i className="codicon codicon-cloud-upload" aria-hidden="true"/> {l10n.t('Register automatically')}
                </button>
            </div>
        )}

        <div className="notif" style={{marginBottom: 14}}>
            <i className="codicon codicon-info" aria-hidden="true"/>
            <span>
                {l10n.t('Missing:')}
            </span>
        </div>

        <ul className="nc-list" id="nc-missing">
            {missing.map((m) => (
                <li key={m} className="nc-item">
                    <i className="codicon codicon-warning" aria-hidden="true"/> {labelFor(m)}
                </li>
            ))}
        </ul>

        <div className="nc-actions">
            <button className="btn" type="button" onClick={onOpenSettings}>
                <i className="codicon codicon-settings-gear" aria-hidden="true"/> {l10n.t('Open Settings')}
            </button>
            <button className="btn btn-secondary" type="button" onClick={onOpenVscodeSettings}>
                <i className="codicon codicon-file-code" aria-hidden="true"/> {l10n.t('Edit settings.json')}
            </button>
        </div>

        <div className="nc-help">
            {l10n.t('The token is generated in your MeasureSoftGram account and stored in VS Code Secret Storage.')}
        </div>
    </div>
);
