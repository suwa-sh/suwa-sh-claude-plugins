#!/usr/bin/env bash
# pre-tool-policy.sh — 製品非依存の PreToolUse hook のサンプル (mid-harness 生成)
#
# 既定では何も止めずに素通りする (exit 0)。止めたい検査は、末尾のコメントアウトした例を参考に足す。
# どの検査をこの hook に置き、どれを commit / push の hook や CI に置くかは、
# mid-harness skill の references/hook-placement.md を参照する。
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
# 観測: 環境変数 MID_HARNESS_HOOK_LOG にファイルパスがあれば、呼び出しごとに "invoked <tool>"、
#       ブロック時に "deny <理由>" を追記する (受け入れテスト用)。
set -u

log() { [ -n "${MID_HARNESS_HOOK_LOG:-}" ] && printf '%s\n' "$*" >> "$MID_HARNESS_HOOK_LOG"; return 0; }

deny() {  # $1 = 理由コード, $2 = 人向けメッセージ
  log "deny $1"
  local msg
  msg="$(printf '%s' "$2" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
  printf '{"decision":"deny","reason":%s,"permissionDecision":"deny","permissionDecisionReason":%s,"permission":"deny","user_message":%s,"agent_message":%s}\n' \
    "$msg" "$msg" "$msg" "$msg"
  echo "BLOCKED by pre-tool-policy: $2" >&2
  exit 2
}

INPUT="$(cat)"

# 正規化: stdout 1 行目 = tool 種別 (shell|other|unknown)、2 行目以降 = command (無ければ空)
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
tool = None; cmd = None
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
            ti = None
    cmd = ti.get("command") if isinstance(ti, dict) else None
elif "command" in d and "hook_event_name" in d:            # Cursor beforeShellExecution
    tool = "shell"; cmd = d.get("command")
tool = tool if isinstance(tool, str) else ""
print("shell" if tool in SHELL_TOOLS else ("other" if tool else "unknown"))
if isinstance(cmd, str):
    print(cmd)
elif isinstance(cmd, list) and all(isinstance(c, str) for c in cmd):
    print(" ".join(cmd))
' 2>/dev/null)"
if [ $? -ne 0 ]; then
  log "invoked unknown"
  exit 0                                   # 入力を解釈できなくても素通り (止めたいなら下の例 1 を有効にする)
fi

TOOLKIND="$(printf '%s' "$PARSED" | sed -n '1p')"
CMD="$(printf '%s' "$PARSED" | sed '1d')"
log "invoked $TOOLKIND"

[ "$TOOLKIND" = "shell" ] || exit 0       # shell 以外のツール (Edit など) は対象外

# 受け入れテスト用の番兵: ログ出力が有効なときだけ、MID_HARNESS_DENY_ME を含むコマンドを拒否する。
# verify.sh が「各製品の headless 実行で hook が呼ばれ、拒否の判定まで進むか」を確かめるために使う
# (製品側で実行が実際に止まったかまでは見ない)。普段の運用では働かない。
# (LLM は curl|sh のような危険コマンドの実行自体を断ることがあり、hook の配線検証に使えないため)
if [ -n "${MID_HARNESS_HOOK_LOG:-}" ] && printf '%s' "$CMD" | grep -q 'MID_HARNESS_DENY_ME'; then
  deny "test-sentinel" "test sentinel"
fi

# ---- 検査の例 (既定はすべて無効。使うときはコメントを外し、fixture を足して scripts/test_hook.sh で確かめる) ----
#
# この hook はコマンドの「書き方」しか見られない。書き方は無数に変えられるので、ここに置く検査は
# 「うっかりを止める抑止」であり、確実に止めたいもの (秘密情報のコミットなど) は commit / push の hook や CI に置く。
#
# 例 1: 入力を解釈できない・shell ツールなのに command が空のときに止める (fail-closed)
#   上の「入力を解釈できなくても素通り」の行の exit 0 を次の行に置き換え、
#     deny "unparseable-input" "hook 入力の JSON を解釈できません"
#   ここに次を足す:
# if [ -z "$(printf '%s' "$CMD" | tr -d '[:space:]')" ]; then
#   deny "malformed-command" "shell ツールの command が空です"
# fi
#
# 例 2: 取得したものをそのままシェルに渡す明らかな形 (curl URL | sh など) を止める
#   文字列の並びだけを見るので、git commit -m "curl URL | sh を止める" のような文章や curl -o f URL | sh も止める (誤検知)。
#   逆に、変形した書き方 (sh <(curl URL) など) は通る。抑止として割り切る
# if printf '%s' "$CMD" | tr '\n' ' ' | grep -Eq '(curl|wget)[^|;&]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash|zsh)([[:space:]]|$)'; then
#   deny "fetch-and-execute" "取得したものをそのままシェルで実行するコマンドは許可しません。保存して内容を確認してから実行してください。"
# fi
#
# 例 3: force push を止める (--force-with-lease は通す。git -C dir push --force や +ref 指定は通る。
#   push 先のブランチも見ないので、確実に守るのはブランチ保護)
# if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+push([[:space:]].*)?[[:space:]](-f|--force)([[:space:]]|$)'; then
#   deny "force-push" "force push は許可しません"
# fi

exit 0
