# 取置き通知メールを送信する - バックエンドワーカー仕様

## 変更概要

`notification.hold-notice.requested` を消費する取置き案内送信ハンドラを追加する。通知レコードから宛先を取得し、外部連携ティア（tier-external-gateway）経由でメール配信サービスへ送信する。送信成功時は通知状態を「送信済み」へ遷移させ、対象予約の予約状態を「予約中」から「取置き中」へ遷移させて取置き期限を設定する。

## イベント処理仕様

### HoldNoticeSendHandler（取置き案内送信ハンドラ）

- **トリガー**: MQ コンシューマ（`notification.hold-notice.requested` へのメッセージ到着）
- **入力チャネル**: `notification.hold-notice.requested`（メッセージ: `HoldNoticeRequested`）
- **出力チャネル**: `notification.hold-notice.dlq`（リトライ上限超過時の移送先）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.hold-notice.requested` および `channels.notification.hold-notice.dlq` を参照

#### 入力メッセージ

| フィールド | 型 | 説明 |
|-----------|---|------|
| notification_id | string | 通知ID |
| notification_type | string | 通知種別（取置き案内） |
| target_reservation_id | string | 対象予約ID |
| recipient_user_no | string | 宛先利用者番号 |
| idempotency_key | string | 通知送信冪等キー（E-902） |
| trace_id | string | 分散トレース ID。ログへ引き継ぐ（arch CLR-005） |
| requested_at | string(date-time) | 送信要求日時 |

#### 処理フロー

1. メッセージをデシリアライズし、`trace_id` をログコンテキストへ引き継ぐ（arch CLR-005 / CLR-004）
2. 冪等キー（E-902）を確認し、既に送信済みであれば何もせず正常終了する（at-least-once 配信の重複対策）
3. `notifications` から通知を取得し、通知状態が「送信待ち」であることを確認する。それ以外は処理をスキップする
4. 通知の宛先メールアドレス（送信時点のコピー）と対象書籍を取得し、**送信実行時刻を起点に取置き期限を先に算出**してメール本文へ埋め込む（送信成功日時は本文組み立て時点で未確定のため、起点は送信実行時刻とする）
5. 外部連携ティア（tier-external-gateway）の ACL 経由でメール配信サービスへ送信する。Timeout・Retry・Circuit Breaker は外部連携ティア側で適用する（arch CLR-010）
6. 送信成功時
   - 通知状態を「送信済み」へ更新し、送信結果に応答コードを記録する
   - 対象予約の予約状態を「予約中」から「取置き中」へ更新し、手順 4 で本文へ埋め込んだのと同じ算出値を取置き期限（`hold_expires_at`）として確定する（本文と DB の値を一致させる）
   - 通知の更新と予約の更新は同一トランザクションで行う
7. 送信失敗時
   - リトライ上限に達するまで再試行する
   - 上限超過で通知状態を「送信失敗」へ更新し、送信結果に応答コードとエラー内容を記録する
   - メッセージを DLQ へ移送し、司書が未達として追跡できるようにする
8. システム実行主体の認証コンテキストで実行し、監査ログへ操作主体を記録する（arch CLR-007 / CLR-009）

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| メール配信サービスのタイムアウト・一時障害（5xx） | Yes | Yes | 指数バックオフで再試行し、上限超過で通知状態を「送信失敗」にして DLQ へ移送する |
| メール配信サービスの恒久エラー（宛先不正等の 4xx） | No | Yes | 再試行せず通知状態を「送信失敗」にし、送信結果へエラー内容を記録して DLQ へ移送する |
| 通知が「送信待ち」でない（重複配信） | No | No | 冪等判定によりスキップし、正常終了として ACK する |
| 予約状態が「予約中」でない（他の操作で先に遷移） | No | No | 通知状態は「送信済み」とし、予約状態は更新しない。競合として警告ログを出力する |
| RDB の一時障害 | Yes | Yes | 再試行し、上限超過で DLQ へ移送する。メール送信済みで DB 更新のみ失敗した場合は冪等キーにより再送されない |

## データモデル変更

### notifications（情報: 通知 / E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_status | VARCHAR | 通知状態。「送信待ち」から「送信済み」または「送信失敗」へ更新する | 変更 |
| send_result | TEXT | 送信結果。メール配信サービスの応答コード・エラー内容を記録する | 変更 |

送信日時は送信イベントの発生時刻で管理する（E-006 の設計方針。スナップショットには送信日時カラムを持たない）。

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_status | VARCHAR | 予約状態。「予約中」から「取置き中」へ更新する | 変更 |
| hold_expires_at | TIMESTAMP | 取置き期限。送信成功日時を起点に設定する | 変更 |

`reservations` は予約コンテキスト（BC-004）の所有データであるため、予約コンテキストの公開インターフェース経由で更新する（arch CLR-002）。

## ビジネスルール

- 取置き通知対象条件: 通知送信後は当該予約の予約状態を「取置き中」に更新する
- 通知状態は「送信待ち → 送信済み」または「送信待ち → 送信失敗」のいずれかへ遷移する。「送信失敗」からの再送は API 側で「送信待ち」へ戻した後に本ハンドラが再実行する
- 冪等キー（E-902）により、同一の通知種別 + 対象予約ID の組に対する送信は 1 回に限定する
- 宛先メールアドレスは通知レコードに保持された送信時点のコピーを使い、利用者テーブルを再参照しない
- 取置き期限の日数は RDRA / NFR に定義が無いため運用パラメータとする（要確認）
- メール配信サービスへのアクセスは外部連携ティアの ACL を経由し、ワーカーから直接 SDK を呼ばない（arch: BC-007 の実装先は tier-external-gateway）
- 送信失敗は未達として記録し、司書が送信実績一覧から追跡・再送できる状態にする
- 個人情報（宛先メールアドレス・氏名）をログへ出力しない（arch CLP-010 ログアンチパターン防止 / NFR E.1.2.1）

## ティア完了条件（BDD）

```gherkin
Feature: 取置き通知メールを送信する - バックエンドワーカー

  Scenario: 送信成功で通知が送信済みになり予約が取置き中へ遷移する
    Given 通知 N-0001 の notification_status が「送信待ち」で target_reservation_id が R-0007 である
    And 予約 R-0007 の reservation_status が「予約中」である
    And メール配信サービスが応答コード 200 を返す
    When ワーカーが notification.hold-notice.requested から N-0001 のメッセージを受信する
    Then 通知 N-0001 の notification_status が「送信済み」になる
    And 予約 R-0007 の reservation_status が「取置き中」になり hold_expires_at が設定される

  Scenario: 一時障害でリトライ上限を超えると送信失敗になる
    Given 通知 N-0002 の notification_status が「送信待ち」である
    And メール配信サービスが応答コード 503 を返し続ける
    When ワーカーが N-0002 のメッセージを受信しリトライ上限まで再試行する
    Then 通知 N-0002 の notification_status が「送信失敗」になる
    And send_result に応答コード 503 とエラー内容が記録される
    And メッセージが notification.hold-notice.dlq へ移送される

  Scenario: 重複配信されたメッセージはスキップされる
    Given 通知 N-0001 の notification_status が既に「送信済み」である
    When ワーカーが同一の idempotency_key を持つメッセージを再度受信する
    Then メール配信サービスへの送信は行われない
    And メッセージは正常終了として ACK される

  Scenario: 宛先不正の恒久エラーは再試行しない
    Given 通知 N-0003 の notification_status が「送信待ち」である
    And メール配信サービスが応答コード 400（宛先不正）を返す
    When ワーカーが N-0003 のメッセージを受信する
    Then 再試行せずに notification_status が「送信失敗」になる
    And 予約の reservation_status は「予約中」のまま変わらない
```
