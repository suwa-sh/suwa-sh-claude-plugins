# CI (.github/workflows/ci.yml)

F5 の genCi が `.distillery/config.yaml` から生成する。ローカルの `runGates.js` と同じ 5 ゲートを同じ順で回す。

## job と依存

```
static → unit → contract → uc-bdd → acceptance
```

- `needs` で直列にする。安い順に落として早く止める。
- 各 job は checkout → setup-node → `npm ci` の後にゲートのコマンドを実行する。

全 job のコマンドは `runGates.js` と同じく config から組む。CI 変種にするため次を変換する。

- `{report}` を書き出すフラグ (`--reporter=json --outputFile={report}` / `--format json:{report}`) は落とす。CI の判定は exit code だけ。
- cucumber の `--tags` から `@uc:{slug}` を外し、CI は全 UC を回す (下表のタグ式に置き換える)。

| job | 実行 | コマンド源 |
|---|---|---|
| static | 各ティアの format_check / lint / typecheck と arch_test | config の tiers[].commands / commands.arch_test |
| unit | 各ティアの unit | tiers[].commands.unit |
| contract | 各ティアの contract | tiers[].commands.contract |
| uc-bdd | `commands.uc_bdd` の `@uc:{slug}` を `not @browser` に置換 (全 feature が UC シナリオ。CI は全 UC) | commands.uc_bdd |
| acceptance | `commands.acceptance_api` の `@uc:{slug} and` を外し `@acceptance and not @browser` | commands.acceptance_api |
| acceptance (browser step) | `capabilities.browser: true` のときだけ `commands.acceptance_browser` を `@acceptance and @browser` で追加 | commands.acceptance_browser |

## ローカル green = CI green

- ローカルは `runGates.js --uc <slug>` で `@uc:<slug>` に絞り、CI は全 UC を回す。コマンド源は同じ config。
  Cucumber のタグ式に前方一致 (ワイルドカード) はない。全 feature が UC シナリオなので、CI の uc-bdd は `not @browser` で全件を選ぶ。
- `@browser` は `capabilities.browser: true` のときだけ。off のサンプルでは CI にもブラウザ step を入れない。
- 判定は exit code だけ。
