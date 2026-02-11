#!/bin/bash

# PreCompact hook - Generate HANDOVER.md using claude -p
# SKILL.md のテンプレート + フィルタ済みトランスクリプト → claude -p sonnet

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

input=$(cat)
transcript_path=$(echo "$input" | jq -r '.transcript_path // ""')
cwd=$(echo "$input" | jq -r '.cwd // ""')
cwd="${cwd:-$(pwd)}"

if [ -z "$transcript_path" ] || [ ! -f "$transcript_path" ]; then
  exit 0
fi

SKILL_MD="$PLUGIN_ROOT/skills/handover/SKILL.md"
if [ ! -f "$SKILL_MD" ]; then
  echo "ERROR: SKILL.md not found: $SKILL_MD" >&2
  exit 1
fi

handover_file="$cwd/HANDOVER.md"
filtered_file=$(mktemp)
output_file=$(mktemp)
trap 'rm -f "$filtered_file" "$output_file"' EXIT

# トランスクリプトからテキスト + tool_use のみ抽出（tool_result, thinking, progress 除外）
jq -c '
  if .type == "assistant" then
    {type: .type, content: [.message.content[]? | select(.type == "text" or .type == "tool_use")]}
  elif .type == "user" then
    {type: .type, content: (
      if (.message.content | type) == "string" then .message.content
      elif (.message.content | type) == "array" then
        [.message.content[]? | select(.type == "text") | .text] | join("\n")
      else ""
      end
    )}
  else empty
  end
' "$transcript_path" > "$filtered_file"

if [ ! -s "$filtered_file" ]; then
  exit 0
fi

# SKILL.md からテンプレート抽出 + フィルタ済みトランスクリプトを claude -p に渡す
template=$(sed -n '/^## HANDOVER.md テンプレート/,$ p' "$SKILL_MD" | grep -v '^```')

{
  echo "以下のトランスクリプトから、セッション引き継ぎドキュメントを生成してください。"
  echo ""
  echo "$template"
  echo ""
  echo "## トランスクリプト:"
  cat "$filtered_file"
} | claude -p --model sonnet --no-session-persistence --max-budget-usd 2.00 > "$output_file" 2>/dev/null

# claude -p の SessionStart hook が HANDOVER.md を削除するため、一時ファイル経由でリネーム
if [ ! -s "$output_file" ]; then
  exit 1
fi
mv "$output_file" "$handover_file"
