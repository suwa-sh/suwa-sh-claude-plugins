# as-built 仕様サマリ: 書籍を貸出する (uc_id: 19ec0182)

実装完了時点(S7 完了、attempt-3)でリポジトリが実際に満たしている仕様を、仕様書との差分マーカー付きで整理する。
差分マーカー: `[仕様どおり]` / `[仕様に無い追加]` / `[仕様と矛盾]`。

## 1. エンドポイント一覧

| メソッド/パス | 実装 | マーカー | 根拠 |
|---|---|---|---|
| `POST /api/v1/loans` | `backend-api/src/http/server.ts:66-93` → `loansController.ts` | `[仕様どおり]` | `_api-summary.yaml` endpoints[0]、`tier-backend-api.md` API仕様と1:1突合済み(S5 attempt-1〜3 spec_conformance) |
| `GET /api/v1/books/:id` | `backend-api/src/http/server.ts:49-64` → `booksController.ts`(新設) | `[仕様に無い追加]` | `_api-summary.yaml` の `endpoints` には宣言が無い。一方 `tier-frontend.md` UIロジック「書籍情報を GET /api/v1/books/:id で取得」は明記されており、このUCの完了(S6 UC BDD)に必須の cross-UC 依存。実体は `_cross-cutting/api/openapi.yaml`(operationId: getBook)に存在するが、本来のオーナー UC(書籍を登録する/書籍情報を編集する)の tier-backend-api が未実装のため、このUCが暫定実装で肩代わりした。詳細: `issues/20260729_113000_books_get_endpoint_undeclared_in_api_summary.md` |

`GET /api/v1/books/:id` のレスポンスは `packages/contracts/api-types/models/BookResponse`(snake_case)準拠だが、`id`/`title`/`status` 以外(`author`/`isbn`/`publisher`/`genre`/`material_type`)は本UCの `BookRepository` がシードしないため空文字列フォールバックになる暫定実装(`booksController.ts:48-63`)。

## 2. 予約状態遷移

| 状態 | rdb-schema.yaml 定義 | 実装(`ReservationStatus`) | マーカー |
|---|---|---|---|
| pending / reserved / cancelled | あり(`_cross-cutting/datastore/rdb-schema.yaml:311-314` `予約状態（pending/reserved/cancelled）`) | あり | `[仕様どおり]` |
| fulfilled(完了) | **無い**(上記3値のみ列挙) | `backend-api/src/domain/reservation.ts:9-13` に追加 | `[仕様と矛盾]` — `spec.md` 状態遷移一覧(127-128行)は「予約状態: 予約確保済 → (終了)。事後処理: 予約レコードを完了に更新」と明記しており、`spec.md` の要求を満たすには何らかの終端値が要る。`rdb-schema.yaml` 側の列挙にはこの値が無く、2つの正本ドキュメントが矛盾したまま `fulfilled` を追加した。詳細: `issues/20260729_113001_reservation_fulfilled_status_missing_in_rdb_schema.md` |

遷移の実装箇所: `createLoanUseCase.ts:101-104`(`reservationRepository.completeReservedByBookIdAndUserId`)。予約確保済(`reserved`)の予約者本人が貸出した場合のみ `fulfilled` に更新し、通常貸出(対象書籍に予約が無い)では no-op。

「予約受付中の予約」「予約者本人（予約確保済）」という `tier-backend-api.md` 66行の状態ラベルと `reservations.status` の対応関係も仕様に明記が無く、以下の解釈で実装した(`[仕様に無い追加]` — 解釈の補完):
- 予約受付中の予約 = 有効な予約(`pending` または `reserved`)全体
- 予約者本人（予約確保済） = 有効な予約のうち `status === "reserved"` かつ `userId` 一致

また `_model-summary.yaml` の `tables[]` には `reservations` テーブルへの操作(SELECT/UPDATE)自体が記載されていない(`loans` と `books` の2テーブルのみ)。実装は `reservations` に SELECT(`findActiveByBookId`)と UPDATE(`completeReservedByBookIdAndUserId`)の両方を行っており、`[仕様に無い追加]`。詳細: `issues/20260729_020000_reservations_select_missing_in_model_summary.md`

## 3. X-User-Id ヘッダ契約の実態

| 項目 | 仕様 | 実装 | マーカー |
|---|---|---|---|
| 認証方式 | `tier-backend-api.md` 13行「OAuth2/OIDC (利用者ロール)」 | トークン検証なし。`server.ts:77` `firstHeaderValue(req.headers["x-user-id"]) ?? ""` を利用者IDとしてそのまま信用するスタブ | `[仕様と矛盾]` |
| RBAC(利用者/司書ロール) | `nfr/latest/nfr-grade.yaml` E.5.2.1(827-834行)grade 2「ロールベースアクセス制御」 | ロール概念自体が実装に存在しない | `[仕様と矛盾]` |
| X-User-Id ヘッダの契約定義 | `_api-summary.yaml` の `CreateLoanRequest` に `X-User-Id` の定義は無く、`tier-frontend.md`・`tier-backend-api.md` にも認証ヘッダとしての記載が無い | backend は `X-User-Id` を実質必須の入力として扱う。frontend の `LoanConfirmationApiClient`(`createLoan`/`getBook`)は `X-User-Id` を一切送信しない(送るのは `Content-Type`/`X-Idempotency-Key`/`Authorization`(設定時のみ)) | `[仕様に無い追加]` — 契約が存在しないヘッダに実質的な意味的依存が生まれている |
| 401(トークン欠落/不正) | エラー表(`tier-backend-api.md`)に記載なし | 未実装。ヘッダ無しでも空文字列 `userId` として後続処理へ進む | `[仕様と矛盾]`(仕様が要求する認証を実装が代替していない) |
| S6/S7 統合テストでの扱い | — | `features/uc/steps/19ec0182.steps.ts` / `features/atdd/steps/SPEC-002-01.steps.ts` の fetch ラッパでテスト用に `X-User-Id` を注入(オーケストレータのユーザー確定方針「ハーネス注入を許容」)。`frontend/src`・`backend-api/src` は無変更 | `[仕様に無い追加]` — 本番導線には存在しない迂回がテストのみに存在する |

