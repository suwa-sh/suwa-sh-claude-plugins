# 貸出を登録するのAPI仕様

## 責務

利用者と書籍を直列化し、貸出・期限・予約終了を一取引で確定する。

## 契約

| 操作 | 参照 | 認証と認可 |
|---|---|---|
| createLoan | [API索引](_api-summary.yaml)のcreateLoan | 司書、館内経路 |
| getLoanEligibility | [API索引](_api-summary.yaml)のgetLoanEligibility | 司書、館内経路 |
| getUser | [API索引](_api-summary.yaml)のgetUser | 司書、館内経路 |
| getBook | [API索引](_api-summary.yaml)のgetBook | 司書、館内経路 |

## 実行条件

| 判断 | 処理 |
|---|---|
| 確認API | getLoanEligibilityは貸出確定と同じ条件評価を読取snapshotで行う。eligibleは予約優先と媒体条件を含み、登録時に再評価する。 |
| 日付と期間 | APIが確定処理を開始した業務日を貸出日とする。有効世代の選定と未設定または重複時の停止は[TR-PARAM](../../../_cross-cutting/technical-rules.md#TR-PARAM)を適用する。 |
| 予約終了 | 対象書籍の先頭予約が当該利用者なら、その予約を終了扱いにして順位対象から除外し、後続順位を詰める。貸出可否を通知送信成功の有無で狭めない。 |

## データ操作

getLoanEligibilityはquery.book_id/user_numberを共通の読取パラメータへ設定する。createLoanはbody.book_id/user_numberを設定する。照会operationは_model-summaryのSELECTだけを実行し、INSERT/UPDATEは実行しない。

[_model-summary.yaml](_model-summary.yaml)を参照する。
利用者行→書籍行をロックし、deleted=falseを再確認して先頭予約と有効な貸出期間を読む。
貸出作成、書籍状態更新、対象予約の終了、各イベント追記を同一SQLトランザクションで確定する。

## 再送と競合

| ケース | 処理と結果 |
|---|---|
| 共通保証 | [技術規則](../../../_cross-cutting/technical-rules.md)の認証、日時、トランザクション、再送を適用する |
| 対象不在 | 404を返す。本人スコープの不一致も同じ応答とする |
| commit前の障害 | 同じ取引の変更をrollbackする |
| commit後の応答不明 | 同じキーと入力の再送で確定済み結果を返す |

## ティア完了条件

```gherkin
Feature: 貸出を登録するのAPI
  Scenario: 権限外の呼出を拒否する
    Given 期限切れの認証トークンがある
    When createLoanを呼ぶ
    Then 401を返し、データの読取結果を返さず更新もしない
```
