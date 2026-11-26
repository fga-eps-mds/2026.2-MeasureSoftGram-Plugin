import React, {useEffect, useRef, useState} from 'react';
import * as l10n from '@vscode/l10n';

interface CopyButtonProps {
    getValue: () => string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({getValue}) => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const handleCopy = () => {
        navigator.clipboard?.writeText(getValue()).catch(() => {
        });
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button className="btn" onClick={handleCopy} style={{width: '100%', justifyContent: 'center'}}>
            <i className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`}/> {copied ? l10n.t('Copied') : l10n.t('Copy')}
        </button>
    );
};
