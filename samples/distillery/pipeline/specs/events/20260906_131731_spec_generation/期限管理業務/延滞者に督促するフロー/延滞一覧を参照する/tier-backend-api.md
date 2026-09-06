# 延滞一覧を参照するAPI仕様

## 責務

延滞中の貸出と同じ貸出IDの督促記録を結合し、司書へ返す。

## 契約

[API索引](_api-summary.yaml)のlistOverdueLoansを参照する。
認証と館内経路には[TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)を適用する。

## 照会条件

| 対象 | 処理 |
|---|---|
| 貸出 | current_status=延滞。返却済みを除外する |
| 通知 | target_loan_idが一致しnotification_type=督促の記録だけを含める |
| 順序 | due_date昇順、loan_id昇順。ページとtotalを同一snapshotで計算する |
| 空一覧 | items=[]、total=0を200で返す |
| 最新結果 | sent_at降順、同値はnotification_id昇順で先頭を最終督促とする |
| DBまたは監査の失敗 | 503。個人情報の部分結果を返さない |

[_model-summary.yaml](_model-summary.yaml)のSELECTとaudit_logsのINSERTを参照する。

## ティア完了条件

```gherkin
Feature: 延滞一覧API
  Scenario: リマインドを督促結果に混ぜない
    Given L-001にリマインド成功と督促失敗の記録がある
    When listOverdueLoansを呼ぶ
    Then 督促履歴には失敗だけを返す
```
