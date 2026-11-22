import React, {useRef} from 'react';
import * as l10n from '@vscode/l10n';

interface CopyButtonProps {
    getValue: () => string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({getValue}) => {
    const btnRef = useRef<HTMLButtonElement>(null);

    const handleCopy = () => {
        navigator.clipboard?.writeText(getValue()).catch(() => {
        });
        if (!btnRef.current) return;
        btnRef.current.innerHTML = `<i class="codicon codicon-check"></i> ${l10n.t('Copied')}`;
        setTimeout(() => {
            if (btnRef.current) {
                btnRef.current.innerHTML = `<i class="codicon codicon-copy"></i> ${l10n.t('Copy')}`;
            }
        }, 1500);
    };

    return (
        <button ref={btnRef} className="btn" onClick={handleCopy} style={{width: '100%', justifyContent: 'center'}}>
            <i className="codicon codicon-copy"/> {l10n.t('Copy')}
        </button>
    );
};
