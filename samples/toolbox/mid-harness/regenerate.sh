#!/usr/bin/env bash
# regenerate.sh — このサンプル (init-output/) を現在の toolbox:mid-harness で作り直し、drift を検査する。
#
#   bash samples/toolbox/mid-harness/regenerate.sh          # 再生成して init-output/ を上書き
#   bash samples/toolbox/mid-harness/regenerate.sh --check  # 再生成結果と init-output/ を比較 (差分があれば exit 1)
#
# 正本は plugins/toolbox/skills/mid-harness/ (templates + scripts)。サンプルは常にそこから導出する。
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# 正本の skill ディレクトリ。リポ外へコピーして使うときは MID_HARNESS_SKILL_DIR で上書きする
SKILL="${MID_HARNESS_SKILL_DIR:-$HERE/../../../plugins/toolbox/skills/mid-harness}"
S="$SKILL/scripts"
[ -f "$S/scaffold.py" ] || { echo "skill scripts not found: $S (set MID_HARNESS_SKILL_DIR)" >&2; exit 2; }
TARGETS="claude-code,codex,cursor,grok,copilot,antigravity"

W="$(mktemp -d "${TMPDIR:-/tmp}/mid-harness-sample.XXXXXX")"
trap 'rm -rf "$W"' EXIT
git -C "$W" init -q
python3 "$S/scaffold.py" "$W" --targets "$TARGETS" > "$W.scaffold.log"
python3 "$S/gen_adapters.py" "$W" > "$W.gen.log"
python3 "$S/check_drift.py" "$W" > "$W.drift.log"

if [ "${1:-}" = "--check" ]; then
  # skill_version は plugin.json 由来 (リポ外コピーでは "dev" になる) なので比較から除く
  if diff -r --exclude .git -I '^skill_version:' "$W" "$HERE/init-output" >/dev/null; then
    echo "sample is up to date"
  else
    echo "sample drifted from current templates/scripts. run: bash $0" >&2
    diff -r --exclude .git -I '^skill_version:' "$W" "$HERE/init-output" | head -40 >&2
    exit 1
  fi
else
  rm -rf "$HERE/init-output"
  rsync -a --exclude .git "$W/" "$HERE/init-output/"
  mkdir -p "$HERE/logs"
  sed "s|$W|<repo>|g" "$W.scaffold.log" > "$HERE/logs/01-scaffold.log"
  sed "s|$W|<repo>|g" "$W.gen.log" > "$HERE/logs/02-gen_adapters.log"
  sed "s|$W|<repo>|g" "$W.drift.log" > "$HERE/logs/03-check_drift.log"
  echo "regenerated: $HERE/init-output ($(find "$HERE/init-output" -type f | wc -l | tr -d ' ') files)"
fi
rm -f "$W.scaffold.log" "$W.gen.log" "$W.drift.log"
