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
#   fetch | ... | [sudo [-flags]] [env] [/path/]sh|bash|zsh|dash|python*|perl|ruby|node   (中間パイプを挟んでも止める)
#   sh|bash|python* <(fetch)
#   eval "$(fetch)" / eval $(fetch) / eval `fetch`
# 照合の前に、バックスラッシュ改行・改行・連続空白を正規化する (grep は行単位なので、改行を挟む迂回を防ぐ)。
# パイプ形は、コマンドを ; && || & 改行 で分け、各コマンドを | で段に分け、
# fetch を含む段より後ろの段がインタプリタで始まるときだけ拒否する。別コマンドに curl と python3 -c が
# 共存するだけ (curl -o f URL; python3 -c ...) は拒否しない。
# 区切りは shlex で引用符を解釈して切る (curl -H 'a;b' URL | sh の ; で割れない)。
# 限界 (位置づけどおり、境界ではない): 保存してから実行する 2 段階 (curl -o f; sh f)、変数経由の eval、
# 変数展開や関数越しの実行は捕まえない。
FETCH='(curl|wget|fetch)'
INTERP='(/[[:alnum:]/._-]*/)?(sh|bash|zsh|dash|ksh|python[0-9.]*|perl|ruby|node)'
ONE="$(printf '%s' "$CMD" | python3 -c 'import re,sys; s=sys.stdin.read(); s=re.sub(r"\\\r?\n"," ",s); print(re.sub(r"\s+"," ",s).strip())')"
PIPE_HIT="$(printf '%s' "$CMD" | python3 -c '
import re, shlex, sys
s = sys.stdin.read().replace("\r", "")
s = re.sub(r"\\\n", " ", s)                                   # バックスラッシュ改行は行の継続
s = s.replace("|&", "|")                                        # |& (stderr 込み) は | と同じ扱い。行結合の前に潰す
lines = [l.strip() for l in s.split("\n") if l.strip()]
cmds = []                                                       # 改行は区切り。ただし | で終わる行 / | で始まる行は前の行に続ける
for l in lines:
    if cmds and (cmds[-1].endswith("|") or (l.startswith("|") and not l.startswith("||"))):
        cmds[-1] += " " + l
    else:
        cmds.append(l)
FETCH = re.compile(r"\b(curl|wget|fetch)\b")
INTERP = re.compile(r"^(/[\w/.-]*/)?(sh|bash|zsh|dash|ksh|python[0-9.]*|perl|ruby|node)$")
# インタプリタの前に置ける前置コマンドと、その「値を取る 1 文字オプション」(例: sudo -u root / xargs -n 1 / env -u VAR)
WRAP = {"sudo": "ugUhpCDRTrt", "doas": "uC", "env": "uCSP", "xargs": "nLsIEPdaRSJ", "nice": "n", "timeout": "sk",
        "nohup": "", "command": "", "exec": ""}
CMD_SEP = {";", "&&", "||", "&"}                                 # コマンドの区切り
PIPE = {"|", "|&"}                                              # 段の区切り
REDIR = re.compile(r"^[<>&]*[<>][<>&]*$")                        # > >> >& &> < などのリダイレクト演算子
OPS = re.compile(r"\|\||&&|\|&|;;|&>>|&>|[<>]+&?|[;&|]")       # 記号の並びをシェルの演算子単位に切る (|> は | と >、&>> は 1 つ)
NAIVE = re.compile(r"\|\||&&|\|&|;;|&>>|&>|[<>]+&?|[;&|]|[^\s;&|<>]+")
def tokenize(c):
    # 引用符を解釈して区切りを切る (引用符の中の ; や | を区切りにしない)。閉じていない引用符は bash でも構文エラーなので素朴に切る。
    # # をコメントとして捨てない (URL の #fragment や a=b#c の後ろの | sh が消える)
    try:
        lex = shlex.shlex(c, posix=True, punctuation_chars=";&|<>")
        lex.whitespace_split = False
        lex.commenters = ""
        toks = list(lex)
    except ValueError:
        toks = NAIVE.findall(c)
    out = []
    for t in toks:
        out.extend(OPS.findall(t) if re.fullmatch(r"[;&|<>]+", t) else [t])
    return out
def starts_with_interp(toks):
    # 段の先頭から、( { / リダイレクト / 前置コマンド / そのオプション / 値を取るオプションの値 / VAR=val を読み飛ばし、最初の実コマンドがインタプリタか見る
    i = 0
    while i < len(toks):
        t = toks[i]
        if t in ("(", "{"):
            i += 1
        elif REDIR.match(t) or (t.isdigit() and i + 1 < len(toks) and REDIR.match(toks[i + 1])):
            # > f / >& 1 / 2 >& 1 / 2 > f。記号が複数に割れても (&> >) まとめて読み飛ばし、その後の 1 語を対象ファイルとして飛ばす
            if t.isdigit(): i += 1
            while i < len(toks) and REDIR.match(toks[i]): i += 1
            i += 1
        else:
            break
    wrap = None; value_ok = False; positional = 0
    for tok in toks[i:]:
        if value_ok:                                            # 直前のオプションの値 (sudo -u sh でも sh を実コマンドと見ない)
            value_ok = False; continue
        if INTERP.match(tok):
            return True
        base = tok.rsplit("/", 1)[-1]                           # /usr/bin/env のような絶対パスの前置も名前で判定
        if base in WRAP:
            wrap = base; positional = 1 if base == "timeout" else 0   # timeout は秒数の位置引数を 1 つ取る
        elif wrap is not None and tok.startswith("-"):
            value_ok = len(tok) == 2 and tok[1] in WRAP[wrap]   # -u root のように値が別トークンのときだけ 1 つ読み飛ばす
        elif wrap is not None and re.match(r"^\w+=", tok):
            pass                                                # env VAR=val
        elif wrap is not None and positional:
            positional -= 1                                     # timeout [opts] 5 bash の 5
        else:
            return False                                        # 実コマンドがインタプリタ以外 (grep, jq など)
    return False
for c in cmds:
    simples = [[]]                                              # トークン列を ; && || & でコマンドに、| で段に分ける
    for tok in tokenize(c):
        if tok in CMD_SEP:
            simples.append([])
        elif tok in PIPE:
            simples[-1].append(None)                            # None = 段の境界
        else:
            simples[-1].append(tok)
    for simple in simples:
        stages = [[]]
        for tok in simple:
            if tok is None: stages.append([])
            else: stages[-1].append(tok)
        seen = False
        for stage in stages:
            if seen and starts_with_interp(stage):
                print("hit"); sys.exit(0)
            if any(FETCH.search(t) for t in stage):
                seen = True
')"
if [ "$PIPE_HIT" = "hit" ] \
   || printf '%s' "$ONE" | grep -Eq "${INTERP}[[:space:]]+(-[[:alnum:]]+[[:space:]]+)*<\([[:space:]]*${FETCH}" \
   || printf '%s' "$ONE" | grep -Eq "eval[[:space:]]+\"?(\\$\(|\`)[[:space:]]*${FETCH}"; then
  deny "fetch-and-execute" "リモート取得をそのままシェル実行するコマンドは許可しません。ファイルに保存してから内容を確認してください。"
fi

exit 0
