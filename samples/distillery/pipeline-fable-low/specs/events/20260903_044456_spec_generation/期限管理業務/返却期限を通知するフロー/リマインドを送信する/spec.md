# リマインドを送信する

## 概要

日次リマインド送信バッチ（タイマー起動の MQ コンシューマ）が、UC「リマインド対象を抽出する」が発行した `ReminderMailRequested` を `notifications.reminder-mail-requested` から受信し、通知レコード（通知種別「リマインド」・送信待ち）を読み出してメール配信サービス経由でリマインドメールを送信し、送信日時と送信結果を通知レコードに反映する。抽出と送信の分離（arch LP-022 / SR-014）の送信側を担う。

## データフロー

```mermaid
graph LR
  subgraph WK["tier-worker"]
    WK_Consumer["presentation\nReminderMailConsumer\n(MessageId=通知ID, traceId)"]
    WK_UC["usecase\nSendReminderMailCommand\n(notificationId)"]
    WK_Consumer --> WK_UC
  end
  subgraph BE["tier-backend-api（共有モジュール）"]
    BE_Domain["domain\nNotification\n送信待ち→成功/失敗\nLoan（貸出中の再確認）\nReminderPolicy"]
    BE_Repo["repository\nNotificationRepository.findById / save\nLoanRepository.findById\nBookRepository.findById"]
    BE_GW["gateway\nMailDeliveryAdapter\n(tier-external-integration ACL)"]
    WK_UC --> BE_Domain
    WK_UC --> BE_Repo
    WK_UC --> BE_GW
  end
  subgraph DB["RDB"]
    DB_Notif[("notifications\nsend_result=PENDING→SUCCEEDED/FAILED, sent_at")]
    DB_Loans[("loans\ncurrent_status, due_date")]
    DB_Books[("books\ntitle")]
  end
  subgraph MQ["MQ"]
    MQ_In[["notifications.reminder-mail-requested"]]
    MQ_DLQ[["notifications.reminder-mail-requested.dlq"]]
  end
  subgraph EXT["メール配信サービス"]
    EXT_Mail["メール送信 API"]
  end
  MQ_In -->|"ReminderMailRequested{notificationId}"| WK_Consumer
  BE_Repo -->|"SELECT notifications WHERE notification_id=:id"| DB_Notif
  BE_Repo -->|"SELECT loans WHERE loan_id=:targetLoanId"| DB_Loans
  BE_Repo -->|"SELECT books WHERE book_id=:bookId"| DB_Books
  BE_GW -->|"send(通知ID, 送信先, 件名, 本文)"| EXT_Mail
  EXT_Mail -->|"送信結果（成功 / 一時失敗 / 恒久失敗）"| BE_GW
  BE_Repo -->|"UPDATE notifications SET send_result, sent_at WHERE notification_id=:id AND send_result='PENDING'"| DB_Notif
  WK_Consumer -.->|"再配信上限超過"| MQ_DLQ
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| WK presentation | ReminderMailConsumer（MessageId = 通知 ID、traceId = ジョブ実行 ID） | MQ メッセージのデシリアライズ → Command 変換。MessageId で既処理照合（LR-014） |
| WK usecase | SendReminderMailCommand(notificationId) | 通知レコード取得 → 送信可否判定 → ACL 送信 → 送信結果の反映（LP-024） |
| BE domain | Notification（通知 ID、通知種別、送信先、件名、本文、送信結果）/ Loan（貸出の状態、返却期限）/ ReminderPolicy | 送信待ち → 成功 / 失敗 の遷移。貸出が貸出中でなくなっていれば送信不要と判定 |
| BE repository | notifications SELECT / UPDATE、loans SELECT、books SELECT | 送信結果と送信日時の反映（条件付き UPDATE で二重反映を防止） |
| BE gateway | MailDeliveryAdapter（tier-external-integration の ACL アダプタ）| 通知語彙 → メール配信サービスの API モデルに翻訳。冪等キー = 通知 ID（LR-019） |

## 処理フロー

```mermaid
sequenceDiagram
  actor Timer as タイマー（MQ 配信）

  box rgb(255,245,230) tier-worker
    participant Consumer as presentation (ReminderMailConsumer)
    participant UC as usecase (SendReminderMail)
  end

  box rgb(240,255,240) tier-backend-api（共有モジュール）
    participant Domain as domain (Notification / Loan)
    participant Repo as repository
    participant GW as gateway (MailDeliveryAdapter)
  end

  participant DB as RDB
  participant Mail as メール配信サービス

  Timer->>Consumer: ReminderMailRequested{notificationId, traceId}
  Consumer->>Consumer: MessageId（=通知 ID）で既処理照合（KVS）
  Consumer->>UC: SendReminderMailCommand(notificationId)
  UC->>Repo: NotificationRepository.findById(notificationId)
  Repo->>DB: SELECT notifications WHERE notification_id=:id
  DB-->>Repo: NotificationRecord
  alt 送信結果 が 送信待ち 以外（成功 / 失敗 / スキップ）
    UC-->>Consumer: 既処理として正常終了（ACK）
  else 送信待ち
    UC->>Repo: LoanRepository.findById(targetLoanId)
    Repo->>DB: SELECT loans WHERE loan_id=:id
    DB-->>Repo: Loan
    UC->>Domain: ReminderPolicy.isStillTarget(loan)
    alt リマインド対象判定: 貸出の状態 = 貸出中
      Domain-->>UC: 送信対象
      UC->>GW: send(通知ID, 送信先, 件名, 本文, idempotencyKey=通知ID)
      GW->>Mail: メール送信 API（HTTPS / SMTPS）
      Mail-->>GW: 応答
      GW-->>UC: 送信結果（成功 / 一時失敗 / 恒久失敗）
      alt 成功
        UC->>Domain: notification.markSent(now)
        UC->>Repo: NotificationRepository.updateSendResultIfPending（send_result=SUCCEEDED, sent_at=now）
        Repo->>DB: UPDATE notifications ... WHERE send_result='PENDING'
      else 恒久失敗（宛先不正・4xx）
        UC->>Domain: notification.markFailed(reason)
        UC->>Repo: NotificationRepository.updateSendResultIfPending（send_result=FAILED）
        Repo->>DB: UPDATE notifications ... WHERE send_result='PENDING'
      else 一時失敗（5xx / タイムアウト / CB Open）
        UC-->>Consumer: RetryableError
        Consumer->>Consumer: NACK（指数バックオフで再配信。上限超過は DLQ + send_result=FAILED）
      end
    else 対象外（返却済み・削除済み）
      Domain-->>UC: 送信不要
      UC->>Repo: NotificationRepository.updateSendResultIfPending（send_result=SKIPPED）
      Repo->>DB: UPDATE notifications ... WHERE send_result='PENDING'
    end
    UC-->>Consumer: 完了（ACK）
  end
  Consumer->>Consumer: 処理サマリ（成功 / 失敗 / スキップ）をメトリクスに加算
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| 通知種別 | リマインド | 件名・本文のテンプレートをリマインド用に切り替え、送信契機（期限接近）を区別する。ストラテジー（LP-012） | tier-backend-api | ReminderMailTemplate / MailDeliveryAdapter |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| リマインド対象判定（送信時再確認） | 通知レコードの対象貸出が貸出の状態 = 貸出中 のときのみ送信する。返却済み・延滞に遷移していれば送信せず「スキップ」とする | tier-backend-api | domain ReminderPolicy.isStillTarget | 送信待ちのリマインド通知をメール送信する / 抽出後に返却された貸出には送信しない |
| 既処理判定（重複送信防止） | 通知レコードの送信結果が「送信待ち」以外なら送信せず ACK する。MessageId = 通知 ID を KVS で照合する | tier-worker | ReminderMailConsumer / NotificationRepository.updateSendResultIfPending の条件付き UPDATE | 同じメッセージを再受信しても二重送信しない |
| 送信結果分類 | ACL の結果型: 成功 → 成功、恒久失敗（4xx・宛先不正）→ 失敗、一時失敗（5xx・タイムアウト・サーキットブレーカー Open）→ 再配信 | tier-worker | ReminderMailConsumer（LR-015） | 一時障害時は再配信し上限超過で DLQ に退避する |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| 再配信間隔 | 再配信回数 n（1〜5） | 待機秒 = min(30 × 2^(n-1), 600) + Jitter（0〜10 秒） | 次回配信時刻 | tier-worker |
| 残日数（本文用） | 貸出.返却期限、送信日 | 残日数 = 返却期限 − 送信日 | 本文の「あと N 日」 | tier-backend-api |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 通知の送信結果（情報: 通知） | 送信待ち | 成功 | メール送信成功 | 通知種別 = リマインド、対象貸出が貸出中 | sent_at を設定 | tier-backend-api |
| 通知の送信結果（情報: 通知） | 送信待ち | 失敗 | 恒久失敗 / 再配信上限超過 | 同上 | DLQ 退避（上限超過時）と WARN ログ | tier-worker / tier-backend-api |
| 通知の送信結果（情報: 通知） | 送信待ち | スキップ | 対象貸出が貸出中でない | 抽出後に返却済みへ遷移 | 送信しない | tier-backend-api |
| 貸出の状態 | 貸出中 | 貸出中（遷移なし） | リマインドを送信する | 参照のみ | なし | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 期限管理業務 | このUCが属する業務 |
| BUC | 返却期限を通知するフロー | このUCを含むBUC |
| アクター | タイマー | 日次リマインド送信バッチ（MQ コンシューマ）として起動する |
| 情報 | 貸出 | 対象貸出（返却期限・貸出の状態の再確認） |
| 情報 | 利用者 | 送信先（通知レコードの送信先メールアドレスの元） |
| 情報 | 通知 | 送信対象レコード。送信日時・送信結果を更新 |
| 情報 | 書籍 | 本文に載せる書籍タイトル |
| 状態 | 貸出の状態 | 貸出中のみ送信 |
| 条件 | リマインド対象判定 | 送信時の再確認に適用 |
| バリエーション | 通知種別 | リマインド |
| タイマー | 日次リマインド送信バッチ | 起動契機 |
| イベント | 返却期限リマインドメール配信 | メール配信サービスへの送信 |
| 外部システム | メール配信サービス | メールを配信する |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: リマインドを送信する

  Scenario: 送信待ちのリマインド通知をメール送信する
    Given 通知 ID「01J7R1」の通知レコードが通知種別「リマインド」・送信結果「送信待ち」で存在する
    And 対象貸出「L-1001」（利用者「U-0001」、書籍「吾輩は猫である」、返却期限 2026-09-05）が貸出中である
    And 今日が 2026-09-03 である
    When MQ チャネル "notifications.reminder-mail-requested" から ReminderMailRequested{notificationId: "01J7R1"} を受信する
    Then メール配信サービスに送信先「U-0001 のメールアドレス」・件名「【図書館】返却期限のお知らせ（あと 2 日）」でメール送信要求が 1 回行われる
    And 通知レコード「01J7R1」の送信結果が「成功」・送信日時が設定される
    And メッセージは ACK される

  Scenario: 同じメッセージを再受信しても二重送信しない
    Given 通知 ID「01J7R1」の通知レコードの送信結果が「成功」である
    When 同じ MessageId「01J7R1」の ReminderMailRequested を再受信する
    Then メール配信サービスへの送信要求は行われない
    And メッセージは ACK される

  Scenario: 抽出後に返却された貸出には送信しない
    Given 通知 ID「01J7R2」の通知レコードが送信結果「送信待ち」で存在する
    And 対象貸出「L-1002」の貸出の状態が「返却済み」である
    When ReminderMailRequested{notificationId: "01J7R2"} を受信する
    Then メール配信サービスへの送信要求は行われない
    And 通知レコード「01J7R2」の送信結果が「スキップ」になる
