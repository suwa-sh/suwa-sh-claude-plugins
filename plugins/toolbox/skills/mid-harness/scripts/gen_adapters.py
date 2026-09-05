#!/usr/bin/env python3
"""manifest (.agents/harness.yaml) + agent-specs + hooks から製品別 adapter を生成する。

usage: gen_adapters.py [<repo>] [--out-root <dir>] [--adopt] [--quiet]
  --out-root: 生成先を別ディレクトリにする (check_drift 用)。既存 adapter は <repo> から読んでマージする。
  --adopt:    所有マーカーの無い既存の agent 定義 (.claude/agents/<name>.md 等) を mid-harness の管理下に取り込んで上書きする。
              無指定ではそのファイルを上書きせず失敗する (手書き資産の保護)。

生成はまず一時ディレクトリに全出力を作り、問題 (unmappable / 未所有ファイル / TOML 不正) が無いときだけ反映する (atomic)。
変換規則の正本: references/adapters/<product>.md。この表を変えたら doc も変える。
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (AGENT_LAYOUT, CAPABILITIES, GENERATED_LINE, GENERATED_MARKER, OWNER_TAG,  # noqa: E402
                     agy_key_owned, die, json_owned, load_manifest, load_policy, manifest_lists,
                     owned_agent_file, owned_hook_command, resolve_repo)

EVENT_MAP = {
    "claude-code": {"pre-tool": "PreToolUse", "post-tool": "PostToolUse",
                    "session-start": "SessionStart", "stop": "Stop"},
    "codex": {"pre-tool": "PreToolUse", "post-tool": "PostToolUse",
              "session-start": "SessionStart", "stop": "Stop"},
    "grok": {"pre-tool": "PreToolUse", "post-tool": "PostToolUse",
             "session-start": "SessionStart", "stop": "Stop"},
    "cursor": {"pre-tool": "beforeShellExecution", "post-tool": "afterShellExecution",
               "session-start": "sessionStart", "stop": "stop"},
    "copilot": {"pre-tool": "preToolUse", "post-tool": "postToolUse",
                "session-start": "sessionStart"},                      # stop は対応なし
    "antigravity": {"pre-tool": "PreToolUse", "post-tool": "PostToolUse", "stop": "Stop"},  # session-start は対応なし
}
CAPABILITY_MAP = {
    "claude-code": {"read": ["Read", "Glob", "Grep"], "edit": ["Edit", "Write", "MultiEdit"],
                    "shell": ["Bash"], "delegate": ["Agent"], "network": ["WebFetch", "WebSearch"]},
    # Grok の tool ID は xai-grok-agent README の template 変数 (read_file / search_replace / run_terminal_cmd / grep / list_dir / web_search)
    "grok": {"read": ["read_file", "grep", "list_dir"], "edit": ["search_replace"],
             "shell": ["run_terminal_cmd"], "delegate": [], "network": ["web_search"]},
    # Copilot は公式 alias (execute / read / edit / search / agent / web)。tools 省略 = 全ツール、空 = 無効
    "copilot": {"read": ["read", "search"], "edit": ["edit"], "shell": ["execute"], "delegate": ["agent"], "network": ["web"]},
}
ROOT_CMD = 'bash "$(git rev-parse --show-toplevel)/{script}"'  # hook の cwd が product ごとに違うので実行時に root を解決
CODEX_BLOCK_BEGIN = "# mid-harness:begin (generated — do not edit)"
CODEX_BLOCK_END = "# mid-harness:end"


class Gen:
    def __init__(self, repo: Path, stage: Path, adopt: bool):
        self.repo = repo
        self.stage = stage          # すべての出力はまずここに書く
        self.adopt = adopt
        self.written: list[str] = []   # 反映するファイル (repo 相対)
        self.symlinks: list[tuple[str, str]] = []
        self.dirs: list[str] = []      # 反映するディレクトリ (skills)
        self.removals: list[str] = []  # 反映時に削除する孤児 (所有マーカー付きで manifest に無いもの)
        self.problems: list[str] = []
        self.notes: list[str] = []

    # ---- io helpers -------------------------------------------------
    def write(self, rel: str, text: str) -> None:
        p = self.stage / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        if not text.endswith("\n"):
            text += "\n"
        p.write_text(text)
        self.written.append(rel)

    def read_existing(self, rel: str) -> str | None:
        """生成先の既存内容。生成先 (またはその親) が symlink ならリポ外へ書く恐れがあるので problem にする."""
        p = self.repo / rel
        if p.is_symlink():
            self.problems.append(f"{rel} は symlink です。生成先は通常ファイルにしてください")
            return None
        for parent in p.parents:
            if parent == self.repo:
                break
            if parent.is_symlink():
                self.problems.append(f"{rel} の親 {parent.relative_to(self.repo)} が symlink です。生成先はリポ内の実ディレクトリにしてください")
                return None
        return p.read_text() if p.is_file() else None

    def unmappable(self, what: str, mode: str) -> None:
        if mode == "skip":
            self.notes.append(f"skip: {what}")
        else:
            self.problems.append(what)

    def guard_owned(self, rel: str, fmt: str) -> bool:
        """既存ファイルが手書き (所定位置に所有マーカー行が無い) なら --adopt が無い限り上書きしない."""
        existing = self.read_existing(rel)
        if existing is None or owned_agent_file(existing, fmt) or self.adopt:
            return True
        self.problems.append(f"{rel} は手書きのようです (所有マーカー無し)。内容を agent-spec へ移してから --adopt で取り込んでください")
        return False

    def collect_orphans(self, rel_dir: str, suffix: str, fmt: str, keep: set[str]) -> None:
        """rel_dir 配下の所有マーカー付き agent 定義のうち manifest に無いものを削除対象にする。
        suffix が '/agent.md' (antigravity) のときは <name>/agent.md 形式で、ディレクトリごと削除する."""
        d = self.repo / rel_dir
        if not d.is_dir():
            return
        for p in sorted(d.glob(f"*{suffix}")):
            if not p.is_file() or p.is_symlink():
                continue
            name = p.parent.name if suffix.startswith("/") else p.stem
            if name not in keep and owned_agent_file(p.read_text(), fmt):
                self.removals.append(f"{rel_dir}/{name}" if suffix.startswith("/") else f"{rel_dir}/{p.name}")

    def write_md_agent(self, rel: str, name: str, pol: dict, prompt: str, extra_fm: list[str], from_rel_dir: str) -> None:
        """Markdown + YAML front matter 形式の agent 定義 (Claude / Cursor / Grok / Copilot / Antigravity)."""
        if not self.guard_owned(rel, "md"):
            return
        fm = [f"name: {name}", f"description: {json.dumps(pol['description'], ensure_ascii=False)}"] + extra_fm
        body = f"<!-- {GENERATED_LINE} from .agents/agent-specs/{name}; do not edit -->\n"
        body += prompt.rstrip() + "\n" + _docs_section(self.repo, from_rel_dir, pol["docs"])
        self.write(rel, "---\n" + "\n".join(fm) + "\n---\n" + body)

    def owned_json_file(self, rel: str, doc: dict) -> None:
        """mid-harness が丸ごと所有する JSON ファイル (grok / copilot の hook ファイル)."""
        existing = self.read_existing(rel)
        if existing is not None:
            try:
                old = json.loads(existing)
            except json.JSONDecodeError as e:
                die(f"{rel} を JSON として読めません: {e}")
            if not _json_owned(old) and not self.adopt:
                self.problems.append(f"{rel} は mid-harness の生成物ではありません (所有マーカー無し)。別名にするか --adopt")
                return
        self.write(rel, json.dumps(doc, ensure_ascii=False, indent=2))

    def collect_orphan_skill_dirs(self) -> None:
        """正本 (.agents/skills) に無い、所有マーカー付きの .claude/skills/<name> を削除対象にする."""
        d = self.repo / ".claude" / "skills"
        if not d.is_dir():
            return
        for marker in sorted(d.glob(f"*/{GENERATED_MARKER}")):
            name = marker.parent.name
            if marker.parent.is_symlink():
                continue
            if not (self.repo / ".agents" / "skills" / name).is_dir():
                self.removals.append(f".claude/skills/{name}")

    def antigravity_drop_key(self) -> None:
        """antigravity が targets に無いとき、.agents/hooks.json の所有キー 'mid-harness' だけを取り除く."""
        rel = ".agents/hooks.json"
        existing = self.read_existing(rel)
        if existing is None:
            return
        try:
            doc = json.loads(existing)
        except json.JSONDecodeError:
            return
        if isinstance(doc, dict) and "mid-harness" in doc and _agy_key_owned(doc["mid-harness"]):
            doc.pop("mid-harness")
            self.write(rel, json.dumps(doc, ensure_ascii=False, indent=2) if doc else "{}")

    def codex_drop_block(self) -> None:
        """codex が targets に無いとき、config.toml の管理ブロックだけを取り除く."""
        existing = self.read_existing(".codex/config.toml")
        if existing is None or CODEX_BLOCK_BEGIN not in existing:
            return
        before, after = _split_block(existing)
        new = (before.rstrip("\n") + "\n\n" if before.strip() else "") + (after if after.strip() else "")
        self.write(".codex/config.toml", new.rstrip("\n"))

    # ---- hooks (JSON, Claude Code / Codex 共通形) --------------------
    def remove_owned_json(self, rel: str) -> None:
        """所有マーカー付きの JSON ファイルだけを削除対象にする (手書きは残す)."""
        p = self.repo / rel
        if not p.is_file() or p.is_symlink():
            return
        try:
            owned = _json_owned(json.loads(p.read_text()))
        except json.JSONDecodeError:
            owned = False
        if owned:
            self.removals.append(rel)
        else:
            self.notes.append(f"{rel} は mid-harness の生成物ではないので残す")

    def hooks_json(self, product: str, hooks: list[dict], settings_rel: str) -> None:
        """settings_rel の hooks.<Event>[].hooks[] のうち mid-harness 所有 handler だけを差し替える (handler 単位)."""
        existing_text = self.read_existing(settings_rel)
        try:
            doc = json.loads(existing_text) if existing_text else {}
        except json.JSONDecodeError as e:
            die(f"{settings_rel} を JSON として読めません: {e}")
        if not isinstance(doc, dict):
            die(f"{settings_rel} の top-level は object")
        hooks_obj = doc.get("hooks")
        if hooks_obj is None:
            hooks_obj = {}
        if not isinstance(hooks_obj, dict):
            die(f"{settings_rel} の hooks は object")
        # 既存の所有 handler を除去 (group は他の handler が残れば保持)
        for ev, groups in list(hooks_obj.items()):
            if not isinstance(groups, list):
                continue
            kept_groups = []
            for g in groups:
                if isinstance(g, dict) and isinstance(g.get("hooks"), list):
                    g["hooks"] = [h for h in g["hooks"] if not (isinstance(h, dict) and owned_hook_command(h.get("command")))]
                    if g["hooks"]:
                        kept_groups.append(g)
                else:
                    kept_groups.append(g)
            if kept_groups:
                hooks_obj[ev] = kept_groups
            else:
                del hooks_obj[ev]
        # 生成
        for h in hooks:
            ev = EVENT_MAP[product].get(h["event"])
            if ev is None:
                self.unmappable(f"{product}: hook event {h['event']} に対応する製品イベントが無い", h.get("on_unmappable", "fail"))
                continue
            script = h["script"]
            if not (self.repo / script).is_file():
                self.problems.append(f"hook script が無い: {script}")
            if product == "claude-code":
                cmd = f'bash "$CLAUDE_PROJECT_DIR/{script}"'
            else:
                # Codex は hook をセッションの cwd で実行する (project root とは限らない) ので実行時に root を解決する
                cmd = f'bash "$(git rev-parse --show-toplevel)/{script}"'
            cmd += f"  {OWNER_TAG}"
            entry = {"hooks": [{"type": "command", "command": cmd}]}
            if h.get("matcher"):
                entry = {"matcher": str(h["matcher"]), **entry}
            hooks_obj.setdefault(ev, []).append(entry)
        if hooks_obj:
            doc["hooks"] = hooks_obj
        else:
            doc.pop("hooks", None)
        self.write(settings_rel, json.dumps(doc, ensure_ascii=False, indent=2))

    # ---- claude-code ------------------------------------------------
    def claude_code(self, m: dict) -> None:
        hooks, agents = manifest_lists(m)
        self.hooks_json("claude-code", hooks, ".claude/settings.json")
        mode = m.get("skills_mode", "generate")
        src_root = self.repo / ".agents" / "skills"
        if mode == "manual":
            self.notes.append("skills_mode=manual: .claude/skills は mid-harness の管理外")
        elif src_root.is_symlink():
            self.problems.append(".agents/skills が symlink です。正本を .agents/skills の実体にしてください (apply の移送対象)")
        elif src_root.is_dir():
            # SKILL.md の無いディレクトリ (references だけの資料置き場など) も同じ規則で link / copy する
            # (skill から相対参照されている実績があるため)。隠しディレクトリは対象外
            for skill in sorted(x for x in src_root.iterdir() if x.is_dir() and not x.name.startswith(".")):
                rel = f".claude/skills/{skill.name}"
                cur = self.repo / rel
                if mode == "symlink":
                    if cur.exists() and not cur.is_symlink() and not (cur / GENERATED_MARKER).exists():
                        self.problems.append(f"{rel} は手書きのようです (マーカー無し)。.agents/skills へ移すか削除してください")
                        continue
                    self.symlinks.append((rel, f"../../.agents/skills/{skill.name}"))
                else:
                    if cur.exists() and not cur.is_symlink() and not (cur / GENERATED_MARKER).exists():
                        self.problems.append(f"{rel} は手書きのようです (マーカー無し)。.agents/skills へ移すか削除してください")
                        continue
                    links = [p for p in skill.rglob("*") if p.is_symlink()]
                    if links:
                        self.problems.append(f".agents/skills/{skill.name} に symlink があります (コピー先で実体化されるため禁止): "
                                             + ", ".join(str(p.relative_to(skill)) for p in links[:5]))
                        continue
                    dst = self.stage / rel
                    shutil.copytree(skill, dst, symlinks=False, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
                    (dst / GENERATED_MARKER).write_text(f"{GENERATED_LINE} from .agents/skills/{skill.name}; do not edit\n")
                    self.dirs.append(rel)
        if mode != "manual":
            self.collect_orphan_skill_dirs()
        self.collect_orphans(".claude/agents", ".md", "md", set(agents))
        for name in agents:
            prompt, pol = load_policy(self.repo, name)
            rel = f".claude/agents/{name}.md"
            if not self.guard_owned(rel, "md"):
                continue
            caps = pol["capabilities"]
            fm = [f"name: {name}", f"description: {json.dumps(pol['description'], ensure_ascii=False)}"]
            if not all(caps.get(c) for c in CAPABILITIES):
                tools = [t for cap in CAPABILITY_MAP["claude-code"] if caps.get(cap) for t in CAPABILITY_MAP["claude-code"][cap]]
                fm.append(f"tools: {', '.join(tools)}")
            if pol.get("model"):
                fm.append(f"model: {pol['model']}")
            body = f"<!-- {GENERATED_LINE} from .agents/agent-specs/{name}; do not edit -->\n"
            body += prompt.rstrip() + "\n" + _docs_section(self.repo, ".claude/agents", pol["docs"])
            self.write(rel, "---\n" + "\n".join(fm) + "\n---\n" + body)

    # ---- codex ------------------------------------------------------
    def codex(self, m: dict) -> None:
        hooks, agents = manifest_lists(m)
        self.hooks_json("codex", hooks, ".codex/hooks.json")
        if m.get("skills_mode", "generate") != "manual" and (self.repo / ".agents" / "skills").is_symlink():
            self.problems.append(".agents/skills が symlink です。Codex は .agents/skills を直接読むので実体にしてください")
        self.collect_orphans(".codex/agents", ".toml", "toml", set(agents))
        block_lines: list[str] = []
        for name in agents:
            prompt, pol = load_policy(self.repo, name)
            rel = f".codex/agents/{name}.toml"
            if not self.guard_owned(rel, "toml"):
                continue
            caps = pol["capabilities"]
            mode = pol["on_unmappable"]
            if not caps["shell"]:
                # sandbox_mode はシェル実行の隔離方式であって shell tool の無効化ではない
                self.unmappable(f"codex/{name}: shell=false は表現できない (shell tool は無効化できず sandbox_mode で隔離するだけ)", mode)
            if not caps["delegate"]:
                self.notes.append(f"codex/{name}: delegate=false は個別制御できない (グローバル [agents] enabled)。生成は続行")
            if caps["network"] and not caps["edit"]:
                self.unmappable(f"codex/{name}: edit=false かつ network=true は表現できない", mode)
            body = prompt.rstrip() + "\n" + _docs_section(self.repo, ".codex/agents", pol["docs"])
            lines = [f"# {GENERATED_LINE} from .agents/agent-specs/{name}; do not edit",
                     f"name = {_toml_basic(name)}", f"description = {_toml_basic(pol['description'])}",
                     f"developer_instructions = {_toml_multiline(body)}"]
            if pol.get("model"):
                lines.append(f"model = {_toml_basic(pol['model'])}")
            lines.append(f'sandbox_mode = "{"workspace-write" if caps["edit"] else "read-only"}"')
            if caps["edit"] and caps["network"]:
                lines.append("\n[sandbox_workspace_write]\nnetwork_access = true")
            text = "\n".join(lines) + "\n"
            err = _toml_check(text)
            if err:
                self.problems.append(f"{rel}: 生成した TOML が不正: {err}")
                continue
            self.write(rel, text)
            block_lines += [f"[agents.{name}]", f"description = {_toml_basic(pol['description'])}",
                            f'config_file = "agents/{name}.toml"', ""]
        existing = self.read_existing(".codex/config.toml")
        before, after = _split_block(existing or "")
        block = ""
        if block_lines:
            block = CODEX_BLOCK_BEGIN + "\n" + "\n".join(block_lines).rstrip() + "\n" + CODEX_BLOCK_END + "\n"
        new = (before.rstrip("\n") + "\n\n" if before.strip() else "") + block + (after if after.strip() else "")
        if new.strip():
            err = _toml_check(new)
            if err:
                self.problems.append(f".codex/config.toml: 結合後の TOML が不正: {err}")
            else:
                self.write(".codex/config.toml", new.rstrip("\n"))
        elif existing is not None and existing.strip():
            # 管理ブロックを取り除いたら空になった: ブロックだけ消す (ファイルは空で残す)
            self.write(".codex/config.toml", "")

    # ---- cursor -----------------------------------------------------
    def cursor(self, m: dict) -> None:
        hooks, agents = manifest_lists(m)
        rel = ".cursor/hooks.json"
        existing = self.read_existing(rel)
        try:
            doc = json.loads(existing) if existing else {}
        except json.JSONDecodeError as e:
            die(f"{rel} を JSON として読めません: {e}")
        if not isinstance(doc, dict):
            die(f"{rel} の top-level は object")
        doc.setdefault("version", 1)
        hooks_obj = doc.get("hooks") if isinstance(doc.get("hooks"), dict) else {}
        for ev, entries in list(hooks_obj.items()):
            if isinstance(entries, list):
                kept = [e for e in entries if not (isinstance(e, dict) and owned_hook_command(e.get("command")))]
                if kept:
                    hooks_obj[ev] = kept
                else:
                    del hooks_obj[ev]
        for h in hooks:
            ev = EVENT_MAP["cursor"].get(h["event"])
            if ev is None:
                self.unmappable(f"cursor: hook event {h['event']} に対応する製品イベントが無い", h.get("on_unmappable", "fail"))
                continue
            if not (self.repo / h["script"]).is_file():
                self.problems.append(f"hook script が無い: {h['script']}")
            # project hook は project root を cwd に実行される。failClosed で hook 失敗時もブロック
            hooks_obj.setdefault(ev, []).append({"command": f"bash {h['script']}  {OWNER_TAG}", "failClosed": True})
        if hooks_obj:
            doc["hooks"] = hooks_obj
        else:
            doc.pop("hooks", None)
        if hooks_obj or existing is not None:
            self.write(rel, json.dumps(doc, ensure_ascii=False, indent=2))
        self.collect_orphans(".cursor/agents", ".md", "md", set(agents))
        for name in agents:
            prompt, pol = load_policy(self.repo, name)
            caps = pol["capabilities"]
            extra = ["model: inherit"] if not pol.get("model") else [f"model: {pol['model']}"]
            if not caps["edit"] and not caps["shell"]:
                extra.append("readonly: true")
            elif caps["edit"] != caps["shell"]:
                self.unmappable(f"cursor/{name}: edit と shell の片方だけ false は表現できない (readonly は両方を禁止)", pol["on_unmappable"])
            for cap in ("delegate", "network"):
                if not caps[cap]:
                    self.notes.append(f"cursor/{name}: {cap}=false は個別制御できない。生成は続行")
            self.write_md_agent(f".cursor/agents/{name}.md", name, pol, prompt, extra, ".cursor/agents")

    # ---- grok -------------------------------------------------------
    def grok(self, m: dict) -> None:
        hooks, agents = manifest_lists(m)
        rel = ".grok/hooks/mid-harness.json"
        groups: dict[str, list] = {}
        for h in hooks:
            ev = EVENT_MAP["grok"].get(h["event"])
            if ev is None:
                self.unmappable(f"grok: hook event {h['event']} に対応する製品イベントが無い", h.get("on_unmappable", "fail"))
                continue
            if not (self.repo / h["script"]).is_file():
                self.problems.append(f"hook script が無い: {h['script']}")
            entry = {"hooks": [{"type": "command", "command": ROOT_CMD.format(script=h["script"]) + f"  {OWNER_TAG}", "timeout": 30}]}
            if h.get("matcher"):
                entry = {"matcher": str(h["matcher"]), **entry}
            groups.setdefault(ev, []).append(entry)
        if groups:
            self.owned_json_file(rel, {"_generated_by": OWNER_TAG.lstrip("# "), "hooks": groups})
        else:
            self.remove_owned_json(rel)
        self.collect_orphans(".grok/agents", ".md", "md", set(agents))
        for name in agents:
            prompt, pol = load_policy(self.repo, name)
            caps = pol["capabilities"]
            extra: list[str] = []
            if not all(caps.get(c) for c in CAPABILITIES):
                tools = [t for cap in CAPABILITY_MAP["grok"] if caps.get(cap) for t in CAPABILITY_MAP["grok"][cap]]
                if tools:
                    extra.append("tools:")
                    extra += [f"  - {t}" for t in tools]
                else:
                    extra.append("tools: []")   # 空 = ツール無し (省略すると全ツール継承になる)
            if not caps["edit"] and not caps["shell"]:
                extra.append("permissionMode: plan")
            if not caps["delegate"]:
                self.notes.append(f"grok/{name}: delegate=false は個別制御できない。生成は続行")
            if pol.get("model"):
                extra.append(f"model: {pol['model']}")
            self.write_md_agent(f".grok/agents/{name}.md", name, pol, prompt, extra, ".grok/agents")

    # ---- copilot ----------------------------------------------------
    def copilot(self, m: dict) -> None:
        hooks, agents = manifest_lists(m)
        rel = ".github/hooks/mid-harness.json"
        events: dict[str, list] = {}
        for h in hooks:
            ev = EVENT_MAP["copilot"].get(h["event"])
            if ev is None:
                self.unmappable(f"copilot: hook event {h['event']} に対応する製品イベントが無い", h.get("on_unmappable", "fail"))
                continue
            if not (self.repo / h["script"]).is_file():
                self.problems.append(f"hook script が無い: {h['script']}")
            cmd = ROOT_CMD.format(script=h["script"]) + f"  {OWNER_TAG}"
            entry: dict = {"type": "command", "bash": cmd, "timeoutSec": 30}
            if h.get("matcher"):
                # Copilot の matcher は toolName 全体への正規表現。Claude 名 Bash は bash|powershell に読み替える
                entry["matcher"] = "bash|powershell" if str(h["matcher"]) == "Bash" else str(h["matcher"])
            events.setdefault(ev, []).append(entry)
        if events:
            self.owned_json_file(rel, {"version": 1, "_generated_by": OWNER_TAG.lstrip("# "), "hooks": events})
        else:
            self.remove_owned_json(rel)
        self.collect_orphans(".github/agents", ".md", "md", set(agents))
        for name in agents:
            prompt, pol = load_policy(self.repo, name)
            caps = pol["capabilities"]
            extra: list[str] = []
            if not all(caps.get(c) for c in CAPABILITIES):
                tools = [t for cap in CAPABILITY_MAP["copilot"] if caps.get(cap) for t in CAPABILITY_MAP["copilot"][cap]]
                extra.append(f"tools: [{', '.join(tools)}]")   # 空なら全ツール無効 (公式仕様)
            if pol.get("model"):
                extra.append(f"model: {pol['model']}")
            self.write_md_agent(f".github/agents/{name}.md", name, pol, prompt, extra, ".github/agents")

    # ---- antigravity ------------------------------------------------
    def antigravity(self, m: dict) -> None:
        hooks, agents = manifest_lists(m)
        rel = ".agents/hooks.json"
        existing = self.read_existing(rel)
        try:
            doc = json.loads(existing) if existing else {}
        except json.JSONDecodeError as e:
            die(f"{rel} を JSON として読めません: {e}")
        if not isinstance(doc, dict):
            die(f"{rel} の top-level は object (hook 名 → イベント)")
        if "mid-harness" in doc and not _agy_key_owned(doc["mid-harness"]) and not self.adopt:
            self.problems.append(f"{rel} の top-level キー 'mid-harness' は mid-harness の生成物ではありません (所有 ID 無し)。別名にするか --adopt")
            return
        doc.pop("mid-harness", None)
        named: dict[str, list] = {}
        for h in hooks:
            ev = EVENT_MAP["antigravity"].get(h["event"])
            if ev is None:
                self.unmappable(f"antigravity: hook event {h['event']} に対応する製品イベントが無い", h.get("on_unmappable", "fail"))
                continue
            if not (self.repo / h["script"]).is_file():
                self.problems.append(f"hook script が無い: {h['script']}")
            # cwd は hooks.json のディレクトリ (.agents/) なので root を実行時解決する。matcher は * (ツール名が run_command)
            named.setdefault(ev, []).append({"matcher": "*", "hooks": [
                {"type": "command", "command": ROOT_CMD.format(script=h["script"]) + f"  {OWNER_TAG}", "timeout": 30}]})
        if named:
            doc["mid-harness"] = named
        if doc:
            self.write(rel, json.dumps(doc, ensure_ascii=False, indent=2))
        elif existing is not None:
            self.write(rel, "{}")
        self.collect_orphans(".agents/agents", "/agent.md", "md", set(agents))
        for name in agents:
            prompt, pol = load_policy(self.repo, name)
            for cap in CAPABILITIES:
                if not pol["capabilities"][cap]:
                    self.notes.append(f"antigravity/{name}: {cap}=false は agent.md の個別制御項目が未確認のため反映しない")
            self.write_md_agent(f".agents/agents/{name}/agent.md", name, pol, prompt, [], f".agents/agents/{name}")

    # ---- apply ------------------------------------------------------
    def apply(self, out: Path) -> None:
        """stage → out へ反映 (問題が無いときだけ呼ぶ)."""
        for rel in self.removals:
            p = out / rel
            if p.is_symlink():
                continue
            if p.is_file():
                p.unlink()
            elif p.is_dir():
                shutil.rmtree(p)
        for rel in self.dirs:
            dst = out / rel
            if dst.is_symlink():
                dst.unlink()
            elif dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(self.stage / rel, dst, symlinks=False)
        for rel, target in self.symlinks:
            dst = out / rel
            if dst.is_symlink():
                dst.unlink()
            elif dst.exists():
                shutil.rmtree(dst)
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.symlink_to(target)
        for rel in self.written:
            dst = out / rel
            if dst.is_symlink():
                die(f"{rel} が symlink に変わっています。書き込みを中止します")
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(self.stage / rel, dst)


_json_owned = json_owned          # 所有判定は _common に集約 (drift 検査と共有)
_agy_key_owned = agy_key_owned


def _split_block(text: str) -> tuple[str, str]:
    if CODEX_BLOCK_BEGIN not in text:
        return text, ""
    b = text.index(CODEX_BLOCK_BEGIN)
    e = text.find(CODEX_BLOCK_END, b)
    if e < 0:
        die(".codex/config.toml の mid-harness ブロックが閉じていません")
    e += len(CODEX_BLOCK_END)
    return text[:b], text[e:].lstrip("\n")


def _docs_section(repo: Path, from_rel_dir: str, docs: list[str]) -> str:
    if not docs:
        return ""
    lines = ["", "## 作業前に読む文書", ""]
    for d in docs:
        link = os.path.relpath(d, from_rel_dir)
        missing = "" if (repo / d).exists() else " <!-- missing -->"
        lines.append(f"- [{d}]({link}){missing}")
    return "\n".join(lines) + "\n"


def _toml_basic(s: str) -> str:
    """TOML basic string (1 行)."""
    return json.dumps(s, ensure_ascii=False)


def _toml_multiline(s: str) -> str:
    """TOML multi-line basic string。backslash、連続 3 つ以上の \"、制御文字 (改行と tab 以外) をエスケープする."""
    s = s.replace("\\", "\\\\")
    s = s.replace('"""', '""\\"')
    s = s.replace("\r\n", "\n").replace("\r", "\\r")
    s = "".join(c if (c in "\n\t" or (ord(c) >= 0x20 and ord(c) != 0x7F)) else f"\\u{ord(c):04X}" for c in s)
    # 末尾が " で終わると閉じ引用と結合するので改行を保証する
    if not s.endswith("\n"):
        s += "\n"
    return '"""\n' + s + '"""'


