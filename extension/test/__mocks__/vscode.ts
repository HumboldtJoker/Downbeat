/**
 * VS Code API mock for testing.
 * Stubs the APIs used by both detection tiers.
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

// --- Shell execution events (ambient tier) ---

type ShellStartCallback = (e: { terminal: object }) => void;
type ShellEndCallback = (e: { terminal: object }) => void;

const shellStartListeners: ShellStartCallback[] = [];
const shellEndListeners: ShellEndCallback[] = [];

const mockTerminal = { name: 'test-terminal' };

export const window = {
  onDidStartTerminalShellExecution(callback: ShellStartCallback): Disposable {
    shellStartListeners.push(callback);
    return new Disposable(() => {
      const idx = shellStartListeners.indexOf(callback);
      if (idx >= 0) shellStartListeners.splice(idx, 1);
    });
  },
  onDidEndTerminalShellExecution(callback: ShellEndCallback): Disposable {
    shellEndListeners.push(callback);
    return new Disposable(() => {
      const idx = shellEndListeners.indexOf(callback);
      if (idx >= 0) shellEndListeners.splice(idx, 1);
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
  showWarningMessage: () => {},
  showInputBox: async () => undefined,
};

/** Test helper: simulate a shell command starting */
export function __simulateShellStart(terminal?: object): void {
  const t = terminal || mockTerminal;
  for (const cb of shellStartListeners) {
    cb({ terminal: t });
  }
}

/** Test helper: simulate a shell command ending */
export function __simulateShellEnd(terminal?: object): void {
  const t = terminal || mockTerminal;
  for (const cb of shellEndListeners) {
    cb({ terminal: t });
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

export const env = {
  openExternal: async () => true,
};

export const workspace = {
  getConfiguration() {
    return {
      get<T>(_key: string, defaultValue: T): T {
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
