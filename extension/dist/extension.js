"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode4 = __toESM(require("vscode"));

// src/detection/vscodeDetector.ts
var vscode = __toESM(require("vscode"));
var SPINNER_CHARS = new Set("\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F");
var THINKING_KEYWORDS = /\b(Thinking|Processing)\b/i;
var STOP_DEBOUNCE_MS = 2e3;
var VscodeTerminalDetector = class {
  startCallbacks = [];
  stopCallbacks = [];
  disposables = [];
  isThinking = false;
  thinkingStartTime = 0;
  debounceTimer;
  constructor() {
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
  handleTerminalData(data) {
    const hasSpinner = [...data].some((char) => SPINNER_CHARS.has(char));
    const hasKeyword = THINKING_KEYWORDS.test(data);
    if (hasSpinner || hasKeyword) {
      this.onThinkingActivity();
    }
  }
  onThinkingActivity() {
    if (this.debounceTimer !== void 0) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = void 0;
    }
    if (!this.isThinking) {
      this.isThinking = true;
      this.thinkingStartTime = Date.now();
      for (const cb of this.startCallbacks) {
        cb();
      }
    }
    this.debounceTimer = setTimeout(() => {
      this.fireStop();
    }, STOP_DEBOUNCE_MS);
  }
  fireStop() {
    if (!this.isThinking) {
      return;
    }
    const durationMs = Date.now() - this.thinkingStartTime;
    this.isThinking = false;
    this.thinkingStartTime = 0;
    this.debounceTimer = void 0;
    for (const cb of this.stopCallbacks) {
      cb(durationMs);
    }
  }
  onThinkingStart(callback) {
    this.startCallbacks.push(callback);
    return new vscode.Disposable(() => {
      this.startCallbacks = this.startCallbacks.filter((cb) => cb !== callback);
    });
  }
  onThinkingStop(callback) {
    this.stopCallbacks.push(callback);
    return new vscode.Disposable(() => {
      this.stopCallbacks = this.stopCallbacks.filter((cb) => cb !== callback);
    });
  }
  dispose() {
    if (this.debounceTimer !== void 0) {
      clearTimeout(this.debounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this.startCallbacks = [];
    this.stopCallbacks = [];
  }
};

// src/rendering/statusBarRenderer.ts
var vscode2 = __toESM(require("vscode"));
var MAX_AD_TEXT_LENGTH = 60;
var StatusBarRenderer = class {
  statusBarItem;
  currentAd = null;
  constructor() {
    this.statusBarItem = vscode2.window.createStatusBarItem(
      vscode2.StatusBarAlignment.Right,
      -100
    );
    this.statusBarItem.show();
    this.showEarnings(0, 0);
  }
  showAd(ad) {
    this.currentAd = ad;
    const displayText = ad.text.length > MAX_AD_TEXT_LENGTH ? ad.text.slice(0, MAX_AD_TEXT_LENGTH - 1) + "\u2026" : ad.text;
    this.statusBarItem.text = `$(megaphone) ${displayText}`;
    this.statusBarItem.tooltip = `Downbeat Ad \u2014 Click to learn more`;
    this.statusBarItem.command = {
      command: "vscode.open",
      title: "Open Ad Link",
      arguments: [vscode2.Uri.parse(ad.url)]
    };
  }
  hideAd() {
    this.currentAd = null;
    this.statusBarItem.command = "downbeat.showEarnings";
  }
  showEarnings(today, total) {
    this.statusBarItem.text = `$(pulse) Downbeat ($${today.toFixed(2)} today \xB7 $${total.toFixed(2)})`;
    this.statusBarItem.tooltip = "Click to view Downbeat earnings";
    this.statusBarItem.command = "downbeat.showEarnings";
  }
  dispose() {
    this.statusBarItem.dispose();
  }
};

// src/api/client.ts
var vscode3 = __toESM(require("vscode"));

// src/api/types.ts
function toAd(response) {
  return {
    text: response.text,
    url: response.url,
    impressionId: response.impression_id
  };
}

// src/api/client.ts
var FLUSH_INTERVAL_MS = 3e4;
var ApiClient = class {
  apiUrl;
  apiKey;
  /**
   * PRIVACY: This queue stores ONLY impression metadata:
   * { impressionId, durationMs, clicked }
   * No terminal content or user data is ever added to this queue.
   */
  pendingImpressions = [];
  flushTimer;
  constructor() {
    const config = vscode3.workspace.getConfiguration("downbeat");
    this.apiUrl = config.get("apiUrl", "http://localhost:8000");
    this.apiKey = config.get("apiKey", "");
    this.flushTimer = setInterval(() => {
      this.flushImpressions().catch(() => {
      });
    }, FLUSH_INTERVAL_MS);
  }
  /**
   * Fetch an ad to display during AI thinking time.
   * PRIVACY: Request contains only the API key header. No user data.
   */
  async fetchAd() {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/ad`, {
        method: "GET",
        headers: this.headers()
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return toAd(data);
    } catch {
      return null;
    }
  }
  /**
   * Queue an impression for batch submission.
   * PRIVACY: Only stores { impressionId, durationMs, clicked }.
   * No terminal content, code, or user data is ever included.
   */
  recordImpression(impressionId, durationMs, clicked = false) {
    this.pendingImpressions.push({ impressionId, durationMs, clicked });
  }
  /**
   * Flush all queued impressions to the server.
   * PRIVACY: POST body contains only an array of
   * { impression_id, duration_ms, clicked } objects.
   * No terminal content or user data is ever transmitted.
   */
  async flushImpressions() {
    if (this.pendingImpressions.length === 0) {
      return;
    }
    const batch = [...this.pendingImpressions];
    this.pendingImpressions = [];
    try {
      const response = await fetch(
        `${this.apiUrl}/api/v1/impressions/batch`,
        {
          method: "POST",
          headers: {
            ...this.headers(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            impressions: batch.map((imp) => ({
              impression_id: imp.impressionId,
              duration_ms: imp.durationMs,
              clicked: imp.clicked
            }))
          })
        }
      );
      if (!response.ok) {
        this.pendingImpressions.unshift(...batch);
      }
    } catch {
      this.pendingImpressions.unshift(...batch);
    }
  }
  /**
   * Fetch current earnings.
   * PRIVACY: Request contains only the API key header. No user data.
   */
  async fetchEarnings() {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/earnings`, {
        method: "GET",
        headers: this.headers()
      });
      if (!response.ok) {
        return { today: 0, total: 0 };
      }
      return await response.json();
    } catch {
      return { today: 0, total: 0 };
    }
  }
  headers() {
    return {
      "X-Downbeat-Key": this.apiKey
    };
  }
  dispose() {
    if (this.flushTimer !== void 0) {
      clearInterval(this.flushTimer);
    }
  }
};

