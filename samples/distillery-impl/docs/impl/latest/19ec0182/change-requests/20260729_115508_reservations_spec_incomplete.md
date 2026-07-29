---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S5 verify attempt-1 (blocker F-001) / S4 tier-impl attempt-3"
related_ids: [REQ-002, SPEC-002-01]
related_files:
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/_model-summary.yaml"
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md"
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/spec.md"
  - "docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml"
severity: spec-gap
---

# 変更要望: reservations テーブルに関する本UCの仕様記述が2箇所で不完全・矛盾している

## 現状の仕様

1. **SELECT操作の未記載**: `_model-summary.yaml` の `tables[]` には `loans`(INSERT)と `books`
   (SELECT status / UPDATE status)の2テーブルのみが記載され、`reservations` テーブルへの操作が
   一切記載されていない。一方 `tier-backend-api.md` 66行のビジネスルール「貸出可否判定ルール」は
   「その書籍に対する予約受付中の予約がない場合に貸出可能。ただし予約者本人（予約確保済）の場合は
   貸出可能」と明記しており、これを正しく実装するには `reservations` を `book_id` で検索する
   SELECT が必須。
2. **完了値の欠落**: `spec.md` 状態遷移一覧(127-128行)は「予約状態: 予約確保済 → (終了)。
   トリガー: 書籍を貸出する（予約者による）。事後処理: 予約レコードを完了に更新」と明記しているが、
   `_cross-cutting/datastore/rdb-schema.yaml` の `reservations.status`(311-314行)の説明は
   「予約状態（pending/reserved/cancelled）」の3値のみで、「完了」に相当する値が列挙されていない。

## 実装で判明した問題

- (1)の未記載が一因となり、S4 attempt-1 では `reservations` テーブルへの参照自体を省略し、
  `rdb-schema.yaml` に存在しない `Book.reservedByUserId` という自作フィールドで代替する実装になった
  (S5 verify attempt-1 blocker F-001)。attempt-2 で `ReservationRepository.findActiveByBookId` を
  新設し是正した。
- (2)の欠落により、S4 attempt-1/2 では貸出成功後に予約レコードを完了へ更新する処理が未実装のままで、
  S6(UC BDD, attempt-2差し戻し相当)で Then「予約が完了状態になる」が fail した。attempt-3 で
  `ReservationStatus` に `fulfilled` を追加(`backend-api/src/domain/reservation.ts`)して是正したが、
  この値は `rdb-schema.yaml` の列挙(pending/reserved/cancelled)と矛盾したまま追加されている。
- 「予約受付中の予約」「予約者本人（予約確保済）」という `tier-backend-api.md` の状態ラベルと
  `reservations.status` の値との対応関係も仕様のどこにも明記が無く、実装側の解釈
  (pending/reserved = 予約受付中、reserved かつ userId一致 = 予約確保済)で補った。

根拠: `docs/impl/latest/19ec0182/issues/20260729_020000_reservations_select_missing_in_model_summary.md`,
`docs/impl/latest/19ec0182/issues/20260729_113001_reservation_fulfilled_status_missing_in_rdb_schema.md`,
`docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml`(F-001)

## 提案する変更

1. `_model-summary.yaml` の `tables[]` に `reservations` の SELECT 操作
   (`where: "book_id = :book_id AND status IN ('pending', 'reserved')"` 相当)と、貸出成功後の
   UPDATE 操作(該当予約を完了値に更新)を追記する。
2. `_cross-cutting/datastore/rdb-schema.yaml` の `reservations.status` の説明を
   「予約状態（pending/reserved/cancelled/fulfilled）」に更新し、`fulfilled` を正式な値として確定させる。
3. `tier-backend-api.md` のビジネスルールに、「予約受付中」「予約確保済」という状態ラベルと
   `reservations.status` の値の対応関係を明文化する(本実装の解釈が正しいかの確認を含む)。

## 影響範囲

- 同じ `reservations` テーブルを参照する他UC(書籍を予約する、予約をキャンセルする、
  貸出状況を確認する、予約状況を確認する)の `_model-summary.yaml` にも同様の記載漏れが
  無いか確認が必要。
- 対象パイプライン: dist-spec(`_model-summary.yaml` 生成ロジック、`rdb-schema.yaml`、`tier-backend-api.md`)。
