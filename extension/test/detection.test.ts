import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VscodeTerminalDetector } from '../src/detection/vscodeDetector';
import { __simulateTerminalData } from './__mocks__/vscode';

describe('VscodeTerminalDetector', () => {
  let detector: VscodeTerminalDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new VscodeTerminalDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('triggers thinking start on spinner characters', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateTerminalData('⠋');

    expect(startCallback).toHaveBeenCalledTimes(1);
  });

  it('triggers thinking start on "Thinking" keyword', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateTerminalData('Thinking...');

    expect(startCallback).toHaveBeenCalledTimes(1);
  });

  it('triggers thinking start on "Processing" keyword', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateTerminalData('Processing request');

    expect(startCallback).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger on regular terminal output', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    // Simulate normal terminal output — none of this should trigger
    __simulateTerminalData('$ npm install');
    __simulateTerminalData('added 42 packages');
    __simulateTerminalData('Hello World');
    __simulateTerminalData('function foo() { return 42; }');
    __simulateTerminalData('ERROR: something failed');
    __simulateTerminalData('/home/user/project/src/index.ts');

    expect(startCallback).not.toHaveBeenCalled();
  });

  it('fires thinking stop after debounce with correct duration', () => {
    const stopCallback = vi.fn();
    detector.onThinkingStart(() => {});
    detector.onThinkingStop(stopCallback);

    __simulateTerminalData('⠋');

    // Advance past debounce threshold (2000ms)
    vi.advanceTimersByTime(2000);

    expect(stopCallback).toHaveBeenCalledTimes(1);
    // Duration should be approximately 2000ms (debounce time)
    const duration = stopCallback.mock.calls[0][0];
    expect(duration).toBeGreaterThanOrEqual(2000);
  });

  it('extends thinking duration when spinner continues', () => {
    const stopCallback = vi.fn();
    detector.onThinkingStart(() => {});
    detector.onThinkingStop(stopCallback);

    __simulateTerminalData('⠋');
    vi.advanceTimersByTime(1000);

    // More spinner activity resets the debounce
    __simulateTerminalData('⠙');
    vi.advanceTimersByTime(1000);

    // Still within debounce of second activity — should NOT have fired yet
    expect(stopCallback).not.toHaveBeenCalled();

    // Advance past debounce from second activity
    vi.advanceTimersByTime(1000);

    expect(stopCallback).toHaveBeenCalledTimes(1);
    const duration = stopCallback.mock.calls[0][0];
    // Total time: ~3000ms from start to stop
    expect(duration).toBeGreaterThanOrEqual(3000);
  });

  it('does not fire start twice for continuous spinner activity', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    __simulateTerminalData('⠋');
    __simulateTerminalData('⠙');
    __simulateTerminalData('⠹');

    expect(startCallback).toHaveBeenCalledTimes(1);
  });

  it('never stores terminal content — data flow verification', () => {
    /**
     * PRIVACY VERIFICATION TEST
     *
     * This test verifies that the detector does not retain any reference
     * to terminal data. We inspect all instance properties to confirm
     * no terminal content is stored anywhere on the object.
     */
    const sensitiveData = 'SECRET_API_KEY=abc123 && curl https://bank.com';

    // Feed sensitive data that should NOT match any patterns
    __simulateTerminalData(sensitiveData);

    // Also feed data that DOES match (spinner)
    __simulateTerminalData('⠋ Processing your request');

    // Inspect the detector instance — no property should contain terminal text
    const detectorAsRecord = detector as unknown as Record<string, unknown>;
    const allValues = JSON.stringify(detectorAsRecord);

    expect(allValues).not.toContain('SECRET_API_KEY');
    expect(allValues).not.toContain('abc123');
    expect(allValues).not.toContain('bank.com');
    expect(allValues).not.toContain('Processing your request');
    expect(allValues).not.toContain(sensitiveData);
  });

  it('cleans up subscriptions on dispose', () => {
    const startCallback = vi.fn();
    detector.onThinkingStart(startCallback);

    detector.dispose();

    __simulateTerminalData('⠋');
    expect(startCallback).not.toHaveBeenCalled();
  });

  it('cleans up individual subscription on Disposable.dispose()', () => {
    const startCallback = vi.fn();
    const sub = detector.onThinkingStart(startCallback);

    sub.dispose();

    __simulateTerminalData('⠋');
    expect(startCallback).not.toHaveBeenCalled();
  });
});
