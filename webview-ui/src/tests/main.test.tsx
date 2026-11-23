import {afterEach, describe, expect, it, vi} from 'vitest';
import {screen} from '@testing-library/react';

vi.mock('@vscode/codicons/dist/codicon.css', () => ({}));
vi.mock('../index.css', () => ({}));
vi.mock('../App.tsx', () => ({
    default: () => <div data-testid="mock-app">Mock App</div>,
}));

describe('main.tsx', () => {
    afterEach(() => {
        const root = document.getElementById('root');
        if (root) {
            root.remove();
        }
    });

    it('renderiza o App dentro do elemento #root', async () => {
        const root = document.createElement('div');
        root.id = 'root';
        document.body.appendChild(root);

        await import('../main.tsx');

        expect(await screen.findByTestId('mock-app')).toBeInTheDocument();
        expect(root).toContainElement(screen.getByTestId('mock-app'));
    });
});
