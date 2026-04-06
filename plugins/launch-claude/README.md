# launch-claude

ghq 管理リポジトリで Ghostty タブに Claude Code セッションを起動するプラグイン。

## 概要

リポジトリ名やキーワードを伝えるだけで、ghq 管理下のリポジトリを検索し、
Ghostty の新しいタブで Claude Code セッション（`--dangerously-skip-permissions`）を起動する。

## インストール

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install launch-claude@suwa-sh-claude-plugins
```

## 前提条件

| ツール     | 用途                       | インストール                               |
| ---------- | -------------------------- | ------------------------------------------ |
| ghq        | リポジトリ管理・検索       | `brew install ghq`                         |
| Ghostty    | ターミナル（タブ起動先）   | [ghostty.org](https://ghostty.org/)        |
| claude CLI | Claude Code セッション実行 | `npm install -g @anthropic-ai/claude-code` |

## 使い方

```
/launch-claude リポジトリ名のキーワード1 リポジトリ名のキーワード2 リポジトリ名のキーワード3
```

キーワードで ghq リポジトリを検索し、一致するものが1つならそのまま起動、
複数あれば選択肢を提示する。

## 注意事項

- Ghostty が起動済み（ウィンドウが存在する状態）である必要がある
- macOS 専用（AppleScript を使用）
