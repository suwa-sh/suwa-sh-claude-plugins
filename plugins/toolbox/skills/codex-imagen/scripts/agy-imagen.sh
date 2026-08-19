#!/usr/bin/env bash
# agy-imagen.sh — Antigravity CLI (agy) の generate_image で画像を生成する。
#
# 引数契約は codex-imagen.sh と同一:
#   agy-imagen.sh <output_path> <prompt> [<input_image>] [--size=<WxH>]
#
# 位置づけ: codex-imagen.sh (既定) が usage limit / rate limit で尽きたときの二段目。
# 単体でも使える (プロバイダを明示的に選びたいとき)。
#
# 実測メモ (2026-08-19):
#   - `agy -p` は非対話 print モード。フラグは `-p` より前に置く (`-p` は直後の引数をプロンプトとして食う)
#   - 生成画像はプロンプトで指定した out_path に直接保存される
#   - サイズ指示 (「W x H ピクセル以上」) をプロンプトに書けば、その比率で返る (縦 1080x1920 も可)
#   - 参照画像は「generate_image の入力画像 (ImagePaths) として渡す」と**明示**したときだけ効く。
#     明示しないと参照が無視され、まったく別の絵が返る
#   - ワークスペース外のパス (例: /tmp) は --add-dir で追加すれば読み書きできる
#
# 環境変数:
#   AGY_IMAGEN_MAX_ATTEMPTS  同一 invocation 内のリトライ上限 (default 2)
#   AGY_IMAGEN_TIMEOUT       agy 1 回の上限秒数 (default 420)
#   AGY_IMAGEN_BIN           agy 実体の上書き (テスト用。default: agy)

set -euo pipefail

IMAGEN_TAG="agy-imagen"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/imagen-common.sh
. "$SCRIPT_DIR/lib/imagen-common.sh"

imagen_parse_args "$@"

AGY_IMAGEN_MAX_ATTEMPTS="${AGY_IMAGEN_MAX_ATTEMPTS:-2}"
AGY_IMAGEN_TIMEOUT="${AGY_IMAGEN_TIMEOUT:-420}"
AGY_IMAGEN_BIN="${AGY_IMAGEN_BIN:-agy}"

# codex-imagen.sh から呼ばれたときは、そちらが set/export した $IMAGEN_VERDICT_FILE に積むだけ。
# 単体実行のときはここが集約役になり、最後に IMAGEN_RESULT を出す。
imagen_verdict_init

if ! command -v "$AGY_IMAGEN_BIN" >/dev/null 2>&1; then
  imagen_log "agy not found in PATH (AGY_IMAGEN_BIN=$AGY_IMAGEN_BIN)"
  imagen_verdict_raw agy failed not_installed
  imagen_verdict_finish failed
  exit 1
fi

# 失敗理由の分類用に「直近の agy 失敗ログ」を保持する
_agy_last_log="$(mktemp -t agy-imagen-last.XXXXXX)"
trap 'rm -f "$_agy_last_log"' EXIT

_timeout_bin="$(imagen_timeout_bin)"

# プロンプトに埋め込むパスは必ず絶対パスにする。
# 呼び出し側は相対パスを渡してよい契約 (imagen_parse_args) だが、agy はワークスペース基準で
# 解釈するため、相対のままだと別ディレクトリに保存されたり ImagePaths 検証に落ちる。
imagen_abs_path() {
  echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
}

build_agy_prompt() {
  local out_abs in_abs
  out_abs="$(imagen_abs_path "$out_path")"
  [ -z "$in_path" ] || in_abs="$(imagen_abs_path "$in_path")"
  if [ -n "$in_path" ]; then
    printf '%s' "参照画像 $in_abs を generate_image ツールの入力画像 (ImagePaths) として必ず渡し、その画像のキャラクター造形・画風・色味を維持したまま画像を1枚生成してください。 $prompt$size_hint 生成した画像は必ず $out_abs に PNG で保存してください。完了したら保存パスと実サイズだけを報告してください。"
  else
    printf '%s' "generate_image ツールで画像を1枚生成してください。 $prompt$size_hint 生成した画像は必ず $out_abs に PNG で保存してください。完了したら保存パスと実サイズだけを報告してください。"
  fi
}

run_agy() {
  local agy_prompt="$1"
  local agy_flags=(--dangerously-skip-permissions --print-timeout "${AGY_IMAGEN_TIMEOUT}s")
  # 出力先・参照画像がワークスペース外でも読み書きできるよう明示的に許可する
  agy_flags+=(--add-dir "$(cd "$(dirname "$out_path")" && pwd)")
  if [ -n "$in_path" ]; then
    agy_flags+=(--add-dir "$(cd "$(dirname "$in_path")" && pwd)")
  fi

  local log_out rc=0
  log_out="$(mktemp -t agy-imagen-log.XXXXXX)"
  # </dev/null: 非対話実行 (stdin を読みに行かせない)
  if [ -n "$_timeout_bin" ]; then
    # -k 10: SIGTERM 後 10 秒で SIGKILL。agy 自身の --print-timeout より少し長く待つ
    "$_timeout_bin" -k 10 "$((AGY_IMAGEN_TIMEOUT + 60))s" \
      "$AGY_IMAGEN_BIN" "${agy_flags[@]}" -p "$agy_prompt" >"$log_out" 2>&1 </dev/null || rc=$?
  else
    "$AGY_IMAGEN_BIN" "${agy_flags[@]}" -p "$agy_prompt" >"$log_out" 2>&1 </dev/null || rc=$?
  fi

  # 失敗理由を握り潰さない (quota / 認証失効 / content policy がすべて「no PNG」に潰れるのを防ぐ)
  : >"$_agy_last_log"
  if [ "$rc" -ne 0 ] || [ ! -f "$out_path" ]; then
    imagen_log "agy rc=${rc}"
    if [ -s "$log_out" ]; then
      imagen_log "agy output (tail):"
      tail -c 1500 "$log_out" | tee -a "$_agy_last_log" | sed "s/^/[${IMAGEN_TAG}]   /" >&2
    fi
  fi
  rm -f "$log_out"
}

try_generate_and_resize() {
  rm -f "$out_path"
  run_agy "$(build_agy_prompt)"
  [ -f "$out_path" ] || return 1
  imagen_resize_if_needed || return 1
  return 0
}

attempt=1
while ! try_generate_and_resize; do
  if [ "$attempt" -ge "$AGY_IMAGEN_MAX_ATTEMPTS" ]; then
    imagen_log "failed to generate/resize image at: $out_path (after ${attempt} attempts)"
    imagen_verdict agy failed "$_agy_last_log"
    imagen_verdict_finish failed
    exit 1
  fi
  imagen_log "attempt ${attempt}/${AGY_IMAGEN_MAX_ATTEMPTS} failed (no PNG or size-reject), retrying after 10s..."
  sleep 10
  attempt=$((attempt + 1))
done

imagen_verdict agy ok
imagen_verdict_finish ok
imagen_print_result
