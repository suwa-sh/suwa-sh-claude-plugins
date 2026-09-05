# AGENTS.md

このファイルは、すべてのコーディングエージェントが共有する行動契約と、知識の読み分けルールの正本です。

## 行動契約

- 変更は小さく、目的ごとに commit する
- 推測で設定やライブラリの使い方を変えない。公式ドキュメントで確認してから変更する
- 破壊的な操作 (削除、履歴改変、外部への送信) は実行前に確認する

## 標準コマンド

<!-- ビルド / テスト / lint のコマンドをここに書く -->

## 知識の読み分け

- リポジトリ知識の全体像が必要なときは `docs/README.md` から辿る
- 作業開始時に `.agents/memory/index.md` を読み、対象タスクに必要なリンクだけを追加で読む
- スキル実行時は、そのスキルの `SKILL.md` と参照された資料を優先する
- 新しいトラブルシューティングは、まず該当スキルの `references/` へ記録する
- 複数スキルに影響する場合は `.agents/memory/troubleshooting/` へ昇格する

## 中ハーネスの構成

この repository は portable core (`AGENTS.md` / `docs/` / `.agents/`) と、そこから生成した製品別 adapter (`.claude/` / `.codex/` など) に分かれています。adapter は手修正せず、`.agents/harness.yaml` と core を直して再生成します (mid-harness skill の `audit` でドリフトを検査します)。
