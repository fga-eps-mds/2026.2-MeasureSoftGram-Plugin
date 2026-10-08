import {commands, ExtensionContext, window} from "vscode";
import {MeasureSoftGramPanel} from "./panels/measureSoftGramPanel";
import {MeasureSoftGramSidebar} from "./panels/measureSoftGramSidebar";
import {MsgramStatusBar} from "./statusbar/msgramStatusBar";
import {activate as _activate} from "./activator";
import {disposeSharedActRunner} from "./services/actRunner";

/** API exposta em `extension.exports`, usada só pelo teste de integração. */
export interface MsgramExtensionApi {
    sidebar: MeasureSoftGramSidebar;
    currentPanel: () => MeasureSoftGramPanel | undefined;
}

export function activate(context: ExtensionContext): MsgramExtensionApi {
    const {sidebar} = _activate(context, {commands, window}, MeasureSoftGramPanel, MeasureSoftGramSidebar, MsgramStatusBar);
    // Mata uma execução local pendente ao desativar a extensão.
    context.subscriptions.push({dispose: disposeSharedActRunner});
    return {
        sidebar,
        currentPanel: () => MeasureSoftGramPanel.currentPanel,
    };
}