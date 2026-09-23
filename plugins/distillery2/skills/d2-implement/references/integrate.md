# mode=integrate: UC BDD と受入の結合 (固定指示)

pending だった step を実装し、テスト用の composition root に計装 (tracer) を結線し、UC BDD と受入ゲートを通す。
ティア実装は変更しない (integration writer)。

## 読むもの

- `features/<業務>/<slug>.feature`、`features/step_definitions/<slug>.steps.ts` (pending の骨格)、`features/support/**`
- `packages/test-support/README.md` (World / hooks / drivers / tracer の使い方)
- `contracts/generated/slices/<slug>/contract-slice.json`
- 各ティアの `src/test-app.ts` (提供側の入口) と `packages/contracts/<id>/` (消費側のクライアント・stub)
- `.distillery/config.yaml` (commands、capabilities.browser)

## 書くもの

- `features/step_definitions/<slug>.steps.ts` (pending を実装に置き換える)
- `features/support/**` の追加 (World への UC 固有の補助、composition root の結線)。共通 helper の構造署名や tracer 本体は変更しない
- `capabilities.browser: true` かつ `@browser` シナリオがある場合: `features/support/drivers/browser.ts` の該当操作

## 規則

- step は API ドライバ経由で振る舞いを確かめる。実装の内部関数を直接呼ばない
- Then はシナリオの観測結果を確かめる。トレースの結線が正しく、`.distillery/runs/<slug>/traces/<scenario_id>.jsonl` が
  シナリオごとに出ることを確認する (as-built がこれを読む)
- ティア実装 (`apps/*/src`) は変更しない。UC BDD が落ちたら「どのティアの何が要求と食い違うか」を分析して報告する
  (修正は d2-run が attempt++ で該当ティアに戻す)
- 契約に無い前提 (認証ヘッダ等) が結合に必要なら、World 内での注入を許容する。注入箇所に根拠 (issue のパスか AssumptionRecord の id) と
  「暫定注入・契約確定後に削除」のコメントを付ける。前提の新規抽出はしない (それは tier の責務)

## 完了条件

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js --uc <slug> --from uc-bdd` が exit 0 (uc-bdd → acceptance)
- 受入 (`@acceptance:`) のシナリオが UC の spec_ids の受入基準を全部覆っている (`checkScenario.js` で再確認)
- 報告に「シナリオ数と結果 / トレース出力の有無 / 失敗時の分析 (ティアと食い違い)」を書く
