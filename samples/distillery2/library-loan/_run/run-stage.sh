#!/bin/sh
# usage: run-stage.sh <stage-name>   (prompt-<stage>.txt を読み run-<stage>.log に出す)
set -u
STAGE="$1"
cd <repo> || exit 1
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
ALLOWED='Bash(node:*),Bash(npm:*),Bash(npx:*),Bash(git:*),Bash(python3:*),Bash(ls:*),Bash(cat:*),Bash(mkdir:*),Bash(cp:*),Bash(wc:*),Bash(grep:*),Bash(find:*),Bash(sed:*),Bash(head:*),Bash(tail:*),Bash(rm:*),Bash(mv:*)'
nohup "$HOME/.local/bin/claude" -p --permission-mode acceptEdits --allowedTools "$ALLOWED" --add-dir "$HOME/.claude/plugins/cache/suwa-sh-claude-plugins" < "prompt-$STAGE.txt" > "run-$STAGE.log" 2>&1 &
PID=$!
echo "started stage=$STAGE pid=$PID"
echo "$PID" > "pid-$STAGE.txt"
