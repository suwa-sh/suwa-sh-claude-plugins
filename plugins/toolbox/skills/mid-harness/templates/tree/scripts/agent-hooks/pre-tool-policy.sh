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
# パイプ形は、全体を shlex で引用符を解釈して 1 回で切り (curl -H 'a;b' URL | sh の ; や、引用符の中の改行で割れない)、
# 入れ子 (( ) { } と if/while/for/case) の外の ; && || & 改行 でコマンドに、| で段に分け、
# fetch を含む段より後ろの段がインタプリタで始まるとき (グループの段なら中のどれかがインタプリタのとき) に拒否する。
# グループの中身、sh/bash -c の文字列、eval の引数、ssh のリモートコマンド、引用符の中の $( ) / ` ` も同じ検査を再帰でかける。
# 取得は実コマンドの位置が curl/wget/fetch のときだけ数える (./curl.sh のようなファイル名では数えない)。
# 別コマンドに curl と python3 -c が共存するだけ (curl -o f URL; python3 -c ...) や、echo "curl x | sh" / '$(curl x | sh)' のような
# 展開されない文字列は拒否しない。
# 引用符が閉じていない・検査が失敗した・入れ子が深すぎる・入力が長すぎるときは、取得を含めば拒否する (fail-closed)。
# 限界 (位置づけどおり、境界ではない): 保存してから実行する 2 段階 (curl -o f; sh f)、変数経由の eval、
# 変数展開や関数越しの実行は捕まえない。
FETCH='(curl|wget|fetch)'
INTERP='(/[[:alnum:]/._-]*/)?(sh|bash|zsh|dash|ksh|python[0-9.]*|perl|ruby|node)'
ONE="$(printf '%s' "$CMD" | python3 -c 'import re,sys; s=sys.stdin.read(); s=re.sub(r"\\\r?\n"," ",s); print(re.sub(r"\s+"," ",s).strip())')"
PIPE_HIT="$(printf '%s' "$CMD" | python3 -c '
import re, shlex, sys
FETCH = re.compile(r"\b(curl|wget|fetch)\b")
INTERP = re.compile(r"^(/[\w/.-]*/)?(sh|bash|zsh|dash|ksh|python[0-9.]*|perl|ruby|node)$")
SHELL = re.compile(r"^(/[\w/.-]*/)?(sh|bash|zsh|dash|ksh)$")      # -c で文字列をコマンドとして実行するシェル
# インタプリタの前に置ける前置コマンドと、その「値を取る 1 文字オプション」(例: sudo -u root / xargs -n 1 / env -u VAR)
WRAP = {"sudo": "ugUhpCDRTrt", "doas": "uC", "env": "uCSP", "xargs": "nLsIEPdaRSJ", "nice": "n", "timeout": "sk",
        "nohup": "", "command": "", "exec": "", "time": "", "builtin": ""}
SSH_VAL = set("bcDEeFIiJLlmOoPpQRSWw")                            # ssh の値を取る 1 文字オプション
CMD_SEP = {";", "&&", "||", "&", ";;", "\n", "`"}               # コマンドの区切り (改行は引用符の外のものだけ。` はコマンド置換の境界)
PIPE = {"|", "|&"}                                              # 段の区切り
OPEN = {"(", "{"}; CLOSE = {")", "}"}                           # サブシェル・コマンド置換・グループ
OPEN_KW = {"if", "while", "until", "for", "case", "select"}; CLOSE_KW = {"fi", "done", "esac"}
LEAD_KW = {"then", "do", "else", "elif", "!", "in"}             # 後ろに次のコマンドが続く語 (サブコマンドの先頭で読み飛ばす)
REDIR = re.compile(r"^[<>&]*[<>][<>&]*$")                        # > >> >& &> < などのリダイレクト演算子
OPS = re.compile(r"\|\||&&|\|&|;;|&>>|&>|[<>]+&?|[;&|()\n`]")  # 記号の並びをシェルの演算子単位に切る (|> は | と >、&>> は 1 つ)
FETCH_CMDS = {"curl", "wget", "fetch"}                           # 実コマンドとして見たときの取得コマンド
MAX_DEPTH = 6                                                   # 入れ子の解析の上限。超えたら取得を含むだけで拒否する (fail-closed)
MAX_LEN = 100000                                                # 解析する長さの上限 (文字)。超えたら取得を含むだけで拒否する (fail-closed)

