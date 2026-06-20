# Downbeat

**Get paid while AI thinks.** Privacy-first ad revenue sharing for developer tools.

Downbeat shows brief text ads in your editor's status bar during AI thinking time (Claude Code, Copilot, Codex). You earn 50% of ad revenue. Your code never leaves your machine.

## Privacy Guarantees

1. Extension NEVER reads file contents, terminal output text, or session transcripts
2. Thinking detection via editor API terminal events only — detects spinner patterns, not content
3. Data sent to server: `{impression_id, duration_ms, clicked}` — nothing else
4. No device fingerprinting, no cookies, no cross-session tracking
5. Client AND server are fully open source and auditable

## Architecture

```
extension/     VS Code extension (TypeScript)
server/        Ad serving API (Python/FastAPI)
```

## License

Hippocratic License 3.0

---

*A Liberation Labs project — liberationlabs.tech*
