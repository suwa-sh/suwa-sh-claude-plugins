# frontend ティアのルール

- **入力**: 自ティアが consumer の契約 (OpenAPI) の生成物、`packages/ui/` の部品、UC の `.feature`。
- **UI 部品は `packages/ui/` のみ使用**。不足コンポーネント・不足 variant は自作せず、design への変更要求を経由する。
- API 呼び出しは `packages/contracts` の生成クライアント経由。`fetch` / `axios` の直書き禁止。
- 画面は Storybook の story を構造の正として組む。乖離が必要なら実装で曲げず issues → 還流で変更要求する。
- 担保するのは構造的整合 (部品在庫・画面状態) まで。ピクセル忠実度は未保証。