// src/extension.ts
var detector;
var renderer;
var apiClient;
var currentImpressionId;
function activate(context) {
  const config = vscode4.workspace.getConfiguration("downbeat");
  let enabled = config.get("enabled", true);
  detector = new VscodeTerminalDetector();
  renderer = new StatusBarRenderer();
  apiClient = new ApiClient();
  apiClient.fetchEarnings().then((earnings) => {
    renderer?.showEarnings(earnings.today, earnings.total);
  });
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
  const stopSub = detector.onThinkingStop(async (durationMs) => {
    if (!apiClient || !renderer) {
      return;
    }
    if (currentImpressionId) {
      apiClient.recordImpression(currentImpressionId, durationMs);
      currentImpressionId = void 0;
    }
    renderer.hideAd();
    const earnings = await apiClient.fetchEarnings();
    renderer.showEarnings(earnings.today, earnings.total);
  });
  const showEarningsCmd = vscode4.commands.registerCommand(
    "downbeat.showEarnings",
    async () => {
      if (!apiClient) {
        return;
      }
      const earnings = await apiClient.fetchEarnings();
      vscode4.window.showInformationMessage(
        `Downbeat Earnings \u2014 Today: $${earnings.today.toFixed(2)} \xB7 Total: $${earnings.total.toFixed(2)}`
      );
      renderer?.showEarnings(earnings.today, earnings.total);
    }
  );
  const toggleAdsCmd = vscode4.commands.registerCommand(
    "downbeat.toggleAds",
    async () => {
      enabled = !enabled;
      await vscode4.workspace.getConfiguration("downbeat").update("enabled", enabled, vscode4.ConfigurationTarget.Global);
      vscode4.window.showInformationMessage(
        `Downbeat ads ${enabled ? "enabled" : "disabled"}.`
      );
      if (!enabled) {
        renderer?.hideAd();
        currentImpressionId = void 0;
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
async function deactivate() {
  if (apiClient) {
    await apiClient.flushImpressions();
    apiClient.dispose();
  }
  detector?.dispose();
  renderer?.dispose();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
