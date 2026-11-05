import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OutputView} from '../../../components/action/OutputView';
import type {LogLine} from '../../../types';

const makeLines = (overrides: Partial<LogLine>[] = []): LogLine[] =>
    overrides.map((o, i) => ({
        time: `00:0${i}`,
        text: `linha ${i}`,
        isError: false,
        ...o,
    }));

describe('OutputView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve renderizar o estado inicial "Aguardando execução..." quando não há linhas', () => {
        render(<OutputView lines={[]}/>);
        expect(screen.getByText('Aguardando execução...')).toBeInTheDocument();
    });

    it('não deve renderizar "Aguardando execução..." quando há linhas', () => {
        render(<OutputView lines={makeLines([{text: 'algo'}])}/>);
        expect(screen.queryByText('Aguardando execução...')).not.toBeInTheDocument();
    });

    it('deve renderizar uma linha com texto e horário corretos', () => {
        const lines = makeLines([{time: '12:00', text: 'olá mundo'}]);
        render(<OutputView lines={lines}/>);
        expect(screen.getByText('12:00')).toBeInTheDocument();
        expect(screen.getByText('olá mundo')).toBeInTheDocument();
    });

    it('deve renderizar múltiplas linhas na ordem correta', () => {
        const lines = makeLines([
            {text: 'primeira'},
            {text: 'segunda'},
            {text: 'terceira'},
        ]);
        render(<OutputView lines={lines}/>);
        const spans = screen.getAllByText(/primeira|segunda|terceira/);
        expect(spans).toHaveLength(3);
        expect(spans[0]).toHaveTextContent('primeira');
        expect(spans[1]).toHaveTextContent('segunda');
        expect(spans[2]).toHaveTextContent('terceira');
    });

    it('deve aplicar a classe "lerr" em linhas de erro', () => {
        const lines = makeLines([{text: 'erro grave', isError: true}]);
        render(<OutputView lines={lines}/>);
        const span = screen.getByText('erro grave');
        expect(span).toHaveClass('lerr');
        expect(span).not.toHaveClass('lok');
    });

    it('deve aplicar a classe "lok" em linhas normais', () => {
        const lines = makeLines([{text: 'sucesso', isError: false}]);
        render(<OutputView lines={lines}/>);
        const span = screen.getByText('sucesso');
        expect(span).toHaveClass('lok');
        expect(span).not.toHaveClass('lerr');
    });

    it('deve exibir HTML do log como texto, sem interpretá-lo', () => {
        const lines = makeLines([{text: '<img src=x onerror="alert(1)"><script>xss</script>'}]);
        render(<OutputView lines={lines}/>);
        const span = screen.getByText('<img src=x onerror="alert(1)"><script>xss</script>');
        expect(span.querySelector('img, script')).toBeNull();
        expect(document.querySelector('#output-log script, #output-log img')).toBeNull();
    });

    it('deve fazer scroll para o final ao receber novas linhas', () => {
        const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set');
        const {rerender} = render(<OutputView lines={[]}/>);
        rerender(<OutputView lines={makeLines([{text: 'nova linha'}])}/>);
        expect(scrollSpy).toHaveBeenCalled();
    });

    it('deve ter os IDs corretos nos elementos raiz', () => {
        render(<OutputView lines={[]}/>);
        expect(document.getElementById('view-output')).toBeInTheDocument();
        expect(document.getElementById('output-log')).toBeInTheDocument();
    });

    it('deve exibir o horário de todas as linhas', () => {
        const lines = makeLines([
            {time: '10:01'},
            {time: '10:02'},
            {time: '10:03'},
        ]);
        render(<OutputView lines={lines}/>);
        expect(screen.getByText('10:01')).toBeInTheDocument();
        expect(screen.getByText('10:02')).toBeInTheDocument();
        expect(screen.getByText('10:03')).toBeInTheDocument();
    });

    it('deve lidar com texto vazio em uma linha sem quebrar', () => {
        const lines = makeLines([{text: ''}]);
        expect(() => render(<OutputView lines={lines}/>)).not.toThrow();
    });

    it('deve lidar com um grande volume de linhas sem quebrar', () => {
        const lines = makeLines(Array.from({length: 500}, (_, i) => ({text: `log ${i}`})));
        expect(() => render(<OutputView lines={lines}/>)).not.toThrow();
        expect(screen.getByText('log 0')).toBeInTheDocument();
        expect(screen.getByText('log 499')).toBeInTheDocument();
    });
});