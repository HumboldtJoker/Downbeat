export interface Ad {
  text: string;
  url: string;
  impressionId: string;
}

export interface AdRenderer {
  showAd(ad: Ad): void;
  hideAd(): void;
  showEarnings(today: number, total: number): void;
  dispose(): void;
}
