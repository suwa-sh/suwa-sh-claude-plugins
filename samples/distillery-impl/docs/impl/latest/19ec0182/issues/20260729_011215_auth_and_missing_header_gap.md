# OAuth2/OIDC 認証・X-Idempotency-Keyヘッダ欠落時の挙動が仕様に未記載

## 仕様の記載

`tier-backend-api.md`:
- 認証: OAuth2/OIDC (利用者ロール)
- 冪等性: X-Idempotency-Key ヘッダ必須(状態変更を伴う操作)
- エラーレスポンス表には 400(book_id未指定)/ 404 / 409 x2 のみが列挙され、
  「トークン欠落・不正」「X-Idempotency-Keyヘッダ欠落」時のレスポンスは記載がない。

## 実装で判明した事実

- OAuth2/OIDC の実際のトークン検証を行うミドルウェア・認可基盤はこのリポには存在しない
  (認証 tier / 共有ライブラリが specs / impl-config に無い)。
- ティア BDD シナリオも「アクセストークンが有効」であることを Given で仮定するのみで、
  トークン検証ロジック自体を検証していない。

## 実装での対応(仮実装)

- 認証は `X-User-Id` ヘッダの値をそのまま認証済み利用者IDとして扱う簡易スタブとした
  (`backend-api/src/http/server.ts`)。本物の OAuth2/OIDC 検証ミドルウェアへの差し替えは
  認証基盤tierが用意され次第の追従作業とする。
- `X-Idempotency-Key` ヘッダが欠落した場合は、エラー表に明記が無いため
  防御的に 400 + detail="X-Idempotency-Keyヘッダは必須です" を返すようにした
  (「必須」という記述と矛盾しない自然な拡張と判断。BDD 対象シナリオでは踏まない分岐)。

## 提案

- 認証基盤(OAuth2/OIDC のリソースサーバー検証)tier が設計されたら、本 API のミドルウェア差し替えが必要。
- エラーレスポンス表に「トークン欠落/不正」(401 想定)と「X-Idempotency-Keyヘッダ欠落」(400)の
  行を追加し、仕様として確定させることを提案する。

## OAuth2/OIDC 要求との差分(attempt-2 明確化)

S5(attempt-1)の verify で本件が major(F-002)と評価された理由の追跡を確実にするため、
tier-backend-api.md の要求と現状実装の差分を明示する。

| 項目 | tier-backend-api.md の要求 | 現状実装 | リスク |
|---|---|---|---|
| トークン検証 | OAuth2/OIDC のアクセストークンを検証 | 検証なし。X-User-Id ヘッダの値をそのまま信用 | クライアントが任意の user_id を名乗れる(なりすまし) |
| 利用者ID取得元 | 検証済みトークンの claim(sub 等) | クライアント指定の X-User-Id ヘッダ | 同上 |
| 利用者ロール | OAuth2/OIDC のロールクレームで RBAC(nfr-grade.yaml E.5.2、grade 2 要求) | ロール概念自体が実装に存在しない | 利用者/司書のアクセス制御が一切ない |
| 401 応答 | トークン欠落/不正時の応答(エラー表に未記載) | 未実装。ヘッダなしでも空文字列 userId として通過し、後続のビジネスロジックへ進む | 401 で弾くべきリクエストが処理される |

S6(統合テスト)以降、認証基盤 tier が用意され本物の OAuth2/OIDC 検証ミドルウェアに
差し替わるまでは、上記差分がなりすましリスクとして残る。コード上は
`backend-api/src/http/server.ts`(userId 取得箇所)と `backend-api/src/http/loansController.ts`
(`HttpRequestContext.userId` の型コメント)に本 issue への参照 TODO を明示済み。

## frontend 契約に X-User-Id ヘッダが無い事実(attempt-3 S6 差し戻しで判明)

`frontend/src/api/loanConfirmationApiClient.ts`(LoanConfirmationApiClient)は
`createLoan` / `getBook` のいずれのリクエストでも `X-User-Id` ヘッダを送信しない
(送っているのは `X-Idempotency-Key` と、Configuration に `accessToken` が設定されている場合の
`Authorization` のみ)。契約(`_api-summary.yaml` の `CreateLoanRequest`)にも `X-User-Id` は
定義が無い。

このため現状の統合経路(features/uc/steps/19ec0182.steps.ts が実 fetch で backend-api を叩く形)では、
backend-api に到達する `X-User-Id` は常に欠落しており、`server.ts` の
`firstHeaderValue(req.headers["x-user-id"]) ?? ""` は空文字列にフォールバックする。

**backend-api 側の対応方針(attempt-3 で確定)**: 空文字列 userId のまま処理を継続する現状の
挙動(仮実装)を維持した。理由は、統合テスト(UC BDD)の正常系シナリオが `X-User-Id` 無しで
`POST /api/v1/loans` を呼ぶため、ここで 400 を返す実装にすると正常系シナリオ自体が成立しなく
なるため。空文字列 userId は「予約なしの通常貸出」では `canLend` が予約チェックをスキップして
通過するため 201 になるが、「予約確保済(reserved)の予約者本人による貸出」シナリオでは
予約の `userId` と一致しないため誤って 409 になる(なりすまし防止として振る舞いは正しいが、
本来の呼び出し元が誰であるかを backend が知り得ない構造的な問題)。

**backend-api の write-set 外の対応が必要**: 本 issue の是正には、
`frontend/src/api/loanConfirmationApiClient.ts` が `X-User-Id` ヘッダを送信するよう変更するか
(frontend の write-set)、または `features/uc/steps/19ec0182.steps.ts` 側(integration writer の
write-set)でテスト用の認証コンテキストを注入する必要がある。backend-api 側は
「`X-User-Id` が実際に送られてくれば、その値をそのまま利用者IDとして扱い、予約確保済シナリオも
正しく貸出可能と判定する」ことを保証する状態(既存実装のまま)にとどめた。
