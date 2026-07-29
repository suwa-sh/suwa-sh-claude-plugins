# _model-summary.yaml の tables[] に reservations の SELECT operation が未記載

## 仕様の記載

- `tier-backend-api.md` 66行 ビジネスルール「貸出可否判定ルール」: 「書籍の status が "available" かつ、
  その書籍に対する予約受付中の予約がない場合に貸出可能。ただし予約者本人（予約確保済）の場合は貸出可能」。
- `_model-summary.yaml` の `tables[]` には `loans`(INSERT)と `books`(SELECT status / UPDATE status)の
  2 テーブルのみが記載され、`reservations` テーブルへの操作が一切記載されていない。
- `_cross-cutting/datastore/rdb-schema.yaml` には `reservations` テーブル(`status`:
  pending/reserved/cancelled、`queue_position`)と `idx_reservations_book_id_status`
  (コメント「返却時の予約チェック用」)が定義されている。

## 実装で判明した事実

貸出可否判定ルールを正しく実装するには `reservations` テーブルを `book_id` で検索する
SELECT 操作が必須だが、`_model-summary.yaml` にはこの操作が記載されておらず、`_api-summary.yaml`
の `endpoints[].summary` にも参照テーブルの言及がない。この未記載が一因となり、
attempt-1 では reservations テーブルへの参照自体を省略し、`Book.reservedByUserId` という
`rdb-schema.yaml` に存在しない自作フィールドで代替する実装になっていた
(S5 verify で blocker F-001 として指摘。
`docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml`)。

## 対応(attempt-2)

`rdb-schema.yaml` の `reservations` テーブル定義とビジネスルールの記述を根拠に、
`ReservationRepository.findActiveByBookId`(`backend-api/src/repositories/reservationRepository.ts`)
を追加し、`canLend`(`backend-api/src/domain/loan.ts`)の予約判定を
`reservations.status` 経由に修正した。

`tier-backend-api.md` 66行の「予約受付中の予約」「予約者本人（予約確保済）」という2つの状態ラベルと
`reservations.status`(pending/reserved/cancelled)の対応関係は仕様に明記されていないため、
以下の解釈で実装した:

- 「予約受付中の予約」= 有効な予約(`status` が `pending` または `reserved`)全体
- 「予約者本人（予約確保済）」= 有効な予約のうち `status` が `reserved` かつ `userId` が一致するもの

## 提案

- `_model-summary.yaml` の `tables[]` に `reservations` テーブルの SELECT 操作
  (`where: "book_id = :book_id AND status IN ('pending', 'reserved')"` 相当)を追記する。
- `tier-backend-api.md` のビジネスルールに、「予約受付中」「予約確保済」という状態ラベルと
  `reservations.status` の対応関係を明文化する(本実装の解釈が正しいかの確認を含む)。
