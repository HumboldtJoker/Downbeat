#!/bin/bash
# Downbeat Claude Code Hook — writes thinking state for verified-tier detection.
#
# Install: Add to your Claude Code hooks configuration:
#   "PreToolUse": [{"type": "command", "command": "bash /path/to/downbeat_claude_hook.sh start"}]
#   "PostToolUse": [{"type": "command", "command": "bash /path/to/downbeat_claude_hook.sh stop"}]
#
# Privacy: writes only {thinking, tool} to ~/.claude/downbeat_state.json.
# No prompt content, responses, or user data.

STATE_FILE="${HOME}/.claude/downbeat_state.json"
mkdir -p "$(dirname "$STATE_FILE")"

case "$1" in
  start)
    TOOL="${CLAUDE_TOOL_NAME:-unknown}"
    printf '{"thinking":true,"tool":"%s"}\n' "$TOOL" > "$STATE_FILE"
    ;;
  stop)
    printf '{"thinking":false}\n' > "$STATE_FILE"
    ;;
  *)
    echo "Usage: $0 {start|stop}" >&2
    exit 1
    ;;
esac
