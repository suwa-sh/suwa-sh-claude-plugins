#!/usr/bin/env python3
"""manifest の targets ごとに「repo hook を製品に読ませるためにユーザー側で必要な trust」の現在状態を検査し、
足りないものと、その付け方を表示する。リポには何も書かない。ユーザー設定も変更しない。

usage: trust_status.py [<repo>] [--json]
exit:  0 = すべて満たしている / 3 = 未設定あり (報告用。失敗ではない)

検査する製品側の設定 (いずれもユーザーのホーム配下。repo 内のファイルでは有効化できない):
  codex       ~/.codex/config.toml  [projects."<repo>"] trust_level = "trusted"  (+ hook 単位の trust hash は別途)
  grok        ~/.grok/trusted_folders.toml  [folders."<repo>"] trusted = true
  antigravity ~/.gemini/antigravity-cli/settings.json の trustedWorkspaces と ~/.gemini/config/projects/*.json の folderUri
  copilot     ~/.copilot/settings.json の trustedFolders
  claude-code / cursor: 永続的な trust 設定は不要 (Cursor は headless で --trust フラグ)
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _common import load_manifest, resolve_repo  # noqa: E402
from agy_project_id import find as agy_find  # noqa: E402


def _read(p: pathlib.Path) -> str:
    try:
        return p.read_text()
    except OSError:
        return ""


def check(product: str, repo: str, home: pathlib.Path) -> dict:
    """returns {product, needed, ok, detail, how}"""
    if product == "codex":
        text = _read(home / ".codex" / "config.toml")
        ok = re.search(r'^\[projects\."' + re.escape(repo) + r'"\]\s*\n(?:[^\[]*\n)*?\s*trust_level\s*=\s*"trusted"', text, re.M) is not None
        return dict(product=product, needed=True, ok=ok,
                    detail="project trust" + ("" if ok else " が無い"),
                    how=f'~/.codex/config.toml に追記:\n  [projects."{repo}"]\n  trust_level = "trusted"\n'
                        "さらに .codex/hooks.json の hook は hook 単位の trust hash が要る (TUI で承認、または検証だけなら codex exec --dangerously-bypass-hook-trust)")
    if product == "grok":
        text = _read(home / ".grok" / "trusted_folders.toml")
        ok = re.search(r'^\[folders\."' + re.escape(repo) + r'"\]\s*\ntrusted\s*=\s*true', text, re.M) is not None
        return dict(product=product, needed=True, ok=ok,
                    detail="folder trust" + ("" if ok else " が無い"),
                    how=f'grok を repo で起動して /hooks-trust、または grok --trust。記録先: ~/.grok/trusted_folders.toml\n  [folders."{repo}"]\n  trusted = true')
    if product == "antigravity":
        try:
            d = json.loads(_read(home / ".gemini" / "antigravity-cli" / "settings.json") or "{}")
        except json.JSONDecodeError:
            d = {}
        trusted = repo in (d.get("trustedWorkspaces") or [])
        ids = agy_find(repo, home)
        ok = trusted and bool(ids)
        detail = ("trusted" if trusted else "trustedWorkspaces に無い") + " / " + (f"project {ids[0]}" if ids else "project 未登録")
        return dict(product=product, needed=True, ok=ok, detail=detail,
                    how=f'repo で一度 `agy -p "reply OK" --new-project` を実行して project 登録し、~/.gemini/antigravity-cli/settings.json の trustedWorkspaces に "{repo}" (canonical パス) を追加')
    if product == "copilot":
        try:
            d = json.loads(_read(home / ".copilot" / "settings.json") or "{}")
        except json.JSONDecodeError:
            d = {}
        ok = repo in (d.get("trustedFolders") or [])
        return dict(product=product, needed=True, ok=ok,
                    detail="trustedFolders" + ("" if ok else " に無い"),
                    how=f'repo で対話 `copilot` を開き trust プロンプトに答える (~/.copilot/settings.json の trustedFolders に "{repo}" が入る。手編集は CLI に書き戻されて消える)。CI や単発なら GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true')
    if product == "cursor":
        return dict(product=product, needed=False, ok=True, detail="永続 trust 不要 (headless は agent -p --trust)", how="")
    if product == "claude-code":
        return dict(product=product, needed=False, ok=True, detail="永続 trust 不要 (.claude/settings.json の hooks はそのまま読まれる)", how="")
    return dict(product=product, needed=False, ok=True, detail="unknown product", how="")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo", nargs="?")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    repo_path = resolve_repo(args.repo)
    repo = str(repo_path)
    m = load_manifest(repo_path)
    hooks = m.get("hooks") or []
    rows = [check(t, repo, pathlib.Path.home()) for t in m["targets"]]
    missing = [r for r in rows if r["needed"] and not r["ok"]]
    if args.json:
        print(json.dumps({"repo": repo, "hooks_declared": bool(hooks), "rows": rows}, ensure_ascii=False, indent=2))
        return 3 if (hooks and missing) else 0
    print(f"trust status: {repo}")
    if not hooks:
        print("manifest に hooks が無いので、製品側の trust は不要です")
        return 0
    print(f"{'PRODUCT':<12} {'STATE':<8} DETAIL")
    for r in rows:
        state = "-" if not r["needed"] else ("ok" if r["ok"] else "missing")
        print(f"{r['product']:<12} {state:<8} {r['detail']}")
    if missing:
        print("\nhook を有効にするには、次をユーザー側で行ってください (repo 内のファイルでは有効化できません):")
        for r in missing:
            print(f"\n[{r['product']}]\n  " + r["how"].replace("\n", "\n  "))
        return 3
    print("\nすべての製品で repo の trust が揃っています")
    return 0


if __name__ == "__main__":
    sys.exit(main())
