#!/usr/bin/env bash
# codex-imagen.sh — Codex CLI の組み込み imagegen スキルで画像を生成する (既定のプロバイダ)。
#
#   codex-imagen.sh <output_path> <prompt> [<input_image>] [--size=<WxH>]
#
# codex 側が usage limit / rate limit で尽きたときは、同じ引数のまま
# grok-imagen.sh、agy-imagen.sh の順にフォールバックする。
# 引数契約・--size のリサイズ・出力パスの扱いは lib/imagen-common.sh が正本。
set -euo pipefail

IMAGEN_TAG="codex-imagen"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/imagen-common.sh
. "$SCRIPT_DIR/lib/imagen-common.sh"

# out_path / prompt / in_path / size / target_w / target_h / size_hint を設定する
imagen_parse_args "$@"

# --- ハウスキープ (全経路一元管理): codex 中間出力 generated_images の古い dir を削除 ---
# codex は指定 out_path でなく ~/.codex/generated_images/<uuid>/ig_*.png に書き出し、本スクリプトが
# そこから cp で out_path に取り込む (move でないため中間物が溜まりっぱなしになる)。
# 本スクリプトは全経路 (backfill / pipeline / pinterest / youtube サムネ等) の唯一の入口なので、
# ここに置けばハウスキープが一元化される。実行ごとに保持期間を超えた dir を best-effort で掃除する。
#   - CODEX_IMAGEN_KEEP_DAYS=<日数> で保持期間 (default 7)。0 で無効化。
#   - -mtime +N は「N 日より古い」= 稼働中 run が harvest する直近 dir (数分前) は対象外 → 並行実行でも安全。
#   - 並行 run が同じ古い dir を同時 rm しても害なし (一方が消すだけ)。失敗しても本処理は止めない。
_gi_dir="${HOME}/.codex/generated_images"
_gi_keep="${CODEX_IMAGEN_KEEP_DAYS:-7}"
if [ -d "$_gi_dir" ] && [ "${_gi_keep:-0}" -gt 0 ] 2>/dev/null; then
  find "$_gi_dir" -mindepth 1 -maxdepth 1 -type d -mtime +"$_gi_keep" -exec rm -rf {} + 2>/dev/null || true
fi

# 使うスキルを名前で固定する。旧文言「imagenスキルで」は組み込みスキル名 imagegen と 1 文字違いで、
# Codex が「imagen = Google Imagen」と読み違えて gemini-image スキルを選び、Chrome を画面操作して
# Gemini で生成した実例がある (2026-10-04)。道具側の遮断は run_codex の features.plugins=false。
_imagen_guard="gemini-image など他の画像スキル、ブラウザ操作、画面操作は使わないこと。"
if [ -n "$in_path" ]; then
  codex_prompt="Codex 組み込みの imagegen スキル (built-in の image_gen ツール) で画像を編集します。${_imagen_guard}入力画像: $in_path  出力ファイルパス: $out_path  $prompt$size_hint"
else
  codex_prompt="Codex 組み込みの imagegen スキル (built-in の image_gen ツール) で画像を生成します。${_imagen_guard}出力ファイルパス: $out_path  $prompt$size_hint"
fi

# --- 並列実行セーフ (thread_id で自分の出力を一意特定) ---
# codex は画像を ~/.codex/generated_images/<thread_id>/ig_*.png に書き出す。
# codex exec --json の先頭イベント thread.started の thread_id がこの dir 名と一致するため、
# 各 run は自分の thread_id の dir だけを harvest すればよい。他 run の PNG を拾う余地が無く、
# 複数の codex-imagen を同時に走らせても干渉しない (= 並列実行できる)。
_codex_thread_id=""

# 失敗理由の分類用に「codex の失敗ログ」を全試行ぶん貯める (人が読むログとは別に分類へ回す)。
# 試行ごとに truncate すると、最後の 1 試行が証拠を残さない失敗 (timeout で stderr 空など) の
# ときに、それ以前に掴んでいた usage limit の証拠まで消える
imagen_verdict_init
_codex_last_log="$(mktemp -t codex-imagen-last.XXXXXX)"
imagen_tmp_register "$_codex_last_log"

# codex exec は単独でも稀にハングする (API ストール等)。timeout が無いと run_codex が返らず
# 外側の Kestra timeout (PT3H) まで詰まる。timeout/gtimeout (homebrew coreutils) で 1回の
# codex exec を CODEX_IMAGEN_TIMEOUT 秒で打ち切り、「PNG 無し → リトライ」経路に確実に到達させる。
# どちらも無い環境では従来通り (timeout なし)。
CODEX_IMAGEN_TIMEOUT="${CODEX_IMAGEN_TIMEOUT:-300}"   # codex exec 1回の上限 (秒)
_timeout_bin="$(imagen_timeout_bin)"

