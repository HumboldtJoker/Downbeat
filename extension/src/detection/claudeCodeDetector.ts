import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ThinkingDetector, ThinkingEvent, AdTier } from './types';

/**
 * PRIVACY ARCHITECTURE — ClaudeCodeDetector (Verified Tier)
 *
 * Reads a state file written by a Claude Code hook to detect exact
 * thinking state. The hook writes { thinking: true/false, tool?: string }
 * and this detector watches for changes via fs.watch.
 *
 * What IS observed:
 *   - Boolean: is Claude Code currently thinking?
 *   - Tool name: which tool is being used (e.g., "Bash", "Read", "Edit")
 *   - Duration: how long the thinking lasted
 *
 * What is NEVER observed, stored, or transmitted:
 *   - Prompt content, responses, file contents, terminal output
 *   - The state file contains only { thinking, tool } — nothing else
 *
 * State file location: ~/.claude/downbeat_state.json
 * Written by: Claude Code PreToolUse/PostToolUse hooks
 */

interface ClaudeState {
  thinking: boolean;
  tool?: string;
  timestamp?: number;
}

const POLL_INTERVAL_MS = 500;

export class ClaudeCodeDetector implements ThinkingDetector {
  readonly tier: AdTier = 'verified';

  private startCallbacks: Array<(event: ThinkingEvent) => void> = [];
  private stopCallbacks: Array<(durationMs: number) => void> = [];

  private stateFilePath: string;
  private watcher: fs.FSWatcher | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private isThinking = false;
  private thinkingStartTime = 0;
  private lastTool: string | undefined;
  private disposed = false;

  constructor() {
    const homeDir =
      process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.stateFilePath = path.join(homeDir, '.claude', 'downbeat_state.json');

    this.startWatching();
  }

  get available(): boolean {
    return fs.existsSync(this.stateFilePath);
  }

  private startWatching(): void {
    const dir = path.dirname(this.stateFilePath);

    try {
      if (fs.existsSync(dir)) {
        this.watcher = fs.watch(dir, (eventType, filename) => {
          if (filename === 'downbeat_state.json') {
            this.checkState();
          }
        });
      }
    } catch {
      // fs.watch not available — fall back to polling
    }

    this.pollTimer = setInterval(() => {
      if (!this.disposed) {
        this.checkState();
      }
    }, POLL_INTERVAL_MS);
  }

  private checkState(): void {
    let state: ClaudeState;
    try {
      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      state = JSON.parse(raw) as ClaudeState;
    } catch {
      if (this.isThinking) {
        this.fireStop();
      }
      return;
    }

    if (state.thinking && !this.isThinking) {
      this.fireStart(state.tool);
    } else if (!state.thinking && this.isThinking) {
      this.fireStop();
    }
  }

  private fireStart(tool?: string): void {
    this.isThinking = true;
    this.thinkingStartTime = Date.now();
    this.lastTool = tool;
    const event: ThinkingEvent = { tier: 'verified', tool };
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
    this.lastTool = undefined;
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
    this.disposed = true;
    this.watcher?.close();
    if (this.pollTimer !== undefined) {
      clearInterval(this.pollTimer);
    }
    this.startCallbacks = [];
    this.stopCallbacks = [];
  }
}
