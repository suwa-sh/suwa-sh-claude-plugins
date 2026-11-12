#!/usr/bin/env bash
# test_hook.sh — pre-tool-policy.sh の単体テスト (fixture 駆動、LLM 不要)。
# usage: test_hook.sh [<hook-script>]   既定はテンプレートの pre-tool-policy.sh
#
# fixture 名の規則:
#   deny-xxx.json  → exit 2 を期待する。stdout に全製品向けの拒否 JSON が出ることも確かめる
#   allow-xxx.json → exit 0 を期待する
#   名前に -with-log を含む → 受け入れテストと同じく MID_HARNESS_HOOK_LOG を付けて実行する (番兵の検査用)
# 検査を足したら、その検査の deny- / allow- fixture も足す。
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="${1:-$HERE/../templates/tree/scripts/agent-hooks/pre-tool-policy.sh}"
FIX="$HERE/hook-fixtures"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fail=0
for f in "$FIX"/*.json; do
  name="$(basename "$f" .json)"
  want="${name%%-*}"
  case "$want" in deny) want=2;; allow) want=0;; *) echo "bad fixture name: $name"; fail=1; continue;; esac
  case "$name" in
    *-with-log*) MID_HARNESS_HOOK_LOG="$TMP/log" bash "$HOOK" < "$f" > "$TMP/out" 2>/dev/null; got=$? ;;
    *) env -u MID_HARNESS_HOOK_LOG bash "$HOOK" < "$f" > "$TMP/out" 2>/dev/null; got=$? ;;
  esac
  note=""
  if [ "$want" = 2 ] && [ "$got" = 2 ]; then
    python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["decision"]=="deny" and d["permissionDecision"]=="deny" and d["permission"]=="deny"' "$TMP/out" 2>/dev/null \
      || { got="2(stdout-json-ng)"; note=" stdout の拒否 JSON が不正"; }
  fi
  if [ "$got" = "$want" ]; then printf 'pass  %-40s exit=%s\n' "$name" "$got"
  else printf 'FAIL  %-40s want=%s got=%s%s\n' "$name" "$want" "$got" "$note"; fail=1; fi
done
exit $fail
