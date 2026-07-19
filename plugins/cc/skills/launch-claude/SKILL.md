---
name: cc:launch-claude
description: Launch a new Claude Code session in a ghq-managed repository via Ghostty split. Use this skill whenever the user wants to "launch claude", "start claude in", "open claude code in", or work on a specific repository in a separate session. Also trigger when the user mentions a repo name to open (e.g., "RDRAAgentで", "pkmを開いて", "sandboxで作業したい", "別セッションで開いて"), or says just a repo keyword expecting a new Claude Code session to be launched there. Supports passing a slash command to auto-execute on launch (e.g., "/cc:launch-claude pkm /deep-research テーマ"), and choosing the model and/or agent persona (e.g., "pkm を fable の marketer で開いて").
---

# Launch Claude Code in a Repository

Open a new Ghostty split running Claude Code (`--dangerously-skip-permissions`) in a ghq-managed repository. Optionally pass a slash command to auto-execute on launch, and optionally choose the model and/or agent persona.

## Workflow

### 0. Check dependencies

Run the bundled check script first. `scripts/` sits next to this `SKILL.md`, so the
same lookup works whether the skill was installed as a Claude Code plugin
(`~/.claude/plugins/...`) or via `npx skills` (`~/.claude/skills/` or `./.claude/skills/`):

```bash
CHECK="$(find ~/.claude ./.claude -path '*/launch-claude/scripts/check_deps.sh' 2>/dev/null | head -1)"
if [ -z "$CHECK" ] || [ ! -f "$CHECK" ]; then
  echo "ERROR: check_deps.sh not found. Reinstall the cc plugin or the cc:launch-claude skill." >&2
  exit 1
fi
bash "$CHECK"
```

If any FAIL is reported, stop and tell the user what's missing. If only WARN (e.g., Ghostty not running), inform the user and proceed if they confirm.

### 1. Parse arguments

`$ARGUMENTS` may contain: `<repo-keyword> [--model <alias>] [--agent <name>] [/slash-command args...]`

- Extract the optional `--model <alias>` and `--agent <name>` flags (they may appear in any order, before the slash command)
  - `--model` accepts a claude model alias (`fable`, `opus`, `sonnet`) or a full model name; passed straight to `claude --model`
  - `--agent` accepts an agent/persona name (e.g., `marketer`, `journaler`, `maintainer`); passed straight to `claude --agent`
- Extract the repo keyword (the remaining words before the first `/` and before any flag)
- Extract the optional slash command (everything from the first `/` onward)

Natural-language requests map to these flags — resolve them before launching:
- "fable の marketer で" → `--model fable --agent marketer`
- "marketer ペルソナで" → `--agent marketer`
- "opus で開いて" → `--model opus`

Examples:
- `pkm /deep-research ハーネスエンジニアリング` → keyword: `pkm`, slash command: `/deep-research ハーネスエンジニアリング`
- `pkm` → keyword: `pkm`, no slash command
- `pkm --model fable --agent marketer` → keyword: `pkm`, model: `fable`, agent: `marketer`, no slash command
- `pkm --agent journaler /journal-review` → keyword: `pkm`, agent: `journaler`, slash command: `/journal-review`
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

- **Extra flags**: Build a `--model <alias>` / `--agent <name>` string from step 1 (empty when neither is given). These are injected into the `claude` invocation.
- **Session name**: Start from the basename, then append a `[agent/model]` suffix when an agent and/or model is set, then append `: <slash-command>` when a slash command is given. Examples: `pkm`, `pkm [marketer/fable]`, `pkm: /deep-research テーマ`, `pkm [journaler]: /journal-review`.
- **Initial prompt**: If a slash command is provided, pass it as a positional argument to the `claude` CLI so it auto-executes on startup.
- **Split direction**: Default is `right` (side-by-side). Use `down` / `left` / `up` if the user explicitly requests another direction.

Build the shared variables first:

```bash
target_dir="<matched_directory>"
base_name="$(basename "$target_dir")"
claude_path="$(command -v claude)"
zsh_path="$(command -v zsh)"
split_dir="right"  # right | left | down | up

# from step 1 (either may be empty)
model="<model-alias-or-empty>"
agent="<agent-name-or-empty>"

extra_flags=""
[ -n "$model" ] && extra_flags="$extra_flags --model $model"
[ -n "$agent" ] && extra_flags="$extra_flags --agent $agent"

# session-name suffix: [agent/model], [agent], or [model]
suffix=""
if [ -n "$agent" ] && [ -n "$model" ]; then suffix=" [${agent}/${model}]";
elif [ -n "$agent" ]; then suffix=" [${agent}]";
elif [ -n "$model" ]; then suffix=" [${model}]"; fi
```

> Note: the AppleScript below is shown as a heredoc for readability. If your Bash tool mangles heredocs, write the `on run argv ... end run` body to a file with the Write tool and call `osascript <file> <args...>` instead.

#### With slash command:

```bash
initial_prompt="<slash-command-and-args>"
session_name="${base_name}${suffix}: ${initial_prompt}"

osascript - "$zsh_path" "$target_dir" "$claude_path" "$session_name" "$extra_flags" "$initial_prompt" "$split_dir" <<'APPLESCRIPT'
on run argv
  set zsh_path to item 1 of argv
  set target_dir to item 2 of argv
  set claude_path to item 3 of argv
  set session_name to item 4 of argv
  set extra_flags to item 5 of argv
  set initial_prompt to item 6 of argv
  set split_dir to item 7 of argv
  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set command of cfg to zsh_path & " -l -i -c 'cd " & target_dir & " && exec " & claude_path & " --dangerously-skip-permissions" & extra_flags & " -n \"" & session_name & "\" \"" & initial_prompt & "\"'"
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
session_name="${base_name}${suffix}"

osascript - "$zsh_path" "$target_dir" "$claude_path" "$session_name" "$extra_flags" "$split_dir" <<'APPLESCRIPT'
on run argv
  set zsh_path to item 1 of argv
  set target_dir to item 2 of argv
  set claude_path to item 3 of argv
  set session_name to item 4 of argv
  set extra_flags to item 5 of argv
  set split_dir to item 6 of argv
  tell application "Ghostty"
    activate
    set cfg to new surface configuration
    set command of cfg to zsh_path & " -l -i -c 'cd " & target_dir & " && exec " & claude_path & " --dangerously-skip-permissions" & extra_flags & " -n \"" & session_name & "\"'"
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

Then confirm to the user that a new split has been opened in Ghostty with Claude Code running in the selected repository (mention the model / agent when set).

## Notes

- Ghostty must already be running with a focused terminal in the front window (the new pane is split off the focused one)
- The new session opens as a split inside the currently selected tab of the front window
- `ghq list -p` returns full absolute paths, so grep results can be used directly
- The session name appears in Ghostty's pane title and in Claude Code's remote control list, so including the slash command and the `[agent/model]` suffix helps identify what each session is doing
- `--model` / `--agent` are standard `claude` CLI options (`claude --help`): `--model` takes an alias (`fable`, `opus`, `sonnet`) or full model name; `--agent` takes an agent/persona name resolved from the same registry Claude Code uses
- AppleScript reference: <https://ghostty.org/docs/features/applescript> (`split` command)
