import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShellExecutionDetector } from '../src/detection/shellDetector';
import { ClaudeCodeDetector } from '../src/detection/claudeCodeDetector';
import { CompositeDetector } from '../src/detection/compositeDetector';
import { ThinkingEvent } from '../src/detection/types';
import { __simulateShellStart, __simulateShellEnd } from './__mocks__/vscode';
import * as fs from 'fs';
import * as path from 'path';

// --- Shell Execution Detector (Ambient Tier) ---

describe('ShellExecutionDetector', () => {
  let detector: ShellExecutionDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new ShellExecutionDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('does NOT trigger immediately on shell start (waits for min duration)', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateShellStart();

    expect(startCallback).not.toHaveBeenCalled();
  });

  it('triggers thinking after minimum duration (3s)', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateShellStart();
    vi.advanceTimersByTime(3000);

    expect(startCallback).toHaveBeenCalledTimes(1);
    expect(startCallback.mock.calls[0][0].tier).toBe('ambient');
  });

  it('fires stop when shell execution ends', () => {
    const stopCallback = vi.fn();
    detector.onThinkingStart(() => {});
    detector.onThinkingStop(stopCallback);

    __simulateShellStart();
    vi.advanceTimersByTime(3000); // triggers thinking start
    vi.advanceTimersByTime(2000); // thinking for 2s more
    __simulateShellEnd();

    expect(stopCallback).toHaveBeenCalledTimes(1);
    const duration = stopCallback.mock.calls[0][0];
    expect(duration).toBeGreaterThanOrEqual(2000);
  });

  it('does not fire if command ends before minimum duration', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateShellStart();
    vi.advanceTimersByTime(1000);
    __simulateShellEnd();
    vi.advanceTimersByTime(5000);

    expect(startCallback).not.toHaveBeenCalled();
  });

  it('cleans up on dispose', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);
    detector.dispose();

    __simulateShellStart();
    vi.advanceTimersByTime(5000);

    expect(startCallback).not.toHaveBeenCalled();
  });

  it('never stores terminal content (privacy)', () => {
    __simulateShellStart();
    vi.advanceTimersByTime(5000);

    const record = detector as unknown as Record<string, unknown>;
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('password');
  });
});

// --- Claude Code Detector (Verified Tier) ---

describe('ClaudeCodeDetector', () => {
  let detector: ClaudeCodeDetector;
  const stateFile = path.join(
    process.env.HOME || '/tmp',
    '.claude',
    'downbeat_state.json'
  );

  beforeEach(() => {
    vi.useFakeTimers();
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    } catch {}
    try {
      fs.unlinkSync(stateFile);
    } catch {}
  });

  afterEach(() => {
    detector?.dispose();
    vi.useRealTimers();
    try {
      fs.unlinkSync(stateFile);
    } catch {}
  });

  it('detects thinking start from state file', () => {
    detector = new ClaudeCodeDetector();
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    fs.writeFileSync(stateFile, JSON.stringify({ thinking: true, tool: 'Bash' }));
    vi.advanceTimersByTime(600);

    expect(startCallback).toHaveBeenCalledTimes(1);
    expect(startCallback.mock.calls[0][0].tier).toBe('verified');
    expect(startCallback.mock.calls[0][0].tool).toBe('Bash');
  });

  it('detects thinking stop from state file', () => {
    detector = new ClaudeCodeDetector();
    const stopCallback = vi.fn();
    detector.onThinkingStart(() => {});
    detector.onThinkingStop(stopCallback);

    fs.writeFileSync(stateFile, JSON.stringify({ thinking: true }));
    vi.advanceTimersByTime(600);

    fs.writeFileSync(stateFile, JSON.stringify({ thinking: false }));
    vi.advanceTimersByTime(600);

    expect(stopCallback).toHaveBeenCalledTimes(1);
  });

  it('fires stop when state file is deleted', () => {
    detector = new ClaudeCodeDetector();
    const stopCallback = vi.fn();
    detector.onThinkingStart(() => {});
    detector.onThinkingStop(stopCallback);

    fs.writeFileSync(stateFile, JSON.stringify({ thinking: true }));
    vi.advanceTimersByTime(600);

    fs.unlinkSync(stateFile);
    vi.advanceTimersByTime(600);

    expect(stopCallback).toHaveBeenCalledTimes(1);
  });

  it('state file contains only boolean + tool (privacy)', () => {
    const state = { thinking: true, tool: 'Read' };
    fs.writeFileSync(stateFile, JSON.stringify(state));

    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    const keys = Object.keys(parsed);
    expect(keys).toContain('thinking');
    expect(keys.length).toBeLessThanOrEqual(2);
  });
});

// --- Composite Detector ---

describe('CompositeDetector', () => {
  let detector: CompositeDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new CompositeDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('fires start from ambient tier on shell execution', () => {
    const events: ThinkingEvent[] = [];
    detector.onThinkingStart((e) => events.push(e));

    __simulateShellStart();
    vi.advanceTimersByTime(3000);

    expect(events.length).toBe(1);
    expect(events[0].tier).toBe('ambient');
  });

  it('does not double-fire when both detectors trigger', () => {
    const events: ThinkingEvent[] = [];
    detector.onThinkingStart((e) => events.push(e));

    __simulateShellStart();
    vi.advanceTimersByTime(3000);

    // Second start from same detector should not re-fire
    __simulateShellStart();
    vi.advanceTimersByTime(3000);

    expect(events.length).toBe(1);
  });

  it('cleans up both detectors on dispose', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);
    detector.dispose();

    __simulateShellStart();
    vi.advanceTimersByTime(5000);

    expect(startCallback).not.toHaveBeenCalled();
  });
});
