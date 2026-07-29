# learning: tsconfig module:ESNext + ts-node/register で拡張子なし相対importが解決できない

## 何が起きたか

`frontend/features/steps/19ec0182.steps.ts` から `../../src/components/loanConfirmation`
(拡張子なしの相対import)を追加したところ、`npm run bdd --workspace=frontend` が
`Error: Cannot find module '.../frontend/src/components/loanConfirmation' imported from ...`
で失敗した。S2 の red baseline 時点では step ファイルが `@cucumber/cucumber` のみを import しており
ローカルファイルへの相対importが無かったため、この問題は顕在化していなかった。

## なぜ(根本原因)

`frontend/tsconfig.json` は `../tsconfig.base.json`(`"module": "ESNext"`)を extends しており、
`frontend/features/cucumber.cjs` は `requireModule: ["ts-node/register"]` で TypeScript の
step definition を実行する構成だった。tsconfig の `"module": "ESNext"` により ts-node が
ESM構文でTSをトランスパイルすると、Nodeの `require()` が(Node 22の `require(esm)` 経由で)
ネイティブESMリゾルバに委譲される。ESMリゾルバはCJSと異なり拡張子省略・index解決を自動で
行わないため、拡張子なしの相対importが解決できない。

## どう回避したか

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

これにより ts-node 経由の cucumber-js 実行時のみ CommonJS へトランスパイルされ、拡張子なしの
相対importが解決できるようになった。

## 次回どうすべきか

`module: ESNext` + `ts-node/register` + `cucumber-js` という scaffold パターンを使う全tier
(tier-frontend / tier-backend-api / tier-worker)は、step definition からローカルTSファイルを
import した瞬間に同じ問題を踏む。S0 bootstrap の scaffold テンプレート(`tsconfig.json` 生成)に
この `ts-node` オーバーライドを標準で含めておけば、tierごとに同じ調査・修正を繰り返さずに済む。
