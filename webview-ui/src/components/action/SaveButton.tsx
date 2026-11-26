import React from 'react';
import * as l10n from '@vscode/l10n';

interface SaveButtonProps {
    onSave: () => void;
    savedFeedback: boolean;
}

export const SaveButton: React.FC<SaveButtonProps> = ({onSave, savedFeedback}) => (
    <>
        <button className="btn" onClick={onSave} style={{width: '100%', justifyContent: 'center'}}>
            <i className="codicon codicon-save"/> {l10n.t('Save')}
        </button>
        {savedFeedback && (
            <span id="action-fb" className="feedback-ok">
                <i className="codicon codicon-check"/> {l10n.t('Saved to your profile')}
            </span>
        )}
    </>
);
