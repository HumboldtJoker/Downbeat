import * as vscode from 'vscode';
import { CompositeDetector } from './detection/compositeDetector';
import { StatusBarRenderer } from './rendering/statusBarRenderer';
import { ApiClient } from './api/client';
import { AdTier, ThinkingEvent } from './detection/types';

let detector: CompositeDetector | undefined;
let renderer: StatusBarRenderer | undefined;
let apiClient: ApiClient | undefined;
let currentImpressionId: string | undefined;
let currentTier: AdTier = 'ambient';
let adFetchAbort: AbortController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('downbeat');
  let enabled = config.get<boolean>('enabled', true);

  detector = new CompositeDetector();
  renderer = new StatusBarRenderer();
  apiClient = new ApiClient();

  apiClient.fetchEarnings().then((earnings) => {
    renderer?.showEarnings(earnings.today, earnings.total);
  });

  const startSub = detector.onThinkingStart(async (event: ThinkingEvent) => {
    if (!enabled || !apiClient || !renderer) {
      return;
    }

    adFetchAbort?.abort();
    adFetchAbort = new AbortController();

    const ad = await apiClient.fetchAd();
    if (ad && !adFetchAbort.signal.aborted) {
      currentImpressionId = ad.impressionId;
      currentTier = event.tier;
      renderer.showAd(ad);
    }
  });

  const stopSub = detector.onThinkingStop(async (durationMs: number) => {
    if (!apiClient || !renderer) {
      return;
    }

    adFetchAbort?.abort();
    adFetchAbort = undefined;

    if (currentImpressionId) {
      apiClient.recordImpression(
        currentImpressionId,
        durationMs,
        currentTier
      );
      currentImpressionId = undefined;
    }

    renderer.hideAd();

    const earnings = await apiClient.fetchEarnings();
    renderer.showEarnings(earnings.today, earnings.total);
  });

  // Click-through: record the click, then open the URL (fixes F4)
  const adClickCmd = vscode.commands.registerCommand(
    'downbeat.adClick',
    async (url: string) => {
      if (currentImpressionId && apiClient) {
        apiClient.recordImpression(
          currentImpressionId,
          0,
          currentTier,
          true
        );
      }

      if (url && url.startsWith('https://')) {
        await vscode.env.openExternal(vscode.Uri.parse(url));
      }
    }
  );

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
        adFetchAbort?.abort();
        currentImpressionId = undefined;
      }
    }
  );

  context.subscriptions.push(
    startSub,
    stopSub,
    adClickCmd,
    showEarningsCmd,
    toggleAdsCmd,
    { dispose: () => detector?.dispose() },
    { dispose: () => renderer?.dispose() },
    { dispose: () => apiClient?.dispose() }
  );
}

export async function deactivate(): Promise<void> {
  adFetchAbort?.abort();
  if (apiClient) {
    await apiClient.flushImpressions();
    apiClient.dispose();
  }
  detector?.dispose();
  renderer?.dispose();
}
