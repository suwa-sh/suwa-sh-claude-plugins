# packages/contracts/api-types/apis/DefaultApi.ts に構文エラー(生成物の欠陥)

## 仕様の記載

`docs/dev-rules/tier-rules.md` / `coding-rules.md`: backend 系は
`packages/contracts/server-stubs` / `api-types`(生成物)起点でハンドラを実装し、契約型は直接編集禁止。

## 実装で判明した事実

`packages/contracts/api-types/apis/DefaultApi.ts` の `SearchBooksGenreEnum` /
`SearchBooksMaterialTypeEnum` の定義が構文エラーになっている(1387〜1406行付近):

```ts
export const SearchBooksGenreEnum = {
    : '文学',     // 本来 `1: '文学'` になるはずのキーが欠落
    2: '理工',
    ...
} as const;
```

openapi.yaml の genre/material_type enum(数値キー + 日本語ラベル)を openapi-generator が
TypeScript オブジェクトに変換する際、キー `1` が脱落したとみられる(codegen のバグ、または
入力 openapi.yaml 側の enum 定義の問題)。この結果 `apis/DefaultApi.ts` を import する経路
(barrel `packages/contracts/api-types/index.ts` 経由)は tsc/ts-node でコンパイルエラーになる。

## 実装での回避

本 UC(貸出作成 API)では `SearchBooks*` 系の型は不要なため、barrel を経由せず
`packages/contracts/api-types/models/{CreateLoanRequest,LoanResponse,ProblemDetails}.ts` を
直接 import することで `DefaultApi.ts` のコンパイルを回避した
(`backend-api/src/http/loansController.ts`)。契約型自体は編集していない。

## 提案

S0/S3 の契約 codegen 再実行時(openapi.yaml の genre/material_type enum 定義見直し、または
openapi-generator の設定/バージョン調整)で `apis/DefaultApi.ts` を再生成し修正する。
書籍検索 API(`searchBooks` 等)を実装する tier が別途この barrel を必要とする場合は
本issueをブロッカーとして扱う必要がある。
