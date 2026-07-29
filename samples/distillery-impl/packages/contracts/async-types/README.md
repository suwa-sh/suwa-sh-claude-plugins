# async-types 生成物 メッセージ対応表

`@asyncapi/cli generate models typescript` は payload スキーマに `title` が無いモデルを
`AnonymousSchema_N` として生成する(message レベルの `name`/`title` は使われない既知の挙動)。
本リポの asyncapi.yaml は `components.messages.*` に `title` を持つが、payload オブジェクト自体に
`title` が無いため、以下の無名化が発生している。

| 生成ファイル | 対応する message | channel |
|---|---|---|
| `AnonymousSchema_1.ts` | `OverdueNotificationMessage`(督促通知メッセージ) | `overdue-notification-queue` |
| `AnonymousSchema_9.ts` | `ReservationNotificationMessage`(予約通知メッセージ) | `reservation-notification-queue` |

根本対応は `_cross-cutting/api/asyncapi.yaml` の各 `payload` オブジェクトに `title` を追加すること
(dist-spec への変更要求ドラフトとして bootstrap 完了報告に記載済み)。それまでは実装側でこの対応表を
正として `AnonymousSchema_1` = 督促通知、`AnonymousSchema_9` = 予約通知 として扱う。