def tokenize(c):
    # 引用符を解釈して全体を 1 回で切る。引用符の中の ; | 改行 は区切りにしない (改行で先に割ると "a<改行>b" で段が割れて迂回できる)。
    # # をコメントとして捨てない (URL の #fragment や a=b#c の後ろの | sh が消える)。閉じていない引用符は None (呼び出し側で fail-closed)
    try:
        lex = shlex.shlex(c, posix=True, punctuation_chars=";&|<>()\n`")
        lex.whitespace = " \t\r"
        lex.whitespace_split = False
        lex.commenters = ""
        toks = list(lex)
    except ValueError:
        return None
    out = []
    for t in toks:
        out.extend(OPS.findall(t) if re.fullmatch(r"[;&|<>()\n`]+", t) else [t])
    return out

def real_cmd(toks):
    # ( { / 予約語 / リダイレクト / 前置コマンド / そのオプション / 値を取るオプションの値 / VAR=val を読み飛ばし、実コマンドの位置を返す
    i = 0
    while i < len(toks):
        t = toks[i]
        if t in OPEN or t in LEAD_KW or t in OPEN_KW:
            i += 1
        elif REDIR.match(t) or (t.isdigit() and i + 1 < len(toks) and REDIR.match(toks[i + 1])):
            # > f / >& 1 / 2 >& 1 / 2 > f。記号が複数に割れても (&> >) まとめて読み飛ばし、その後の 1 語を対象ファイルとして飛ばす
            if t.isdigit(): i += 1
            while i < len(toks) and REDIR.match(toks[i]): i += 1
            i += 1
        else:
            break
    wrap = None; value_ok = False; positional = 0
    for j in range(i, len(toks)):
        tok = toks[j]
        if value_ok:                                            # 直前のオプションの値 (sudo -u sh でも sh を実コマンドと見ない)
            value_ok = False; continue
        base = tok.rsplit("/", 1)[-1]                           # /usr/bin/env のような絶対パスの前置も名前で判定
        if INTERP.match(tok):
            return j
        if base in WRAP:
            wrap = base; positional = 1 if base == "timeout" else 0   # timeout は秒数の位置引数を 1 つ取る
        elif wrap is not None and tok.startswith("-"):
            value_ok = len(tok) == 2 and tok[1] in WRAP[wrap]   # -u root のように値が別トークンのときだけ 1 つ読み飛ばす
        elif re.match(r"^\w+=", tok):
            pass                                                # VAR=val / env VAR=val
        elif wrap is not None and positional:
            positional -= 1                                     # timeout [opts] 5 bash の 5
        else:
            return j
    return None

def inner_scripts(toks):
    # 実コマンドが文字列をコマンドとして実行するとき、その文字列を返す: sh/bash -c (-lc 等も)、eval、ssh のリモートコマンド
    j = real_cmd(toks)
    if j is None:
        return []
    base = toks[j].rsplit("/", 1)[-1]; rest = toks[j + 1:]
    if SHELL.match(toks[j]):
        # オプションを読み、-c (-lc 等の束も) があれば、オプションの後の最初の語が実行される文字列 (bash -c -o pipefail "..." も同じ)
        k = 0; has_c = False
        while k < len(rest) and rest[k].startswith(("-", "+")) and rest[k] not in ("-", "--"):
            opt = rest[k]
            if opt in ("-o", "+o", "-O", "+O"):
                k += 2; continue
            if not opt.startswith("--") and "c" in opt[1:]:
                has_c = True
            k += 1
        if k < len(rest) and rest[k] == "--":
            k += 1
        return [rest[k]] if has_c and k < len(rest) else []
    if base == "eval":
        return [" ".join(rest[1:] if rest[:1] == ["--"] else rest)]   # eval -- "..." の -- は区切り
    if base == "ssh":
        k = 0
        while k < len(rest) and rest[k].startswith("-"):
            k += 2 if (len(rest[k]) == 2 and rest[k][1] in SSH_VAL) else 1
        return [" ".join(rest[k + 1:])] if k + 1 < len(rest) else []
    return []

