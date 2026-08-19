#!/usr/bin/env bash
# imagen-common.sh — 画像生成スクリプト (codex-imagen.sh / agy-imagen.sh) の共通部品。
#
# 各スクリプトは「どのエージェント CLI に画像を作らせるか」だけが違い、
#   引数契約 / --size のリサイズ / 出力パスの扱い
# は完全に同じ。ここを正本にして二重メンテを避ける。
#
# 使い方 (呼び出し側):
#   . "$(dirname "$0")/lib/imagen-common.sh"
#   IMAGEN_TAG="agy-imagen"          # ログ接頭辞。source 前に設定する
#   imagen_parse_args "$@"           # out_path / prompt / in_path / size / target_* / size_hint を設定
#   ...生成...
#   imagen_resize_if_needed || return 1
#   imagen_print_result
#
# set -euo pipefail 下で source される前提。

IMAGEN_TAG="${IMAGEN_TAG:-imagen}"
IMAGEN_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

imagen_log() { echo "[${IMAGEN_TAG}] $*" >&2; }

imagen_usage() {
  cat >&2 <<EOF
Usage:
  $(basename "${0}") <output_path> <prompt> [<input_image>] [--size=<WxH>]

  <output_path>  : 生成画像の保存先
  <prompt>       : プロンプト文字列
  <input_image>  : （任意）入力画像パス。参照画像として渡す (edit / reference モード)
  --size=<WxH>   : （任意）最終サイズを WxH に強制する。例: --size=1280x670
                   指定時はプロンプトに size 指示を追加し、生成後 scale-to-cover + center-crop
                   でリサイズする（歪みなし）。元画像が目標より小さい場合はエラー→リトライ
EOF
  exit 2
}

# 引数を解析して out_path / prompt / in_path / size / target_w / target_h / size_hint を設定する。
# 出力先ディレクトリも作成する。不正な引数は exit 2 (usage) / 入力画像不在は exit 1。
imagen_parse_args() {
  out_path=""
  prompt=""
  in_path=""
  size=""

  local arg
  for arg in "$@"; do
    case "$arg" in
      --size=*) size="${arg#--size=}" ;;
      *)
        if   [ -z "$out_path" ]; then out_path="$arg"
        elif [ -z "$prompt"   ]; then prompt="$arg"
        elif [ -z "$in_path"  ]; then in_path="$arg"
        else imagen_usage
        fi
        ;;
    esac
  done

  if [ -z "$out_path" ] || [ -z "$prompt" ]; then
    imagen_usage
  fi

  if [ -n "$size" ] && ! [[ "$size" =~ ^[0-9]+x[0-9]+$ ]]; then
    imagen_log "invalid --size format: $size (expected WxH)"
    exit 2
  fi

  if [ -n "$in_path" ] && [ ! -f "$in_path" ]; then
    imagen_log "input image not found: $in_path"
    exit 1
  fi

  mkdir -p "$(dirname "$out_path")"

  target_w=""
  target_h=""
  size_hint=""
  if [ -n "$size" ]; then
    target_w="${size%x*}"
    target_h="${size#*x}"
    size_hint=" 画像サイズは${target_w}x${target_h}ピクセル以上、縦横比${target_w}:${target_h}で生成してください。"
  fi
}

# timeout / gtimeout (homebrew coreutils) を探す。どちらも無ければ空文字。
imagen_timeout_bin() {
  if   command -v timeout  >/dev/null 2>&1; then echo "timeout"
  elif command -v gtimeout >/dev/null 2>&1; then echo "gtimeout"
  else echo ""
  fi
}

# --size 指定時: scale-to-cover + center-crop でリサイズ
# 元画像が目標より小さければ non-zero で返す（呼び出し側でリトライ判定）
imagen_resize_cover_crop() {
  local path="$1" tw="$2" th="$3"
  local src_w src_h
  # || true: pipefail 下で sips が失敗しても代入自体は成功させ、下の空判定 → return 1
  # (= 呼び出し側でリトライ) に必ず到達させる。bare 呼び出しでも set -e で落ちない
  src_w=$(sips -g pixelWidth "$path" 2>/dev/null | awk '/pixelWidth/{print $2}' || true)
  src_h=$(sips -g pixelHeight "$path" 2>/dev/null | awk '/pixelHeight/{print $2}' || true)
  if [ -z "$src_w" ] || [ -z "$src_h" ]; then
    imagen_log "cannot read image dimensions: $path"
    return 1
  fi
  if [ "$src_w" -lt "$tw" ] || [ "$src_h" -lt "$th" ]; then
    imagen_log "source ${src_w}x${src_h} smaller than target ${tw}x${th}"
    return 1
  fi
  # scale-to-cover: 最小辺が target を覆うようにスケール
  local new_w new_h
  read -r new_w new_h < <(awk -v tw="$tw" -v th="$th" -v sw="$src_w" -v sh="$src_h" 'BEGIN {
    a=tw/sw; b=th/sh; s=(a>b ? a : b);
    printf "%d %d\n", int(sw*s+0.5), int(sh*s+0.5)
  }')
  sips --resampleHeightWidth "$new_h" "$new_w" "$path" --out "$path" >/dev/null 2>&1 || return 1
  sips -c "$th" "$tw" "$path" --out "$path" >/dev/null 2>&1 || return 1
  return 0
}

