# 返却通知を送信するのAPI仕様

## 責務

通知要求を契機キーで重複排除して受け付け、貸出IDから配信結果を投影する。

## 契約

| 操作 | 参照 | 認証と認可 |
|---|---|---|
| requestReturnNotification | [API索引](_api-summary.yaml)のrequestReturnNotification | 司書、館内経路 |
| getReturnNotificationStatus | [API索引](_api-summary.yaml)のgetReturnNotificationStatus | 司書、館内経路 |

## 実行条件

| 判断 | 処理 |
|---|---|
| 受付と配信 | HTTPの202は受付完了であり、送信成功はworkerの結果保存で確定する。getReturnNotificationStatusはloan_idから現在の先頭予約と通知履歴を返す。pending_requests.stateは[TR-MQ](../../../_cross-cutting/technical-rules.md#TR-MQ)のHTTP受付状態へ投影する。 |
| 自動要求との共存 | 返却と取消による自動要求、司書の要求は同じ予約IDと通知種別の契機キーで照合し、同じ通知IDに収束させる。 |
| 送信前の取消 | 送信権を獲得した後、予約が取消または終了、書籍が在庫ありか貸出中、先頭が別予約なら送信を中止する。予約状態を通知済みにしない。 |
| 送信中の取消 | 予約状態更新は予約中かつ当該予約が先頭の場合だけ行う。送信開始後の取消は外部メールを取り消せないが、取消状態を通知済みで上書きしない。 |

## データ操作

[_model-summary.yaml](_model-summary.yaml)を参照する。
通知要求、対象予約、書籍、利用者を読む。
既存の通知契機を確認し、未登録の場合だけoutboxを保存する。notification_request_receiptsは既存通知の再利用時も同じ取引で保存する。

## 再送と競合

| ケース | 処理と結果 |
|---|---|
| 共通保証 | [技術規則](../../../_cross-cutting/technical-rules.md)の認証、日時、トランザクション、再送を適用する |
| 新規通知のversion不一致 | body.versionとlock後の予約versionが異なれば409。既存cause_keyの受付再利用は予約を更新しない |
| 対象不在 | 404を返す。本人スコープの不一致も同じ応答とする |
| commit前の障害 | 同じ取引の変更をrollbackする |
| commit後の応答不明 | 同じキーと入力の再送で確定済み結果を返す |

## ティア完了条件

```gherkin
Feature: 返却通知を送信するのAPI
  Scenario: 権限外の呼出を拒否する
    Given 期限切れの認証トークンがある
    When requestReturnNotificationを呼ぶ
    Then 401を返し、データの読取結果を返さず更新もしない
```
