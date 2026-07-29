# packages/contracts/api-client/apis/DefaultApi.ts が構文エラーで import 不能(全 tier に影響する blocker)

- stage: S4 tier-impl (tier-frontend)
- 検出日時: 2026-07-29
- 深刻度: blocker(この UC/tier に限らず api-client を使う全実装が影響を受ける)

## 仕様の記載(契約生成物)

`packages/contracts/api-client/apis/DefaultApi.ts` は openapi.yaml から typescript-fetch で
生成された `DefaultApi` クラス(全エンドポイントの HTTP クライアント)。`packages/contracts/api-client/index.ts`
経由でこのファイルを再エクスポートしており、api-client を使う実装はこの barrel から `DefaultApi` を
import する想定。

## 実装で判明した事実

`SearchBooksGenreEnum`(searchBooks の genre クエリパラメータ列挙)の生成コードが構文エラーを含む:

```ts
export const SearchBooksGenreEnum = {
    : '文学',      // ← プロパティ名が空(構文エラー)
    2: '理工',
    3: '児童書',
    ...
} as const;
```

genre の enum 値がすべて日本語(非 ASCII)のため、openapi-generator の enum 変数名サニタイズが
1 件目のみ空文字列になり(2 件目以降はフォールバックで数値キーが振られている)、TypeScript として
パース不能な構文になっている。

esbuild(vitest が内部で使用)で単独確認済み:

```
ERROR: Expected identifier but found ":"
  packages/contracts/api-client/apis/DefaultApi.ts:1390:4
```

この結果、`DefaultApi.ts` 自体は勿論、これを re-export する `apis/index.ts` および最上位の
`packages/contracts/api-client/index.ts`(barrel)を import する経路は**すべて**失敗する
(genre と無関係なメソッド `getBook` / `createLoan` を使う場合でも、ファイル単位でパースされるため
巻き添えになる)。

一方で `runtime.ts` と `models/*.ts` は個別ファイルとして独立にパース可能(実測で確認済み)。

## 実装での対応(迂回)

コーディング規約(`docs/dev-rules/coding-rules.md` rule 1「契約型の直接編集禁止」)に従い
`packages/contracts/` 配下は一切編集していない。代わりに `frontend/src/api/loanConfirmationApiClient.ts`
に、`DefaultApi.ts` が定義する `getBook` / `createLoan` のリクエスト内容(path・method・header・
body 変換)を寸分違わず再現した迂回クライアント `LoanConfirmationApiClient` を実装し、
`runtime.ts`(BaseAPI・JSONApiResponse 等)と `models/BookResponse.ts` / `models/LoanResponse.ts` /
`models/CreateLoanRequest.ts` を個別ファイルから直接 import して使用した(barrel 経由の
`DefaultApi` import はしていない)。fetch/axios の直書きはしていない(tier-rules.md 準拠)。

## 提案

- **根本修正は契約 codegen 側(S0/S3 の再生成)で行うべき**。openapi-generator の
  `enumPropertyNaming` 設定、または openapi.yaml の genre enum に `x-enum-varnames`
  (英語識別子)を追加してから再生成すれば解消する見込み
- 再生成後、`frontend/src/api/loanConfirmationApiClient.ts` の迂回実装は不要になるため削除し、
  `packages/contracts/api-client` の barrel から直接 `DefaultApi` を import する形に戻すことを推奨する
  (現状の迂回実装は DefaultApi.ts の該当メソッドと同一内容だが、契約が変更された際に
  手動追従が必要という保守コストを負っている)
- 他 UC・他 tier(tier-backend-api 等)でも同じ barrel を経由する実装が同一の blocker に
  当たる可能性が高い。オーケストレータで横断的な認知を推奨する
