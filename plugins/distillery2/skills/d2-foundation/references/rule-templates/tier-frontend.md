# frontend ティアのルール

- **入力**: 自ティアが consumer の契約 (OpenAPI) の生成物、`packages/ui/` の部品、UC の `.feature`。
- **UI 部品は `packages/ui/` のみ使用**。不足コンポーネント・不足 variant は自作せず、design への変更要求を経由する。
- API 呼び出しは `packages/contracts` の生成クライアント経由。`fetch` / `axios` の直書き禁止。
  生成クライアントの `options.fetch` は上位から注入できるようにする (UC BDD がブラウザ無しで画面 → API を通し、計装する)。
- 画面の操作 (送信・確定など) は、描画と切り離して **ブラウザ無しで呼べる入口関数**として export する。
- 画面は Storybook の story を構造の正として組む。乖離が必要なら実装で曲げず issues → 還流で変更要求する。
- 担保するのは構造的整合 (部品在庫・画面状態) まで。ピクセル忠実度は未保証。
