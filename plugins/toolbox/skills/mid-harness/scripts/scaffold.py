#!/usr/bin/env python3
"""init: 推奨ツリーを templates/tree から展開し、manifest を生成する。既存ファイルは上書きしない。

usage: scaffold.py [<repo>] [--targets claude-code,codex] [--skills-mode generate|symlink]
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (MANIFEST_REL, SUPPORTED_TARGETS, TEMPLATES_DIR, die,  # noqa: E402
                     resolve_repo, skill_version)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("repo", nargs="?")
    ap.add_argument("--targets", default="claude-code,codex")
    ap.add_argument("--skills-mode", default="generate", choices=("generate", "symlink", "manual"))
    ap.add_argument("--manifest-only", action="store_true",
                    help="推奨ツリーを展開せず manifest だけ作る (apply で既存リポに段階導入するとき)")
    args = ap.parse_args()

    repo = resolve_repo(args.repo)
    targets = [t.strip() for t in args.targets.split(",") if t.strip()]
    for t in targets:
        if t not in SUPPORTED_TARGETS:
            die(f"unsupported target: {t} (対応: {', '.join(SUPPORTED_TARGETS)})")

    created: list[str] = []
    skipped: list[str] = []
    tree = TEMPLATES_DIR / "tree"
    for src in sorted(tree.rglob("*")):
        if src.is_dir() or args.manifest_only:
            continue
        rel = src.relative_to(tree)
        dst = repo / rel
        if dst.exists() or dst.is_symlink():
            skipped.append(str(rel))
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        if dst.suffix == ".sh":
            dst.chmod(0o755)
        created.append(str(rel))

    manifest = repo / MANIFEST_REL
    if manifest.exists():
        skipped.append(str(MANIFEST_REL))
    else:
        text = (TEMPLATES_DIR / "harness.yaml").read_text()
        text = (text.replace("__SKILL_VERSION__", skill_version())
                    .replace("__TARGETS__", ", ".join(targets))
                    .replace("__SKILLS_MODE__", args.skills_mode))
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(text)
        created.append(str(MANIFEST_REL))

    print(f"repo: {repo}")
    print(f"created ({len(created)}):")
    for c in created:
        print(f"  + {c}")
    print(f"skipped, already exists ({len(skipped)}):")
    for s in skipped:
        print(f"  = {s}")
    print("next: gen_adapters.py で adapter を生成してください")
    return 0


if __name__ == "__main__":
    sys.exit(main())
