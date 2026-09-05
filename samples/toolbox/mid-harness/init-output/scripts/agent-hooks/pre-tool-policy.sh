#!/usr/bin/env bash
# pre-tool-policy.sh — 製品非依存の PreToolUse 検査 (mid-harness 生成)
#
# 6 製品の hook 入出力を 1 本で受ける:
#   Claude Code / Codex : stdin {tool_name, tool_input.command}            ブロック = exit 2 + stderr
#   Grok Build          : stdin {toolName: run_terminal_command, toolInput.command} (snake_case も同梱)
#                                                                            ブロック = exit 2 / stdout {"decision":"deny"}
#   Copilot CLI         : stdin {toolName: "bash", toolArgs: {command} or JSON 文字列}
#                                                                            ブロック = stdout {"permissionDecision":"deny"} / exit 2
#   Cursor              : stdin {command, cwd, hook_event_name: beforeShellExecution} (tool_name 無し)
#                                                                            ブロック = exit 2 / stdout {"permission":"deny"}
#   Antigravity (agy)   : stdin {toolCall: {name: run_command, args: {CommandLine}}}
#                                                                            ブロック = stdout {"decision":"deny"}
# ブロック時は「全形式を含む 1 行 JSON を stdout」+「理由を stderr」+「exit 2」を同時に行う (各製品が自分の形式だけを読む)。
# 許可時は stdout に何も出さず exit 0。
#
# 位置づけ: 「取得即実行の明白形」を止める最終防衛線であり、セキュリティ境界ではない
# (正規表現は迂回できる。多くの製品は hook のエラーを fail-open に扱う)。強制したい検査は CI /
# サーバー側ポリシーにも置く。
#
# fail-closed: JSON が読めない、shell 系ツールなのに command が空・非文字列、のときはブロックする。
#
# 観測: 環境変数 MID_HARNESS_HOOK_LOG にファイルパスがあれば、呼び出しごとに "invoked <tool>"、
#       ブロック時に "deny <理由>" を追記する (受け入れテスト用)。
set -u

log() { [ -n "${MID_HARNESS_HOOK_LOG:-}" ] && printf '%s\n' "$*" >> "$MID_HARNESS_HOOK_LOG"; return 0; }

deny() {  # $1 = 理由コード, $2 = 人向けメッセージ
  log "deny $1"
  printf '{"decision":"deny","reason":%s,"permissionDecision":"deny","permissionDecisionReason":%s,"permission":"deny","user_message":%s,"agent_message":%s}\n' \
    "$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
    "$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
    "$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
    "$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
  echo "BLOCKED by pre-tool-policy: $2" >&2
  exit 2
}

INPUT="$(cat)"

# 正規化: stdout 1 行目 = tool 種別 (shell|other|unknown)、2 行目 = command 種別 (str|list|missing|other)、3 行目以降 = command
PARSED="$(printf '%s' "$INPUT" | python3 -c '
import sys, json
SHELL_TOOLS = {"Bash", "bash", "shell", "exec_command", "local_shell", "shell_command", "container.exec",
               "run_terminal_command", "run_terminal_cmd", "run_command", "powershell"}
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(3)
if not isinstance(d, dict):
    sys.exit(3)
tool = None; cmd = None; kind = "other"
tc = d.get("toolCall")
if isinstance(tc, dict):                                   # Antigravity
    tool = tc.get("name"); a = tc.get("args")
    cmd = a.get("CommandLine") if isinstance(a, dict) else None
elif "tool_name" in d or "toolName" in d:                  # Claude / Codex / Grok / Copilot
    tool = d.get("tool_name") or d.get("toolName")
    ti = d.get("tool_input") if "tool_input" in d else d.get("toolInput", d.get("toolArgs"))
    if isinstance(ti, str):
        try:
            ti = json.loads(ti)                             # Copilot: toolArgs が JSON 文字列のことがある
        except Exception:
            ti = None                                       # 解釈できない文字列は fail-closed (missing 扱い)
    cmd = ti.get("command") if isinstance(ti, dict) else None
elif "command" in d and "hook_event_name" in d:            # Cursor beforeShellExecution
    tool = "shell"; cmd = d.get("command")
tool = tool if isinstance(tool, str) else ""
print("shell" if tool in SHELL_TOOLS else ("other" if tool else "unknown"))
if isinstance(cmd, str):
    print("str"); print(cmd)
elif isinstance(cmd, list) and all(isinstance(c, str) for c in cmd):
    print("list"); print(" ".join(cmd))
elif cmd is None:
    print("missing")
else:
    print("other")
' 2>/dev/null)"
if [ $? -ne 0 ]; then
  log "invoked unknown"
  deny "unparseable-input" "hook 入力の JSON を解釈できません (fail-closed)"
fi

TOOLKIND="$(printf '%s' "$PARSED" | sed -n '1p')"
KIND="$(printf '%s' "$PARSED" | sed -n '2p')"
CMD="$(printf '%s' "$PARSED" | sed '1,2d')"
log "invoked $TOOLKIND"

case "$TOOLKIND" in
  shell) ;;
  other) exit 0 ;;                       # shell 以外のツール (Edit など) は対象外
  *) deny "unknown-tool" "tool 名を判別できない hook 入力です (fail-closed)" ;;
esac

# shell 系ツールなのに command が無い / 型が違う / 空 → fail-closed
if { [ "$KIND" != "str" ] && [ "$KIND" != "list" ]; } || [ -z "$(printf '%s' "$CMD" | tr -d '[:space:]')" ]; then
  deny "malformed-command" "shell ツールの command が空か不正です (fail-closed)"
fi

# 受け入れテスト用の番兵: ログ出力が有効なときだけ、MID_HARNESS_DENY_ME を含むコマンドを拒否する。
# (LLM は curl|sh のような危険コマンドの実行自体を断ることがあり、hook の配線検証に使えないため)
if [ -n "${MID_HARNESS_HOOK_LOG:-}" ] && printf '%s' "$CMD" | grep -q 'MID_HARNESS_DENY_ME'; then
  deny "test-sentinel" "test sentinel"
fi

# 取得即実行の明白形を止める:
#   fetch | [sudo] [env] [/path/]sh|bash|zsh|dash|python*|perl|ruby|node
#   sh|bash|python* <(fetch)
#   eval "$(fetch)" / eval $(fetch) / eval `fetch`
FETCH='(curl|wget|fetch)'
INTERP='(/[[:alnum:]/._-]*/)?(sh|bash|zsh|dash|ksh|python[0-9.]*|perl|ruby|node)'
if printf '%s' "$CMD" | grep -Eq "${FETCH}[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(env[[:space:]]+)?${INTERP}([[:space:]]|$)" \
   || printf '%s' "$CMD" | grep -Eq "${INTERP}[[:space:]]+(-[[:alnum:]]+[[:space:]]+)*<\(${FETCH}" \
   || printf '%s' "$CMD" | grep -Eq "eval[[:space:]]+\"?(\\$\(|\`)[[:space:]]*${FETCH}"; then
  deny "fetch-and-execute" "リモート取得をそのままシェル実行するコマンドは許可しません。ファイルに保存してから内容を確認してください。"
fi

exit 0
