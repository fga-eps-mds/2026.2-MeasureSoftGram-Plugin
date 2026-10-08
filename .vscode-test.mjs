import { defineConfig } from '@vscode/test-cli';

// Só os testes de integração rodam dentro de um VS Code real.
// Os unitários (src/tests/**, exceto integration/) rodam com Mocha e o
// mock de 'vscode' via `npm run test:unit`.
export default defineConfig({
	files: 'out/tests/integration/**/*.test.js',
	mocha: {
		ui: 'tdd',
		timeout: 20000,
	},
});
