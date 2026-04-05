---
name: launch-claude
description: Launch a new Claude Code session in a ghq-managed repository via Ghostty tab. Use this skill whenever the user wants to "launch claude", "start claude in", "open claude code in", or work on a specific repository in a separate session. Also trigger when the user mentions a repo name to open (e.g., "RDRAAgentで", "pkmを開いて", "sandboxで作業したい", "別セッションで開いて"), or says just a repo keyword expecting a new Claude Code session to be launched there.
---

# Launch Claude Code in a Repository

Open a new Ghostty tab running Claude Code (`--dangerously-skip-permissions`) in a ghq-managed repository.

## Workflow

### 0. Check dependencies

Run the bundled check script first:

```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
bash "$PLUGIN_ROOT/scripts/check_deps.sh"
```

If the plugin root is not available, fall back to finding the script via the plugin directory:

```bash
bash "$(find ~/.claude/plugins -path '*/launch-claude/scripts/check_deps.sh' 2>/dev/null | head -1)"
```

If any FAIL is reported, stop and tell the user what's missing. If only WARN (e.g., Ghostty not running), inform the user and proceed if they confirm.

### 1. Find the repository

Run `ghq list -p | grep -i <keyword>` using the keyword or repository name the user provided. The keyword comes from `$ARGUMENTS` or from the conversation context.

### 2. Handle matches

- **No matches**: Tell the user no repository was found and suggest they check the keyword or run `ghq list` to browse.
- **Single match**: Proceed to launch immediately (no confirmation needed).
- **Multiple matches**: List all matches with numbers and ask the user to pick one.

### 3. Launch

Use AppleScript to open a new tab in the existing Ghostty window. The session name is the directory's basename.

```bash
target_dir="<matched_directory>"
session_name="$(basename "$target_dir")"
claude_path="$(command -v claude)"
zsh_path="$(command -v zsh)"

osascript - "$zsh_path" "$target_dir" "$claude_path" "$session_name" <<'APPLESCRIPT'
on run argv
  set zsh_path to item 1 of argv
  set target_dir to item 2 of argv
  set claude_path to item 3 of argv
  set session_name to item 4 of argv
  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set command of cfg to zsh_path & " -c 'cd " & target_dir & " && exec " & claude_path & " --dangerously-skip-permissions -n " & session_name & "'"
    set win to window 1
    set t to new tab in win with configuration cfg
  end tell
end run
APPLESCRIPT
```

Then confirm to the user that a new tab has been opened in Ghostty with Claude Code running in the selected repository.

## Notes

- Ghostty must already be running (a window must exist)
- The new session opens as a tab in the existing Ghostty window
- The session name is automatically set to the directory's basename
- `ghq list -p` returns full absolute paths, so grep results can be used directly
