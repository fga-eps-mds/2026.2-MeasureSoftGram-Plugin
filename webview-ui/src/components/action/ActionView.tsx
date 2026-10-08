import React from 'react';
import {YamlEditor} from './YamlEditor.tsx';
import {SaveButton} from './SaveButton.tsx';
import {CopyButton} from './CopyButton.tsx';
import {RunButton} from './RunButton.tsx';

interface ActionViewProps {
    yaml: string;
    onChange: (yaml: string) => void;
    onSave: () => void;
    savedFeedback: boolean;
    onRun: () => void;
    running: boolean;
    alert?: string | null;
    /** true = carregado do msgram.yml do projeto; false = modelo; null = ainda não sabe */
    yamlExists?: boolean | null;
}

export const ActionView: React.FC<ActionViewProps> = ({
                                                          yaml,
                                                          onChange,
                                                          onSave,
                                                          savedFeedback,
                                                          onRun,
                                                          running,
                                                          alert,
                                                          yamlExists = null,
                                                      }) => (
    <div className="vw" id="view-action">
        <div className="sf">
            {alert && (
                <div className="notif warn-n"
                     style={{marginBottom: 12, borderLeftColor: '#D13310', background: '#FEF0F0'}}>
                    <i className="ti ti-alert-triangle" style={{color: '#D13310'}}/>
                    <span>{alert}</span>
                </div>
            )}

            <div className="notif" style={{marginBottom: 12}}>
                <i className="ti ti-info-circle"/>
                <span>
                    Edite o <strong>msgram.yml</strong> abaixo.
                    {yamlExists !== null && (
                        <span className={`yaml-origin ${yamlExists ? 'existing' : 'new'}`} data-testid="yaml-origin">
                            {yamlExists
                                ? ' Arquivo existente em .github/workflows/msgram.yml: salvar sobrescreve.'
                                : ' Novo arquivo: será criado em .github/workflows/msgram.yml.'}
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
                    <RunButton onRun={onRun} running={running}/>
                </div>
            </div>
        </div>
    </div>
);