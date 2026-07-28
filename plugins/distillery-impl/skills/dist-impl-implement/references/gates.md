# 6 段ゲート定義(distillery-impl)

ゲートは「通過しなければ次 stage に進めない」実行可能な検査。コマンドの正本は実装リポの
`impl-config.yaml`(`commands` / `integration_commands`)であり、本書はゲートの意味と判定規則を定める。

| # | ゲート | 実行者(stage) | コマンド源 | 判定 |
|---|---|---|---|---|
| 1 | format | Implementer(S4)/ CI | commands.format_check | **check-only** で exit 0 |
| 2 | lint | Implementer(S4)/ CI | commands.lint | exit 0(qlty 併用可) |
| 3 | TDD(単体) | Implementer(S4)/ CI | commands.test | 対象 tier の全テスト pass |
| 4 | tier BDD | Implementer(S4)/ CI | commands.bdd | `{tier_dir}/features/{uc_id}.feature` 全シナリオ pass |
| 5 | UC BDD | integration writer(S6)/ CI | integration_commands.uc_bdd | `features/uc/{uc_id}.feature` 全シナリオ pass |
| 6 | ATDD | integration writer(S7)/ CI | integration_commands.atdd | uc-map の atdd_scenarios に列挙された Scenario 全 pass(選択実行) |

## 判定規則

- **exit code が正**。出力文字列の grep で pass 判定しない
- スキップ・pending のシナリオは pass に数えない(ゲート 4〜6)
- ゲート実行前にテストが 1 本も無い状態は fail 扱い(red baseline の逆流防止)

## check-only 規約(ゲート 1〜2、S4 並走中)

- tier 並走中の Implementer は**自 tier ディレクトリに限定した check-only コマンド**のみ実行する
  (例: `biome check {tier_dir}` / `ruff check {tier_dir}`)。リポ全体を対象にしない
- **書き換えを伴う formatter(--write / --fix)は S4 中は禁止**。並走 tier の write-set を侵すため。
  必要な整形は Implementer が自分のコードを手で直すか、barrier 後にオーケストレータが単一 writer として実行する

## 失敗時挙動

- ゲート 3〜4 の fail: Implementer が TDD ループ内で修正(リトライは Implementer の裁量。
  ただし同一 fail が 3 回続いたら仕様疑義を疑い issues/ に書いて状況を返す)
- ゲート 5〜6 の fail: integration writer は修正せず分析を返す(S4 差し戻しはオーケストレータ判断)
- 環境起因の fail(依存欠落・ポート衝突等)はゲート結果と区別して報告する
