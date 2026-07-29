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

### プラグイン開発プロセス

1. **別ディレクトリで動作確認** — `/private/tmp/<plugin>-test/` 等でスキルを実行
2. **キャッシュの変更をリポジトリに取り込む** — 動作確認中に `~/.claude/plugins/cache/` 配下のスキルファイルを直接修正した場合、その差分を本リポジトリの `plugins/<plugin>/` に反映する
3. **実行結果をサンプルに反映**（サンプルがあるプラグインのみ） — テスト出力からドキュメント類（yaml, md, tsv）を `samples/<plugin>/` にコピー（node_modules・storybook build 出力等のビルド成果物は除外。手書き・生成ソースコード（storybook-app/src 等）は同梱してよい）
4. **ドキュメント不足の見直し** — README.md のスキル名・コマンド例・機能説明が最新のスキル構成と一致しているか確認
5. **version bump** — 変更した plugin の `plugins/<plugin>/.claude-plugin/plugin.json` の `version`（semver）を上げる。
   **bump はリリース手順の一部**（install cache がバージョン名ディレクトリになるため、bump を忘れると古い cache が使われ続ける）。
   version の正本はこのファイルのみ（SKILL.md 等へ埋め込まない。skill は実行時に `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` から読む）
6. **コミット＆プッシュ** — Conventional Commits 規約でコミットし、push
7. **マーケットプレイス更新＆プラグイン再インストール**:
   ```bash
   ~/.local/bin/claude plugin marketplace update suwa-sh-claude-plugins
   ~/.local/bin/claude plugin uninstall <プラグイン名>
   ~/.local/bin/claude plugin install <プラグイン名>@suwa-sh-claude-plugins
   ```
   - `install` のみだと "already installed" で no-op になり、バージョンが更新されない。**必ず `uninstall` → `install` の順で再インストールする**
8. **バージョン確認** — `~/.local/bin/claude plugin list`（または `~/.claude/plugins/installed_plugins.json`）で該当プラグインの version が bump した semver と一致し、gitCommitSha が push したコミットと一致することを確認する

### コミット規約

- Conventional Commits に従い、スコープにはプラグイン名を指定する
  - 例: `feat(distillery): add new skill`, `fix(handover): correct path reference`
  - 複数プラグインにまたがる場合やリポジトリ全体の変更はスコープなしでもよい
