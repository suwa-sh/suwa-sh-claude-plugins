# frontend/tsconfig.json の module 設定のままだと ts-node 経由の cucumber-js が相対 import を解決できない

- stage: S4 tier-impl (tier-frontend)
- 検出日時: 2026-07-29
- 深刻度: 非 blocker(frontend/tsconfig.json に ts-node 用オーバーライドを追加して解消済み)

## 仕様の記載(S0/S2 scaffold)

`frontend/tsconfig.json` は `../tsconfig.base.json`(`"module": "ESNext"`)を extends、
`frontend/features/cucumber.cjs` は `requireModule: ["ts-node/register"]` で TypeScript の
step definition を実行する構成。S2 の red baseline 時点では step ファイルが
`@cucumber/cucumber` のみを import しており(ローカルファイルへの相対 import なし)、
この問題は顕在化していなかった。

## 実装で判明した事実

tier-frontend.md のロジックをテスト可能にするため `features/steps/19ec0182.steps.ts` から
`../../src/components/loanConfirmation`(拡張子なしの相対 import)を追加したところ、
`npm run bdd --workspace=frontend` が以下のエラーで失敗した:

```
Error: Cannot find module '.../frontend/src/components/loanConfirmation' imported from
  .../frontend/features/steps/19ec0182.steps.ts
```

原因: tsconfig の `"module": "ESNext"` により ts-node が ESM 構文で TS をトランスパイルし、
Node の `require()` が(Node 22 の require(esm) 経由で)ネイティブ ESM リゾルバに委譲される。
ESM リゾルバは CJS と異なり拡張子省略・index 解決を自動で行わないため、拡張子なしの相対 import が
解決できない。

## 実装での対応

Context7(`/typestrong/ts-node`)で ts-node 公式ドキュメントの「Overriding tsconfig.json Module
for ts-node」パターンを確認し、`frontend/tsconfig.json` に ts-node 専用の compilerOptions
オーバーライドを追加した(vitest/esbuild 側の `"module": "ESNext"` はそのまま維持):

```jsonc
{
  "extends": "../tsconfig.base.json",
  "include": ["src", "test", "features"],
  "ts-node": {
    "compilerOptions": { "module": "CommonJS" }
  }
}
```

これにより ts-node 経由の cucumber-js 実行時のみ CommonJS へトランスパイルされ、
拡張子なしの相対 import が解決できるようになった(ゲート 4 が pass することを確認済み)。

## 提案

- 他 tier(tier-backend-api / tier-worker)が同じ scaffold パターン(tsconfig `module: ESNext`
  + ts-node/register + cucumber-js)を使い、かつ step definition からローカル TS ファイルを
  import する場合、同じ問題に当たる可能性がある。S0 bootstrap の scaffold テンプレートに
  この `ts-node` オーバーライドを標準で含めることを推奨する