def _toml_loader():
    try:
        import tomllib  # py3.11+
        return tomllib.loads
    except ImportError:
        try:
            import tomli  # type: ignore
            return tomli.loads
        except ImportError:
            return None


def _toml_check(text: str) -> str | None:
    """不正なら理由を返す。検証器が無い環境では『検証不能』を理由として返す (成功扱いにしない)."""
    loads = _toml_loader()
    if loads is None:
        return "TOML を検証できません (python 3.11+ の tomllib か `pip install tomli` が必要)"
    try:
        loads(text)
        return None
    except Exception as e:
        return str(e)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo", nargs="?")
    ap.add_argument("--out-root")
    ap.add_argument("--adopt", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()
    repo = resolve_repo(args.repo)
    out = Path(args.out_root).resolve() if args.out_root else repo
    m = load_manifest(repo)
    with tempfile.TemporaryDirectory(prefix="mid-harness-gen-") as tmp:
        g = Gen(repo, Path(tmp), args.adopt)
        for t in m["targets"]:
            getattr(g, t.replace("-", "_"))(m)
        # targets から外れた製品の所有マーカー付き agent 定義も孤児として削除する
        for product, (rel_dir, suffix, fmt) in AGENT_LAYOUT.items():
            if product not in m["targets"]:
                g.collect_orphans(rel_dir, suffix, fmt, set())
        if "codex" not in m["targets"]:
            g.codex_drop_block()
        for product, rel in (("grok", ".grok/hooks/mid-harness.json"), ("copilot", ".github/hooks/mid-harness.json")):
            if product not in m["targets"]:
                g.remove_owned_json(rel)
        if "antigravity" not in m["targets"]:
            g.antigravity_drop_key()
        if g.problems:
            print("unmappable / errors (何も書き込んでいません):", file=sys.stderr)
            for p in g.problems:
                print(f"  ! {p}", file=sys.stderr)
            return 1
        g.apply(out)
    if not args.quiet:
        print(f"repo: {repo}" + (f"  (out: {out})" if out != repo else ""))
        print(f"targets: {', '.join(m['targets'])}  skills_mode: {m.get('skills_mode', 'generate')}")
        items = [f"{d}/" for d in g.dirs] + [f"{r} -> {t}" for r, t in g.symlinks] + g.written
        print(f"written ({len(items)}):")
        for w in items:
            print(f"  * {w}")
        for r in g.removals:
            print(f"  - removed orphan: {r}")
        for n in g.notes:
            print(f"  note: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