# CODEX_IMAGEN_CODEX_WRAPPER: codex の代わりに実行するラッパー (例: OTel トレーシングラッパー)。
# 呼び出し側 (launcher 等) が環境変数で注入する。未設定・実行不可なら codex を直接呼ぶ。
_codex_cmd=(codex)
if [ -n "${CODEX_IMAGEN_CODEX_WRAPPER:-}" ] && [ -x "${CODEX_IMAGEN_CODEX_WRAPPER}" ]; then
  _codex_cmd=("$CODEX_IMAGEN_CODEX_WRAPPER")
fi

# config.toml に直接書かれた MCP サーバーは features.plugins=false では止まらない。
# 実例: node_repl は画面操作サービス (SKY_CUA_SERVICE_PATH) とブラウザ操作の設定を持つ。
# 画像生成に MCP は不要なので、有効なものを列挙して 1 つずつ enabled=false を渡す。
# 未定義の名前を -c で渡すと "invalid transport" で起動自体が落ちるため、実在するものだけを止める。
# 列挙は codex を 1 回起動するだけで課金は無い。CODEX_IMAGEN_MCP_LIST_TIMEOUT 秒 (default 30) で打ち切る。
# 止める対象を確定できないとき (列挙の失敗・時間切れ・JSON 不正・-c で指定できない名前の有効サーバー) は
# 画面操作の道具が残り得るので Codex 経路を実行せず、フォールバック (grok → agy) へ回す (fail-closed)。
CODEX_IMAGEN_MCP_LIST_TIMEOUT="${CODEX_IMAGEN_MCP_LIST_TIMEOUT:-30}"
_codex_mcp_off=()
_codex_mcp_ok=1
_mcp_list_cmd=("${_codex_cmd[@]}" -c features.plugins=false mcp list --json)
if [ -n "$_timeout_bin" ]; then
  _mcp_list_cmd=("$_timeout_bin" -k 5 "${CODEX_IMAGEN_MCP_LIST_TIMEOUT}s" "${_mcp_list_cmd[@]}")
fi
_mcp_names="$("${_mcp_list_cmd[@]}" 2>/dev/null </dev/null | python3 -c '
import json, re, sys
try:
    servers = json.load(sys.stdin)
except Exception:
    sys.exit(1)
if not isinstance(servers, list):
    sys.exit(1)
for s in servers:
    name = s.get("name") or ""
    if not s.get("enabled"):
        continue
    # -c のキーは「.」で単純分割されるので、安全な文字だけの名前しか止められない
    if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
        sys.exit(2)
    print(name)
' 2>/dev/null)" || {
  imagen_log "WARN: could not list codex MCP servers (or an enabled server name cannot be disabled via -c); skipping codex path"
  _codex_mcp_ok=0
  _mcp_names=""
}
for _mcp_name in $_mcp_names; do
  _codex_mcp_off+=(-c "mcp_servers.${_mcp_name}.enabled=false")
done

