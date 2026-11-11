# CLAUDE.md

## プラグイン開発ルール

### スキル命名規則

- SKILL.md の `name` は **ディレクトリ名と同じ**にする (Agent Skills 仕様: 英小文字・数字・ハイフンのみ、親ディレクトリ名と一致。https://agentskills.io/specification)
  - 例: `skills/dist-pipeline/SKILL.md` に `name: dist-pipeline`
  - Claude Code はプラグイン名を自動で前置する (`/distillery:dist-pipeline`。https://code.claude.com/docs/en/skills 、2026-09-26 確認)。`name` に `プラグイン名:` を書かない
  - frontmatter は仕様の許可項目 (`name` / `description` / `license` / `compatibility` / `metadata` / `allowed-tools`) だけにする。Claude Code 専用の項目 (`user-invocable` 等) は仕様の検証ツールでエラーになる
  - 全プラグインが移行済み (2026-11-12。コロンを受け付けないエージェントがあるため)
- スキルディレクトリ名にプリフィックスを付けて、どのプラグインのスキルか名前で判別できるようにする
  - 例: `skills/dist-pipeline/`（distillery の pipeline スキル）、`skills/cc-handover/`（cc の handover スキル）
  - 例外: toolbox は汎用スキル集なのでプリフィックスを付けない (`skills/human-html-review/`)
- スキル本文・README・指示ファイルで他のスキルを呼ぶときは、コロン無しの名前 (`human-html-review`、`d2-run`) で書く。Claude Code の Skill ツールもコロン無しの名前で解決できる (2026-11-12 実測)
  - サブエージェント (`agents/*.md`) の呼び名 (`distillery2:d2-verifier` 等) はスキルではないので、名前空間付きのまま書く

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
   version の正本はこのファイルのみ（SKILL.md 等へ埋め込まない。skill は実行時に `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` から読む）。
   **bump の要否は install cache に入るかで決める**: cache に含まれるのは `plugins/<plugin>/` 配下のみ
   （2026-08-13 実測: `~/.claude/plugins/cache/.../distillery/<ver>/` に samples は無い）。
   `samples/` やリポ直下 README だけの変更は bump・再インストール不要。逆に `plugins/` 配下を
   1 文字でも変えたら bump + 手順 6〜8 の再インストールまで必須
6. **コミット＆プッシュ** — Conventional Commits 規約でコミットし、push
7. **マーケットプレイス更新＆プラグイン再インストール**:
   ```bash
   ~/.local/bin/claude plugin marketplace update suwa-sh-claude-plugins
   ~/.local/bin/claude plugin uninstall <プラグイン名>
   ~/.local/bin/claude plugin install <プラグイン名>@suwa-sh-claude-plugins
   ```
   - `install` のみだと "already installed" で no-op になり、バージョンが更新されない。**必ず `uninstall` → `install` の順で再インストールする**
8. **バージョン確認** — `~/.local/bin/claude plugin list`（または `~/.claude/plugins/installed_plugins.json`）で該当プラグインの version が bump した semver と一致し、gitCommitSha が push したコミットと一致することを確認する
9. **CI確認** — GitHub Actions の結果を確認し、すべてのジョブが成功していることを確認する（失敗している場合は修正して再push）

### コミット規約

- Conventional Commits に従い、スコープにはプラグイン名を指定する
  - 例: `feat(distillery): add new skill`, `fix(handover): correct path reference`
  - 複数プラグインにまたがる場合やリポジトリ全体の変更はスコープなしでもよい
