#!/usr/bin/env bash
# test_hook.sh — pre-tool-policy.sh の単体テスト (fixture 駆動、LLM 不要)。
# usage: test_hook.sh [<hook-script>]   既定はテンプレートの pre-tool-policy.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="${1:-$HERE/../templates/tree/scripts/agent-hooks/pre-tool-policy.sh}"
FIX="$HERE/hook-fixtures"
fail=0
for f in "$FIX"/*.json; do
  name="$(basename "$f" .json)"
  want="${name%%-*}"          # deny-xxx.json → 2, allow-xxx.json → 0
  case "$want" in deny) want=2;; allow) want=0;; *) echo "bad fixture name: $name"; fail=1; continue;; esac
  bash "$HOOK" < "$f" >/dev/null 2>&1; got=$?
  if [ "$got" = "$want" ]; then printf 'pass  %-32s exit=%s\n' "$name" "$got"
  else printf 'FAIL  %-32s want=%s got=%s\n' "$name" "$want" "$got"; fail=1; fi
done
exit $fail
