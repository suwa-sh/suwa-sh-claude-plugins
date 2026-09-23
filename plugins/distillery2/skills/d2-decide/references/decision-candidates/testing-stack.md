# 決定候補カタログ: テスト方針

4 段テスト (受入 / UC BDD / 契約 / 単体) の構成とスタックを決める。ADR の `scope: [testing]`。
このカタログの既定は distillery2 のイテレーション 1 サンプル (TypeScript モノレポ) 前提。

---

## 4 段テストの位置づけ

| 段 | 目的 | 実装 |
|---|---|---|
| 単体 | ティア内のロジック | 各ティアに同居する単体テスト |
| 契約 | 契約 (OpenAPI/AsyncAPI/DB スキーマ) と実装の一致 | 契約から機械生成する契約テスト |
| UC BDD | UC 1 本の振る舞い | `features/` の Gherkin を API ドライバで実行 |
| 受入 | 受入基準の充足 | `@acceptance:` タグ付き Scenario。ブラウザ確認は `@browser` タグで opt-in |

- ティア別 BDD は作らない。契約は「別ファイルへの転写」ではなく、契約から生成した契約テストで検証する。
- 受入シナリオはブラウザで確かめるものも含めてすべて Gherkin (`features/`) に置く。別ディレクトリの e2e spec は作らない。

## スタックの既定 (TypeScript)

- **選択肢**: cucumber-js (BDD) + vitest (単体 / 契約ランナー) + pglite (DB 契約テスト、docker 不要) + Playwright (ブラウザドライバ、ライブラリとして使用)
- **向く条件**: TypeScript モノレポ。DB は RDB で pglite が使える。
- **向かない / 逸脱**: 別言語スタックのとき、または DB が RDB でないときは各言語の同等ツールに置き換える (ADR で明示)。
- **派生するルール例**:
  ```yaml
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、API ドライバとブラウザドライバで同じ Scenario を実行する"
  - scope: testing
    text: "契約テストは契約から生成し、手で編集しない"
  ```

## トレース

- cucumber の Before で scenario_id を伝播し、HTTP / DB / publish を記録する (in-process から開始)。
- **派生するルール例**:
  ```yaml
  - scope: testing
    text: "テスト用 composition root で tracer を結線し、シナリオごとの実行トレースを残す"
  ```
