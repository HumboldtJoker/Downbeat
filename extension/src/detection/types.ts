import { Disposable } from 'vscode';

export type AdTier = 'ambient' | 'verified';

export interface ThinkingEvent {
  tier: AdTier;
  tool?: string;
}

export interface ThinkingDetector {
  readonly tier: AdTier;
  onThinkingStart(callback: (event: ThinkingEvent) => void): Disposable;
  onThinkingStop(callback: (durationMs: number) => void): Disposable;
  dispose(): void;
}
