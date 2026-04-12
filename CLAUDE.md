# CLAUDE.md

## プラグイン開発ルール

### スキル命名規則

- SKILL.md の `name` フィールドに `プラグイン名:スキル名` 形式でフルプリフィックスを記載する
  - 例: `name: distillery:dist-pipeline`
  - プラグイン名からの自動付与はされない。name フィールドの値がそのままスラッシュコマンドのサジェストに表示される
- スキルディレクトリ名にも短縮プリフィックスを付けて、ディレクトリ一覧でどのプラグインのスキルか判別できるようにする
  - 例: `skills/dist-pipeline/`（distillery の pipeline スキル）

### マーケットプレイス操作

- `claude` CLI は `~/.local/bin/claude` にインストールされている
- マーケットプレイス更新 → プラグインインストールの手順:
  ```bash
  ~/.local/bin/claude plugin marketplace update <marketplace名>
  ~/.local/bin/claude plugin install <プラグイン名>@<marketplace名>
  ```

### distillery 開発プロセス

1. **別ディレクトリで動作確認** — `/private/tmp/distillery-test/` 等で `/distillery:dist-pipeline` を実行
2. **キャッシュの変更をリポジトリに取り込む** — 動作確認中に `~/.claude/plugins/cache/` 配下のスキルファイルを直接修正した場合、その差分を本リポジトリの `plugins/distillery/skills/` に反映する
3. **実行結果をサンプルに反映** — テスト出力の `docs/` からドキュメント類（yaml, md, tsv）を `samples/distillery/` にコピー（storybook-app, node_modules は除外）
4. **ドキュメント不足の見直し** — README.md のスキル名・コマンド例・Skills テーブルが最新のスキル構成と一致しているか確認
5. **コミット＆プッシュ** — Conventional Commits 規約でコミットし、push
6. **マーケットプレイス更新＆プラグイン再インストール**:
   ```bash
   ~/.local/bin/claude plugin marketplace update suwa-sh-claude-plugins
   ~/.local/bin/claude plugin install distillery@suwa-sh-claude-plugins
   ```

### コミット規約

- Conventional Commits に従い、スコープにはプラグイン名を指定する
  - 例: `feat(distillery): add new skill`, `fix(handover): correct path reference`
  - 複数プラグインにまたがる場合やリポジトリ全体の変更はスコープなしでもよい
