import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import * as l10n from '@vscode/l10n';
import ptBr from '../../../../l10n/bundle.l10n.pt-br.json';
import {NotConfiguredView} from '../../components/NotConfiguredView';

describe('NotConfiguredView', () => {
    it('explica que a extensão não está configurada', () => {
        render(<NotConfiguredView missing={['token']} onOpenSettings={() => {}} onOpenVscodeSettings={() => {}}/>);
        expect(screen.getByText(/is not configured/i)).toBeInTheDocument();
    });

    it('lista cada campo faltante com rótulo legível', () => {
        render(
            <NotConfiguredView
                missing={['token', 'serviceUrl', 'productName']}
                onOpenSettings={() => {}}
                onOpenVscodeSettings={() => {}}
            />,
        );
        expect(screen.getByText(/measuresoftgram token/i)).toBeInTheDocument();
        expect(screen.getByText(/service url/i)).toBeInTheDocument();
        expect(screen.getByText(/product name/i)).toBeInTheDocument();
    });

    it('não mostra campos que não faltam', () => {
        render(<NotConfiguredView missing={['token']} onOpenSettings={() => {}} onOpenVscodeSettings={() => {}}/>);
        expect(screen.queryByText(/product name/i)).not.toBeInTheDocument();
    });

    it('botão "Open Settings" chama onOpenSettings', () => {
        const onOpenSettings = vi.fn();
        render(<NotConfiguredView missing={['token']} onOpenSettings={onOpenSettings} onOpenVscodeSettings={() => {}}/>);
        fireEvent.click(screen.getByRole('button', {name: /open settings/i}));
        expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('botão "settings.json" chama onOpenVscodeSettings', () => {
        const onOpenVscodeSettings = vi.fn();
        render(<NotConfiguredView missing={['token']} onOpenSettings={() => {}} onOpenVscodeSettings={onOpenVscodeSettings}/>);
        fireEvent.click(screen.getByRole('button', {name: /settings\.json/i}));
        expect(onOpenVscodeSettings).toHaveBeenCalledTimes(1);
    });

    it('com repositório não cadastrado mostra o aviso e o botão "Cadastrar automaticamente"', () => {
        const onRegisterRepo = vi.fn();
        render(<NotConfiguredView missing={['productName']} unregisteredRepo="meu-repo" onOpenSettings={() => {}} onOpenVscodeSettings={() => {}} onRegisterRepo={onRegisterRepo}/>);
        expect(screen.getByTestId('unregistered-repo')).toHaveTextContent('meu-repo');
        fireEvent.click(screen.getByTestId('register-repo'));
        expect(onRegisterRepo).toHaveBeenCalledTimes(1);
    });

    it('sem repositório não cadastrado não mostra o botão de cadastro', () => {
        render(<NotConfiguredView missing={['token']} onOpenSettings={() => {}} onOpenVscodeSettings={() => {}} onRegisterRepo={() => {}}/>);
        expect(screen.queryByTestId('register-repo')).not.toBeInTheDocument();
    });

    it('nunca exibe score, repositório de exemplo ou aviso de meta', () => {
        const {container} = render(<NotConfiguredView missing={['token']} onOpenSettings={() => {}} onOpenVscodeSettings={() => {}}/>);
        expect(container.textContent).not.toMatch(/0\.94|mock-repo|abaixo da meta/i);
    });

    it('destaca o repositório não cadastrado em negrito, também na tradução', () => {
        l10n.config({contents: ptBr});
        try {
            render(<NotConfiguredView missing={['productName']} unregisteredRepo="meu-repo" onOpenSettings={() => {}} onOpenVscodeSettings={() => {}}/>);
            const notice = screen.getByTestId('unregistered-repo');
            expect(notice.querySelector('strong')?.textContent).toBe('meu-repo');
            expect(notice).toHaveTextContent('O repositório meu-repo não está cadastrado');
        } finally {
            l10n.config({contents: {}});
        }
    });
});
