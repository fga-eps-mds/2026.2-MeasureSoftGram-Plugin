import {commands, ExtensionContext, window} from "vscode";
import {MeasureSoftGramPanel} from "./panels/measureSoftGramPanel";
import {MeasureSoftGramSidebar} from "./panels/measureSoftGramSidebar";
import {MsgramStatusBar} from "./statusbar/msgramStatusBar";
import {activate as _activate} from "./activator";
import {disposeSharedActRunner} from "./services/actRunner";

export function activate(context: ExtensionContext) {
    _activate(context, {commands, window}, MeasureSoftGramPanel, MeasureSoftGramSidebar, MsgramStatusBar);
    // Mata uma execução local pendente ao desativar a extensão.
    context.subscriptions.push({dispose: disposeSharedActRunner});
}