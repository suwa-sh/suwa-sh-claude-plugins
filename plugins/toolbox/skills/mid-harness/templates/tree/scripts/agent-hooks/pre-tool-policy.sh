#!/usr/bin/env bash
# pre-tool-policy.sh — 製品非依存の PreToolUse 検査 (mid-harness 生成)
#
# 入出力契約 (Claude Code / Codex CLI 共通):
#   stdin: JSON ({"tool_name": ..., "tool_input": {"command": ...}, ...})
#   exit 0: 続行 / exit 2 + stderr: ブロック
# 各製品の設定 (.claude/settings.json / .codex/hooks.json) はこのスクリプトを呼ぶだけにする。
#
# 位置づけ: これは「取得即実行の明白形」を止める最終防衛線であり、セキュリティ境界ではない
# (正規表現は迂回できる。Codex は hook のエラーを fail-open に扱う)。強制したい検査は CI /
# サーバー側ポリシーにも置く。
#
# fail-closed: JSON が読めない、shell 系ツールなのに command が空・非文字列、のときはブロックする。
#
# 観測: 環境変数 MID_HARNESS_HOOK_LOG にファイルパスがあれば、呼び出しごとに "invoked <tool>"、
#       ブロック時に "deny <理由>" を追記する (受け入れテスト用)。
set -u

log() { [ -n "${MID_HARNESS_HOOK_LOG:-}" ] && printf '%s\n' "$*" >> "$MID_HARNESS_HOOK_LOG"; return 0; }

INPUT="$(cat)"

# stdout: 1 行目 = tool_name、2 行目 = command 種別 (str|list|missing|other)、3 行目以降 = command
PARSED="$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(3)
if not isinstance(d, dict):
    sys.exit(3)
tool = d.get("tool_name")
ti = d.get("tool_input")
print(tool if isinstance(tool, str) else "")
cmd = ti.get("command") if isinstance(ti, dict) else None
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
  log "deny unparseable-input"
  echo "BLOCKED by pre-tool-policy: hook 入力の JSON を解釈できません (fail-closed)" >&2
  exit 2
fi

TOOL="$(printf '%s' "$PARSED" | sed -n '1p')"
KIND="$(printf '%s' "$PARSED" | sed -n '2p')"
CMD="$(printf '%s' "$PARSED" | sed '1,2d')"
log "invoked ${TOOL:-unknown}"

case "$TOOL" in
  Bash|bash|shell|exec_command|local_shell|shell_command|container.exec) ;;
  *) exit 0 ;;
esac

# shell 系ツールなのに command が無い / 型が違う / 空 → fail-closed
if [ "$KIND" != "str" ] && [ "$KIND" != "list" ] || [ -z "$(printf '%s' "$CMD" | tr -d '[:space:]')" ]; then
  log "deny malformed-command"
  echo "BLOCKED by pre-tool-policy: shell ツールの command が空か不正です (fail-closed)" >&2
  exit 2
fi

# 受け入れテスト用の番兵: ログ出力が有効なときだけ、MID_HARNESS_DENY_ME を含むコマンドを拒否する。
# (LLM は curl|sh のような危険コマンドの実行自体を断ることがあり、hook の配線検証に使えないため)
if [ -n "${MID_HARNESS_HOOK_LOG:-}" ] && printf '%s' "$CMD" | grep -q 'MID_HARNESS_DENY_ME'; then
  log "deny test-sentinel"
  echo "BLOCKED by pre-tool-policy: test sentinel" >&2
  exit 2
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
  log "deny fetch-and-execute"
  echo "BLOCKED by pre-tool-policy: リモート取得をそのままシェル実行するコマンドは許可しません。ファイルに保存してから内容を確認してください。" >&2
  exit 2
fi

exit 0
