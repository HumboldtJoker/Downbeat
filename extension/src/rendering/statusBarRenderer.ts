import * as vscode from 'vscode';
import { Ad, AdRenderer } from './types';

const MAX_AD_TEXT_LENGTH = 60;

export class StatusBarRenderer implements AdRenderer {
  private statusBarItem: vscode.StatusBarItem;
  private currentAd: Ad | null = null;

  constructor() {
    // Priority -100: stay out of the way of other extensions
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      -100
    );
    this.statusBarItem.show();
    this.showEarnings(0, 0);
  }

  showAd(ad: Ad): void {
    this.currentAd = ad;

    const displayText =
      ad.text.length > MAX_AD_TEXT_LENGTH
        ? ad.text.slice(0, MAX_AD_TEXT_LENGTH - 1) + '…'
        : ad.text;

    this.statusBarItem.text = `$(megaphone) ${displayText}`;
    this.statusBarItem.tooltip = `Downbeat Ad — Click to learn more`;
    this.statusBarItem.command = {
      command: 'vscode.open',
      title: 'Open Ad Link',
      arguments: [vscode.Uri.parse(ad.url)],
    };
  }

  hideAd(): void {
    this.currentAd = null;
    this.statusBarItem.command = 'downbeat.showEarnings';
    // Will be overwritten by showEarnings call from extension
  }

  showEarnings(today: number, total: number): void {
    this.statusBarItem.text = `$(pulse) Downbeat ($${today.toFixed(2)} today · $${total.toFixed(2)})`;
    this.statusBarItem.tooltip = 'Click to view Downbeat earnings';
    this.statusBarItem.command = 'downbeat.showEarnings';
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
