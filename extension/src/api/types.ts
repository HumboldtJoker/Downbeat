import { Ad } from '../rendering/types';
import { AdTier } from '../detection/types';

/**
 * PRIVACY: The only data sent to the Downbeat API is:
 *   - impression_id: opaque server-generated identifier from the ad itself
 *   - duration_ms: how long the ad was displayed
 *   - clicked: whether the user clicked the ad
 *   - tier: 'ambient' or 'verified' (detection method, not user data)
 *
 * No terminal content, code, file paths, commands, or user activity
 * of any kind is ever included in API requests.
 */

export interface ImpressionRecord {
  impressionId: string;
  durationMs: number;
  clicked: boolean;
  tier: AdTier;
}

export interface ImpressionBatchRequest {
  impressions: ImpressionRecord[];
}

export interface EarningsResponse {
  today: number;
  total: number;
}

export interface AdResponse {
  text: string;
  url: string;
  impression_id: string;
}

/** Convert API response shape to internal Ad type */
export function toAd(response: AdResponse): Ad {
  return {
    text: response.text,
    url: response.url,
    impressionId: response.impression_id,
  };
}