def nest(stack, t, at_start):
    # 入れ子のスタックを 1 語ぶん進める。case の中の ")" は分岐のパターンの終わりで、入れ子を閉じない
    if t in OPEN:
        if not (t == "(" and stack and stack[-1] == "case"):    # case の分岐の先頭の ( は任意の飾り
            stack.append(t)
    elif at_start and t in OPEN_KW:
        stack.append(t)
    elif t == ")" and stack and stack[-1] == "case":
        pass
    elif (t in CLOSE or (at_start and t in CLOSE_KW)) and stack:
        stack.pop()

def split_top(toks):
    # 深さ 0 の区切りでコマンドに分け、各コマンドを深さ 0 の | で段に分ける。入れ子 (( ) { } と if/while/for/case) の中は切らない。
    # 改行は区切りだが、| && || の直後の改行と、| で始まる行の前の改行は継続として扱う
    cmds = [[[]]]; stack = []; at_start = True; prev = None
    for n, t in enumerate(toks):
        nxt = toks[n + 1] if n + 1 < len(toks) else None
        if not stack and t == "\n" and (prev in PIPE or prev in ("&&", "||") or nxt in PIPE):
            continue
        nest(stack, t, at_start)
        depth = len(stack)
        if depth == 0 and t in CMD_SEP:
            cmds.append([[]])
        elif depth == 0 and t in PIPE:
            cmds[-1].append([])
        else:
            cmds[-1][-1].append(t)
        at_start = t in CMD_SEP or t in PIPE or t in OPEN or t in LEAD_KW or t in ("if", "while", "until") or (t == ")" and stack and stack[-1] == "case")
        prev = t
    return cmds

def sub_commands(toks):
    # 入れ子も含めてすべての区切りで切った単純コマンドの列 (グループの中のどれかがインタプリタかを見る用)
    subs = [[]]
    for t in toks:
        if t in CMD_SEP or t in PIPE or t in OPEN or t in CLOSE or t in CLOSE_KW:
            subs.append([])
        else:
            subs[-1].append(t)
    return [s for s in subs if s]

def groups(toks):
    # 深さ 1 のグループ (( ) { } と予約語の複合コマンド) の中身を返す。中身はそれ自体をコマンド列として検査する
    out = []; stack = []; start = None; at_start = True
    for n, t in enumerate(toks):
        before = len(stack)
        nest(stack, t, at_start)
        if before == 0 and len(stack) == 1:
            start = n + 1
        elif before == 1 and len(stack) == 0:
            out.append(toks[start:n])
        at_start = t in CMD_SEP or t in PIPE or t in OPEN or t in LEAD_KW or t in ("if", "while", "until") or (t == ")" and stack and stack[-1] == "case")
    if stack and start is not None:
        out.append(toks[start:])                                # 閉じていないグループも中身を検査する
    return out

def substitutions(s):
    # 実際に展開されるコマンド置換 $( ) / ` ` の中身を、引用符とエスケープの状態を追って 1 回の走査で取り出す (線形)。
    # 単一引用符の中とエスケープされた \$( は展開されないので拾わない。閉じていない $( は末尾までを中身とする
    out = []; i = 0; n = len(s); quote = None
    while i < n:
        ch = s[i]
        if quote == "$\x27":                                   # $ 付きの単一引用 (ANSI-C) の中は \ が次の 1 文字をエスケープし、置換は起きない
            if ch == "\\":
                i += 2; continue
            if ch == "\x27": quote = None
            i += 1; continue
        if quote == "\x27":
            if ch == "\x27": quote = None
            i += 1; continue
        if ch == "\\":
            i += 2; continue
        if ch == "$" and quote is None and s[i + 1:i + 2] == "\x27":
            quote = "$\x27"; i += 2; continue
        if ch == "\x27" and quote is None:
            quote = "\x27"; i += 1; continue
        if ch == "\"":
            quote = None if quote == "\"" else "\""; i += 1; continue
        if ch == "$" and i + 1 < n and s[i + 1] == "(":
            depth = 1; j = i + 2; q = None
            while j < n and depth:
                c = s[j]
                if q == "\x27":
                    if c == "\x27": q = None
                elif c == "\\":
                    j += 1
                elif c in ("\x27", "\"") and q is None:
                    q = c
                elif c == "\"" and q == "\"":
                    q = None
                elif q is None and c == "(":
                    depth += 1
                elif q is None and c == ")":
                    depth -= 1
                j += 1
            out.append(s[i + 2:j - 1] if depth == 0 else s[i + 2:])
            i = j; continue
        if ch == "`":
            j = s.find("`", i + 1)
            out.append(s[i + 1:j] if j != -1 else s[i + 1:])
            i = (j + 1) if j != -1 else n; continue
        i += 1
    return out

