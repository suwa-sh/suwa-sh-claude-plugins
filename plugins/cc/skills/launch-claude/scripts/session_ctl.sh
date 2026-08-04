#!/usr/bin/env bash
# Control Claude Code sessions that are already running in Ghostty panes.
#
#   session_ctl.sh list
#   session_ctl.sh send   <target> <text...>
#   session_ctl.sh remote <target>
#
# <target> is a Ghostty terminal id (from `list`) or a case-insensitive
# substring of the pane name. An ambiguous or unknown target is an error.
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
usage:
  session_ctl.sh list                     list Ghostty panes as "ID | NAME | CWD"
  session_ctl.sh resolve <target>         print the id <target> resolves to (sends nothing)
  session_ctl.sh send   <target> <text>   paste <text> into the pane, then press enter
  session_ctl.sh remote <target>          send "/remote-control" (toggles Remote Control)

<target>: terminal id, or case-insensitive substring of the pane name.
USAGE
  exit 2
}

list_panes() {
  osascript <<'APPLESCRIPT'
set out to ""
tell application "Ghostty"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in terminals of t
        set out to out & (id of s) & " | " & (name of s) & " | " & (working directory of s) & linefeed
      end repeat
    end repeat
  end repeat
end tell
return out
APPLESCRIPT
}

# Resolve <target> to exactly one terminal id, or exit non-zero with a message.
resolve_target() {
  local target="$1" panes matches count
  panes="$(list_panes)"

  # exact id match wins
  if printf '%s\n' "$panes" | grep -qiF -- "$target | "; then
    printf '%s\n' "$panes" | grep -iF -- "$target | " | head -1 | cut -d'|' -f1 | tr -d ' '
    return 0
  fi

  matches="$(printf '%s\n' "$panes" | grep -iF -- "$target" || true)"
  count="$(printf '%s' "$matches" | grep -c . || true)"

  if [[ "$count" -eq 0 ]]; then
    echo "ERROR: no Ghostty pane matches '$target'. Run 'session_ctl.sh list'." >&2
    return 1
  fi
  if [[ "$count" -gt 1 ]]; then
    echo "ERROR: '$target' matches ${count} panes — narrow it down or use the id:" >&2
    printf '%s\n' "$matches" >&2
    return 1
  fi
  printf '%s\n' "$matches" | cut -d'|' -f1 | tr -d ' '
}

send_text() {
  local term_id="$1" text="$2"
  osascript - "$term_id" "$text" <<'APPLESCRIPT'
on run argv
  set targetId to item 1 of argv
  set theText to item 2 of argv
  tell application "Ghostty"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in terminals of t
          if (id of s) is targetId then
            input text theText to s
            delay 0.3
            send key "enter" to s
            return "sent to " & (name of s)
          end if
        end repeat
      end repeat
    end repeat
  end tell
  error "terminal not found: " & targetId
end run
APPLESCRIPT
}

cmd="${1:-}"
case "$cmd" in
  list)
    list_panes
    ;;
  resolve)
    [[ $# -eq 2 ]] || usage
    resolve_target "$2"
    ;;
  send)
    [[ $# -ge 3 ]] || usage
    target="$2"; shift 2
    term_id="$(resolve_target "$target")"
    send_text "$term_id" "$*"
    ;;
  remote)
    [[ $# -eq 2 ]] || usage
    term_id="$(resolve_target "$2")"
    send_text "$term_id" "/remote-control"
    ;;
  *)
    usage
    ;;
esac
