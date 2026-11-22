import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {RunButton} from '../../../components/action/RunButton';
import {userEvent} from "@testing-library/user-event/dist/cjs/setup/index.js";

describe('RunButton', () => {
    const onRun = vi.fn();
    const onStop = vi.fn();

    beforeEach(() => {
        onRun.mockClear();
        onStop.mockClear();
    });


    it('deve renderizar o botão com texto "Run" quando não está rodando', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={false}/>);
        expect(screen.getByRole('button', {name: /run/i})).toHaveTextContent('Run');
    });

    it('deve renderizar o botão com texto "Running..." quando está rodando', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={true}/>);
        expect(screen.getByRole('button', {name: /running/i})).toHaveTextContent('Running...');
    });

    it('deve estar habilitado quando running é false', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={false}/>);
        expect(screen.getByRole('button', {name: /run/i})).not.toBeDisabled();
    });

    it('deve estar desabilitado quando running é true', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={true}/>);
        expect(screen.getByRole('button', {name: /running/i})).toBeDisabled();
    });

    it('deve chamar onRun ao clicar quando não está rodando', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={false}/>);
        fireEvent.click(screen.getByRole('button', {name: /run/i}));
        expect(onRun).toHaveBeenCalledTimes(1);
    });

    it('não deve chamar onRun ao clicar quando está desabilitado', async () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={true}/>);
        await userEvent.click(screen.getByRole('button', {name: /running/i}));
        expect(onRun).not.toHaveBeenCalled();
    });

    it('deve exibir ícone de play quando não está rodando', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={false}/>);
        expect(screen.getByRole('button', {name: /run/i}).querySelector('i')).toHaveClass('codicon-play');
    });

    it('deve exibir ícone de loader quando está rodando', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={true}/>);
        expect(screen.getByRole('button', {name: /running/i}).querySelector('i')).toHaveClass('codicon-loading codicon-modifier-spin');
    });

    it('não mostra "Stop" quando não está rodando', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={false}/>);
        expect(screen.queryByRole('button', {name: /stop/i})).not.toBeInTheDocument();
    });

    it('mostra "Stop" habilitado quando está rodando e chama onStop', () => {
        render(<RunButton onRun={onRun} onStop={onStop} running={true}/>);
        const stop = screen.getByRole('button', {name: /stop/i});
        expect(stop).not.toBeDisabled();
        fireEvent.click(stop);
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(onRun).not.toHaveBeenCalled();
    });
});
