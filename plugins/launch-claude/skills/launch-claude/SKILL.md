---
name: launch-claude
description: Launch a new Claude Code session in a ghq-managed repository via Ghostty split. Use this skill whenever the user wants to "launch claude", "start claude in", "open claude code in", or work on a specific repository in a separate session. Also trigger when the user mentions a repo name to open (e.g., "RDRAAgentで", "pkmを開いて", "sandboxで作業したい", "別セッションで開いて"), or says just a repo keyword expecting a new Claude Code session to be launched there. Supports passing a slash command to auto-execute on launch (e.g., "/launch-claude pkm /deep-research テーマ").
---

# Launch Claude Code in a Repository

Open a new Ghostty split running Claude Code (`--dangerously-skip-permissions`) in a ghq-managed repository. Optionally pass a slash command to auto-execute on launch.

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

### 1. Parse arguments

`$ARGUMENTS` may contain: `<repo-keyword> [/slash-command args...]`

- Extract the repo keyword (everything before the first `/`)
- Extract the optional slash command (everything from the first `/` onward)

Examples:
- `pkm /deep-research ハーネスエンジニアリング` → keyword: `pkm`, slash command: `/deep-research ハーネスエンジニアリング`
- `pkm` → keyword: `pkm`, no slash command
- `rdra agent /tech-dr テーマ` → keyword: `rdra agent`, slash command: `/tech-dr テーマ`

### 2. Find the repository

Run `ghq list -p | grep -i <keyword>` using the keyword extracted in step 1.

If the user specifies an absolute path (starts with `/` or `~`) instead of a keyword, use that path directly without ghq lookup. Create the directory with `mkdir -p` if it doesn't exist.

### 3. Handle matches

- **No matches**: Tell the user no repository was found and suggest they check the keyword or run `ghq list` to browse.
- **Single match**: Proceed to launch immediately (no confirmation needed).
- **Multiple matches**: List all matches with numbers and ask the user to pick one.

### 4. Launch

Use AppleScript to split the focused terminal in the existing Ghostty window. The new pane opens beside (or below) the currently focused terminal in the front window's selected tab.

- **Session name**: If a slash command is provided, use `<basename>: <slash-command>` (e.g., `pkm: /deep-research ハーネスエンジニアリング`). Otherwise, use just the basename.
- **Initial prompt**: If a slash command is provided, pass it as a positional argument to the `claude` CLI so it auto-executes on startup.
- **Split direction**: Default is `right` (side-by-side). Use `down` / `left` / `up` if the user explicitly requests another direction.

#### With slash command:

```bash
target_dir="<matched_directory>"
base_name="$(basename "$target_dir")"
claude_path="$(command -v claude)"
zsh_path="$(command -v zsh)"
initial_prompt="<slash-command-and-args>"
session_name="${base_name}: ${initial_prompt}"
split_dir="right"  # right | left | down | up

osascript - "$zsh_path" "$target_dir" "$claude_path" "$session_name" "$initial_prompt" "$split_dir" <<'APPLESCRIPT'
on run argv
  set zsh_path to item 1 of argv
  set target_dir to item 2 of argv
  set claude_path to item 3 of argv
  set session_name to item 4 of argv
  set initial_prompt to item 5 of argv
  set split_dir to item 6 of argv
  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set command of cfg to zsh_path & " -l -i -c 'cd " & target_dir & " && exec " & claude_path & " --dangerously-skip-permissions -n \"" & session_name & "\" \"" & initial_prompt & "\"'"
    set currentTerm to focused terminal of selected tab of front window
    if split_dir is "right" then
      set newTerm to split currentTerm direction right with configuration cfg
    else if split_dir is "left" then
      set newTerm to split currentTerm direction left with configuration cfg
    else if split_dir is "down" then
      set newTerm to split currentTerm direction down with configuration cfg
    else
      set newTerm to split currentTerm direction up with configuration cfg
    end if
    focus newTerm
  end tell
end run
APPLESCRIPT
```

#### Without slash command:

```bash
target_dir="<matched_directory>"
session_name="$(basename "$target_dir")"
claude_path="$(command -v claude)"
zsh_path="$(command -v zsh)"
split_dir="right"  # right | left | down | up

osascript - "$zsh_path" "$target_dir" "$claude_path" "$session_name" "$split_dir" <<'APPLESCRIPT'
on run argv
  set zsh_path to item 1 of argv
  set target_dir to item 2 of argv
  set claude_path to item 3 of argv
  set session_name to item 4 of argv
  set split_dir to item 5 of argv
  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set command of cfg to zsh_path & " -l -i -c 'cd " & target_dir & " && exec " & claude_path & " --dangerously-skip-permissions -n " & session_name & "'"
    set currentTerm to focused terminal of selected tab of front window
    if split_dir is "right" then
      set newTerm to split currentTerm direction right with configuration cfg
    else if split_dir is "left" then
      set newTerm to split currentTerm direction left with configuration cfg
    else if split_dir is "down" then
      set newTerm to split currentTerm direction down with configuration cfg
    else
      set newTerm to split currentTerm direction up with configuration cfg
    end if
    focus newTerm
  end tell
end run
APPLESCRIPT
```

Then confirm to the user that a new split has been opened in Ghostty with Claude Code running in the selected repository.

## Notes

- Ghostty must already be running with a focused terminal in the front window (the new pane is split off the focused one)
- The new session opens as a split inside the currently selected tab of the front window
- `ghq list -p` returns full absolute paths, so grep results can be used directly
- The session name appears in Ghostty's pane title and in Claude Code's remote control list, so including the slash command helps identify what each session is doing
- AppleScript reference: <https://ghostty.org/docs/features/applescript> (`split` command)
