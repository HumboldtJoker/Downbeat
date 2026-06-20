import * as vscode from 'vscode';
import { VscodeTerminalDetector } from './detection/vscodeDetector';
import { StatusBarRenderer } from './rendering/statusBarRenderer';
import { ApiClient } from './api/client';

let detector: VscodeTerminalDetector | undefined;
let renderer: StatusBarRenderer | undefined;
let apiClient: ApiClient | undefined;
let currentImpressionId: string | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('downbeat');
  let enabled = config.get<boolean>('enabled', true);

  detector = new VscodeTerminalDetector();
  renderer = new StatusBarRenderer();
  apiClient = new ApiClient();

  // Fetch initial earnings display
  apiClient.fetchEarnings().then((earnings) => {
    renderer?.showEarnings(earnings.today, earnings.total);
  });

  // When AI thinking starts → fetch and display an ad
  const startSub = detector.onThinkingStart(async () => {
    if (!enabled || !apiClient || !renderer) {
      return;
    }

    const ad = await apiClient.fetchAd();
    if (ad) {
      currentImpressionId = ad.impressionId;
      renderer.showAd(ad);
    }
  });

  // When AI thinking stops → record the impression, return to earnings
  const stopSub = detector.onThinkingStop(async (durationMs: number) => {
    if (!apiClient || !renderer) {
      return;
    }

    if (currentImpressionId) {
      apiClient.recordImpression(currentImpressionId, durationMs);
      currentImpressionId = undefined;
    }

    renderer.hideAd();

    // Refresh earnings display
    const earnings = await apiClient.fetchEarnings();
    renderer.showEarnings(earnings.today, earnings.total);
  });

  // Command: Show Earnings
  const showEarningsCmd = vscode.commands.registerCommand(
    'downbeat.showEarnings',
    async () => {
      if (!apiClient) {
        return;
      }

      const earnings = await apiClient.fetchEarnings();
      vscode.window.showInformationMessage(
        `Downbeat Earnings — Today: $${earnings.today.toFixed(2)} · Total: $${earnings.total.toFixed(2)}`
      );

      renderer?.showEarnings(earnings.today, earnings.total);
    }
  );

  // Command: Toggle Ads
  const toggleAdsCmd = vscode.commands.registerCommand(
    'downbeat.toggleAds',
    async () => {
      enabled = !enabled;
      await vscode.workspace
        .getConfiguration('downbeat')
        .update('enabled', enabled, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `Downbeat ads ${enabled ? 'enabled' : 'disabled'}.`
      );

      if (!enabled) {
        renderer?.hideAd();
        currentImpressionId = undefined;
      }
    }
  );

  context.subscriptions.push(
    startSub,
    stopSub,
    showEarningsCmd,
    toggleAdsCmd,
    { dispose: () => detector?.dispose() },
    { dispose: () => renderer?.dispose() },
    { dispose: () => apiClient?.dispose() }
  );
}

export async function deactivate(): Promise<void> {
  // Flush any pending impressions before shutdown
  if (apiClient) {
    await apiClient.flushImpressions();
    apiClient.dispose();
  }
  detector?.dispose();
  renderer?.dispose();
}
