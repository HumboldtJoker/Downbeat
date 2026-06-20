import { Disposable } from 'vscode';

export interface ThinkingDetector {
  onThinkingStart(callback: () => void): Disposable;
  onThinkingStop(callback: (durationMs: number) => void): Disposable;
  dispose(): void;
}
