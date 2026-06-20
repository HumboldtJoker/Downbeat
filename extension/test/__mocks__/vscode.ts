/**
 * Minimal VS Code API mock for testing.
 * Only stubs the APIs actually used by the extension.
 */

export class Disposable {
  private _callOnDispose: () => void;
  constructor(callOnDispose: () => void) {
    this._callOnDispose = callOnDispose;
  }
  dispose(): void {
    this._callOnDispose();
  }
}

type TerminalDataCallback = (e: { data: string }) => void;
const terminalDataListeners: TerminalDataCallback[] = [];

export const window = {
  onDidWriteTerminalData(callback: TerminalDataCallback): Disposable {
    terminalDataListeners.push(callback);
    return new Disposable(() => {
      const idx = terminalDataListeners.indexOf(callback);
      if (idx >= 0) terminalDataListeners.splice(idx, 1);
    });
  },
  createStatusBarItem(): Record<string, unknown> {
    return {
      text: '',
      tooltip: '',
      command: undefined,
      show: () => {},
      hide: () => {},
      dispose: () => {},
    };
  },
  showInformationMessage: () => {},
};

/** Test helper: simulate terminal data arriving */
export function __simulateTerminalData(data: string): void {
  for (const cb of terminalDataListeners) {
    cb({ data });
  }
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export const Uri = {
  parse(value: string) {
    return { toString: () => value };
  },
};

export const workspace = {
  getConfiguration() {
    return {
      get<T>(key: string, defaultValue: T): T {
        return defaultValue;
      },
      update: async () => {},
    };
  },
};

export const commands = {
  registerCommand: () => new Disposable(() => {}),
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};