def strip_comments(s):
    # 引用符の外で、語の先頭にある # から行末までのシェルコメントを消す (改行は残す)。語の途中の # (URL の #fragment、a#b) は残す。
    # コメントを残すと、「curl URL | # 説明<改行>sh」でパイプの継続を見失い、「curl -o f URL # 例: curl URL | sh」を誤検知する
    out = []; i = 0; n = len(s); quote = None
    while i < n:
        ch = s[i]
        if quote == "$\x27":                                   # $ 付きの単一引用 (ANSI-C) の中は \ が次の 1 文字をエスケープする
            if ch == "\\":
                out.append(s[i:i + 2]); i += 2; continue
            if ch == "\x27": quote = None
            out.append(ch); i += 1; continue
        if quote == "\x27":
            if ch == "\x27": quote = None
            out.append(ch); i += 1; continue
        if ch == "\\":
            out.append(s[i:i + 2]); i += 2; continue
        if ch == "$" and quote is None and s[i + 1:i + 2] == "\x27":
            quote = "$\x27"; out.append(s[i:i + 2]); i += 2; continue
        if ch == "\x27" and quote is None:
            quote = "\x27"
        elif ch == "\"":
            quote = None if quote == "\"" else "\""
        elif ch == "#" and quote is None and (i == 0 or s[i - 1] in " \t\n;&|()<>"):
            j = s.find("\n", i)
            i = n if j == -1 else j
            continue
        out.append(ch); i += 1
    return "".join(out)

ANSI_C = {"n": "\n", "t": "\t", "r": "\r", "a": "\a", "b": "\b", "e": "\x1b", "E": "\x1b", "f": "\f", "v": "\v"}
def normalize_quotes(s):
    # $ 付きの単一引用 (ANSI-C) を中身をデコードした通常の単一引用に、$"..." を通常の二重引用に置き換える (shlex は両方を知らない)。
    # 置き換えないと、bash -c に ANSI-C の引用で渡した取得即実行を見落とし、コミットメッセージの中の | を区切りと誤認する
    out = []; i = 0; n = len(s); quote = None
    while i < n:
        ch = s[i]
        if quote == "\x27":
            if ch == "\x27": quote = None
            out.append(ch); i += 1; continue
        if ch == "\\":
            out.append(s[i:i + 2]); i += 2; continue
        if ch == "$" and quote is None and s[i + 1:i + 2] == "\x27":
            j = i + 2; buf = []
            while j < n and s[j] != "\x27":
                if s[j] == "\\" and j + 1 < n:
                    buf.append(ANSI_C.get(s[j + 1], s[j + 1])); j += 2
                else:
                    buf.append(s[j]); j += 1
            text = "".join(buf)
            out.append("\x27" + text.replace("\x27", "\x27\\\x27\x27") + "\x27")
            i = j + 1; continue
        if ch == "$" and quote is None and s[i + 1:i + 2] == "\"":
            i += 1; continue                                    # $"..." はロケール翻訳つきの二重引用。$ を外して二重引用として読む
        if ch == "\x27" and quote is None:
            quote = "\x27"
        elif ch == "\"":
            quote = None if quote == "\"" else "\""
        out.append(ch); i += 1
    return "".join(out)

