import * as vscode from 'vscode';
import { ThinkingDetector, ThinkingEvent, AdTier } from './types';

/**
 * PRIVACY ARCHITECTURE — ShellExecutionDetector (Ambient Tier)
 *
 * Uses VS Code's STABLE shell integration API to detect when a
 * long-running command is executing in the terminal. This detector
 * NEVER reads terminal output — it only observes command lifecycle
 * events (start/end).
 *
 * What IS observed:
 *   - A shell command started executing (boolean)
 *   - The command finished executing (boolean + duration)
 *
 * What is NEVER observed, stored, or transmitted:
 *   - The command text itself
 *   - Terminal output of any kind
 *   - File contents, paths, or any user data
 *
 * Minimum command duration prevents ads on quick commands like `ls`.
 */

const MIN_DURATION_MS = 3000;

export class ShellExecutionDetector implements ThinkingDetector {
  readonly tier: AdTier = 'ambient';

  private startCallbacks: Array<(event: ThinkingEvent) => void> = [];
  private stopCallbacks: Array<(durationMs: number) => void> = [];
  private disposables: vscode.Disposable[] = [];

  private activeExecutions = new Map<vscode.Terminal, number>();
  private isThinking = false;
  private thinkingStartTime = 0;

  constructor() {
    const startListener = vscode.window.onDidStartTerminalShellExecution(
      (e) => {
        this.activeExecutions.set(e.terminal, Date.now());
        if (!this.isThinking) {
          this.checkThinkingState();
        }
      }
    );

    const endListener = vscode.window.onDidEndTerminalShellExecution((e) => {
      this.activeExecutions.delete(e.terminal);
      if (this.activeExecutions.size === 0 && this.isThinking) {
        this.fireStop();
      }
    });

    this.disposables.push(startListener, endListener);
  }

  private checkThinkingState(): void {
    if (this.isThinking || this.activeExecutions.size === 0) {
      return;
    }

    const earliest = Math.min(...this.activeExecutions.values());
    const elapsed = Date.now() - earliest;

    if (elapsed >= MIN_DURATION_MS) {
      this.fireStart();
    } else {
      setTimeout(() => this.checkThinkingState(), MIN_DURATION_MS - elapsed);
    }
  }

  private fireStart(): void {
    if (this.isThinking || this.activeExecutions.size === 0) {
      return;
    }
    this.isThinking = true;
    this.thinkingStartTime = Date.now();
    const event: ThinkingEvent = { tier: 'ambient' };
    for (const cb of this.startCallbacks) {
      cb(event);
    }
  }

  private fireStop(): void {
    if (!this.isThinking) {
      return;
    }
    const durationMs = Date.now() - this.thinkingStartTime;
    this.isThinking = false;
    this.thinkingStartTime = 0;
    for (const cb of this.stopCallbacks) {
      cb(durationMs);
    }
  }

  onThinkingStart(
    callback: (event: ThinkingEvent) => void
  ): vscode.Disposable {
    this.startCallbacks.push(callback);
    return new vscode.Disposable(() => {
      this.startCallbacks = this.startCallbacks.filter((cb) => cb !== callback);
    });
  }

  onThinkingStop(callback: (durationMs: number) => void): vscode.Disposable {
    this.stopCallbacks.push(callback);
    return new vscode.Disposable(() => {
      this.stopCallbacks = this.stopCallbacks.filter((cb) => cb !== callback);
    });
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.startCallbacks = [];
    this.stopCallbacks = [];
    this.activeExecutions.clear();
  }
}
