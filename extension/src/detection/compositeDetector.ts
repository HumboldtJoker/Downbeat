import * as vscode from 'vscode';
import { ThinkingDetector, ThinkingEvent, AdTier } from './types';
import { ShellExecutionDetector } from './shellDetector';
import { ClaudeCodeDetector } from './claudeCodeDetector';

/**
 * CompositeDetector — selects the highest-value detection tier available.
 *
 * Priority: verified (Claude Code hooks) > ambient (shell execution).
 * When Claude Code is active, its detector takes precedence — impressions
 * are tagged 'verified' for premium CPM. When it's not available, the
 * shell execution detector provides ambient-tier coverage.
 *
 * Both detectors run simultaneously. The composite deduplicates:
 * if both fire, only the verified event propagates.
 */
export class CompositeDetector implements ThinkingDetector {
  readonly tier: AdTier = 'verified';

  private shellDetector: ShellExecutionDetector;
  private claudeDetector: ClaudeCodeDetector;
  private disposables: vscode.Disposable[] = [];

  private startCallbacks: Array<(event: ThinkingEvent) => void> = [];
  private stopCallbacks: Array<(durationMs: number) => void> = [];

  private activeSource: AdTier | null = null;
  private isThinking = false;

  constructor() {
    this.shellDetector = new ShellExecutionDetector();
    this.claudeDetector = new ClaudeCodeDetector();

    this.disposables.push(
      this.claudeDetector.onThinkingStart((event) => {
        this.handleStart(event);
      }),
      this.claudeDetector.onThinkingStop((durationMs) => {
        this.handleStop('verified', durationMs);
      }),
      this.shellDetector.onThinkingStart((event) => {
        this.handleStart(event);
      }),
      this.shellDetector.onThinkingStop((durationMs) => {
        this.handleStop('ambient', durationMs);
      })
    );
  }

  private handleStart(event: ThinkingEvent): void {
    if (this.isThinking) {
      if (event.tier === 'verified' && this.activeSource === 'ambient') {
        this.activeSource = 'verified';
      }
      return;
    }
    this.isThinking = true;
    this.activeSource = event.tier;
    for (const cb of this.startCallbacks) {
      cb(event);
    }
  }

  private handleStop(source: AdTier, durationMs: number): void {
    if (!this.isThinking) {
      return;
    }
    if (source !== this.activeSource) {
      return;
    }
    this.isThinking = false;
    this.activeSource = null;
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
    this.shellDetector.dispose();
    this.claudeDetector.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.startCallbacks = [];
    this.stopCallbacks = [];
  }
}