結果として、「予約確保済の予約者本人による貸出」シナリオは実運用導線(frontend → backend)では `X-User-Id` が届かず常に空文字列 `userId` になり、予約者本人判定に失敗して 409 になる。統合テストはハーネス注入で回避しているため、この不整合はS6/S7のゲートでは検出されない。詳細: `issues/20260729_011215_auth_and_missing_header_gap.md`

## 4. エラー応答

| ステータス | 条件 | 実装 | マーカー |
|---|---|---|---|
| 400 | `book_id` 未指定 | `createLoanUseCase.ts:39-41` `ValidationError("book_idは必須です")` → `loansController.ts:71` | `[仕様どおり]` |
| 400 | `X-Idempotency-Key` ヘッダ欠落 | `createLoanUseCase.ts:42-44` `ValidationError("X-Idempotency-Keyヘッダは必須です")` | `[仕様に無い追加]` — エラー表に明記が無い分岐(「必須」という記述と矛盾しない拡張として実装者が追加。issue起票済み) |
| 404 | 書籍が存在しない(`POST /loans`) | `createLoanUseCase.ts:52-54` | `[仕様どおり]` |
| 404 | 書籍が存在しない(`GET /books/:id`) | `booksController.ts:43-46` | `[仕様に無い追加]` — このエンドポイント自体が `_api-summary.yaml` 未宣言のため、エラー応答契約も仕様上存在しない |
| 409 | 在庫なし/予約あり | `createLoanUseCase.ts:61-63` `ConflictError("この書籍は現在貸出できません")` | `[仕様どおり]` |
| 409 | 冪等キー重複(KVS 事前チェック) | `createLoanUseCase.ts:47-49` | `[仕様どおり]` |
| 409 | 冪等キー重複(RDB UNIQUE 制約相当、2層目) | `createLoanUseCase.ts:83-94` `UniqueConstraintViolationError` → `ConflictError` 変換(attempt-2で追加。attempt-1は無応答のままリクエストが放置される欠陥だった) | `[仕様どおり]` — 仕様(69行「KVS で重複チェック後、RDB の UNIQUE 制約で二重防止」)の2層目を実装 |
| 409 vs 200(キャッシュ再送) | `_cross-cutting/datastore/kvs-schema.yaml` の一般記述は「重複リクエスト時にキャッシュから返却」(=元の成功レスポンス再送を示唆) | 常に 409 を返す実装(キャッシュ再送はしない) | `[仕様と矛盾]` — `tier-backend-api.md` の個別エラー表(409固定)を優先した実装判断。2つの正本ドキュメントが矛盾。詳細: `issues/20260729_011214_idempotency_conflict_semantics.md` |
| 500 | 未捕捉例外全般 | `server.ts:103-107` の express エラーハンドリングミドルウェア(RFC 7807形式) | `[仕様に無い追加]` — 仕様のエラー表には無いが、フォールトトレランス上の安全策として追加(S5 attempt-1 F-003 の是正) |

いずれのエラー応答も RFC 7807(`type`/`title`/`status`/`detail`)形式を維持している。

## 5. その他の as-built 上の逸脱(参考)

- `packages/contracts/api-types(/api-client)/apis/DefaultApi.ts` は openapi.yaml の genre/material_type enum(日本語ラベル)のサニタイズ失敗により構文エラーで import 不能。backend/frontend とも barrel を経由せず `models/*.ts` を個別 import する迂回で対応(契約自体は無編集)。詳細: `issues/20260729_011213_api_types_defaultapi_syntax_error.md`, `issues/20260729101416_defaultapi-generated-syntax-error.md`
- `packages/ui` に Skeleton/Spinner が未生成のため、ローディング表示はプレーンテキスト代替(`「読み込み中...」`/`「処理中...」`)。詳細: `issues/20260729103955_skeleton-spinner-components-missing.md`
- `/loans/new` への実URLルーティング配線(アプリシェル/ルーター)がリポジトリに存在せず、画面コンポーネントは Props 経由でマウント可能な自己完結コンポーネントとして実装するに留まる。詳細: `issues/20260729103956_no-app-shell-router-for-loans-new-route.md`
- 本UC(19ec0182)自体の SPEC-002-01 への対応は `uc-map.yaml` に確定済み(`atdd_confirmed: true`)だが、その確定は dist-spec の機械可読出力のみでは導出できず、S1(uc-init)でのユーザー確認(human-in-the-loop)を経て初めて成立した。`[仕様に無い追加]` — `usdm/latest/requirements.yaml` の `affected_models[]` は BUC名キーが `name` でなく `target` であること、`type: "buc"` エントリを持たない SPEC(例: SPEC-002-02)が存在すること、1 SPEC が複数UCの受け入れ基準を含む例(SPEC-001-01)があることの3点により、UC↔SPEC対応を機械的に一意に導出できないため。詳細: `docs/impl/events/20260729_095000_s1_uc_init_completed/event.yaml`
