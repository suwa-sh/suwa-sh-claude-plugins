# _api-summary.yaml に未宣言の GET /api/v1/books/:id を実装した(cross-UC 依存の仕様漏れ)

## 仕様の記載

- `docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/_api-summary.yaml` の
  `endpoints` には `POST /api/v1/loans` しか宣言されていない。
- 一方、`tier-frontend.md` の UI ロジックには
  「状態管理: book_id をクエリパラメータから取得、書籍情報を GET /api/v1/books/:id で取得」
  と明記されている。
- frontend 実装(`frontend/src/api/loanConfirmationApiClient.ts` の `getBook`、
  `frontend/src/components/loanConfirmation.ts` の `LoanConfirmationController.loadBookResponse` /
  `loadBook`)も、貸出手続き画面の表示に `GET /api/v1/books/:id` の呼び出しを前提としている。
- `GET /api/v1/books/{id}` 自体は `_cross-cutting/api/openapi.yaml`(operationId: `getBook`)に
  定義があり、システム全体としては存在する API だが、そのオーナー tier(「書籍を登録する」UC
  または「書籍情報を編集する」UC の tier-backend-api)がこの UC の attempt 時点で未実装のため、
  本 UC(書籍を貸出する)の統合テスト(S6 UC BDD)がこのエンドポイント欠如で全シナリオ fail
  していた。

## 実装で判明した事実

- S6(attempt-3 差し戻し)の fail 原因の1つがこの GET エンドポイント欠如だった
  (`features/uc/steps/19ec0182.steps.ts` の `LoanConfirmationController.loadBookResponse` が
  404 相当のエラーで即座に失敗し、全 4 シナリオが「書籍情報の取得に失敗したため貸出手続き画面を
  表示できない」で fail していた)。
- `_api-summary.yaml` は UC ごとの API サマリのため、この UC が「呼び出すだけ」で「所有しない」
  API(他 UC が背後で実装する GET 系エンドポイント)は宣言対象外という設計自体はあり得るが、
  その場合でも「このUCの完了に他UCの実装が必須」という cross-UC 依存の存在は、
  トレーサビリティマトリクスや `_api-summary.yaml` のどこかに明示されるべきで、現状は追跡不能。

## 実装での対応(方針: ユーザー確定 2026-07-29「仕様不整合は issues に書き残した上でテストが
通るところまで実装を進める」)

- `backend-api/src/http/booksController.ts` を新設し、`GET /api/v1/books/:id` を最小実装した
  (`backend-api/src/http/server.ts` にルーティング追加)。
- レスポンス形は `packages/contracts/api-types/models/BookResponse.ts`(snake_case)に合わせた。
- この UC の `BookRepository`(`InMemoryBookRepository`)は貸出可否判定に必要な
  `id` / `title` / `status` のみをシードする経路しか持たないため、`author` / `isbn` /
  `publisher` / `genre` / `material_type` / `location` は未シード時に空文字列で応答する
  暫定実装とした(`backend-api/src/domain/book.ts` にこれらを任意項目として追加)。
  `created_at` は未シード時 `clock.today()` を代替値として使う。

## 提案

1. `_api-summary.yaml` の生成ロジックに「自 UC が呼び出すが所有しない cross-UC API」を
   明示する欄(例: `external_dependencies`)を追加し、S1(uc-init)の時点で検出できるようにする。
2. 「書籍を登録する」/「書籍情報を編集する」UC の tier-backend-api で
   `GET /api/v1/books/:id` の本実装(実データを持つ `BookRepository`)が完成した際に、
   本 UC の `booksController.ts` の暫定実装(空文字列フォールバック)を置き換えるか、
   共有 `BookRepository` 実装に一本化することを検討する。
