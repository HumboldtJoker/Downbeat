# Downbeat Privacy Policy

**Last updated:** July 13, 2026

Downbeat is built on a simple principle: **your code is yours.** We monetize your waiting time, not your data.

## What We Collect

When an ad is shown during AI thinking time, the extension sends exactly four fields to our server:

| Field | Type | Purpose |
|-------|------|---------|
| `impression_id` | string | Unique ID for this ad display (generated server-side) |
| `duration_ms` | integer | How long the ad was visible (milliseconds) |
| `clicked` | boolean | Whether you clicked the ad |
| `tier` | string | Detection method: `ambient` or `verified` (not user data) |

That's it. Nothing else. Ever.

## What We Do NOT Collect

- Your source code
- Your AI prompts or conversations
- Your terminal output or commands
- Your file contents or file paths
- Your project names or repository information
- Your browsing history or other application data
- Device fingerprints or hardware identifiers
- Cookies or cross-session tracking tokens

## How Thinking Detection Works

Downbeat has two detection tiers. Both are privacy-first.

### Ambient Tier (any AI tool)

The extension uses VS Code's stable shell integration API to detect when a long-running command is executing in the terminal. It observes only two events: "a command started" and "a command ended." **It never reads terminal output at all** — not the command text, not the results, nothing. This is the strongest possible privacy guarantee: the extension literally cannot see what you're typing or what your tools produce.

### Verified Tier (Claude Code)

When Claude Code is installed, an optional hook writes a boolean state file (`~/.claude/downbeat_state.json`) containing only `{"thinking": true, "tool": "Bash"}` or `{"thinking": false}`. The extension watches this file for changes. The file contains no prompt content, no responses, no code — only the boolean thinking state and the tool name.

## Authentication

Your API key identifies you for earnings tracking. It is stored in VS Code's SecretStorage (encrypted, not synced). We do not use OAuth, Google sign-in, or any third-party authentication.

## Data Retention

- Impression records are retained for revenue calculation and advertiser reporting
- No personal data beyond your optional email (provided at signup) and API key is stored
- You can request deletion of all your data at any time

## No Self-Update

Downbeat updates only through the VS Code Marketplace. You approve every update. The extension cannot modify its own code or download new capabilities without your knowledge.

## Open Source Audit

Both the extension (client) and the API (server) are fully open source. You can read every line of code that runs on your machine and every line that runs on our server.

- Client: [extension/](./extension/)
- Server: [server/](./server/)

## Contact

Questions about privacy: thomas@liberationlabs.tech

---

*A Liberation Labs project — liberationlabs.tech*
