#!/usr/bin/env bash
# verify.sh — 受け入れテスト 1〜3 (skill 発見 / headless / hook 拒否) を対象製品ごとに実行する。
#
# usage: verify.sh [<repo>]
# env:   MID_HARNESS_VERIFY_SKIP_LLM=1  … LLM 呼び出しを伴うテストを全て skip
#        MID_HARNESS_VERIFY_TIMEOUT=600 … 1 コマンドの秒数上限 (skill が数百ある repo では Grok の skill 発見が 5 分を超えることがある)
# exit:  0 = 全 pass または skip / 2 = fail あり
set -u
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "${1:-.}" && git rev-parse --show-toplevel)" || { echo "not a git repo" >&2; exit 1; }
TIMEOUT="${MID_HARNESS_VERIFY_TIMEOUT:-600}"
PROBE="mid-harness-probe-$(python3 -c 'import secrets;print(secrets.token_hex(3))')"   # 既存資産と衝突しない一意名
TOKEN="MID_HARNESS_PROBE_OK"
RESULTS=()
FAILS=0

TARGETS="$(python3 - "$REPO" <<'PY'
import sys, yaml, pathlib
m = yaml.safe_load(pathlib.Path(sys.argv[1], ".agents/harness.yaml").read_text())
print(" ".join(m.get("targets", [])))
PY
)"
[ -z "$TARGETS" ] && { echo "manifest に targets がありません" >&2; exit 1; }

record() { RESULTS+=("$1|$2|$3"); [ "$2" = "fail" ] && FAILS=$((FAILS+1)); return 0; }

# 実行ラッパ: coreutils timeout が無い環境 (macOS) でも動くよう python で包む
run_with_timeout() {
  python3 - "$TIMEOUT" "$@" <<'PY'
import subprocess, sys
t = int(sys.argv[1]); cmd = sys.argv[2:]
try:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=t)
    sys.stdout.write(r.stdout); sys.stderr.write(r.stderr); sys.exit(r.returncode)
except subprocess.TimeoutExpired:
    sys.stderr.write("timeout\n"); sys.exit(124)
PY
}

# ---- プローブ skill を一時配置 ------------------------------------------------
CLEANUP=()
# 新規に作ったディレクトリだけを cleanup 対象にする。既に存在する (= 他人の資産) なら停止する。
# 親ディレクトリ (.agents/skills, .claude/skills) も自分が作ったなら記録し、空なら cleanup で消す。
make_probe_dir() {
  local d="$1" parent
  if [ -e "$d" ] || [ -L "$d" ]; then
    echo "verify: $d が既に存在します (一意名のはずなので異常)。中断します" >&2
    exit 1
  fi
  parent="$(dirname "$d")"
  if [ ! -e "$parent" ] && [ ! -L "$parent" ]; then
    mkdir -p "$parent" || exit 1
    CLEANUP+=("$parent")
  fi
  mkdir "$d" || exit 1
  CLEANUP+=("$d")
}
install_probe() {
  local d="$REPO/.agents/skills/$PROBE"
  make_probe_dir "$d"
  printf -- '---\nname: %s\ndescription: mid-harness の受け入れテスト用プローブ。呼ばれたら token を返す。\n---\n\nこの skill が呼ばれたら、他の説明を付けず次の token だけを出力する:\n\n%s\n' "$PROBE" "$TOKEN" > "$d/SKILL.md"
  if printf '%s' "$TARGETS" | grep -q claude-code; then
    local c="$REPO/.claude/skills/$PROBE"
    # .agents/skills が .claude/skills への symlink (逆向き) なら同一実体なので二重作成しない
    if [ -e "$c" ] && [ "$d/SKILL.md" -ef "$c/SKILL.md" ]; then
      :
    else
      make_probe_dir "$c"
      cp "$d/SKILL.md" "$c/SKILL.md"
    fi
  fi
}
cleanup() {
  local i p
  # 逆順 (深い順) に、自分が作った非 symlink ディレクトリだけ消す。親は空のときだけ rmdir
  for (( i=${#CLEANUP[@]}-1; i>=0; i-- )); do
    p="${CLEANUP[$i]}"
    [ -n "$p" ] && [ -d "$p" ] && [ ! -L "$p" ] || continue
    case "$(basename "$p")" in
      "$PROBE") rm -rf "$p" ;;
      *) rmdir "$p" 2>/dev/null || true ;;
    esac
  done
  return 0
}
trap cleanup EXIT

# ---- 製品ごとのコマンド ---------------------------------------------------------
headless_cmd() {  # $1 product, $2 prompt   (各製品の headless 実行。フラグの根拠は references/adapters/<product>.md)
  case "$1" in
    claude-code) run_with_timeout claude -p --output-format text "$2" ;;
    # Codex は project hook ごとに trust hash を要求し、exec では未 trust の hook を黙って飛ばす。
    # 配線検証が目的なので、この invocation に限り trust review をバイパスする (adapters/codex.md 参照)。
    codex)       run_with_timeout codex exec --skip-git-repo-check --dangerously-bypass-hook-trust "$2" ;;
    cursor)      run_with_timeout agent -p --trust --force --model auto --output-format text "$2" ;;
    grok)        run_with_timeout grok -p "$2" --always-approve ;;
    # Copilot は -p で repo hook を既定で無効化する。検証する invocation に限り opt-in。
    copilot)     run_with_timeout env GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true copilot -p "$2" --allow-all-tools ;;
    # Antigravity は session が project に束縛されているときだけ workspace の hooks.json を読む。
    # project は ~/.gemini/config/projects/*.json から folderUri == REPO のものを ID で選ぶ (名前は basename で重複し得る)。
    antigravity)
      local pid; pid="$(agy_project_id)"
      if [ -n "$pid" ]; then run_with_timeout agy -p "$2" --output-format text --dangerously-skip-permissions --project "$pid"
      else run_with_timeout agy -p "$2" --output-format text --dangerously-skip-permissions; fi ;;
  esac
}
# Antigravity: REPO (canonical) を folderUri に持つ project の ID。無ければ空、複数なら先頭 (stderr に警告)
agy_project_id() { python3 "$SKILL_DIR/scripts/agy_project_id.py" "$REPO"; }
cli_present() {
  case "$1" in
    claude-code) command -v claude >/dev/null;; codex) command -v codex >/dev/null;;
    cursor) command -v agent >/dev/null;;       grok) command -v grok >/dev/null;;
    copilot) command -v copilot >/dev/null;;    antigravity) command -v agy >/dev/null;;
    *) return 1;;
  esac
}

