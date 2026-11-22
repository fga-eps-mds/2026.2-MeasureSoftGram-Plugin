import {l10n} from 'vscode';

export interface StatusBarDeps {
  createStatusBarItem: (alignment: any, priority: number) => any;
  ThemeColor: new (color: string) => any;
}

function getDefaultDeps(): StatusBarDeps {
  const vscode = require('vscode');
  return {
    createStatusBarItem: (alignment, priority) =>
        vscode.window.createStatusBarItem(alignment, priority),
    ThemeColor: vscode.ThemeColor,
  };
}

export class MsgramStatusBar {
  private readonly _item: any;

  constructor(deps: StatusBarDeps = getDefaultDeps()) {
    this._item = deps.createStatusBarItem(1, 100);
    this._item.command = 'msgram.qualityView.focus';
    this._item.tooltip = l10n.t('MeasureSoftGram — click to open');
    this.setLoading();
    this._item.show();
  }

  setLoading(): void {
    this._item.text = '$(sync~spin) MSGRAM: ...';
    this._item.color = undefined;
    this._item.backgroundColor = undefined;
  }

  setScore(score: number, deps: StatusBarDeps = getDefaultDeps()): void {
    this._item.text = `$(chart-bar) MSGRAM: ${score.toFixed(2)}`;
    if (score >= 0.8) {
      this._item.color = new deps.ThemeColor('charts.green');
    } else if (score >= 0.6) {
      this._item.color = new deps.ThemeColor('charts.yellow');
    } else {
      this._item.color = new deps.ThemeColor('charts.red');
    }
    this._item.backgroundColor = undefined;
  }

  setNotConfigured(): void {
    this._item.text = `$(gear) ${l10n.t('MSGRAM: configure')}`;
    this._item.color = undefined;
    this._item.backgroundColor = undefined;
  }

  setNoData(): void {
    this._item.text = `$(dash) ${l10n.t('MSGRAM: no data')}`;
    this._item.color = undefined;
    this._item.backgroundColor = undefined;
  }

  setError(deps: StatusBarDeps = getDefaultDeps()): void {
    this._item.text = `$(warning) ${l10n.t('MSGRAM: error')}`;
    this._item.color = new deps.ThemeColor('statusBarItem.warningForeground');
    this._item.backgroundColor = new deps.ThemeColor('statusBarItem.warningBackground');
  }

  dispose(): void {
    this._item.dispose();
  }
}