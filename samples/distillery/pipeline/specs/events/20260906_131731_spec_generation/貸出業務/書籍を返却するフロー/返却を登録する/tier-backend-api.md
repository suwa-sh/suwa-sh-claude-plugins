# 返却を登録するのAPI仕様

## 責務

貸出と予約を直列化し、返却状態・書籍状態・通知要求を一取引で確定する。

## 契約

| 操作 | 参照 | 認証と認可 |
|---|---|---|
| returnLoan | [API索引](_api-summary.yaml)のreturnLoan | 司書、館内経路 |
| getReturnPreview | [API索引](_api-summary.yaml)のgetReturnPreview | 司書、館内経路 |

## 実行条件

| 判断 | 処理 |
|---|---|
| 貸出の特定 | getReturnPreviewはbook_idで未返却貸出を1件特定する。0件は404。複数件なら503として運用異常を記録し、任意の1件を選ばない。 |
| 予約との競合 | 同じ書籍ロックにより、予約登録と取消の順序を確定する。通知要求はその取引で確定した先頭予約IDを参照する。 |
| 通知の発火 | 返却commitに通知要求を含める。確認画面への遷移や送信ボタンの押下を待たず、outbox公開処理が配信を開始する。 |

## データ操作

getReturnPreviewはpath.book_idから未返却貸出を特定する。returnLoanはpath.loan_idから同じ読取対象を特定する。照会operationは_model-summaryのSELECTだけを実行し、INSERT/UPDATEは実行しない。

[_model-summary.yaml](_model-summary.yaml)を参照する。
書籍、対象貸出、順序付きの有効予約を同じ取引でロックする。
貸出返却、書籍状態、返却イベント、先頭予約への通知要求とoutboxを同一SQLトランザクションで確定する。

## 再送と競合

| ケース | 処理と結果 |
|---|---|
| 共通保証 | [技術規則](../../../_cross-cutting/technical-rules.md)の認証、日時、トランザクション、再送を適用する |
| 対象不在 | 404を返す。本人スコープの不一致も同じ応答とする |
| version不一致 | 409を返し、変更せず最新値を再取得させる |
| commit前の障害 | 同じ取引の変更をrollbackする |
| commit後の応答不明 | 同じキーと入力の再送で確定済み結果を返す |

## ティア完了条件

```gherkin
Feature: 返却を登録するのAPI
  Scenario: 権限外の呼出を拒否する
    Given 期限切れの認証トークンがある
    When returnLoanを呼ぶ
    Then 401を返し、データの読取結果を返さず更新もしない
```
