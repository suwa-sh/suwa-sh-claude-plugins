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

### コミット規約

- Conventional Commits に従い、スコープにはプラグイン名を指定する
  - 例: `feat(distillery): add new skill`, `fix(handover): correct path reference`
  - 複数プラグインにまたがる場合やリポジトリ全体の変更はスコープなしでもよい
