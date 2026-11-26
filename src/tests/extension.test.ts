import * as assert from 'assert';
import {activate} from '../extension';
import {MeasureSoftGramPanel} from '../panels/measureSoftGramPanel';
import {setOutputChannelForTests} from '../utilities/log';
import * as activatorMod from '../activator';
import * as settingsMod from '../config/settings';
import * as registerRepoMod from '../services/registerRepo';
import * as workspaceRepoMod from '../utilities/workspaceRepo';
import * as actRunnerMod from '../services/actRunner';

const vscode = require('vscode');

suite('extension — activate()', () => {
    const origActivate = activatorMod.activate;
    const origMakeSettingsDeps = settingsMod.makeSettingsDeps;
    const origLoadSettings = settingsMod.loadSettings;
    const origUpdateProjectSettings = settingsMod.updateProjectSettings;
    const origRegisterWorkspaceRepo = registerRepoMod.registerWorkspaceRepo;
    const origDetectWorkspaceHints = workspaceRepoMod.detectWorkspaceHints;
    const origDisposeShared = actRunnerMod.disposeSharedActRunner;

    const origShowWarning = vscode.window.showWarningMessage;
    const origShowError = vscode.window.showErrorMessage;
    const origShowInfo = vscode.window.showInformationMessage;
    const origShowQuickPick = vscode.window.showQuickPick;
    const origShowInputBox = vscode.window.showInputBox;
    const origWorkspaceFolders = vscode.workspace.workspaceFolders;
    const origCurrentPanel = MeasureSoftGramPanel.currentPanel;

    let subscriptions: { dispose: () => void }[];
    let fakeContext: any;
    let capturedRegisterRepo: ((afterSuccess: () => Promise<void>) => Promise<void>) | undefined;
    let fakeSidebar: any;
    let createdTree: any;
    let warnings: string[];
    let errors: string[];
    let infos: string[];
    let logs: string[];
    let persistedPatches: any[];
    let disposeSharedCalled: boolean;
    let quickPickCalls: { items: any[]; options?: any }[];
    let inputBoxCalls: any[];
    let infoMessageCalls: { msg: string; options?: any; okLabel?: string }[];

    setup(() => {
        subscriptions = [];
        fakeContext = {
            subscriptions,
            secrets: {
                get: async () => undefined,
                store: async () => {},
                delete: async () => {},
            },
        };
        capturedRegisterRepo = undefined;
        fakeSidebar = {id: 'fake-sidebar'};
        createdTree = undefined;
        warnings = [];
        errors = [];
        infos = [];
        logs = [];
        persistedPatches = [];
        disposeSharedCalled = false;
        quickPickCalls = [];
        inputBoxCalls = [];
        infoMessageCalls = [];

        setOutputChannelForTests({
            appendLine: (m: string) => logs.push(m),
            show: () => {},
            dispose: () => {},
        });

        vscode.window.showWarningMessage = async (msg: string) => {
            warnings.push(msg);
            return undefined;
        };
        vscode.window.showErrorMessage = async (msg: string) => {
            errors.push(msg);
            return undefined;
        };
        vscode.window.showInformationMessage = async (msg: string, opts?: any, okLabel?: string) => {
            infos.push(msg);
            infoMessageCalls.push({msg, options: opts, okLabel});
            return okLabel;
        };
        vscode.window.showQuickPick = async (items: any[], options?: any) => {
            quickPickCalls.push({items, options});
            return items[0];
        };
        vscode.window.showInputBox = async (opts: { prompt?: string; value?: string }) => {
            inputBoxCalls.push(opts);
            return opts.value ?? 'input-val';
        };
        vscode.workspace.workspaceFolders = undefined;

        (activatorMod as any).activate = (
            _ctx: any,
            _vs: any,
            _Panel: any,
            _Sidebar: any,
            _StatusBar: any,
            makeTree?: (sb: any) => any,
            registerRepo?: (afterSuccess: () => Promise<void>) => Promise<void>,
        ) => {
            createdTree = makeTree ? makeTree({}) : undefined;
            capturedRegisterRepo = registerRepo;
            return {sidebar: fakeSidebar, tree: createdTree};
        };

        (settingsMod as any).makeSettingsDeps = () => ({fakeDeps: true});
        (settingsMod as any).loadSettings = async () => ({
            serviceUrl: 'https://msgram.lappis.rocks',
            productName: 'prod',
            organizationName: 'org',
            sonarProjectKey: '',
            workflowName: 'Build',
            requestTimeoutMs: 15000,
            grafanaAllowedHosts: [],
            token: 'secret-token',
            githubToken: '',
        });
        (settingsMod as any).updateProjectSettings = async (patch: any) => {
            persistedPatches.push(patch);
        };
        (workspaceRepoMod as any).detectWorkspaceHints = async (fsPath: string) => ({
            folderName: fsPath.split('/').pop(),
            remoteName: 'repo-hint',
        });
        (actRunnerMod as any).disposeSharedActRunner = () => {
            disposeSharedCalled = true;
        };
    });

    teardown(() => {
        (activatorMod as any).activate = origActivate;
        (settingsMod as any).makeSettingsDeps = origMakeSettingsDeps;
        (settingsMod as any).loadSettings = origLoadSettings;
        (settingsMod as any).updateProjectSettings = origUpdateProjectSettings;
        (registerRepoMod as any).registerWorkspaceRepo = origRegisterWorkspaceRepo;
        (workspaceRepoMod as any).detectWorkspaceHints = origDetectWorkspaceHints;
        (actRunnerMod as any).disposeSharedActRunner = origDisposeShared;

        vscode.window.showWarningMessage = origShowWarning;
        vscode.window.showErrorMessage = origShowError;
        vscode.window.showInformationMessage = origShowInfo;
        vscode.window.showQuickPick = origShowQuickPick;
        vscode.window.showInputBox = origShowInputBox;
        vscode.workspace.workspaceFolders = origWorkspaceFolders;
        MeasureSoftGramPanel.currentPanel = origCurrentPanel;
        setOutputChannelForTests(undefined);
    });

    test('activate devolve a API (sidebar, tree, currentPanel)', () => {
        const fakePanel = {id: 'panel-instance'} as any;
        MeasureSoftGramPanel.currentPanel = fakePanel;

        const api = activate(fakeContext);

        assert.strictEqual(api.sidebar, fakeSidebar);
        assert.strictEqual(api.tree, createdTree);
        assert.ok(api.tree);
        assert.strictEqual(api.currentPanel(), fakePanel);
    });

    test('registra dispose do ActRunner compartilhado em context.subscriptions', () => {
        activate(fakeContext);

        assert.strictEqual(subscriptions.length, 1);
        subscriptions[0].dispose();
        assert.strictEqual(disposeSharedCalled, true);
    });

    test('callback de cadastro avisa quando não há token', async () => {
        (settingsMod as any).loadSettings = async () => ({
            serviceUrl: 'https://msgram.lappis.rocks',
            productName: '',
            organizationName: '',
            sonarProjectKey: '',
            workflowName: 'Build',
            requestTimeoutMs: 15000,
            grafanaAllowedHosts: [],
            token: '',
            githubToken: '',
        });
        let registerCalled = false;
        (registerRepoMod as any).registerWorkspaceRepo = async () => {
            registerCalled = true;
            return {kind: 'cancelled'};
        };

        activate(fakeContext);
        assert.ok(capturedRegisterRepo);

        let afterSuccessCalled = false;
        await capturedRegisterRepo(async () => {
            afterSuccessCalled = true;
        });

        assert.strictEqual(warnings.length, 1);
        assert.ok(warnings[0].includes('Enter the MeasureSoftGram token'));
        assert.strictEqual(registerCalled, false);
        assert.strictEqual(afterSuccessCalled, false);
    });

    test('callback de cadastro cadastra com sucesso, exercita callbacks de UI/persist/log e chama afterSuccess', async () => {
        vscode.workspace.workspaceFolders = [{uri: {fsPath: '/workspace/my-repo'}}];
        let receivedHints: any;
        let picked: any;
        let inputVal: any;
        let confirmed: any;

        (registerRepoMod as any).registerWorkspaceRepo = async (_settings: any, hints: any, deps: registerRepoMod.RegisterDeps) => {
            receivedHints = hints;
            picked = await deps.ui.pick([{label: 'org1'}], 'Escolha org');
            inputVal = await deps.ui.input('Nome', 'default-prod');
            confirmed = await deps.ui.confirm('Confirmar?', 'Cadastrar');
            deps.ui.info('Info msg');
            deps.ui.warn('Warn msg');
            await deps.persist({productName: 'prod1', organizationName: 'org1'});
            deps.log?.('log msg');
            return {
                kind: 'registered',
                orgName: 'org1',
                productName: 'prod1',
                repo: {id: 1, name: 'my-repo'},
            };
        };

        activate(fakeContext);
        assert.ok(capturedRegisterRepo);

        let afterSuccessCalled = false;
        await capturedRegisterRepo(async () => {
            afterSuccessCalled = true;
        });

        assert.strictEqual(picked?.label, 'org1');
        assert.strictEqual(inputVal, 'default-prod');
        assert.strictEqual(confirmed, true);
        assert.deepStrictEqual(infoMessageCalls[0].options, {modal: true});
        assert.deepStrictEqual(quickPickCalls[0].options, {placeHolder: 'Escolha org'});
        assert.deepStrictEqual(inputBoxCalls[0], {prompt: 'Nome', value: 'default-prod'});
        assert.deepStrictEqual(receivedHints, {folderName: 'my-repo', remoteName: 'repo-hint'});
        assert.strictEqual(afterSuccessCalled, true);
        assert.deepStrictEqual(persistedPatches, [{productName: 'prod1', organizationName: 'org1'}]);
        assert.ok(infos.includes('Info msg'));
        assert.ok(warnings.includes('Warn msg'));
        assert.ok(logs.includes('log msg'));
    });

    test('callback de cadastro não chama afterSuccess quando registerWorkspaceRepo é cancelado', async () => {
        (registerRepoMod as any).registerWorkspaceRepo = async () => ({kind: 'cancelled'});

        activate(fakeContext);
        assert.ok(capturedRegisterRepo);

        let afterSuccessCalled = false;
        await capturedRegisterRepo(async () => {
            afterSuccessCalled = true;
        });

        assert.strictEqual(afterSuccessCalled, false);
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(warnings.length, 0);
    });

    test('callback de cadastro trata erro que não é instância de Error convertendo com String(err)', async () => {
        (registerRepoMod as any).registerWorkspaceRepo = async () => {
            return Promise.reject('falha em string');
        };

        activate(fakeContext);
        assert.ok(capturedRegisterRepo);

        let afterSuccessCalled = false;
        await capturedRegisterRepo(async () => {
            afterSuccessCalled = true;
        });

        assert.strictEqual(afterSuccessCalled, false);
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0], 'Could not register repository: falha em string');
        assert.ok(logs.some((l) => l.includes('[registro] erro: falha em string')));
    });

    test('callback de cadastro trata erro mostrando showErrorMessage e registrando no log', async () => {
        (registerRepoMod as any).registerWorkspaceRepo = async () => {
            throw new Error('Falha na API');
        };

        activate(fakeContext);
        assert.ok(capturedRegisterRepo);

        let afterSuccessCalled = false;
        await capturedRegisterRepo(async () => {
            afterSuccessCalled = true;
        });

        assert.strictEqual(afterSuccessCalled, false);
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0], 'Could not register repository: Falha na API');
        assert.ok(logs.some((l) => l.includes('[registro] erro: Falha na API')));
    });
});
