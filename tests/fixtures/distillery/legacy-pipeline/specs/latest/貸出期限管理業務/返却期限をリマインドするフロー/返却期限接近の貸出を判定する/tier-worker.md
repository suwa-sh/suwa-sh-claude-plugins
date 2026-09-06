# 返却期限接近の貸出を判定する - バックエンドワーカー仕様

## 変更概要

返却期限接近判定日次タイマー（CronJob）で起動するバッチを追加する。貸出状態が「貸出中」の貸出をチャンク単位で走査し、リマインド通知対象条件を満たす貸出から返却期限リマインドの送信要求を MQ へ publish する。貸出状態は変更しない。

## イベント処理仕様

### UpcomingDueJudgeJobHandler（返却期限接近判定日次ジョブ）

- **トリガー**: 返却期限接近判定日次タイマー（CronJob）。深夜の計画停止枠（1 時〜4 時）およびバックアップ取得時間帯と競合しない時間帯に配置する（arch SP-021 / NFR C.1.1.2, C.1.1.3）
- **入力チャネル**: なし（タイマー起動）
- **出力チャネル**: `notification.remind.requested`
- **AsyncAPI**: [asyncapi.yaml](../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.remind.requested` を参照
- **ペイロードスキーマ**: `RemindNotificationRequestedPayload`（AsyncAPI `components.schemas.RemindNotificationRequestedPayload.title` と同名。契約生成の型名の正本であり、業務的意味が変わらない限り改名しない）
- **ヘッダースキーマ**: `MessageHeaders`（全非同期メッセージ共通のヘッダー）
- **実行パラメータ**: `base_date`（既定: 実行日）、`chunk_size`（既定: 1000）、`remind_days`（外部設定、既定: 3）
- **実行主体**: システム実行主体の認証コンテキスト（arch tier-worker のシステム実行主体ルール）を組み立て、監査ログの `user_id` にジョブ識別子を記録する

#### 処理フロー

1. ジョブ実行 ID（`upcoming-due-judge:{base_date}`）で重複実行を検知する。既に完了済みなら処理せず終了する（arch SR-018）
2. 新規 `trace_id` を発行し、以降の全ログ・MQ メッセージへ伝播する（arch SR-019）
3. `loans` を `loan_status = '貸出中' AND due_date BETWEEN :base_date AND :base_date + :remind_days` の条件で `chunk_size` 単位に走査する（読み取り専用 finder）
4. チャンクごとにドメイン層でリマインド通知対象条件を判定し、通知タイミング区分を決定する（残日数 0 → 期限当日 / 1〜`remind_days` → 期限前リマインド）
5. 対象貸出ごとに冪等キー（`sha256(通知種別:対象貸出ID:通知タイミング区分:base_date)`）を生成し、`notification.remind.requested` へ publish する
6. チャンク単位で処理件数を集計し、走査件数・対象件数・publish 件数を INFO の監査ログに出力する
7. ジョブ実行時間が実行枠（バッチ 8 時間以内 / NFR B.2.2.1）のしきい値を超えた場合は WARN の劣化兆候ログを出力する（arch SR-021）

#### 出力メッセージ: RemindNotificationRequested

| フィールド | 型 | 説明 |
|-----------|---|------|
| message_id | string | メッセージID（重複消費検知に使う） |
| idempotency_key | string | 冪等キー。通知種別＋対象貸出ID＋通知タイミング区分＋基準日から決定的に生成する |
| notification_type | string | 通知種別。固定値 `返却期限リマインド` |
| timing_type | string | 通知タイミング区分（`期限前リマインド` / `期限当日`） |
| target_loan_id | string | 対象貸出ID |
| recipient_user_no | string | 宛先利用者番号 |
| due_date | string(date) | 返却期限 |
| days_remaining | integer | 残日数 |
| base_date | string(date) | 判定基準日 |
| requested_at | string(date-time) | 送信要求日時 |
| trace_id | string | 分散トレース ID |

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| RDB 一時障害（接続断・デッドロック） | Yes | No | チャンク単位で指数バックオフ + Jitter により再試行する。上限超過でジョブを異常終了し ERROR ログを出力する |
| MQ publish 失敗 | Yes | No | 同一チャンクを再 publish する。冪等キーにより二重生成は抑止される |
| 重複実行の検知 | No | No | 既完了のジョブ実行 ID を検知したら INFO ログを出して正常終了する |
| ドメイン例外（判定不能な貸出データ） | No | No | 当該貸出をスキップし WARN ログへ記録する。ジョブ全体は継続する |
| 実行枠超過 | No | No | WARN の劣化兆候ログ（`degradation_type=batch_duration`）を出力し、処理は継続する |
| 中断（スポット/プリエンプティブル回収） | Yes | No | 冪等キーにより安全に再実行できる（arch SP-032）。次回起動時に同一 `base_date` で再走査する |

## データモデル変更

### loans（情報: 貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（PK） | 変更なし（参照のみ） |
| user_no | VARCHAR | 宛先利用者の特定に使う | 変更なし（参照のみ） |
| due_date | DATE | 返却期限。走査の検索軸 | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`貸出中` のみを対象にする | 変更なし（参照のみ） |

インデックス: `(loan_status, due_date)` の複合インデックスが必須（貸出全件最大 10 万件の日次走査 / NFR B.1.1.4）。

### notification_idempotency_keys（E-902 通知送信冪等キー / KVS）

| 項目 | 型 | 説明 | 変更種別 |
|------|---|------|---------|
| idempotency_key | string | 冪等キー（KVS のキー） | 追加（本 UC で書き込む） |
| requested_at | datetime | 送信要求日時 | 追加 |
| expires_at | datetime | キー保持期限（TTL 7 日） | 追加 |

貸出状態・通知レコードの生成は本 UC では行わない（通知レコードの作成は「リマインドメールを送信する」が担う）。

## ビジネスルール

- リマインド通知対象条件: 貸出状態が「貸出中」であり、かつ返却期限までの残日数が通知タイミング区分で定めたリマインド基準日数以内の貸出を通知対象とする
- 貸出状態が「返却済み」の貸出は対象外とする
- 貸出状態が「延滞」の貸出は返却期限を既に超過しているためリマインド対象外とする（督促通知対象条件が扱う）
- 同一の貸出・通知タイミング区分・基準日の組み合わせに対する送信要求は 1 件のみ生成する（arch SR-018 重複実行・重複消費の検知）
- 本 UC は貸出状態を遷移させない。貸出中 → 延滞の遷移は「期限超過の貸出を延滞にする」が担う
- ドメイン層はログを出力しない。監査ログはユースケース層、依存関係ログ・劣化兆候ログはゲートウェイ層で出力する（arch のレイヤー別ログカテゴリ）

## ティア完了条件（BDD）

```gherkin
Feature: 返却期限接近の貸出を判定する - バックエンドワーカー

  Scenario: 期限接近の貸出から送信要求を publish する
    Given 貸出「L-1001」が貸出状態「貸出中」・返却期限「2026-09-05」で登録されている
    And remind_days が「3」に設定されている
    When base_date「2026-09-02」で返却期限接近判定日次ジョブを実行する
    Then notification.remind.requested に target_loan_id「L-1001」・timing_type「期限前リマインド」のメッセージが 1 件 publish される

  Scenario: 返却期限当日の貸出に期限当日区分を設定する
    Given 貸出「L-1002」が貸出状態「貸出中」・返却期限「2026-09-02」で登録されている
    When base_date「2026-09-02」で返却期限接近判定日次ジョブを実行する
    Then publish されたメッセージの timing_type が「期限当日」になる

  Scenario: 返却済みの貸出を走査対象から除外する
    Given 貸出「L-1003」が貸出状態「返却済み」・返却期限「2026-09-03」で登録されている
    When base_date「2026-09-02」で返却期限接近判定日次ジョブを実行する
    Then target_loan_id「L-1003」のメッセージは publish されない

  Scenario: 同一 base_date の再実行で二重 publish しない
    Given ジョブ実行 ID「upcoming-due-judge:2026-09-02」が完了済みで記録されている
    When base_date「2026-09-02」で返却期限接近判定日次ジョブを再実行する
    Then メッセージは 1 件も publish されず INFO ログ「重複実行を検知」が出力される

  Scenario: 10 万件の走査でチャンク処理を行う
    Given 貸出中の貸出が 100000 件登録されている
    When chunk_size「1000」で返却期限接近判定日次ジョブを実行する
    Then 走査は 1000 件単位に分割され、ジョブ実行時間が 8 時間以内に完了する

  Scenario: MQ publish に失敗したときリトライする
    Given MQ が最初の publish で一時エラーを返す
    When base_date「2026-09-02」で返却期限接近判定日次ジョブを実行する
    Then 指数バックオフで再 publish され、冪等キーにより送信要求は 1 件だけ生成される
```
