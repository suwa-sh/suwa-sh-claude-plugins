#!/usr/bin/env bash
set -euo pipefail

[[ $# -eq 1 && -f "$1" ]] || {
  echo "Usage: validate-review-output.sh <output-file>" >&2
  exit 2
}

awk '
  function reset_fields() {
    has_perspective = has_target = has_severity = has_claim = has_evidence = has_why = 0
  }

  function finish_finding() {
    if (in_finding && !(has_perspective && has_target && has_severity && has_claim && has_evidence && has_why)) {
      invalid = 1
    }
  }

  # 見出し装飾を剥がして素の見出し語を取り出す
  # ("## below-threshold" / "**(3) below-threshold**" → "below-threshold")
  function heading_text(s) {
    sub(/^[[:space:]]*#+[[:space:]]*/, "", s)
    gsub(/\*\*/, "", s)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
    sub(/^\([0-9]\)[[:space:]]*/, "", s)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
    return tolower(s)
  }

  # 表のセルを取り出し、意味を変えない装飾 (** ` *) を落として正規化する
  function cell(s) {
    gsub(/[*`]/, "", s)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
    return s
  }

  BEGIN {
    in_finding = in_fence = finding_count = no_findings = invalid = summary_rows = 0
    fence_ch = ""; fence_len = 0
    reset_fields()
  }

  {
    line = $0
    sub(/\r$/, "", line)

    # コードフェンス内は「出力例」なので契約の判定材料にしない。
    # 開始フェンスの文字種と長さを覚え、対応する閉じフェンスだけで解除する
    # (``` を含む例を ```` で囲む Markdown が壊れないようにするため)。
    if (match(line, /^[[:space:]]{0,3}(`{3,}|~{3,})/)) {
      marker = substr(line, RSTART, RLENGTH)
      gsub(/^[[:space:]]+/, "", marker)
      ch = substr(marker, 1, 1)
      len = length(marker)
      if (!in_fence) {
        in_fence = 1; fence_ch = ch; fence_len = len
      } else if (ch == fence_ch && len >= fence_len) {
        in_fence = 0
      }
      next
    }
    if (in_fence) next

    if (line ~ /^[[:space:]]*$/) next

    # companion の result 出力が末尾に付けるトレイラー行は契約外の散文として扱わない
    if (line ~ /^[[:space:]]*Codex session ID:[[:space:]]*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[[:space:]]*$/) next
    if (line ~ /^[[:space:]]*Resume in Codex:[[:space:]]*codex resume[[:space:]]+[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[[:space:]]*$/) next

    # (1) 観点サマリ表の行。
    # 「先頭セルが観点 ID (P<数字>)」「判定セルが独立して存在」「3 セル以上」を全て満たす行だけを数える。
    # 「| 1 | read target | FAIL |」のような別表を観点サマリと誤認しないための条件。
    if (line ~ /^[[:space:]]{0,3}\|/) {
      cells = split(line, cell_a, "|")
      if (cells >= 5 && cell(cell_a[2]) ~ /^P[0-9]+$/) {
        verdict = 0
        for (i = 2; i <= cells; i++) {
          if (cell(cell_a[i]) ~ /^(PASS|CONCERN|FAIL|UNCHECKED)$/) verdict = 1
        }
        if (verdict) { summary_rows++; next }
      }
    }

    # (3) below-threshold ブロックの開始。
    # 見出し行のみを節の切り替えとみなす。
    # 4 space 以上のインデント (= コードブロック) は本文の引用なので状態を変えない。
    if (line !~ /^[[:space:]]{4,}/ && heading_text(line) == "below-threshold") {
      finish_finding()
      in_finding = 0
      reset_fields()
      next
    }

    if (line ~ /^[[:space:]]*#{2,4}[[:space:]]*指摘[[:space:]]*[0-9]+[[:space:]]*$/) {
      finish_finding()
      finding_count++
      in_finding = 1
      reset_fields()
      next
    }

    # 指摘の有無にかかわらず数える (指摘の後に置かれた混在も検出するため)
    if (line ~ /^[[:space:]]*No findings[.。]?[[:space:]]*$/) {
      no_findings++
      next
    }

    if (!in_finding) next

    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*perspective\*\*:[[:space:]]*[^[:space:]]/) has_perspective = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*対象\*\*:[[:space:]]*[^[:space:]]/) has_target = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*severity\*\*:[[:space:]]*(critical|high|medium|low|nit)[[:space:]]*$/) has_severity = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*claim\*\*:[[:space:]]*[^[:space:]]/) has_claim = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*evidence\*\*:[[:space:]]*[^[:space:]]/) has_evidence = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*why_raised\*\*:[[:space:]]*[^[:space:]]/) has_why = 1
  }

  END {
    finish_finding()

    # 観点サマリ表は指摘の有無にかかわらず必須。
    # レビューが実行できていない場合の出力 (エラー文・空応答) をここで弾く。
    if (summary_rows < 1) exit 1
    if (invalid) exit 1
    if (no_findings > 0 && finding_count == 0) exit 0
    if (finding_count > 0 && no_findings == 0) exit 0
    exit 1
  }
' "$1"