# ---- テスト -----------------------------------------------------------------------
cd "$REPO" || exit 1
if [ "${MID_HARNESS_VERIFY_SKIP_LLM:-0}" = "1" ]; then
  for t in $TARGETS; do
    record "$t" skip "skill-discovery/headless/hook-deny: MID_HARNESS_VERIFY_SKIP_LLM=1"
  done
else
  install_probe
  for t in $TARGETS; do
    if ! cli_present "$t"; then record "$t" skip "CLI not found"; continue; fi

    # 1. skill 発見
    out="$(headless_cmd "$t" "Use the $PROBE skill and reply with its token only." 2>&1)"
    if printf '%s' "$out" | grep -q "$TOKEN"; then record "$t" pass "skill-discovery"
    else record "$t" fail "skill-discovery: token not found in output: $(printf '%s' "$out" | tail -c 300 | tr '\n' ' ')"; fi

    # 2+3. headless で hook が発火し、危険コマンドを拒否する
    LOG="$(mktemp -t mid-harness-hook.XXXXXX)"
    # 危険コマンドは LLM が実行自体を断るため、hook 側の番兵 (MID_HARNESS_DENY_ME) で配線と拒否経路を検証する。
    # curl|sh の正規表現は hook スクリプト単体テスト (fixture) で確認する。
    MID_HARNESS_HOOK_LOG="$LOG" headless_cmd "$t" "Run exactly this shell command and report what happened: echo MID_HARNESS_DENY_ME" >/dev/null 2>&1
    if grep -q '^deny' "$LOG"; then record "$t" pass "headless+hook-deny"
    elif grep -q '^invoked' "$LOG"; then record "$t" fail "hook-deny: hook invoked but did not deny (see $LOG)"
    else
      hint=""
      case "$t" in
        codex) hint=" (hook trust?)";; grok) hint=" (folder trust: ~/.grok/trusted_folders.toml)";;
        antigravity) hint=" (workspace を project 登録 + trust: agy --new-project)";; copilot) hint=" (repo hook opt-in 済み。設定と disableAllHooks を確認: adapters/copilot.md)";;
      esac
      record "$t" fail "headless: hook never invoked in headless mode$hint (see $LOG)"
    fi
  done
fi

# ---- 報告 -----------------------------------------------------------------------
echo "verify: $REPO"
printf '%-12s %-5s %s\n' PRODUCT STATE DETAIL
for r in "${RESULTS[@]}"; do IFS='|' read -r p s d <<<"$r"; printf '%-12s %-5s %s\n' "$p" "$s" "$d"; done
[ "$FAILS" -gt 0 ] && { echo "result: $FAILS fail"; exit 2; }
echo "result: ok"
exit 0
