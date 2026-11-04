# CI (.github/workflows/ci.yml)

F5 と F8 の genCi が生成する。機械チェックの一括実行 `node scripts/check.mjs --mode ci` を回す 1 本の job (0.3.0)。一括チェックは genCheck.js が `.distillery/config.yaml` から作る (コマンドの正はローカルの `runGates.js` と同じ config)。

走るのは main と `feature/**` への push (`on: push: branches: [main, ## job

- `check` の 1 本: checkout (credential を残さない) → setup-node → `npm ci` → qlty の install (SHA ピン) → `node scripts/check.mjs --mode ci`
- 一括チェックは 6 観点を順に回し、落ちたものを最後にまとめて exit 1: generate (生成物の鮮度) → format → lint (アーキテストを含む) → build → test (単体・提供側の契約・UC のシナリオ・受入) → security (秘密情報・ティアごとの依存の脆弱性と SAST)
- generate は distillery2 のスクリプトが要る。CI では `.distillery/distillery2.lock.json` の repo と commit を取る (genCheck.js がプラグインの commit を書く)

一括チェックのコマンドは config から組む。CI 変種にするため次を変換する (genCheck.js)。

- `{report}` を書き出すフラグ (`--reporter=json --outputFile={report}` / `--format json:{report}`) は落とす。判定は exit code だけ。
- 単体と契約は、テストが 0 件のティアで落ちないよう `--passWithNoTests` を付ける (ローカルの runGates には付けない。red baseline は 0 件で落ちることを使う)。契約は提供側だけ。
- cucumber の `--tags` から `@uc:{slug}` を外し、全 UC を回す (uc-bdd は `not @browser`、受入は `@acceptance and not @browser`。`capabilities.browser: true` のときだけ `@acceptance and @browser` も)。

## コミットのとき (hook)

`.githooks/commit-msg` (genCheck.js が生成。`git config core.hooksPath .githooks` は genCheck.js とルートの package.json の `prepare` が入れる) が `node scripts/check.mjs --mode hook` を回す。
コミットするファイルに関わるものだけ: 変えたティアの format・lint・build・単体テスト、文書類の format・lint、生成物の鮮度、秘密情報。d2-run の commit (件名が `impl(` `req(` `req: ` `decide: ` `foundation: ` `precheck(` `feedback` で始まるか、trailer に `UC-Slug:`) は回さない。

きだけ `commands.acceptance_browser` を `@acceptance and @browser` で追加 | commands.acceptance_browser |

## ローカル green = CI green

- ローカルは `runGates.js --uc <slug>` で `@uc:<slug>` に絞り、CI は全 UC を回す。コマンド源は同じ config。
  Cucumber のタグ式に前方一致 (ワイルドカード) はない。全 feature が UC シナリオなので、CI の uc-bdd は `not @browser` で全件を選ぶ。
- `@browser` は `capabilities.browser: true` のときだけ。off のサンプルでは CI にもブラウザ step を入れない。
- 判定は exit code だけ。
