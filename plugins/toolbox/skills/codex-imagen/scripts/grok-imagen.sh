#!/usr/bin/env bash
# grok-imagen.sh — Grok CLI の image_gen / image_edit で画像を生成・編集する。
#
# 引数契約は codex-imagen.sh と同一:
#   grok-imagen.sh <output_path> <prompt> [<input_image>] [--size=<WxH>]
#
# 入力画像なしは image_gen、ありは image_edit を明示的に許可する。codex-imagen.sh の
# 既定フォールバック列では codex の次、agy の前に実行される。単体実行も可能。
#
# 環境変数:
#   GROK_IMAGEN_MAX_ATTEMPTS  同一 invocation 内のリトライ上限 (default 2)
#   GROK_IMAGEN_TIMEOUT       grok 1 回の上限秒数 (default 420)
#   GROK_IMAGEN_BIN           grok 実体の上書き (テスト用。default: grok)
#   GROK_IMAGEN_MODEL         使用モデルの明示指定 (任意)
#   GROK_HOME                 Grok の状態保存先 (default: ~/.grok)

set -euo pipefail

IMAGEN_TAG="grok-imagen"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/imagen-common.sh
. "$SCRIPT_DIR/lib/imagen-common.sh"

imagen_parse_args "$@"

GROK_IMAGEN_MAX_ATTEMPTS="${GROK_IMAGEN_MAX_ATTEMPTS:-2}"
GROK_IMAGEN_TIMEOUT="${GROK_IMAGEN_TIMEOUT:-420}"
GROK_IMAGEN_BIN="${GROK_IMAGEN_BIN:-grok}"
GROK_IMAGEN_MODEL="${GROK_IMAGEN_MODEL:-}"

imagen_verdict_init

if ! command -v "$GROK_IMAGEN_BIN" >/dev/null 2>&1; then
  imagen_log "grok not found in PATH (GROK_IMAGEN_BIN=$GROK_IMAGEN_BIN)"
  imagen_verdict_raw grok skipped not_installed
  imagen_verdict_finish failed
  exit 1
fi

_grok_last_log="$(mktemp -t grok-imagen-last.XXXXXX)"
imagen_tmp_register "$_grok_last_log"
_timeout_bin="$(imagen_timeout_bin)"

imagen_abs_path() {
  echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
}

build_grok_prompt() {
  local in_abs
  if [ -n "$in_path" ]; then
    in_abs="$(imagen_abs_path "$in_path")"
    printf '%s' "image_edit ツールを必ず1回だけ使い、既存画像 $in_abs を編集してください。image_gen や検索など、ほかのツールは使わないでください。編集指示: $prompt$size_hint image_edit が返ったら、追加作業をせず OK とだけ答えてください。"
  else
    printf '%s' "image_gen ツールを必ず1回だけ使って画像を生成してください。検索など、ほかのツールは使わないでください。生成指示: $prompt$size_hint image_gen が返ったら、追加作業をせず OK とだけ答えてください。"
  fi
}

new_grok_session_id() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  elif [ -r /proc/sys/kernel/random/uuid ]; then
    tr '[:upper:]' '[:lower:]' </proc/sys/kernel/random/uuid
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import uuid; print(uuid.uuid4())'
  else
    return 1
  fi
}

find_grok_session_dir() {
  local session_id="$1" grok_home="${GROK_HOME:-$HOME/.grok}"
  [ -d "$grok_home/sessions" ] || return 1
  find "$grok_home/sessions" -mindepth 2 -maxdepth 2 -type d -name "$session_id" -print -quit
}

