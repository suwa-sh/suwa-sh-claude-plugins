# reservations.status に「完了」相当の値が rdb-schema.yaml に定義されていない

## 仕様の記載

- `spec.md` 状態遷移一覧: 「予約状態 | 予約確保済 | (終了) | 書籍を貸出する(予約者による) |
  予約確保済の予約者がこの書籍を貸出 | 予約レコードを完了に更新 | tier-backend-api」
  ― 予約確保済の予約者が貸出を実行すると、予約レコードは「完了」に更新される、と明記されている。
- `_cross-cutting/datastore/rdb-schema.yaml` の `reservations.status` カラムの説明は
  「予約状態（pending/reserved/cancelled）」の3値のみで、「完了」に相当する値が列挙されていない。

## 実装で判明した事実

- S6(attempt-3 差し戻し)の fail 原因の1つが、貸出成功後に予約レコードを完了へ更新する処理が
  未実装だったこと(`features/uc/steps/19ec0182.steps.ts` の Then「予約が完了状態になる」が
  「予約レコードが完了に更新されておらず reserved のまま active 一覧に残っている」で fail)。
- `backend-api/src/repositories/reservationRepository.ts`(`ReservationRepository`)は
  attempt-2 まで `findActiveByBookId`(READ専用)のみを公開しており、状態を更新するメソッドが
  存在しなかった。
- `ReservationStatus`(`backend-api/src/domain/reservation.ts`)も `pending` / `reserved` /
  `cancelled` の3値のみで、「完了」に相当する値が無かった。

## 実装での対応(方針: ユーザー確定 2026-07-29「仕様不整合は issues に書き残した上でテストが
通るところまで実装を進める」)

- `ReservationStatus` に `fulfilled`(完了)を追加した(`backend-api/src/domain/reservation.ts`)。
  この値は `rdb-schema.yaml` の記載(pending/reserved/cancelled の3値)と矛盾した状態のまま
  追加している。
- `ReservationRepository` に `completeReservedByBookIdAndUserId(bookId, userId)` を追加し、
  `createLoanUseCase` の貸出成功処理の最後で呼び出すようにした
  (`backend-api/src/application/createLoanUseCase.ts`)。予約確保済(reserved)の予約者本人が
  貸出した場合のみ該当予約を `fulfilled` に更新し、予約が存在しない通常貸出では no-op。
- `findActiveByBookId` の「有効な予約」の定義を `status !== "cancelled"` から
  `status === "pending" || status === "reserved"` に変更し、`fulfilled` になった予約が
  以後の貸出可否判定(`canLend`)で有効な予約として誤カウントされないようにした。

## 提案

- `rdb-schema.yaml` の `reservations.status` カラムの説明を
  「予約状態（pending/reserved/cancelled/fulfilled）」に更新し、`fulfilled` を正式な値として
  確定させることを提案する。
- あわせて `_model-summary.yaml`(このUC)に `reservations` テーブルへの UPDATE 操作
  (現状は記載が無く、`reservations` テーブル自体への言及が無いことも
  `20260729_020000_reservations_select_missing_in_model_summary.md` で既に起票済み)を
  追記することを提案する。
