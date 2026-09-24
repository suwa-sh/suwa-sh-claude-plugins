# mode=integrate: UC BDD と受入の結合 (固定指示)

pending だった step を実装し、テスト用の composition root に計装 (tracer) を結線し、UC BDD と受入ゲートを通す。
ティア実装は変更しない (integration writer)。

計装の目的は as-built の図 (シーケンス・データフロー) で、**UC が通る全ティア・全レイヤを 1 本のトレースで見せる**こと。
計装していない部品は図に出ない。

## 読むもの

- `features/<業務>/<slug>.feature`、`features/step_definitions/<slug>.steps.ts` (pending の骨格)、`features/support/**`
- `packages/test-support/README.md` (World / hooks / drivers / tracer の使い方と結線契約)
- `contracts/generated/slices/<slug>/contract-slice.json`
- 各ティアの `src/test-app.ts` (提供側の入口)、frontend ティアの画面の入口関数、`packages/contracts/<id>/` (消費側のクライアント・stub)
- `docs/requirements/use-cases.yaml` の該当行 (`tiers`: この UC が通るティア)
- `.distillery/config.yaml` (commands、capabilities.browser)

## 書くもの

- `features/step_definitions/<slug>.steps.ts` (pending を実装に置き換える)
- `features/support/**` の追加 (World への UC 固有の補助、composition root の結線)。共通 helper の構造署名や tracer 本体は変更しない
- `capabilities.browser: true` かつ `@browser` シナリオがある場合: `features/support/drivers/browser.ts` の該当操作

## 規則

- **入口は UC の最前のティアから入る**。frontend が関与する UC では、`もし` の step は画面の入口関数
  (例: `submitLoanCheckout`) を呼び、その API 呼び出しに `this.api.asFetch({ tier, layer: 'api-client' })` を渡す
  (生成クライアントの `options.fetch`。ブラウザ無しで「画面 → API クライアント → backend」がトレースに乗る)。
  frontend が無い UC だけ `this.driver.request()` で API を直接叩く。実装の内部関数 (usecase やリポジトリ) を step から直接呼ばない
- **レイヤの境界オブジェクトを全部 `traced()` で包む**: 画面の入口 (`tracedFn`、layer `screen`)、backend の usecase / repository / gateway、
  DB クライアント (`tracePg`)、publisher (`tracePublisher`)。それぞれ `{ tier, layer }` を付ける (README の結線契約)。
  純粋関数だけの層 (domain) は包まなくてよい
- Then はシナリオの観測結果を確かめる。トレースの結線が正しく、`.distillery/runs/<slug>/traces/<scenario_id>.jsonl` が
  シナリオごとに出ることを確認する (as-built がこれを読む)
- ティア実装 (`apps/*/src`) は変更しない。UC BDD が落ちたら「どのティアの何が要求と食い違うか」を分析して報告する
  (修正は d2-run が attempt++ で該当ティアに戻す)
- 契約に無い前提 (認証ヘッダ等) が結合に必要なら、World 内での注入を許容する。注入箇所に根拠 (issue のパスか AssumptionRecord の id) と
  「暫定注入・契約確定後に削除」のコメントを付ける。前提の新規抽出はしない (それは tier の責務)

## 完了条件

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js --uc <slug> --from uc-bdd` が exit 0 (uc-bdd → acceptance)
- 受入 (`@acceptance:`) のシナリオが UC の spec_ids の受入基準を全部覆っている (`checkScenario.js <feature> --use-cases ... --requirements ... --acceptance-dir features/acceptance` で再確認)
- **計装の範囲**: 正常系のトレース 1 本に、`use-cases.yaml` の `tiers` の全ティアが `meta.tier` として現れ、
  各ティアで少なくとも 1 つの部品 (`call`) が現れる。確認コマンド:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/extractAsBuilt.js --run .distillery/runs/<slug>
  # 標準出力に「計装なしのティア」が出なければよい (出たら結線を足す)
  ```

- 報告に「シナリオ数と結果 / トレース出力の有無と計装の範囲 (ティアとレイヤ) / 失敗時の分析 (ティアと食い違い)」を書く
