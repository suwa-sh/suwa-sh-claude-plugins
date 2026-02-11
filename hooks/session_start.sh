#!/bin/bash

# SessionStart hook - Read and inject HANDOVER.md into session context
# Triggered on: startup, resume, compact

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // ""')
cwd="${cwd:-$(pwd)}"
handover_file="$cwd/HANDOVER.md"

if [ ! -f "$handover_file" ]; then
  exit 0
fi

content=$(cat "$handover_file")
rm -f "$handover_file"

# stdout is injected into session context
echo "=== 前回セッションからの引き継ぎ ==="
echo "$content"
echo "=== 引き継ぎ終了 ==="
