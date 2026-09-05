#!/usr/bin/env python3
"""棚卸し: 既存リポのエージェント資産を「製品 × 面 × パス」で列挙して JSON に出す。分類はしない (LLM の入力)。

usage: inventory.py [<repo>] [--out inventory.json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import GENERATED_MARKER, MANIFEST_REL, resolve_repo  # noqa: E402

# (product, surface, path, kind) kind: file | dir
SURFACES = [
    ("core", "instructions", "AGENTS.md", "file"),
    ("core", "instructions", "AGENTS.override.md", "file"),
    ("core", "manifest", str(MANIFEST_REL), "file"),
    ("core", "memory", ".agents/memory", "dir"),
    ("core", "skills", ".agents/skills", "dir"),
    ("core", "agent-specs", ".agents/agent-specs", "dir"),
    ("core", "hooks-scripts", "scripts/agent-hooks", "dir"),
    ("core", "docs", "docs/README.md", "file"),
    ("claude-code", "instructions", "CLAUDE.md", "file"),
    ("claude-code", "instructions", ".claude/CLAUDE.md", "file"),
    ("claude-code", "rules", ".claude/rules", "dir"),
    ("claude-code", "skills", ".claude/skills", "dir"),
    ("claude-code", "commands", ".claude/commands", "dir"),
    ("claude-code", "agents", ".claude/agents", "dir"),
    ("claude-code", "settings", ".claude/settings.json", "file"),
    ("claude-code", "settings-local", ".claude/settings.local.json", "file"),
    ("claude-code", "mcp", ".mcp.json", "file"),
    ("codex", "config", ".codex/config.toml", "file"),
    ("codex", "hooks", ".codex/hooks.json", "file"),
    ("codex", "agents", ".codex/agents", "dir"),
    ("codex", "skills", ".codex/skills", "dir"),
    ("copilot", "instructions", ".github/copilot-instructions.md", "file"),
    ("copilot", "instructions", ".github/instructions", "dir"),
    ("copilot", "agents", ".github/agents", "dir"),
    ("copilot", "hooks", ".github/hooks", "dir"),
    ("copilot", "skills", ".github/skills", "dir"),
    ("antigravity", "instructions", "GEMINI.md", "file"),
    ("antigravity", "rules", ".agents/rules", "dir"),
    ("antigravity", "agents", ".agents/agents", "dir"),
    ("antigravity", "hooks", ".agents/hooks.json", "file"),
    ("antigravity", "mcp", ".agents/mcp_config.json", "file"),
    ("antigravity", "plugins", ".agents/plugins", "dir"),
    ("grok", "config", ".grok/config.toml", "file"),
    ("grok", "skills", ".grok/skills", "dir"),
    ("grok", "agents", ".grok/agents", "dir"),
    ("grok", "hooks", ".grok/hooks", "dir"),
    ("cursor", "rules", ".cursor/rules", "dir"),
    ("cursor", "agents", ".cursor/agents", "dir"),
    ("cursor", "hooks", ".cursor/hooks.json", "file"),
    ("cursor", "skills", ".cursor/skills", "dir"),
]


def describe(repo: Path, rel: str) -> dict | None:
    p = repo / rel
    if not p.exists() and not p.is_symlink():
        return None
    d: dict = {"path": rel, "is_symlink": p.is_symlink()}
    if p.is_symlink():
        d["link_target"] = os.readlink(p)
        d["link_resolves"] = p.exists()
    if p.is_dir():
        entries = sorted(x.name for x in p.iterdir() if not x.name.startswith("."))
        d["entries"] = entries
        d["count"] = len(entries)
        gen = [x.name for x in p.iterdir() if (x / GENERATED_MARKER).exists()]
        if gen:
            d["generated_entries"] = sorted(gen)
    elif p.is_file():
        d["size"] = p.stat().st_size
    return d


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("repo", nargs="?")
    ap.add_argument("--out")
    args = ap.parse_args()
    repo = resolve_repo(args.repo)

    assets = []
    for product, surface, rel, kind in SURFACES:
        d = describe(repo, rel)
        if d is None:
            continue
        d.update({"product": product, "surface": surface, "kind": kind,
                  "contract": None, "target": None})
        assets.append(d)

    result = {
        "repo": str(repo),
        "has_manifest": (repo / MANIFEST_REL).exists(),
        "assets": assets,
        "products_present": sorted({a["product"] for a in assets if a["product"] != "core"}),
    }
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n")
        print(f"wrote {args.out}: {len(assets)} assets, products={result['products_present']}, manifest={result['has_manifest']}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