```

### 異常系

```gherkin
  Scenario: 一時障害時は再配信し上限超過で DLQ に退避する
    Given 通知 ID「01J7R3」の通知レコードが送信結果「送信待ち」で存在する
    And メール配信サービスが HTTP 503 を返し続ける
    When ReminderMailRequested{notificationId: "01J7R3"} を受信する
    Then メッセージは指数バックオフで最大 5 回再配信される
    And 5 回目の失敗後にメッセージは "notifications.reminder-mail-requested.dlq" へ退避される
    And 通知レコード「01J7R3」の送信結果が「失敗」になり WARN ログ「MAIL_DELIVERY_EXHAUSTED」が出力される

  Scenario: 宛先不正は再試行せず失敗として記録する
    Given 通知 ID「01J7R4」の通知レコードの送信先メールアドレスが不正な形式である
    When ReminderMailRequested{notificationId: "01J7R4"} を受信する
    Then メール配信サービスは HTTP 400 を返し再試行は行われない
    And 通知レコード「01J7R4」の送信結果が「失敗」になりメッセージは ACK される
```

## ティア別仕様

- [ワーカー](tier-worker.md)
- [Backend API](tier-backend-api.md)

### 統合 API Spec

- [OpenAPI Spec](../../../_cross-cutting/api/openapi.yaml)（全 UC 統合、Contract First 開発用）
- [AsyncAPI Spec](../../../_cross-cutting/api/asyncapi.yaml)（全 UC 統合、非同期イベントがある場合のみ）
