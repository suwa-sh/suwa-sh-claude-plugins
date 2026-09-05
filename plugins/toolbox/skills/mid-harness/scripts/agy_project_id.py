#!/usr/bin/env python3
"""Antigravity CLI の project registry (~/.gemini/config/projects/*.json) から、
folderUri が <repo> に一致する project の ID を 1 つ返す。無ければ空文字。複数なら先頭 (stderr に警告)。

usage: agy_project_id.py <repo>     (HOME を差し替えればテストできる)
"""
from __future__ import annotations

import json
import pathlib
import sys


def find(repo: str, home: pathlib.Path) -> list[str]:
    repo = repo.rstrip("/")
    want = {f"file://{repo}", f"file://{repo}/"}
    ids: list[str] = []
    for f in sorted((home / ".gemini" / "config" / "projects").glob("*.json")):
        try:
            j = json.loads(f.read_text())
        except Exception:
            print(f"agy_project_id: {f.name} を JSON として読めないので skip", file=sys.stderr)
            continue
        # 個別エントリの型が壊れていても検索全体は止めない
        pid = j.get("id") if isinstance(j, dict) else None
        if not isinstance(pid, str) or not pid.strip():
            continue
        pr = j.get("projectResources")
        resources = pr.get("resources") if isinstance(pr, dict) else None
        if not isinstance(resources, list):
            continue
        for r in resources:
            uri = r.get("folderUri") if isinstance(r, dict) else None
            if isinstance(uri, str) and uri in want:
                ids.append(pid)
                break
    return ids


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    ids = find(sys.argv[1], pathlib.Path.home())
    if len(ids) > 1:
        print(f"agy_project_id: project が複数あります ({len(ids)})。先頭 {ids[0]} を使います", file=sys.stderr)
    print(ids[0] if ids else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
