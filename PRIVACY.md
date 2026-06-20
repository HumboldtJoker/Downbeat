# Downbeat Privacy Policy

**Last updated:** June 20, 2026

Downbeat is built on a simple principle: **your code is yours.** We monetize your waiting time, not your data.

## What We Collect

When an ad is shown during AI thinking time, the extension sends exactly three fields to our server:

| Field | Type | Purpose |
|-------|------|---------|
| `impression_id` | string | Unique ID for this ad display (generated server-side) |
| `duration_ms` | integer | How long the ad was visible (milliseconds) |
| `clicked` | boolean | Whether you clicked the ad |

That's it. Nothing else. Ever.

## What We Do NOT Collect

- Your source code
- Your AI prompts or conversations
- Your terminal output
- Your file contents or file paths
- Your project names or repository information
- Your browsing history or other application data
- Device fingerprints or hardware identifiers
- Cookies or cross-session tracking tokens

## How Thinking Detection Works

The extension detects AI thinking time by watching for **spinner animation characters** in your terminal (the rotating dots that appear while Claude, Copilot, etc. process). It performs a simple pattern match — does this character look like a spinner? — and immediately discards all terminal data regardless of the result. No terminal content is ever stored, logged, or transmitted.

## Authentication

Your API key identifies you for earnings tracking. It is stored locally in your VS Code settings. We do not use OAuth, Google sign-in, or any third-party authentication that would share your identity with other services.

## Data Retention

- Impression records are retained for revenue calculation and advertiser reporting
- No personal data beyond your email (provided at signup) and API key is stored
- You can request deletion of all your data at any time

## No Self-Update

Downbeat updates only through the VS Code Marketplace. You approve every update. The extension cannot modify its own code or download new capabilities without your knowledge.

## Open Source Audit

Both the extension (client) and the API (server) are fully open source. You can read every line of code that runs on your machine and every line that runs on our server. The code in the repository is the code that ships.

- Client: [extension/](./extension/)
- Server: [server/](./server/)

## Contact

Questions about privacy: privacy@liberationlabs.tech

---

*A Liberation Labs project — liberationlabs.tech*
