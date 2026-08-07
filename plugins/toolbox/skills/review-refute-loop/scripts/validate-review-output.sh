#!/usr/bin/env bash
set -euo pipefail

[[ $# -eq 1 && -f "$1" ]] || {
  echo "Usage: validate-review-output.sh <output-file>" >&2
  exit 2
}

awk '
  function reset_fields() {
    has_target = has_severity = has_claim = has_evidence = 0
  }

  function finish_finding() {
    if (in_finding && !(has_target && has_severity && has_claim && has_evidence)) {
      invalid = 1
    }
  }

  BEGIN {
    in_finding = finding_count = no_findings = invalid = outside = 0
    reset_fields()
  }

  {
    line = $0
    sub(/\r$/, "", line)

    if (line ~ /^[[:space:]]*$/) next

    if (line ~ /^[[:space:]]*No findings[.。]?[[:space:]]*$/) {
      no_findings++
      next
    }

    if (line ~ /^[[:space:]]*#{2,4}[[:space:]]*指摘[[:space:]]*[0-9]+[[:space:]]*$/) {
      finish_finding()
      finding_count++
      in_finding = 1
      reset_fields()
      next
    }

    if (!in_finding) {
      # No-findings responses may state what remained unreviewed, but may not
      # contain arbitrary prose that could hide an execution failure.
      if (no_findings == 1 && line ~ /^[[:space:]]*未確認範囲[：:]/) next
      outside = 1
      next
    }

    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*対象\*\*:[[:space:]]*[^[:space:]]/) has_target = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*severity\*\*:[[:space:]]*(critical|high|medium|low|nit)[[:space:]]*$/) has_severity = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*claim\*\*:[[:space:]]*[^[:space:]]/) has_claim = 1
    if (line ~ /^[[:space:]]*-[[:space:]]*\*\*evidence\*\*:[[:space:]]*[^[:space:]]/) has_evidence = 1
  }

  END {
    finish_finding()

    if (no_findings == 1 && finding_count == 0 && !outside && !invalid) exit 0
    if (finding_count > 0 && no_findings == 0 && !outside && !invalid) exit 0
    exit 1
  }
' "$1"
