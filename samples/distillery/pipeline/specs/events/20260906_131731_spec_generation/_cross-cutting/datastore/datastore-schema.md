# データ保存の索引

RDB: 17 テーブル / 5 サブドメイン。

| サブドメイン | テーブル | 正本 | 関連キーを含む参照用スキーマ |
|---|---|---|---|
| SD-001 | `loan_periods`, `loans`, `loans_events`, `remind_days`, `reservations`, `reservations_events` | [定義](domains/SD-001.yaml) | [参照](generated/domain-slices/SD-001.yaml) |
| SD-002 | `books`, `books_events`, `genres` | [定義](domains/SD-002.yaml) | [参照](generated/domain-slices/SD-002.yaml) |
| SD-003 | `audit_logs`, `credentials`, `users`, `users_events` | [定義](domains/SD-003.yaml) | [参照](generated/domain-slices/SD-003.yaml) |
| SD-004 | `loan_statistics` | [定義](domains/SD-004.yaml) | [参照](generated/domain-slices/SD-004.yaml) |
| SD-005 | `notification_outbox`, `notification_request_receipts`, `notifications` | [定義](domains/SD-005.yaml) | [参照](generated/domain-slices/SD-005.yaml) |

[RDB入口](rdb-schema.yaml) / [全体スキーマ](generated/rdb-schema.bundle.yaml)

キー・有効期限は[KVSスキーマ](kvs-schema.yaml)を参照する。
