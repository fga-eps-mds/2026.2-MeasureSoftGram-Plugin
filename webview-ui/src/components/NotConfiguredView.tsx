import React from 'react';
import type {MissingSetting} from '../types';

interface NotConfiguredViewProps {
    missing: MissingSetting[];
    onOpenSettings: () => void;
    onOpenVscodeSettings: () => void;
}

const LABELS: Record<MissingSetting, string> = {
    token: 'Token do MeasureSoftGram',
    serviceUrl: 'URL do serviço',
    productName: 'Nome do produto',
};

/**
 * Tela exibida no lugar do painel quando falta configuração.
 * Nunca mostra score, repositórios ou avisos: não há dado real para mostrar.
 */
export const NotConfiguredView: React.FC<NotConfiguredViewProps> = ({missing, onOpenSettings, onOpenVscodeSettings}) => (
    <div className="vw on" id="view-not-configured">
        <div className="view-header">
            <div>
                <div className="view-title">
                    <i className="ti ti-settings-off" aria-hidden="true"/>
                    <span>Extensão não está configurada</span>
                </div>
                <div className="view-sub">
                    Informe os dados abaixo para ver a qualidade real do seu produto.
                </div>
            </div>
        </div>

        <div className="notif" style={{marginBottom: 14}}>
            <i className="ti ti-info-circle" aria-hidden="true"/>
            <span>
                Falta{missing.length > 1 ? 'm' : ''}:
            </span>
        </div>

        <ul className="nc-list" id="nc-missing">
            {missing.map((m) => (
                <li key={m} className="nc-item">
                    <i className="ti ti-alert-circle" aria-hidden="true"/> {LABELS[m]}
                </li>
            ))}
        </ul>

        <div className="nc-actions">
            <button className="btn" type="button" onClick={onOpenSettings}>
                <i className="ti ti-settings" aria-hidden="true"/> Abrir Settings
            </button>
            <button className="btn btn-secondary" type="button" onClick={onOpenVscodeSettings}>
                <i className="ti ti-file-code" aria-hidden="true"/> Editar settings.json
            </button>
        </div>

        <div className="nc-help">
            O token é gerado na sua conta do MeasureSoftGram e fica guardado no Secret Storage do VS Code.
        </div>
    </div>
);
