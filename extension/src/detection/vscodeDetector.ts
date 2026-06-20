import * as vscode from 'vscode';
import { ThinkingDetector } from './types';

/**
 * PRIVACY ARCHITECTURE — VscodeTerminalDetector
 *
 * This detector watches terminal output EXCLUSIVELY for AI thinking indicators.
 * It pattern-matches against a small allowlist of spinner characters and keywords.
 *
 * What IS captured:
 *   - Boolean state: "is AI thinking right now?" (yes/no)
 *   - Duration: how long the thinking state lasted (milliseconds)
 *
 * What is NEVER captured, stored, or transmitted:
 *   - Terminal text content (commands, output, code, file paths, errors)
 *   - User input of any kind
 *   - Any data beyond the boolean thinking state and its duration
 *
 * Data flow: terminal data → regex test → boolean match → discard all text immediately
 */

/** Braille spinner characters used by common CLI tools (ora, cli-spinners) */
const SPINNER_CHARS = new Set('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏');

/** Keywords that indicate AI processing — matched case-insensitively */
const THINKING_KEYWORDS = /\b(Thinking|Processing)\b/i;

/** Debounce interval: how long after last spinner activity before we consider thinking "stopped" */
const STOP_DEBOUNCE_MS = 2000;

export class VscodeTerminalDetector implements ThinkingDetector {
  private startCallbacks: Array<() => void> = [];
  private stopCallbacks: Array<(durationMs: number) => void> = [];
  private disposables: vscode.Disposable[] = [];

  private isThinking = false;
  private thinkingStartTime = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // PRIVACY: Register terminal data listener.
    // The callback receives raw terminal data, tests it against our allowlist,
    // then IMMEDIATELY discards the data. No terminal content is ever stored.
    const terminalListener = vscode.window.onDidWriteTerminalData((e) => {
      this.handleTerminalData(e.data);
    });
    this.disposables.push(terminalListener);
  }

  /**
   * PRIVACY: This method is the sole entry point for terminal data.
   * It tests data against spinner chars and keywords, then returns.
   * The `data` parameter is never assigned to any instance variable,
   * never pushed to any array, and never transmitted anywhere.
   * After this method returns, the data string is eligible for GC.
   */
  private handleTerminalData(data: string): void {
    // PRIVACY: Test only — we check if data contains thinking indicators.
    // The data string itself is never stored beyond this stack frame.
    const hasSpinner = [...data].some((char) => SPINNER_CHARS.has(char));
    const hasKeyword = THINKING_KEYWORDS.test(data);

    if (hasSpinner || hasKeyword) {
      this.onThinkingActivity();
    }
    // PRIVACY: data falls out of scope here and is never referenced again.
  }

  private onThinkingActivity(): void {
    // Clear any pending stop debounce — thinking is still active
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    if (!this.isThinking) {
      this.isThinking = true;
      this.thinkingStartTime = Date.now();
      for (const cb of this.startCallbacks) {
        cb();
      }
    }

    // Set debounce: if no more thinking activity within STOP_DEBOUNCE_MS, fire stop
    this.debounceTimer = setTimeout(() => {
      this.fireStop();
    }, STOP_DEBOUNCE_MS);
  }

  private fireStop(): void {
    if (!this.isThinking) {
      return;
    }

    const durationMs = Date.now() - this.thinkingStartTime;
    this.isThinking = false;
    this.thinkingStartTime = 0;
    this.debounceTimer = undefined;

    for (const cb of this.stopCallbacks) {
      cb(durationMs);
    }
  }

  onThinkingStart(callback: () => void): vscode.Disposable {
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
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.startCallbacks = [];
    this.stopCallbacks = [];
  }
}