# --size 指定があればリサイズする。sips が無い環境は警告してスキップ (成功扱い)。
imagen_resize_if_needed() {
  [ -n "$size" ] || return 0
  if ! command -v sips >/dev/null 2>&1; then
    imagen_log "warning: sips not found, skipping resize to $size"
    return 0
  fi
  imagen_resize_cover_crop "$out_path" "$target_w" "$target_h"
}

# 成功時の契約: 生成画像の絶対パスを stdout に 1 行だけ出す
imagen_print_result() {
  echo "$(cd "$(dirname "$out_path")" && pwd)/$(basename "$out_path")"
}

# --- verdict (プロバイダごとの結末) ---------------------------------------
# 失敗が「PNG が出なかった」に潰れると、呼び出し元の pipeline は理由を通知できない
# (2026-08-20: codex 枯渇 → agy も枯渇、を Asana 通知から読み取れなかった)。
# 各プロバイダが自分の結末を JSON 1 行で $IMAGEN_VERDICT_FILE に積み、
# 集約役 (= 最初に init したスクリプト) が最後に IMAGEN_RESULT 1 行にまとめて stderr へ出す。
#
# 契約 (呼び出し元が読む):
#   [<tag>] IMAGEN_RESULT {"status":"failed","out":"<path>","providers":[{...},{...}]}
#   providers[].status = ok | failed | skipped
#   providers[].reason (status=failed) = usage_limit | quota_exhausted | rate_limit | auth_expired
#                      | content_policy | timeout | no_image (出力はあったが PNG 無し)
#                      | unknown (証拠が取れなかった)
#   providers[].reason (status=skipped) = disabled | misconfigured | script_not_found | not_installed
#   providers[].retry_epoch (任意) = 復帰見込み epoch 秒
#
# 消費側は「status=skipped は試していない」として扱うこと (失敗として数えると、
# 実際に試したプロバイダの判定が歪む)。

_imagen_verdict_owner=0
_imagen_tmp_files=""

# 一時ファイルの回収は 1 つの EXIT trap に集約する。各スクリプトが直に trap を張ると
# 後から張った側が黙って上書きし、片方が消えずに /tmp へ溜まる (非対称が事故になる)。
imagen_cleanup() {
  local f
  for f in $_imagen_tmp_files; do
    [ -n "$f" ] && rm -f "$f"
  done
  _imagen_tmp_files=""
}

# imagen_tmp_register <path> — 終了時に消す一時ファイルを登録する
imagen_tmp_register() {
  _imagen_tmp_files="${_imagen_tmp_files} $1"
  # shellcheck disable=SC2064
  trap imagen_cleanup EXIT
}

imagen_verdict_init() {
  if [ -n "${IMAGEN_VERDICT_FILE:-}" ]; then
    _imagen_verdict_owner=0   # 上位 (codex-imagen.sh) が集約する。積むだけ
    return 0
  fi
  IMAGEN_VERDICT_FILE="$(mktemp -t imagen-verdict.XXXXXX)"
  export IMAGEN_VERDICT_FILE
  _imagen_verdict_owner=1
  # set -e 中断 / SIGTERM / 外側 timeout で finish に到達しなくても消えるようにする
  imagen_tmp_register "$IMAGEN_VERDICT_FILE"
}

# imagen_verdict <provider> <ok|failed> [<logfile>]
imagen_verdict() {
  local provider="$1" status="$2" logfile="${3:-}" line=""
  [ -n "${IMAGEN_VERDICT_FILE:-}" ] || return 0
  if command -v python3 >/dev/null 2>&1; then
    line="$(python3 "$IMAGEN_LIB_DIR/imagen-verdict.py" "$provider" "$status" "$logfile" 2>/dev/null || true)"
  fi
  [ -n "$line" ] || line="{\"name\":\"${provider}\",\"status\":\"${status}\",\"reason\":\"unknown\"}"
  printf '%s\n' "$line" >>"$IMAGEN_VERDICT_FILE"
}

# imagen_verdict_raw <provider> <status> <reason> — 分類不要のとき (skipped 等) に直接積む
imagen_verdict_raw() {
  [ -n "${IMAGEN_VERDICT_FILE:-}" ] || return 0
  printf '{"name":"%s","status":"%s","reason":"%s"}\n' "$1" "$2" "$3" >>"$IMAGEN_VERDICT_FILE"
}

# imagen_verdict_finish <ok|failed> — 集約役だけが IMAGEN_RESULT を出す
imagen_verdict_finish() {
  local status="$1"
  [ "${_imagen_verdict_owner}" = "1" ] || return 0
  [ -n "${IMAGEN_VERDICT_FILE:-}" ] || return 0
  local out_abs summary=""
  out_abs="$(cd "$(dirname "$out_path")" 2>/dev/null && pwd)/$(basename "$out_path")"
  if command -v python3 >/dev/null 2>&1; then
    summary="$(python3 -c '
import json, sys
providers = []
try:
    with open(sys.argv[3], encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    providers.append(json.loads(line))
                except ValueError:
                    pass
except OSError:
    pass
print(json.dumps({"status": sys.argv[1], "out": sys.argv[2], "providers": providers},
                 ensure_ascii=False, separators=(",", ":")))
' "$status" "$out_abs" "$IMAGEN_VERDICT_FILE" 2>/dev/null || true)"
  fi
  [ -n "$summary" ] || summary="{\"status\":\"${status}\",\"out\":\"${out_abs}\",\"providers\":[]}"
  imagen_log "IMAGEN_RESULT ${summary}"
  rm -f "$IMAGEN_VERDICT_FILE"
}
