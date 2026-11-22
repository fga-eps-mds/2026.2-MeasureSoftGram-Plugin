import React from 'react';
import * as l10n from '@vscode/l10n';
import type {TabName} from '../types';

interface Tab {
    id: TabName;
    label: string;
    icon: string;
}

interface TabsProps {
    active: TabName;
    onSelect: (tab: TabName) => void;
}

export const Tabs: React.FC<TabsProps> = ({active, onSelect}) => {
    const tabs: Tab[] = [
        {id: 'dashboard', label: l10n.t('Panel'),    icon: 'codicon-dashboard'},
        {id: 'grafana',   label: 'Grafana',          icon: 'codicon-graph-line'},
        {id: 'settings',  label: l10n.t('Settings'), icon: 'codicon-settings-gear'},
        {id: 'action',    label: 'Action',           icon: 'codicon-file-code'},
    ];

    return (
        <div className="tabs">
            {tabs.map((t) => (
                <div
                    key={t.id}
                    id={`tab-${t.id}`}
                    className={`tab${active === t.id ? ' on' : ''}`}
                    onClick={() => onSelect(t.id)}
                >
                    <i className={`codicon ${t.icon}`}/> {t.label}
                </div>
            ))}
        </div>
    );
};