materialize_grok_image() {
  local session_id="$1" session_dir source ext
  session_dir="$(find_grok_session_dir "$session_id" || true)"
  [ -n "$session_dir" ] && [ -d "$session_dir/images" ] || return 1
  # Grok は images/1.jpg, images/2.jpg ... の順に保存する。最初の1枚が依頼した
  # image_gen/image_edit の結果であり、同一セッション内の後続画像を誤回収しない。
  source="$(find "$session_dir/images" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print | sort | head -1)"
  [ -n "$source" ] && [ -f "$source" ] || return 1
  ext="$(printf '%s' "${source##*.}" | tr '[:upper:]' '[:lower:]')"

  if [ "$ext" = png ]; then
    cp "$source" "$out_path"
  elif command -v sips >/dev/null 2>&1; then
    sips -s format png "$source" --out "$out_path" >/dev/null 2>&1
  elif command -v magick >/dev/null 2>&1; then
    magick "$source" "$out_path"
  elif command -v convert >/dev/null 2>&1; then
    convert "$source" "$out_path"
  elif command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -loglevel error -y -i "$source" "$out_path"
  else
    imagen_log "cannot convert Grok ${ext} output to PNG (sips/magick/convert/ffmpeg not found)"
    return 1
  fi
}

run_grok() {
  local grok_prompt="$1" grok_tool="image_gen" log_out session_id rc=0
  [ -z "$in_path" ] || grok_tool="image_edit"
  log_out="$(mktemp -t grok-imagen-log.XXXXXX)"
  session_id="$(new_grok_session_id || true)"
  if [ -z "$session_id" ]; then
    imagen_log "cannot create a Grok session ID (uuidgen/python3 unavailable)"
    echo "cannot create session id" >>"$_grok_last_log"
    return 1
  fi

  local grok_flags=(
    --permission-mode bypassPermissions
    --no-subagents
    --no-plan
    --disable-web-search
    --disallowed-tools search_tool
    --max-turns 2
    --verbatim
    --output-format plain
    --cwd "$(cd "$(dirname "$out_path")" && pwd)"
    --session-id "$session_id"
    --tools "$grok_tool"
  )
  [ -z "$GROK_IMAGEN_MODEL" ] || grok_flags+=(--model "$GROK_IMAGEN_MODEL")

  if [ -n "$_timeout_bin" ]; then
    "$_timeout_bin" -k 10 "${GROK_IMAGEN_TIMEOUT}s" \
      "$GROK_IMAGEN_BIN" "${grok_flags[@]}" --single "$grok_prompt" \
      >"$log_out" 2>&1 </dev/null || rc=$?
  else
    "$GROK_IMAGEN_BIN" "${grok_flags[@]}" --single "$grok_prompt" \
      >"$log_out" 2>&1 </dev/null || rc=$?
  fi

  if [ ! -f "$out_path" ]; then
    materialize_grok_image "$session_id" || true
  fi
  if [ "$rc" -ne 0 ] || [ ! -f "$out_path" ]; then
    imagen_log "grok rc=${rc} tool=${grok_tool} session_id=${session_id}"
    if [ -s "$log_out" ]; then
      imagen_log "grok output (tail):"
      LC_ALL=C tail -c 2000 "$log_out" | tee -a "$_grok_last_log" | LC_ALL=C sed "s/^/[${IMAGEN_TAG}]   /" >&2
    fi
  fi
  rm -f "$log_out"
}

try_generate_and_resize() {
  rm -f "$out_path"
  run_grok "$(build_grok_prompt)"
  [ -f "$out_path" ] || return 1
  imagen_resize_if_needed || {
    echo "resize rejected (source smaller than target)" >>"$_grok_last_log"
    return 1
  }
  return 0
}

attempt=1
while ! try_generate_and_resize; do
  if [ "$attempt" -ge "$GROK_IMAGEN_MAX_ATTEMPTS" ]; then
    imagen_log "failed to generate/resize image at: $out_path (after ${attempt} attempts)"
    imagen_verdict grok failed "$_grok_last_log"
    imagen_verdict_finish failed
    exit 1
  fi
  imagen_log "attempt ${attempt}/${GROK_IMAGEN_MAX_ATTEMPTS} failed (no PNG or size-reject), retrying after 10s..."
  sleep 10
  attempt=$((attempt + 1))
done

imagen_verdict grok ok
imagen_verdict_finish ok
imagen_print_result
