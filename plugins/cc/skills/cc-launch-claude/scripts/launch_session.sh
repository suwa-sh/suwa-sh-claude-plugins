#!/usr/bin/env bash
# Open a new Ghostty split running Claude Code in <target-dir>.
#
#   launch_session.sh <target-dir> [--model <alias>] [--agent <name>]
#                                  [--name <session-name>] [--split right|left|down|up]
#                                  [--prompt <slash-command...>] [--dry-run]
#
# The session name defaults to "<basename>[ [agent/model]][: <prompt>]".
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
usage: launch_session.sh <target-dir> [options]

  --model <alias>    claude --model (fable | opus | sonnet | full name)
  --agent <name>     claude --agent (marketer | journaler | maintainer | ...)
  --name <name>      override the session display name
  --split <dir>      right (default) | left | down | up
  --prompt <text>    slash command to auto-execute on startup
  --dry-run          print the shell command that would run, and exit
USAGE
  exit 2
}

[[ $# -ge 1 ]] || usage
target_dir="$1"; shift

model="" agent="" name="" split_dir="right" prompt="" dry_run=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)   model="${2:-}"; shift 2 ;;
    --agent)   agent="${2:-}"; shift 2 ;;
    --name)    name="${2:-}"; shift 2 ;;
    --split)   split_dir="${2:-}"; shift 2 ;;
    --prompt)  prompt="${2:-}"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) echo "ERROR: unknown option '$1'" >&2; usage ;;
  esac
done

[[ -d "$target_dir" ]] || { echo "ERROR: not a directory: $target_dir" >&2; exit 1; }
case "$split_dir" in right|left|down|up) ;; *) echo "ERROR: bad --split '$split_dir'" >&2; usage ;; esac

claude_path="$(command -v claude)" || { echo "ERROR: claude not found in PATH" >&2; exit 1; }
zsh_path="$(command -v zsh)"       || { echo "ERROR: zsh not found in PATH" >&2; exit 1; }

# Default session name: basename + [agent/model] + ": prompt"
if [[ -z "$name" ]]; then
  name="$(basename "$target_dir")"
  if   [[ -n "$agent" && -n "$model" ]]; then name="$name [${agent}/${model}]"
  elif [[ -n "$agent" ]];                then name="$name [${agent}]"
  elif [[ -n "$model" ]];                then name="$name [${model}]"
  fi
  [[ -n "$prompt" ]] && name="$name: $prompt"
fi

flags=""
[[ -n "$model" ]] && flags="$flags --model $model"
[[ -n "$agent" ]] && flags="$flags --agent $agent"

# Escape for a double-quoted context inside the zsh -c string
# (backslash first, then the characters zsh still expands inside double quotes).
esc_dq() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\$/\\$/g; s/`/\\`/g'; }
# Wrap in single quotes for the zsh -c argument.
sq() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }

inner="cd \"$(esc_dq "$target_dir")\" && exec \"$(esc_dq "$claude_path")\" --dangerously-skip-permissions${flags} -n \"$(esc_dq "$name")\""
[[ -n "$prompt" ]] && inner="$inner \"$(esc_dq "$prompt")\""

cmd="$zsh_path -l -i -c $(sq "$inner")"

if [[ $dry_run -eq 1 ]]; then
  printf '%s\n' "$cmd"
  exit 0
fi

osascript - "$cmd" "$split_dir" <<'APPLESCRIPT'
on run argv
  set theCommand to item 1 of argv
  set splitDir to item 2 of argv
  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set command of cfg to theCommand
    set currentTerm to focused terminal of selected tab of front window
    if splitDir is "right" then
      set newTerm to split currentTerm direction right with configuration cfg
    else if splitDir is "left" then
      set newTerm to split currentTerm direction left with configuration cfg
    else if splitDir is "down" then
      set newTerm to split currentTerm direction down with configuration cfg
    else
      set newTerm to split currentTerm direction up with configuration cfg
    end if
    focus newTerm
    return "launched: " & (id of newTerm)
  end tell
end run
APPLESCRIPT
