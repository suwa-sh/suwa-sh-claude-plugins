---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-frontend / tier-backend-api)"
related_ids: []
related_files:
  - "docs/specs/latest/_cross-cutting/api/openapi.yaml"
  - "packages/contracts/api-types/apis/DefaultApi.ts"
  - "packages/contracts/api-client/apis/DefaultApi.ts"
severity: spec-gap
---

# 変更要望: openapi.yaml の genre/material_type enum(日本語ラベル)が生成コードの構文エラーを引き起こす

## 現状の仕様

`_cross-cutting/api/openapi.yaml` の `searchBooks` の genre / material_type クエリパラメータの enum は
数値キー + 日本語ラベル(例: `1: 文学`, `2: 理工`)で定義されている。x-enum-varnames 等の英語識別子指定は無い。

## 実装で判明した問題

openapi-generator(typescript-fetch)がこの enum を TypeScript オブジェクトへ変換する際、
1件目のプロパティ名サニタイズが失敗し、生成された `packages/contracts/{api-types,api-client}/apis/DefaultApi.ts`
の `SearchBooksGenreEnum` / `SearchBooksMaterialTypeEnum` が構文エラーになる:

```ts
export const SearchBooksGenreEnum = {
    : '文学',     // プロパティ名が空(構文エラー)
    2: '理工',
    ...
} as const;
```

esbuild 単独実行で `ERROR: Expected identifier but found ":"` を確認済み。`DefaultApi.ts` はファイル単位で
パースされるため、genre と無関係な `getBook` / `createLoan` を使う場合でも barrel(`apis/index.ts` →
`packages/contracts/{api-types,api-client}/index.ts`)経由の import は全て巻き添えで失敗する。

本UCの backend-api / frontend の両実装はこの barrel を経由せず `runtime.ts` と `models/*.ts` を
個別ファイルとして直接 import することで回避し、契約自体(`packages/contracts/`)は無編集のまま
UC を完了させた(coding-rules.md rule 1「契約型の直接編集禁止」準拠)。回避策で進められたため
severity は `spec-gap` とするが、`searchBooks` を実際に呼び出す UC(書籍を検索する 等)は
この迂回が使えず、根本修正が無ければ実装を完了できない可能性が高い。

根拠: `docs/impl/latest/19ec0182/issues/20260729_011213_api_types_defaultapi_syntax_error.md`,
`docs/impl/latest/19ec0182/issues/20260729101416_defaultapi-generated-syntax-error.md`

## 提案する変更

openapi-generator の `enumPropertyNaming` 設定を見直すか、`openapi.yaml` の genre/material_type enum に
`x-enum-varnames`(英語識別子、例: `LITERATURE`, `SCIENCE`)を追加してから契約を再生成する
(S0 bootstrap P4_contracts / S3 contracts の再実行)。再生成後、本UC・他UCの迂回実装
(`loanConfirmationApiClient.ts`, `booksController.ts` の個別 import)を barrel 経由の `DefaultApi` import に
戻すクリーンアップが可能になる。

## 影響範囲

- 影響UC: `searchBooks` を利用する「書籍を検索する」(uc_id: 6212b978)は本件が未解消のままだと
  barrel 経由の実装ができない可能性が高い。
- 対象パイプライン: dist-spec(openapi.yaml の enum 定義、または契約生成テンプレート/generator設定)。
