# Downbeat

**Get paid while AI thinks.** Privacy-first ad revenue sharing for developer tools.

Downbeat shows brief text ads in your editor's status bar during AI thinking time. You earn 50% of ad revenue. Your code never leaves your machine.

## Privacy Guarantees

1. Extension never **stores, logs, or transmits** file contents, terminal output, or session data
2. **Ambient tier**: detects thinking via VS Code shell execution events (command start/end) — never reads terminal output at all
3. **Verified tier** (Claude Code): reads a boolean state file (`~/.claude/downbeat_state.json`) written by a Claude Code hook — contains only `{thinking: true/false, tool: "name"}`
4. Data sent to server: `{impression_id, duration_ms, clicked, tier}` — nothing else
5. No device fingerprinting, no cookies, no cross-session tracking
6. Client and server are fully open source and auditable

## Two-Tier Detection

| Tier | How it works | CPM | Works with |
|------|-------------|-----|-----------|
| **Ambient** | Shell execution events — "a command is running" | Standard | Any AI tool |
| **Verified** | Claude Code hook — exact thinking state + tool name | Premium (4x) | Claude Code |

Both tiers run simultaneously. When Claude Code is active, impressions are automatically upgraded to the verified tier.

## Quick Start

### Extension
```bash
cd extension
npm install
npm run build
# Install: Ctrl+Shift+P → "Install from VSIX" or launch in dev host
```

### Server
```bash
cd server
pip install -r requirements.txt
python run.py    # http://localhost:8000
```

### Get Your API Key
```bash
curl -X POST http://localhost:8000/api/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "your_name"}'
```

Then set `downbeat.apiKey` in VS Code settings.

## Architecture

```
extension/     VS Code extension (TypeScript)
  detection/     Two-tier thinking detector (shell events + Claude Code hooks)
  rendering/     Status bar ad display
  api/           Server communication (impression batching)

server/        Ad serving API (Python/FastAPI)
  src/app.py     API endpoints (ad fetch, impressions, earnings, signup)
  src/db.py      SQLite database (ads, impressions, publishers)
```

## Revenue Model

- Advertisers pay CPM (cost per 1,000 impressions)
- Verified impressions (Claude Code) command 4x the CPM of ambient
- Publishers (developers) receive 50% of impression revenue
- Earnings accrue per-impression, viewable in the status bar and via `Downbeat: Show Earnings`

## License

Hippocratic License 3.0 with SAFE-AI Addendum

---

*A Liberation Labs project — liberationlabs.tech*