def expand_split(sc):
    # env -S "a b" / env -S"a b" / env --split-string="a b" は値を空白で区切って引数に展開する (シェルではないのでパイプは解釈しない)
    for k, t in enumerate(sc):
        if t.rsplit("/", 1)[-1] != "env":
            continue
        m = k + 1
        while m < len(sc) and sc[m].startswith("-"):
            o = sc[m]; val = None
            if o in ("-S", "--split-string"):
                if m + 1 < len(sc): val, end = sc[m + 1], m + 2
            elif o.startswith("--split-string="):
                val, end = o.split("=", 1)[1], m + 1
            elif o.startswith("-S"):
                val, end = o[2:], m + 1
            if val is not None:
                return sc[:k + 1] + val.split() + sc[end:]
            m += 1
        break
    return sc

def is_end(t):
    return (t in CMD_SEP and t != "`") or t in PIPE              # コマンドの終わり (; && || & 改行 |)。` の中は同じコマンドに含める

def code_hits(toks):
    # インタプリタにコードを渡す形 (-c / -e とその束、<<< のヒアストリング) の後ろで取得しているか。
    # bash -c "$(curl URL)" / python3 -c "$(curl URL)" / bash <<< "$(curl URL)" は eval "$(curl URL)" と同じく取得物をコードとして実行する。
    # 同じコマンドの区間は 1 回だけ見る (後ろのインタプリタの区間は前のものに含まれるので、見直しても結果は変わらない。入力長に対して線形)
    n = len(toks); k = 0
    while k < n:
        if not INTERP.match(toks[k]):
            k += 1; continue
        m = k + 1; code_at = None
        while m < n and not is_end(toks[m]):
            t = toks[m]
            if t == "<<<":
                code_at = m; break
            if t in ("-o", "+o", "-O", "+O"):
                m += 2; continue
            if t.startswith("-") and not t.startswith("--"):
                if any(c in t[1:] for c in "ce"):
                    code_at = m; break
                m += 1; continue
            break                                               # オプション以外の語 (スクリプト名など): コードを渡す形ではない
        if code_at is None:
            k += 1; continue
        e = code_at + 1
        while e < n and not is_end(toks[e]):
            e += 1
        if code_from_fetch(toks[code_at + 1:e]):
            return True
        k = e
    return False

def code_from_fetch(after):
    for t in after:
        for inner in substitutions(t):                          # 引用符の中の "$(curl ...)"
            inner_toks = tokenize(inner)
            if inner_toks is None:
                if FETCH.search(inner): return True
            elif any(is_fetch(expand_split(sc)) for sc in sub_commands(inner_toks)):
                return True
    return any(is_fetch(expand_split(sc)) for sc in sub_commands(after))   # 引用符の外の $(curl ...) / `curl ...`

def paren_ends(toks):
    # 各 ( に対応する ) の位置を 1 回の走査で求める (閉じていない ( は末尾)。( ごとに走査し直すと入力長の 2 乗になる
    ends = {}; stack = []
    for j, t in enumerate(toks):
        if t == "(": stack.append(j)
        elif t == ")" and stack: ends[stack.pop()] = j
    for j in stack: ends[j] = len(toks)
    return ends

def subst_fetch(toks):
    # 語の列の中のコマンド置換 ($( ) と ` `) で取得しているか。置換の外の取得 (curl -o f URL) は見ない
    n = len(toks); i = 0; ends = None
    while i < n:
        t = toks[i]
        if "$(" in t or "`" in t:
            if code_from_fetch([t]): return True                # 引用符の中の "$(curl ...)"
        if t == "$" and i + 1 < n and toks[i + 1] == "(":
            if ends is None: ends = paren_ends(toks)
            e = ends[i + 1]
            if code_from_fetch(toks[i + 2:e]): return True
            i = e + 1; continue
        if t == "`":
            e = i + 1
            while e < n and toks[e] != "`": e += 1
            if code_from_fetch(toks[i + 1:e]): return True
            i = e + 1; continue
        i += 1
    return False

