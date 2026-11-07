import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

let mochaData = null;
const mochaPath = path.join(rootDir, 'mocha-result.json');
if (fs.existsSync(mochaPath)) {
    try {
        let raw = fs.readFileSync(mochaPath, 'utf8');
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            raw = raw.substring(start, end + 1);
        }
        mochaData = JSON.parse(raw);
    } catch (e) {
        console.error('Erro ao ler mocha-result.json:', e);
    }
}

let vitestData = null;
const vitestPath = path.join(rootDir, 'webview-ui/vitest-result.json');
if (fs.existsSync(vitestPath)) {
    try {
        vitestData = JSON.parse(fs.readFileSync(vitestPath, 'utf8'));
    } catch (e) {
        console.error('Erro ao ler vitest-result.json:', e);
    }
}

const filesMap = new Map();

if (mochaData && mochaData.tests) {
    for (const t of mochaData.tests) {
        if (!t.file) continue;
        let relPath = path.relative(rootDir, t.file).replace(/\\/g, '/');
        // Mapeia caminho compilado out/tests/... para o fonte src/tests/...
        relPath = relPath.replace(/^out\/tests\//, 'src/tests/').replace(/\.js$/, '.ts');
        if (!filesMap.has(relPath)) filesMap.set(relPath, []);
        filesMap.get(relPath).push({
            name: t.fullTitle || t.title,
            duration: Math.max(1, Math.round(t.duration || 1))
        });
    }
}

if (vitestData && vitestData.testResults) {
    for (const suite of vitestData.testResults) {
        if (!suite.name) continue;
        let relPath = path.relative(rootDir, suite.name).replace(/\\/g, '/');
        if (!filesMap.has(relPath)) filesMap.set(relPath, []);
        for (const t of suite.assertionResults || []) {
            filesMap.get(relPath).push({
                name: t.fullName || t.title,
                duration: Math.max(1, Math.round(t.duration || 1))
            });
        }
    }
}

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<testExecutions version="1">\n';
let totalTests = 0;
for (const [filePath, tests] of filesMap.entries()) {
    xml += `  <file path="${filePath}">\n`;
    for (const t of tests) {
        totalTests++;
        const safeName = String(t.name)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        xml += `    <testCase name="${safeName}" duration="${t.duration}" />\n`;
    }
    xml += '  </file>\n';
}
xml += '</testExecutions>\n';

fs.writeFileSync(path.join(rootDir, 'test-report.xml'), xml, 'utf8');
console.log(`[Sonar Report] test-report.xml gerado com sucesso: ${totalTests} testes em ${filesMap.size} arquivos.`);
