import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ActionView} from '../../../components/action/ActionView';

vi.mock('../../../components/action/YamlEditor.tsx', () => ({
    YamlEditor: ({value, onChange}: {value: string; onChange: (v: string) => void}) => (
        <div>
            <span data-testid="yaml-value">{value}</span>
            <button
                data-testid="yaml-change"
                onClick={() => onChange('novo yaml')}
            >
                alterar
            </button>
        </div>
    ),
}));

vi.mock('../../../components/action/SaveButton.tsx', () => ({
    SaveButton: ({onSave}: {onSave: () => void}) => (
        <button data-testid="save-button" onClick={onSave}>
            Salvar
        </button>
    ),
}));

vi.mock('../../../components/action/CopyButton.tsx', () => ({
    CopyButton: ({getValue}: {getValue: () => string}) => (
        <button data-testid="copy-button">
            {getValue()}
        </button>
    ),
}));

vi.mock('../../../components/action/RunButton.tsx', () => ({
    RunButton: ({onRun}: {onRun: () => void}) => (
        <button data-testid="run-button" onClick={onRun}>
            Executar
        </button>
    ),
}));

describe('ActionView', () => {
    const defaultProps = {
        yaml: 'foo: bar',
        onChange: vi.fn(),
        onSave: vi.fn(),
        savedFeedback: false,
        onRun: vi.fn(),
        running: false,
        alert: null,
    };

    it('deve renderizar a mensagem informativa', () => {
        render(<ActionView {...defaultProps} />);

        expect(
            screen.getByText(/Edit msgram\.yml below/i)
        ).toBeInTheDocument();
    });

    it('deve renderizar o alerta quando fornecido', () => {
        render(
            <ActionView
                {...defaultProps}
                alert="Erro ao carregar YAML"
            />
        );

        expect(
            screen.getByText('Erro ao carregar YAML')
        ).toBeInTheDocument();
    });

    it('não deve renderizar alerta quando alert for null', () => {
        render(<ActionView {...defaultProps} />);

        expect(
            screen.queryByText('Erro ao carregar YAML')
        ).not.toBeInTheDocument();
    });

    it('deve renderizar o valor do yaml no editor', () => {
        render(<ActionView {...defaultProps} />);

        expect(
            screen.getByTestId('yaml-value')
        ).toHaveTextContent('foo: bar');
    });

    it('deve chamar onChange quando o editor alterar o yaml', () => {
        render(<ActionView {...defaultProps} />);

        fireEvent.click(screen.getByTestId('yaml-change'));

        expect(defaultProps.onChange)
            .toHaveBeenCalledWith('novo yaml');
    });

    it('deve chamar onSave ao clicar em salvar', () => {
        render(<ActionView {...defaultProps} />);

        fireEvent.click(screen.getByTestId('save-button'));

        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onRun ao clicar em executar', () => {
        render(<ActionView {...defaultProps} />);

        fireEvent.click(screen.getByTestId('run-button'));

        expect(defaultProps.onRun).toHaveBeenCalledTimes(1);
    });

    it('deve passar o yaml para o CopyButton', () => {
        render(<ActionView {...defaultProps} />);

        expect(
            screen.getByTestId('copy-button')
        ).toHaveTextContent('foo: bar');
    });

    it('mostra "Existing file" quando yamlExists é true', () => {
        render(<ActionView {...defaultProps} yamlExists={true}/>);
        expect(screen.getByTestId('yaml-origin')).toHaveTextContent(/existing file/i);
    });

    it('mostra "New file" quando yamlExists é false', () => {
        render(<ActionView {...defaultProps} yamlExists={false}/>);
        expect(screen.getByTestId('yaml-origin')).toHaveTextContent(/new file/i);
    });

    it('não mostra o selo enquanto não sabe se o arquivo existe', () => {
        render(<ActionView {...defaultProps} yamlExists={null}/>);
        expect(screen.queryByTestId('yaml-origin')).not.toBeInTheDocument();
    });

    it('mostra aviso com link de instalação quando bloqueado por docker_missing', () => {
        render(<ActionView {...defaultProps} blocked={{reason: 'docker_missing'}}/>);
        const notice = screen.getByTestId('action-blocked');
        expect(notice).toHaveTextContent(/Docker/);
        expect(notice).toHaveTextContent(/required/i);
        const link = notice.querySelector('a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('https://docs.docker.com/get-docker/');
    });

    it('mostra "Start Docker" quando bloqueado por docker_stopped, com o detalhe', () => {
        render(<ActionView {...defaultProps} blocked={{reason: 'docker_stopped', detail: 'daemon off'}}/>);
        const notice = screen.getByTestId('action-blocked');
        expect(notice).toHaveTextContent(/start docker/i);
        expect(notice).toHaveTextContent('daemon off');
    });

    it('mostra "already running" quando bloqueado por already_running', () => {
        render(<ActionView {...defaultProps} blocked={{reason: 'already_running'}}/>);
        expect(screen.getByTestId('action-blocked')).toHaveTextContent(/already running/i);
    });

    it('não mostra o aviso de bloqueio quando blocked é null', () => {
        render(<ActionView {...defaultProps} blocked={null}/>);
        expect(screen.queryByTestId('action-blocked')).not.toBeInTheDocument();
    });

    it('mostra aviso de pasta e erro genérico no blocked', () => {
        const {rerender} = render(<ActionView {...defaultProps} blocked={{reason: 'no_workspace', detail: 'sem pasta'}}/>);
        expect(screen.getByTestId('action-blocked')).toHaveTextContent(/Open a folder in VS Code/);
        expect(screen.getByTestId('action-blocked')).toHaveTextContent('sem pasta');

        rerender(<ActionView {...defaultProps} blocked={{reason: 'other' as never, detail: 'falha'}}/>);
        expect(screen.getByTestId('action-blocked')).toHaveTextContent(/Could not run/);
        expect(screen.getByTestId('action-blocked')).toHaveTextContent('falha');
    });
});