run_codex() {
  local codex_cmd=("${_codex_cmd[@]}")
  # --json: stdout に JSONL イベントを出す。先頭の thread.started から thread_id を取り、
  # 自分の生成画像 dir (~/.codex/generated_images/<thread_id>/) を一意に特定する。
  local json_out err_out rc=0
  json_out="$(mktemp -t codex-imagen-json.XXXXXX)"
  err_out="$(mktemp -t codex-imagen-err.XXXXXX)"
  # --skip-git-repo-check: cwd が git repo でないと codex は
  #   "Not inside a trusted directory and --skip-git-repo-check was not specified" で
  #   起動を拒否する。Kestra の Process runner は実行ごとの temp dir を cwd にするため、
  #   これを付けないと自動実行から呼んだ画像生成が必ず失敗する (2026-07-28 実測)。
  # </dev/null: 付けないと codex が "Reading additional input from stdin..." で
  #   呼び出し元の stdin を読みに行く (非対話実行では停止要因になる)。
  # -c features.plugins=false: プラグイン由来の MCP サーバー (画面操作の cua_repl、ブラウザ等) を
  #   読み込ませない。画像生成は組み込み image_gen だけで足りる (2026-10-04 実測: 画面操作の道具 0 件、
  #   生成は成功)。注意: `-c 'plugins."<名前>".enabled=false'` は効かない。Codex の -c は
  #   キーを「.」で単純分割し引用符を外さないため、別の無効なキーとして書き込まれる。
  # _codex_mcp_off: config.toml 直書きの MCP サーバーを止める (上の列挙参照)。bash 3.2 の
  #   set -u は空配列の展開を unbound にするので ${a[@]+"${a[@]}"} で展開する。
  local codex_flags=(exec --json --skip-git-repo-check -c features.plugins=false ${_codex_mcp_off[@]+"${_codex_mcp_off[@]}"})
  if [ -n "$_timeout_bin" ]; then
    # -k 10: SIGTERM 後 10 秒で SIGKILL (codex が TERM を無視しても確実に殺す)
    "$_timeout_bin" -k 10 "${CODEX_IMAGEN_TIMEOUT}s" "${codex_cmd[@]}" "${codex_flags[@]}" "$codex_prompt" \
      >"$json_out" 2>"$err_out" </dev/null || rc=$?
  else
    "${codex_cmd[@]}" "${codex_flags[@]}" "$codex_prompt" >"$json_out" 2>"$err_out" </dev/null || rc=$?
  fi
  _codex_thread_id="$(grep -m1 '"type":"thread.started"' "$json_out" 2>/dev/null | sed -n 's/.*"thread_id":"\([^"]*\)".*/\1/p' || true)"
  # 失敗の原因を握り潰さない。stderr を捨てていたため、rate limit / 認証失効 / content
  # policy 拒否がすべて「no PNG」に潰れて診断不能だった (2026-07-28)。
  # さらに 2026-08-20: 人が読むログに出すだけでなく、分類用に失敗ログを保持する。
  if [ "$rc" -ne 0 ] || [ -z "$_codex_thread_id" ]; then
    imagen_log "codex exec rc=${rc} thread_id='${_codex_thread_id}'"
    if [ -s "$err_out" ]; then
      imagen_log "stderr:"
      # 表示は先頭 (起動時のバナー・警告が読みたい)、分類は末尾 (エラーは最後に出る) と
      # ソースを分ける。head だけを分類器へ渡すと usage limit の文言が届かない
      head -c 2000 "$err_out" | sed 's/^/[codex-imagen]   /' >&2
      tail -c 4000 "$err_out" >>"$_codex_last_log"
    fi
    # JSONL 側の error イベントも拾う (stderr が空でも API 側の拒否理由がここに出る)
    grep -o '"type":"[a-z._]*error[a-z._]*"[^}]*' "$json_out" 2>/dev/null | head -3 \
      | tee -a "$_codex_last_log" | sed 's/^/[codex-imagen]   json: /' >&2 || true
  fi
  rm -f "$json_out" "$err_out"
}

# codex は画像を ~/.codex/generated_images/<thread_id>/ 配下に書き出す (指定 out_path には
# 書かないことがある)。run_codex が取得した自分の thread_id の dir から PNG を採取して取り込む。
#
# ファイル名は codex のバージョンで変わる。2026-07-28 実測では `exec-<uuid>.png` (256件) と
# `call_<id>.png` のみで、旧実装が期待していた `ig_*.png` は **1 件も存在しなかった**。
# そのため codex が out_path へ直接書いた回だけ偶然成功し、そうでない回は「no PNG」で
# 全リトライを消費して失敗していた (article-to-explainer-video のサムネ生成が全滅)。
# 名前を決め打ちせず、その thread_id dir 内の PNG を新しい順に採る。
try_generate_and_resize() {
  rm -f "$out_path"
  _codex_thread_id=""
  run_codex   # _codex_thread_id を設定

  # 1. out_path に直接書かれていればそれを使う
  if [ ! -f "$out_path" ]; then
    # 2. 自分の thread_id の dir から PNG を採る。codex exec が return しても PNG の flush が
    #    遅延することがあるため最大 30 秒 (5 秒間隔) ポーリングする。
    if [ -z "$_codex_thread_id" ]; then
      return 1   # thread_id が取れない = codex 失敗 → 呼び出し側でリトライ
    fi
    local found="" i=0
    while [ $i -lt 6 ]; do
      found=$(ls -t "$HOME/.codex/generated_images/$_codex_thread_id"/*.png 2>/dev/null | head -1)
      if [ -n "$found" ] && [ -f "$found" ]; then
        break
      fi
      sleep 5
      i=$((i + 1))
    done
    if [ -z "$found" ] || [ ! -f "$found" ]; then
      # 分類器に「出力はあったが PNG が出なかった」を伝える。書かないと証拠ゼロ = unknown となり、
      # routine な no-PNG と「分類器へログが届いていない配線ミス」を区別できなくなる
      echo "no png produced in generated_images/${_codex_thread_id} after 30s" >>"$_codex_last_log"
      return 1  # 30 秒待っても PNG が出ない → 呼び出し側でリトライ
    fi
    cp "$found" "$out_path"
  fi

  # size 拒否も分類器へ残す (PNG は出たが契約サイズに満たない = 引き直しで直る類)
  imagen_resize_if_needed || { echo "resize rejected (source smaller than target)" >>"$_codex_last_log"; return 1; }
  return 0
}

# --size 指定時、codex が目標未満のサイズを返すと resize が拒否して失敗する。
# これは codex 側の出力サイズの当たり外れ (実行ごとに揺れる) なので、同一 invocation 内で
# 複数回リトライすることで「外れ」を引き直す。CODEX_IMAGEN_MAX_ATTEMPTS で上限を制御
# (default 4: --size 用途で 1 回の pipeline run 内に十分な引き直し回数を確保する)。
# 1 回あたり最大 CODEX_IMAGEN_TIMEOUT(300s) + sleep 10s なので最悪 ~20 分 (pinterest-image.md の想定内)。
CODEX_IMAGEN_MAX_ATTEMPTS="${CODEX_IMAGEN_MAX_ATTEMPTS:-4}"

run_codex_attempts() {
  local attempt=1
  while ! try_generate_and_resize; do
    if [ "$attempt" -ge "$CODEX_IMAGEN_MAX_ATTEMPTS" ]; then
      imagen_log "codex path failed (after ${attempt} attempts)"
      return 1
    fi
    imagen_log "attempt ${attempt}/${CODEX_IMAGEN_MAX_ATTEMPTS} failed (no PNG or size-reject), retrying after 10s..."
    sleep 10
    attempt=$((attempt + 1))
  done
  return 0
}

# --- フォールバック: 同じ引数のまま別プロバイダのスクリプトへ委譲 ---
# codex は usage limit で数時間〜1 日単位で止まることがあり、その間は何回リトライしても出ない。
# 画像生成に依存する pipeline (YouTube サムネ / Shorts ページ / Pinterest pin) が片方の
# クォータ枯渇で丸ごと止まらないよう、grok、agy の順で退避する。
#   CODEX_IMAGEN_FALLBACKS=grok,agy (default) | agy | grok | off
# 旧 CODEX_IMAGEN_FALLBACK も、FALLBACKS が未指定なら互換入力として受け付ける。
CODEX_IMAGEN_FALLBACKS="${CODEX_IMAGEN_FALLBACKS:-${CODEX_IMAGEN_FALLBACK:-grok,agy}}"

run_fallbacks() {
  case "$CODEX_IMAGEN_FALLBACKS" in
    off)
      imagen_log "fallback disabled (CODEX_IMAGEN_FALLBACKS=off)"
      imagen_verdict_raw fallback skipped disabled
      return 1
      ;;
  esac

  local provider fallback_script
  local providers=()
  IFS=',' read -r -a providers <<<"$CODEX_IMAGEN_FALLBACKS"
  for provider in "${providers[@]}"; do
    provider="${provider//[[:space:]]/}"
    case "$provider" in
      grok|agy) ;;
      "") continue ;;
      *)
        imagen_log "unknown fallback provider: '$provider' (expected grok|agy)"
        imagen_verdict_raw "$provider" skipped misconfigured
        continue
        ;;
    esac

    fallback_script="$SCRIPT_DIR/${provider}-imagen.sh"
    if [ ! -f "$fallback_script" ]; then
      imagen_log "fallback script not found: $fallback_script"
      imagen_verdict_raw "$provider" skipped script_not_found
      continue
    fi

    imagen_log "switching to fallback: $(basename "$fallback_script")"
    # 引数は受け取ったものをそのまま渡す。失敗したら次の provider へ進む。
    if bash "$fallback_script" "$@"; then
      return 0
    fi
  done
  return 1
}

if [ "$_codex_mcp_ok" -ne 1 ]; then
  # MCP の遮断を確認できないまま Codex を動かさない (冒頭の列挙を参照)
  imagen_verdict_raw codex skipped mcp_unverified
elif run_codex_attempts; then
  imagen_verdict codex ok
  imagen_verdict_finish ok
  imagen_print_result
  exit 0
else
  imagen_verdict codex failed "$_codex_last_log"
fi

# フォールバック側は同じ $IMAGEN_VERDICT_FILE に自分の verdict を試行順で積む
if run_fallbacks "$@"; then
  imagen_verdict_finish ok
  exit 0
fi

imagen_log "failed to generate/resize image at: $out_path (providers=codex,${CODEX_IMAGEN_FALLBACKS})"
imagen_verdict_finish failed
exit 1
