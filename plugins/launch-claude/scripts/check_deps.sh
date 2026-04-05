#!/usr/bin/env bash
# Check dependencies for launch-claude skill
set -euo pipefail

errors=0

# macOS check
if [[ "$(uname)" != "Darwin" ]]; then
  echo "FAIL: macOS required (detected: $(uname))"
  errors=$((errors + 1))
else
  echo "OK: macOS"
fi

# osascript
if command -v osascript &>/dev/null; then
  echo "OK: osascript"
else
  echo "FAIL: osascript not found"
  errors=$((errors + 1))
fi

# Ghostty
if pgrep -qf "Ghostty.app" || pgrep -qx ghostty; then
  echo "OK: Ghostty (running)"
else
  echo "WARN: Ghostty is not running (must be running before launch)"
fi

# ghq
if command -v ghq &>/dev/null; then
  echo "OK: ghq"
else
  echo "FAIL: ghq not found (brew install ghq)"
  errors=$((errors + 1))
fi

# zsh
zsh_path="$(command -v zsh 2>/dev/null || true)"
if [[ -n "$zsh_path" ]]; then
  echo "OK: zsh ($zsh_path)"
else
  echo "FAIL: zsh not found in PATH"
  errors=$((errors + 1))
fi

# claude
claude_path="$(command -v claude 2>/dev/null || true)"
if [[ -n "$claude_path" ]]; then
  echo "OK: claude ($claude_path)"
else
  echo "FAIL: claude not found in PATH"
  errors=$((errors + 1))
fi

if [[ $errors -gt 0 ]]; then
  echo "---"
  echo "RESULT: ${errors} dependency issue(s) found"
  exit 1
else
  echo "---"
  echo "RESULT: All dependencies OK"
  exit 0
fi
