---
name: cc:launch-claude
description: Launch a new Claude Code session in a ghq-managed repository via Ghostty split, and drive sessions that are already running. Use this skill whenever the user wants to "launch claude", "start claude in", "open claude code in", or work on a specific repository in a separate session. Also trigger when the user mentions a repo name to open (e.g., "RDRAAgentで", "pkmを開いて", "sandboxで作業したい", "別セッションで開いて"), or says just a repo keyword expecting a new Claude Code session to be launched there. Supports passing a slash command to auto-execute on launch (e.g., "/cc:launch-claude pkm /deep-research テーマ"), and choosing the model and/or agent persona (e.g., "pkm を fable の marketer で開いて"). Also handles talking to an already-open pane — listing running sessions, typing a command into one, or turning Remote Control on from outside (e.g., "さっき開いたセッションを remote on にして", "あのペインに /clear を送って", "起動済みセッション一覧").
---

# Launch Claude Code in a Repository

Open a new Ghostty split running Claude Code (`--dangerously-skip-permissions`) in a ghq-managed repository. Optionally pass a slash command to auto-execute on launch, and optionally choose the model and/or agent persona.

Two jobs live here:

| The user wants | Go to |
|---|---|
| A **new** session in a repo | Steps 0–4 (Launch) |
| To talk to an **already running** pane (list / send a command / Remote Control) | Step 5 (Control) |

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

Call the bundled `scripts/launch_session.sh` — it builds the `claude` invocation, escapes it safely, and splits the focused terminal of the front window's selected tab. **Do not hand-roll the AppleScript**; a scratchpad copy gets wiped between turns and the quoting is easy to get wrong.

```bash
LAUNCH="$(find ~/.claude ./.claude -path '*/launch-claude/scripts/launch_session.sh' 2>/dev/null | head -1)"
bash "$LAUNCH" <target-dir> [--model <alias>] [--agent <name>] [--prompt '<slash-command...>']
```

| Option | Meaning |
|---|---|
| `--model <alias>` | passed to `claude --model` |
| `--agent <name>` | passed to `claude --agent` |
| `--prompt <text>` | slash command auto-executed on startup |
| `--name <text>` | override the auto-generated session name |
| `--split right\|left\|down\|up` | pane direction (default `right`) |
| `--dry-run` | print the shell command instead of opening a pane |

The session name is derived automatically: `<basename>` + ` [agent/model]` + `: <prompt>` — e.g. `pkm`, `pkm [marketer/fable]`, `agent-loop [maintainer]: /journal-review`. Pass `--name` only when the user wants something else, or to disambiguate repeat launches of the same repo (`pkm [fable] 2`).

Examples:

```bash
bash "$LAUNCH" /Users/me/src/pkm
bash "$LAUNCH" /Users/me/src/pkm --model fable --agent marketer
bash "$LAUNCH" /Users/me/src/pkm --prompt '/deep-research ハーネスエンジニアリング'
```

Then confirm to the user that a new split has been opened in Ghostty with Claude Code running in the selected repository (mention the model / agent when set).

### 5. Control an already-running session

Use `scripts/session_ctl.sh` when the user refers to a session that is **already open** — "さっき立ち上げたやつ", "あのペイン", "起動済みのセッション". Locate it the same way as `check_deps.sh`:

```bash
CTL="$(find ~/.claude ./.claude -path '*/launch-claude/scripts/session_ctl.sh' 2>/dev/null | head -1)"
```

| Command | What it does |
|---|---|
| `bash "$CTL" list` | Print every Ghostty pane as `ID \| NAME \| CWD` |
| `bash "$CTL" resolve <target>` | Print the id `<target>` resolves to, **sending nothing** |
| `bash "$CTL" send <target> <text...>` | Paste `<text>` into the pane, then press enter |
| `bash "$CTL" remote <target>` | Send `/remote-control` to the pane |

`<target>` is a terminal id from `list`, or a case-insensitive substring of the pane name (`claude-plugins`, `pkm [fable] 3`). No match or an ambiguous match is an error that lists the candidates — it never guesses.

Rules:

- **Always run `list` first** and show the user which pane you are about to hit. Pane names carry the `[agent/model]` suffix from step 4, so they are the natural handle.
- **Sending is an interrupt.** The text lands in that session's prompt as if pasted. Only send to a pane the user pointed at, and prefer an idle one — a busy session will take the injection mid-work.
- `/remote-control` is a **toggle**, not an "on" switch. Sessions normally start with Remote Control already enabled (`remoteControlAtStartup` in `~/.claude/settings.json`), so sending it to a healthy session turns it **off**. Send it only when the user says a session is missing from claude.ai, and ask them to confirm the pane afterwards.
- There is no CLI to enable Remote Control on a live session; `claude --remote-control [name]` works at startup only. Injecting the slash command is the only outside-in route.

## Notes

- Ghostty must already be running with a focused terminal in the front window (the new pane is split off the focused one)
- The new session opens as a split inside the currently selected tab of the front window
- `ghq list -p` returns full absolute paths, so grep results can be used directly
- The session name appears in Ghostty's pane title and in Claude Code's remote control list, so including the slash command and the `[agent/model]` suffix helps identify what each session is doing
- `--model` / `--agent` are standard `claude` CLI options (`claude --help`): `--model` takes an alias (`fable`, `opus`, `sonnet`) or full model name; `--agent` takes an agent/persona name resolved from the same registry Claude Code uses
- `-n <name>` only sets the display name (prompt box, `/resume` picker, terminal title). Remote Control is governed separately by `remoteControlAtStartup`, or by launching with `--remote-control [name]`
- AppleScript reference: <https://ghostty.org/docs/features/applescript> (`split`, `input text`, `send key`)
