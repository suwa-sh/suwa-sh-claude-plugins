#!/usr/bin/env python3
"""audit: manifest から adapter を一時ディレクトリへ再生成し、作業ツリーと比較する。差分があれば exit 1。

usage: check_drift.py [<repo>]

検出するもの:
- 生成ファイルの内容差 / 欠落 / permission bit (実行ビット) の差
- 生成 skill ディレクトリ (マーカー付き) の余剰ファイル・欠落ファイル・マーカー消失
- 正本 (.agents/skills) に無い孤児の生成 skill、manifest に無い所有マーカー付き agent 定義 (孤児)
- 所有 ID 付き hook handler や Codex 管理ブロックが再生成結果に無いのに残っている場合 (内容差として検出)
- symlink の向きの違い
"""
from __future__ import annotations

import argparse
import filecmp
import json
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (AGENT_LAYOUT, GENERATED_MARKER, agy_key_owned, json_owned,  # noqa: E402
                     owned_agent_file, resolve_repo)

GEN = Path(__file__).resolve().parent / "gen_adapters.py"


def _files_under(root: Path) -> set[str]:
    return {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file() or p.is_symlink()}


def _mode(p: Path) -> int:
    return stat.S_IMODE(p.stat().st_mode)


def _cmp(a: Path, b: Path, rel: str, drift: list[str]) -> None:
    if not filecmp.cmp(a, b, shallow=False):
        drift.append(f"content differs: {rel}")
    elif (_mode(a) & 0o111) != (_mode(b) & 0o111):
        drift.append(f"exec bit differs: {rel} (generated {oct(_mode(a))}, repo {oct(_mode(b))})")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo", nargs="?")
    args = ap.parse_args()
    repo = resolve_repo(args.repo)

    with tempfile.TemporaryDirectory(prefix="mid-harness-drift-") as tmp:
        out = Path(tmp)
        # --adopt は「既存 agent 定義が手書きでも生成結果を出す」ため。手書きのままなら内容差として drift に出る
        r = subprocess.run([sys.executable, str(GEN), str(repo), "--out-root", str(out), "--adopt", "--quiet"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr.strip(), file=sys.stderr)
            print("gen_adapters が失敗したため drift を判定できません", file=sys.stderr)
            return 1
        drift: list[str] = []
        # 1) 生成 skill ディレクトリはファイル集合を双方向で比較
        skills_out = out / ".claude" / "skills"
        gen_skill_dirs = {p.parent for p in skills_out.glob(f"*/{GENERATED_MARKER}")} if skills_out.exists() else set()
        for gdir in sorted(gen_skill_dirs):
            rel = gdir.relative_to(out)
            cur = repo / rel
            if not cur.is_dir() or cur.is_symlink():
                drift.append(f"missing generated skill dir: {rel}")
                continue
            gset, cset = _files_under(gdir), _files_under(cur)
            for extra in sorted(cset - gset):
                drift.append(f"extra file in generated dir: {rel}/{extra}")
            for missing in sorted(gset - cset):
                drift.append(f"missing file in generated dir: {rel}/{missing}")
            for common in sorted(gset & cset):
                _cmp(gdir / common, cur / common, f"{rel}/{common}", drift)
        # 2) その他の生成物はファイル単位
        for gen_path in sorted(p for p in out.rglob("*") if p.is_file() or p.is_symlink()):
            if any(gen_path.is_relative_to(d) for d in gen_skill_dirs):
                continue
            rel = gen_path.relative_to(out)
            cur = repo / rel
            if gen_path.is_symlink():
                if not cur.is_symlink() or os.readlink(cur) != os.readlink(gen_path):
                    drift.append(f"symlink differs: {rel}")
                continue
            if not cur.exists():
                drift.append(f"missing in repo: {rel}")
            elif cur.is_symlink() or not cur.is_file():
                drift.append(f"not a regular file in repo: {rel}")
            else:
                _cmp(gen_path, cur, str(rel), drift)
        # 3) 孤児: 正本に無い生成 skill / manifest に無い所有マーカー付き agent 定義
        for marker in (repo / ".claude" / "skills").glob(f"*/{GENERATED_MARKER}"):
            name = marker.parent.name
            if not (repo / ".agents" / "skills" / name).is_dir():
                drift.append(f"orphan generated skill: .claude/skills/{name}")
        # 3b) 所有マーカー付きの hook ファイル / キーが再生成結果に無いのに残っている (targets から外した後の未生成など)
        for rel in (".grok/hooks/mid-harness.json", ".github/hooks/mid-harness.json"):
            cur = repo / rel
            if cur.is_file() and not (out / rel).exists():
                try:
                    if json_owned(json.loads(cur.read_text())):
                        drift.append(f"orphan generated hook file: {rel} (manifest の targets に無い)")
                except json.JSONDecodeError:
                    pass
        agy_cur, agy_out = repo / ".agents" / "hooks.json", out / ".agents" / "hooks.json"
        if agy_cur.is_file():
            try:
                cur_doc = json.loads(agy_cur.read_text())
                out_doc = json.loads(agy_out.read_text()) if agy_out.is_file() else {}
                # 所有判定は生成側と同じ (手書きの同名キーは孤児にしない)
                if isinstance(cur_doc, dict) and agy_key_owned(cur_doc.get("mid-harness")) \
                        and "mid-harness" not in (out_doc if isinstance(out_doc, dict) else {}):
                    drift.append("orphan generated hook key: .agents/hooks.json#mid-harness (manifest の targets に無い)")
            except json.JSONDecodeError:
                pass
        for rel_dir, suffix, fmt in AGENT_LAYOUT.values():
            d = repo / rel_dir
            if not d.is_dir():
                continue
            for p in sorted(d.glob(f"*{suffix}")):
                if p.is_file() and owned_agent_file(p.read_text(), fmt) and not (out / p.relative_to(repo)).exists():
                    drift.append(f"orphan generated agent: {p.relative_to(repo)} (manifest に無い)")

    if drift:
        print(f"drift detected ({len(drift)}):")
        for d in drift:
            print(f"  ! {d}")
        print("fix: core / manifest を直して gen_adapters.py を再実行し、結果を commit する")
        return 1
    print("no drift")
    return 0


if __name__ == "__main__":
    sys.exit(main())
