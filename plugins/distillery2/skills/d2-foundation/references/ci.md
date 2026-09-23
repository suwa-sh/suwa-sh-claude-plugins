# CI (.github/workflows/ci.yml)

F5 の genCi が `.distillery/config.yaml` から生成する。ローカルの `runGates.js` と同じ 5 ゲートを同じ順で回す。

## job と依存

```
static → unit → contract → uc-bdd → acceptance
```

- `needs` で直列にする。安い順に落として早く止める。
- 各 job は checkout → setup-node → `npm ci` の後にゲートのコマンドを実行する。

| job | 実行 | コマンド源 |
|---|---|---|
| static | 各ティアの format_check / lint / typecheck と `commands.arch_test` | config の tiers[].commands / commands.arch_test |
| unit | 各ティアの unit | tiers[].commands.unit |
| contract | 各ティアの contract | tiers[].commands.contract |
| uc-bdd | `cucumber-js --tags "not @browser"` (全 feature が UC シナリオ。CI は全 UC) | 固定 |
| acceptance | `cucumber-js --tags "@acceptance and not @browser"` | 固定 |

## ローカル green = CI green

- ローカルは `runGates.js --uc <slug>` で `@uc:<slug>` に絞り、CI は全 UC を回す。コマンド本体は同じ。
  Cucumber のタグ式に前方一致 (ワイルドカード) はない。全 feature が UC シナリオなので、CI の uc-bdd は `not @browser` で全件を選ぶ。
- `@browser` は `capabilities.browser: true` のときだけ。イテレーション 1 のサンプルは off なので CI にも入れない。
- 判定は exit code だけ。