def stdin_hits(toks):
    # インタプリタの標準入力やスクリプトに、取得物を渡す形。
    # bash < <(curl URL) / bash <(curl URL) はプロセス置換の中身を、bash <<EOF の本文の $(curl URL) は展開結果を、コードとして実行する
    # 検査済みの範囲の内側にある置換は、外側の検査に含まれるので見直さない (入力長に対して線形)
    # 括弧の中の ; で引数の走査を打ち切らないよう、検査した置換の範囲は丸ごと飛ばす
    n = len(toks); k = 0; ends = None; done = -1; runners = None
    def check(p):
        nonlocal ends, done
        if ends is None: ends = paren_ends(toks)
        if p <= done: return False
        done = ends[p]
        return code_from_fetch(toks[p + 1:ends[p]])
    while k < n:
        is_exec = toks[k].rsplit("/", 1)[-1] == "exec"          # exec < <(curl URL) は以降のコマンドの標準入力を取得物にする
        if runners is None: runners = runner_positions(toks)
        if not (INTERP.match(toks[k]) or is_exec or k in runners):
            k += 1; continue
        m = k + 1
        while m < n and not is_end(toks[m]):
            t = toks[m]
            if t == "<" and m + 1 < n and toks[m + 1] == "(" and not is_exec:
                if check(m + 1): return True                    # bash <(curl URL) / source <(curl URL)。位置引数のどれでも拒否 (安全側)
                m = ends[m + 1] + 1; continue
            if t == "<" and m + 2 < n and toks[m + 1] == "<" and toks[m + 2] == "(":
                if check(m + 2): return True                    # bash < <(curl URL) / exec < <(curl URL)
                m = ends[m + 2] + 1; continue
            if t == "<<<":
                e = m + 1
                while e < n and not is_end(toks[e]): e += 1
                if code_from_fetch(toks[m + 1:e]): return True  # exec <<< "$(curl URL)" / source /dev/stdin <<< "$(curl URL)"
                m = e; continue                                 # コマンドの終わりまで見たので、同じコマンドの残りの <<< は見直さない (線形)
            m += 1
        k = m
    return heredoc_hits(toks)

RUNNERS = {"source", ".", "eval"}                               # 引数をコードとして読み込む組み込みコマンド
def is_code_cmd(t):
    # 実コマンドとして置かれたとき、入力や引数をコードとして実行するもの (インタプリタと source / . / eval)
    return bool(INTERP.match(t)) or t in RUNNERS

def runner_positions(toks):
    # 実コマンドの位置にある source / . / eval の位置の集合。前置コマンド (builtin / command / sudo など)・予約語 (if など)・
    # リダイレクト・VAR=val を real_cmd と同じ規則で読み飛ばす (find . の . のような引数は含めない)
    out = set(); start = 0
    for i in range(len(toks) + 1):
        if i == len(toks) or toks[i] in CMD_SEP or toks[i] in PIPE or toks[i] in OPEN or toks[i] in CLOSE or toks[i] in CLOSE_KW:
            if i > start:
                j = real_cmd(toks[start:i])
                if j is not None and toks[start + j] in RUNNERS: out.add(start + j)
            start = i + 1
    return out

def runs_code(toks):
    # 語の列のどこかにインタプリタ・exec・source・eval・実コマンドの位置の . があるか (位置は問わない。安全側)
    return any(INTERP.match(t) or t.rsplit("/", 1)[-1] in ("exec", "source", "eval") for t in toks) or bool(runner_positions(toks))

def heredoc_hits(toks):
    # ヒアドキュメントの本文の $(curl URL) がコードとして実行される形 (bash <<EOF / cat <<EOF | bash / cat <<EOF | の次の行の bash / exec <<EOF)。
    # 本文の終わりと、本文の後ろに続くパイプの読み取りは読み違えやすいので、ヒアドキュメントがあって、入力のどこかにインタプリタなどがあれば、
    # 最初のヒアドキュメントの行より後ろ全体のコマンド置換を見る (安全側。後ろ全体を見るので 1 回で足りる)
    n = len(toks)
    for m, t in enumerate(toks):
        if t == "<<":
            if not runs_code(toks): return False
            b = m + 1
            while b < n and toks[b] != "\n": b += 1
            return subst_fetch(toks[b + 1:])
    return False

def out_proc_interp(stage):
    # 段の中の出力側のプロセス置換 >(sh) にインタプリタがあるか (curl URL > >(sh) は取得物を sh に流す)。
    # 実コマンドの位置だけを見ると exec -a NAME sh のような前置コマンドのオプションで迂回できるので、中のどの語でも見る (安全側)
    ends = None; done = -1                                       # 検査済みの範囲の内側は見直さない (線形)
    for i, t in enumerate(stage):
        if t == "(" and i > done and i > 0 and stage[i - 1].endswith(">") and REDIR.match(stage[i - 1]):
            if ends is None: ends = paren_ends(stage)
            done = ends[i]
            if runs_code(stage[i + 1:done]): return True
    return False

