# 督促メールを送信する - バックエンドワーカー仕様

## 変更概要

`notification.dun.requested` を消費して延滞督促メールを送信する MQ コンシューマを追加する。通知レコードを「送信待ち」で作成し、外部システム「メール配信サービス」への送信は tier-external-gateway（BC-007 のメール配信コンテキスト。ACL アダプタ）へ委譲する。配信結果を通知状態（送信済み / 送信失敗）へ反映する。

## イベント処理仕様

### DunNotificationConsumer（延滞督促送信コンシューマ）

- **トリガー**: `notification.dun.requested` へのメッセージ到着（Competing Consumers。arch SP-020）
- **入力チャネル**: `notification.dun.requested`
- **出力チャネル**: `notification.dun.requested.dlq`（再試行上限超過時の退避先）
- **AsyncAPI**: [asyncapi.yaml](../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.dun.requested` / `channels.notification.dun.requested.dlq` を参照
- **ペイロードスキーマ**: `DunNotificationRequestedPayload`（AsyncAPI `components.schemas.DunNotificationRequestedPayload.title` と同名。契約生成の型名の正本であり、業務的意味が変わらない限り改名しない）
- **ヘッダースキーマ**: `MessageHeaders`（全非同期メッセージ共通のヘッダー）
- **外部連携**: メール配信サービスへの送信は本ティアから直接行わず、tier-external-gateway の ACL 翻訳層（`L-external-gateway-translator`）へ送信依頼を渡す。Timeout + Retry（指数バックオフ + Jitter）+ Circuit Breaker は tier-external-gateway が適用する（arch SP-030）
- **実行主体**: システム実行主体の認証コンテキストを組み立て、監査ログの `user_id` にコンシューマ識別子を記録する

#### 処理フロー

1. メッセージをデシリアライズし、`message_id` で重複消費を検知する（arch SR-018）。既処理なら ack して終了する
2. メッセージの `trace_id` と parent span_id を伝播し、ティア入口で新しい span_id を発行する（arch SR-019）
3. `idempotency_key` を KVS で検証する。既に通知が生成済みならその通知を再利用し、通知の再生成は行わない。メッセージに `notification_id` があれば（再送）その既存通知を再利用し、新規 INSERT は行わない
4. `target_loan_id` から貸出を取得し、督促通知対象条件を再判定する。貸出状態が「返却済み」なら督促を停止し ack する（AG-005 不変条件）
5. `recipient_user_no` から利用者を取得し、宛先メールアドレスと氏名を解決する。宛先は送信時点の値をコピーして通知へ保持する
6. `notification_id` が無い場合のみ通知を「送信待ち」で作成し、`notifications` へ INSERT する。`notification_id` がある場合は既存通知を再利用し、INSERT せず通知状態のみ「送信待ち」→「送信済み / 送信失敗」へ更新する
7. 通知種別「延滞督促」・通知タイミング区分「期限超過督促」に対応する件名・本文を組み立てる（超過日数を差し込む）
8. tier-external-gateway へ送信依頼を渡す
9. 配信結果に応じて通知状態を遷移させる（成功 → 送信済み / 恒久エラー → 送信失敗 / 一時エラー → 再試行）
10. `send_result` に応答コード・エラー内容を記録する（メールアドレスはマスクして記録する。arch SR-031）
11. 処理結果を監査ログへ INFO で出力し、メッセージを ack する

#### 入力メッセージ: DunNotificationRequested

| フィールド | 型 | 説明 |
|-----------|---|------|
| message_id | string | メッセージID。重複消費検知に使う |
| idempotency_key | string | 冪等キー |
| notification_id | string | 既存通知ID。再送時のみ必須。指定時は既存通知を再利用し新規 INSERT しない |
| notification_type | string | 通知種別。`延滞督促` |
| timing_type | string | 通知タイミング区分。`期限超過督促` |
| target_loan_id | string | 対象貸出ID |
| recipient_user_no | string | 宛先利用者番号 |
| due_date | string(date) | 返却期限 |
| days_overdue | integer | 超過日数 |
| base_date | string(date) | 判定基準日 |
| requested_at | string(date-time) | 送信要求日時 |
| trace_id | string | 分散トレース ID |

#### メール本文の組み立て

| 通知タイミング区分 | 件名 | 本文の要点 |
|------------------|------|-----------|
| 期限超過督促 | 【図書館】返却期限を過ぎた本があります | 宛名（利用者氏名）、書籍タイトル、返却期限、超過日数、窓口での返却案内 |

責める表現を避け、事実（超過日数・対象書籍）と次の行動（窓口で返却）だけを記載する（`ux-design.md` の改善機会に整合）。

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| 恒久エラー（宛先不正・認証エラー等の 4xx） | No | No | リトライせず通知状態を「送信失敗」として即座に記録する（arch SR-029） |
| 一時エラー（タイムアウト・5xx・Circuit Open） | Yes | Yes | 指数バックオフ + Jitter で再試行する。上限（既定 5 回）超過で DLQ へ退避し通知状態を「送信失敗」にしたうえでアラートを通知する（arch SR-020） |
| RDB 一時障害 | Yes | Yes | 通知の INSERT / UPDATE を再試行する。上限超過で DLQ へ退避する |
| 重複メッセージ | No | No | `message_id` / 冪等キーで検知し、通知を再生成せず ack する |
| 対象貸出が返却済み | No | No | 督促を停止し INFO ログを出して ack する。通知レコードは作成しない |
| 対象貸出・利用者が存在しない | No | Yes | データ不整合として ERROR ログを出力し DLQ へ退避する |
| 中断（スポット/プリエンプティブル回収） | Yes | No | 未 ack のメッセージが再配信される。冪等キーにより二重送信は起きない（arch SP-032） |

キュー深度・リトライ率の増加は WARN の劣化兆候ログとして出力する（arch SR-021）。

## データモデル変更

### notifications（情報: 通知 / E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR | 通知ID（PK） | 追加（INSERT） |
| notification_type | VARCHAR | 通知種別。固定値 `延滞督促` | 追加 |
| timing_type | VARCHAR | 通知タイミング区分。固定値 `期限超過督促` | 追加 |
| recipient_user_no | VARCHAR | 宛先利用者番号 | 追加 |
| recipient_email | VARCHAR | 宛先メールアドレス。送信時点の値をコピーする。保管時暗号化（NFR E.6.1.1） | 追加 |
| target_loan_id | VARCHAR | 対象貸出ID | 追加 |
| target_reservation_id | VARCHAR | 本 UC では NULL | 追加（NULL 固定） |
| send_result | TEXT | 送信結果。応答コード・エラー内容（メールアドレスはマスク） | 追加 / 変更（UPDATE） |
| notification_status | VARCHAR | 通知状態。`送信待ち` で作成し `送信済み` / `送信失敗` へ更新する | 追加 / 変更（UPDATE） |

インデックス: `(target_loan_id, notification_type, timing_type)` の複合インデックスを必要とする（重複送信抑止の検索）。

### loans / users / books（参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.loan_status | VARCHAR | 送信時点の再判定（`延滞` であること）に使う | 変更なし（参照のみ） |
| loans.due_date | DATE | 本文へ差し込む返却期限と超過日数の算出元 | 変更なし（参照のみ） |
| users.email | VARCHAR | 宛先メールアドレスの解決元 | 変更なし（参照のみ） |
| users.name | VARCHAR | 本文の宛名 | 変更なし（参照のみ） |
| books.title | VARCHAR | 本文へ差し込む書籍タイトル（`book_id = loans.book_id` で参照） | 変更なし（参照のみ） |

### notification_idempotency_keys（E-902 通知送信冪等キー / KVS）

| 項目 | 型 | 説明 | 変更種別 |
|------|---|------|---------|
| idempotency_key | string | 冪等キー（KVS のキー） | 変更（生成済み通知IDを書き戻す） |
| notification_id | string | 生成済みの通知ID | 追加 |
| expires_at | datetime | キー保持期限（TTL 7 日） | 追加 |

## ビジネスルール

- 督促通知対象条件を送信時点で再判定する。貸出状態が「返却済み」になった時点で督促を停止する
- 通知状態は「送信待ち」で作成し、メール配信サービスへの送信が成功した通知は「送信済み」とし、同一対象への重複送信を抑止する
- 宛先メールアドレスは送信時点の値をコピーして通知に保持する。利用者側の連絡先変更に追随させない
- 外部システムとの連携は tier-external-gateway（ACL）に閉じる。メール配信サービスのデータ形式を worker の domain 層へ持ち込まない（arch SP-029）
- 外部通信は SMTPS または HTTPS（TLS1.2 以上）で行う（arch SR-030）
- ログに宛先メールアドレスの生値を残さない。マスクして記録する（arch SR-031 / NFR E.6.2.1）
- 本 UC は貸出状態を遷移させない。貸出中 → 延滞の遷移は「期限超過の貸出を延滞にする」が担う
- 通知の永続化と外部送信は同一トランザクションにしない。送信失敗は通知状態で追跡する（arch LP-005）

## ティア完了条件（BDD）

```gherkin
Feature: 督促メールを送信する - バックエンドワーカー

  Scenario: 督促送信要求を消費して通知を送信済みにする
    Given 貸出「L-3001」が貸出状態「延滞」・返却期限「2026-09-01」で登録されている
    And 利用者「田中太郎」の連絡先が「tanaka@example.com」である
    When target_loan_id「L-3001」・timing_type「期限超過督促」の送信要求を消費する
    Then 通知が「送信待ち」で作成された後に通知状態が「送信済み」へ更新される

  Scenario: 超過日数を本文へ差し込む
    Given 送信要求の due_date が「2026-09-01」で days_overdue が「1」である
    When ワーカーが送信要求を消費する
    Then 件名「【図書館】返却期限を過ぎた本があります」と超過日数「1日」を含む本文で送信依頼が渡される

  Scenario: 返却済みの貸出は督促を停止する
    Given 貸出「L-3005」の貸出状態が「返却済み」である
    When target_loan_id「L-3005」の督促送信要求を消費する
    Then 通知レコードは作成されずメッセージが ack される

  Scenario: 恒久エラーはリトライせず送信失敗にする
    Given メール配信サービスが宛先不正で HTTP 400 を返す
    When ワーカーが督促送信要求を消費する
    Then 通知状態が「送信失敗」になり send_result に応答コードが記録され再試行は行われない

  Scenario: 一時エラーの再試行上限超過で DLQ へ退避する
    Given メール配信サービスがタイムアウトを返し続けている
    When ワーカーが同一メッセージを 5 回再試行する
    Then メッセージが notification.dun.requested.dlq へ退避され通知状態が「送信失敗」になる

  Scenario: 重複メッセージで二重送信しない
    Given 冪等キー「延滞督促:L-3001:期限超過督促:2026-09-02」の通知が「送信済み」で存在する
    When 同じ冪等キーのメッセージが再配信される
    Then メール配信サービスへの送信依頼は行われずメッセージが ack される

  Scenario: 貸出状態を変更しない
    Given 貸出「L-3001」が貸出状態「延滞」である
    When ワーカーが督促送信要求を消費して送信を完了する
    Then 貸出「L-3001」の貸出状態は「延滞」のまま変更されない
```
