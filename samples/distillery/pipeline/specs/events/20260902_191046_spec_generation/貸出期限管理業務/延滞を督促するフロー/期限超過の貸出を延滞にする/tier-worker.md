# 期限超過の貸出を延滞にする - バックエンドワーカー仕様

## 変更概要

返却期限超過判定日次タイマー（CronJob）で起動するバッチを追加する。返却期限を超過した「貸出中」の貸出をチャンク単位で走査し、貸出状態を「延滞」へ遷移させたうえで、延滞督促の送信要求を MQ へ publish する。

## イベント処理仕様

### OverdueJudgeJobHandler（返却期限超過判定日次ジョブ）

- **トリガー**: 返却期限超過判定日次タイマー（CronJob）。深夜の計画停止枠（1 時〜4 時）およびバックアップ取得時間帯と競合しない時間帯に配置する（arch SP-021）
- **入力チャネル**: なし（タイマー起動）
- **出力チャネル**: `notification.dun.requested`
- **AsyncAPI**: [asyncapi.yaml](../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.dun.requested` を参照
- **実行パラメータ**: `base_date`（既定: 実行日）、`chunk_size`（既定: 1000）
- **実行主体**: システム実行主体の認証コンテキストを組み立て、監査ログの `user_id` にジョブ識別子を記録する

#### 処理フロー

1. ジョブ実行 ID（`overdue-judge:{base_date}`）で重複実行を検知する。既に完了済みなら処理せず終了する（arch SR-018）
2. 新規 `trace_id` を発行し、以降の全ログ・MQ メッセージへ伝播する（arch SR-019）
3. `loans` を `loan_status = '貸出中' AND due_date < :base_date` の条件で `chunk_size` 単位に走査する
4. ドメイン層で督促通知対象条件を判定し、貸出状態を「貸出中」→「延滞」へ遷移させる。許可外の遷移要求はドメイン例外をスローする（arch LP-009）
5. チャンク単位のトランザクションで `UPDATE loans SET loan_status='延滞' WHERE loan_id IN (...) AND loan_status='貸出中'` を確定する（`loan_status` を WHERE に含めて競合更新を防ぐ）
6. コミット後に、遷移した貸出ごとに冪等キー（`sha256(通知種別:対象貸出ID:通知タイミング区分:base_date)`）を生成し `notification.dun.requested` へ publish する（arch LP-005）
7. 状態遷移を伴うビジネスイベントとして、遷移件数と対象貸出ID を監査ログへ INFO で出力する（arch LP-006）
8. ジョブ実行時間が実行枠のしきい値を超えた場合は WARN の劣化兆候ログを出力する（arch SR-021）

#### 出力メッセージ: DunNotificationRequested

| フィールド | 型 | 説明 |
|-----------|---|------|
| message_id | string | メッセージID（重複消費検知に使う） |
| idempotency_key | string | 冪等キー。通知種別＋対象貸出ID＋通知タイミング区分＋基準日から決定的に生成する |
| notification_type | string | 通知種別。固定値 `延滞督促` |
| timing_type | string | 通知タイミング区分。固定値 `期限超過督促` |
| target_loan_id | string | 対象貸出ID |
| recipient_user_no | string | 宛先利用者番号 |
| due_date | string(date) | 返却期限 |
| days_overdue | integer | 超過日数 |
| base_date | string(date) | 判定基準日 |
| requested_at | string(date-time) | 送信要求日時 |
| trace_id | string | 分散トレース ID |

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| RDB 一時障害（接続断・デッドロック） | Yes | No | チャンク単位で指数バックオフ + Jitter により再試行する。上限超過でジョブを異常終了し ERROR ログを出力する |
| 競合更新（他処理が同一貸出を返却済みへ更新） | No | No | `WHERE loan_status='貸出中'` により更新 0 件となる。当該貸出をスキップし送信要求も生成しない |
| MQ publish 失敗 | Yes | No | 同一チャンクを再 publish する。冪等キーにより二重生成は抑止される |
| ドメイン例外（許可外の状態遷移） | No | No | 当該貸出をスキップし WARN ログへ記録する。ジョブ全体は継続する |
| 重複実行の検知 | No | No | 既完了のジョブ実行 ID を検知したら INFO ログを出して正常終了する |
| 実行枠超過 | No | No | WARN の劣化兆候ログ（`degradation_type=batch_duration`）を出力し、処理は継続する |
| 中断（スポット/プリエンプティブル回収） | Yes | No | チャンク単位でコミット済みのため再実行で残りを処理できる（arch SP-032） |

## データモデル変更

### loans（情報: 貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（PK） | 変更なし（参照のみ） |
| user_no | VARCHAR | 宛先利用者の特定に使う | 変更なし（参照のみ） |
| due_date | DATE | 返却期限。走査の検索軸 | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`貸出中` → `延滞` へ更新する | 変更（UPDATE） |

インデックス: `(loan_status, due_date)` の複合インデックスが必須（貸出全件最大 10 万件の日次走査 / NFR B.1.1.4）。

### notification_idempotency_keys（E-902 通知送信冪等キー / KVS）

| 項目 | 型 | 説明 | 変更種別 |
|------|---|------|---------|
| idempotency_key | string | 冪等キー（KVS のキー） | 追加（本 UC で書き込む） |
| requested_at | datetime | 送信要求日時 | 追加 |
| expires_at | datetime | キー保持期限（TTL 7 日） | 追加 |

通知レコードの生成は本 UC では行わない（通知レコードの作成は「督促メールを送信する」が担う）。

## ビジネスルール

- 督促通知対象条件: 貸出状態が「貸出中」であり、かつ返却期限を経過した貸出を督促対象とし、督促時に貸出状態を「延滞」へ遷移させる
- 貸出状態が「返却済み」になった時点で督促を停止する。返却済みの貸出は走査対象から除外し、送信要求も生成しない
- 許可された遷移（貸出中 → 延滞）のみをドメインモデル内で実行する。既に「延滞」の貸出は再遷移させない（arch LP-009）
- 返却期限当日の貸出は超過していないため対象外とする（`due_date < base_date` が条件）
- 状態遷移の確定はチャンク単位のトランザクション境界で行い、送信要求の publish はコミット後に行う（arch LP-005）
- 同一の貸出・通知タイミング区分・基準日の組み合わせに対する送信要求は 1 件のみ生成する（arch SR-018）
- ドメイン層はログを出力しない。監査ログはユースケース層が出力する

## ティア完了条件（BDD）

```gherkin
Feature: 期限超過の貸出を延滞にする - バックエンドワーカー

  Scenario: 期限超過の貸出を延滞へ遷移させる
    Given 貸出「L-3001」が貸出状態「貸出中」・返却期限「2026-09-01」で登録されている
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを実行する
    Then 貸出「L-3001」の貸出状態が「延滞」に更新される

  Scenario: 遷移した貸出の督促送信要求を publish する
    Given 貸出「L-3001」が貸出状態「貸出中」・返却期限「2026-09-01」で登録されている
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを実行する
    Then notification.dun.requested に target_loan_id「L-3001」・timing_type「期限超過督促」・days_overdue「1」のメッセージが publish される

  Scenario: 返却済みの貸出を遷移させない
    Given 貸出「L-3002」が貸出状態「返却済み」・返却期限「2026-08-30」で登録されている
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを実行する
    Then 貸出「L-3002」の貸出状態は「返却済み」のままでメッセージも publish されない

  Scenario: 返却期限当日の貸出を遷移させない
    Given 貸出「L-3003」が貸出状態「貸出中」・返却期限「2026-09-02」で登録されている
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを実行する
    Then 貸出「L-3003」の貸出状態は「貸出中」のままである

  Scenario: 競合更新で返却済みになった貸出をスキップする
    Given 走査後・更新前に貸出「L-3004」が窓口処理で「返却済み」へ更新されている
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを実行する
    Then UPDATE の更新件数が 0 件となり貸出「L-3004」の送信要求は publish されない

  Scenario: 同一 base_date の再実行で二重 publish しない
    Given ジョブ実行 ID「overdue-judge:2026-09-02」が完了済みで記録されている
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを再実行する
    Then メッセージは 1 件も publish されず INFO ログ「重複実行を検知」が出力される

  Scenario: 状態遷移を監査ログへ記録する
    Given 貸出「L-3001」が延滞へ遷移する
    When base_date「2026-09-02」で返却期限超過判定日次ジョブを実行する
    Then 「誰が・いつ・何を・どうしたか」を含む INFO 監査ログに loan_id「L-3001」と遷移「貸出中→延滞」が記録される
```