def is_fetch(sc):
    # 単純コマンドの語のどれかが curl / wget / fetch そのものか (./curl.sh のようなファイル名の部分一致では判定しない)。
    # 実コマンドの位置だけを見ると busybox / stdbuf / torsocks などの起動役で迂回できるので、位置は問わない
    return any(t.rsplit("/", 1)[-1] in FETCH_CMDS for t in sc)

def hit_string(s, level):
    if level > MAX_DEPTH or len(s) > MAX_LEN:                   # 深すぎる入れ子・長すぎる入力: 取得を含むなら拒否 (fail-closed)
        return bool(FETCH.search(s))
    stripped = strip_comments(s)
    if FETCH.search(s) and not FETCH.search(stripped):
        # コメントとして消した部分にしか取得が無い: 引用の読み違いに備え、コメントを消さない形でも検査し、当たれば拒否 (fail-closed)。
        # git pull のコメントに fetch と書いただけのものは、消さない形でも取得即実行にならないので通す
        raw_s = normalize_quotes(s)
        raw = tokenize(raw_s)
        if raw is None or hit_tokens(raw, level) or any(hit_string(inner, level + 1) for inner in substitutions(raw_s)):
            return True
    s = normalize_quotes(stripped)
    toks = tokenize(s)
    if toks is None:                                            # 閉じていない引用符: 取得を含むなら拒否 (fail-closed)
        return bool(FETCH.search(s))
    if hit_tokens(toks, level):
        return True
    return any(hit_string(inner, level + 1) for inner in substitutions(s))   # 引用符の中の "$(...)" / "`...`"

def hit_tokens(toks, level):
    if level > MAX_DEPTH:
        return any(FETCH.search(t) for t in toks)
    if code_hits(toks) or stdin_hits(toks):
        return True                                             # インタプリタに渡すコード・標準入力・ヒアドキュメントの中で取得している
    if out_proc_interp(toks) and any(is_fetch(sc) for sc in sub_commands(toks)):
        return True                                             # 出力側 >(sh) と取得が同じコマンド列にある (curl URL > >(sh) / exec 3> >(sh); curl URL >&3)。安全側
    for cmd in split_top(toks):
        seen = False
        for stage in cmd:
            subs = [expand_split(sc) for sc in sub_commands(stage)]
            if seen and any(real_cmd(sc) is not None and is_code_cmd(sc[real_cmd(sc)]) for sc in subs):
                return True                                     # 取得の後ろの段 (グループならその中のどれか) がインタプリタ
            if any(is_fetch(sc) for sc in subs):
                seen = True
            for sc in subs:
                for inner in inner_scripts(sc):                 # sh -c "..." / eval "..." / ssh host "..." の中身
                    if hit_string(inner, level + 1): return True
        for g in groups([t for stage in cmd for t in stage + ["|"]][:-1]):
            if hit_tokens(g, level + 1): return True
    return False

s = sys.stdin.read().replace("\r", "")
s = re.sub(r"\\\n", " ", s)                                     # バックスラッシュ改行は行の継続
print("hit" if hit_string(s, 0) else "")
')"
PIPE_RC=$?
if [ "$PIPE_RC" -ne 0 ]; then                # 検査自体が落ちたら通さない (fail-closed)
  deny "policy-check-failed" "コマンドの検査に失敗しました (fail-closed)"
fi
if [ "$PIPE_HIT" = "hit" ] \
   || printf '%s' "$ONE" | grep -Eq "${INTERP}[[:space:]]+(-[[:alnum:]]+[[:space:]]+)*<\([[:space:]]*${FETCH}" \
   || printf '%s' "$ONE" | grep -Eq "eval[[:space:]]+\"?(\\$\(|\`)[[:space:]]*${FETCH}"; then
  deny "fetch-and-execute" "リモート取得をそのままシェル実行するコマンドは許可しません。ファイルに保存してから内容を確認してください。"
fi

exit 0
