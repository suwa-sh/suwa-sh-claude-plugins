# 利用者の利用状況を参照するのAPI仕様

## 責務

司書の参照範囲に従って対象の情報を取得し、getUserActivityの応答を返す。

## 契約

| 操作 | 定義 | 適用条件 |
|---|---|---|
| getUserActivity | [_api-summary.yaml](_api-summary.yaml)のoperationと[_contract-slice.json](_contract-slice.json) | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)。館内接続と司書ロールを検証する |

## データ操作

| 対象 | 絞り込みと投影 |
|---|---|
| users, loans, reservations, books | 指定利用者の存在を確認し、同じ利用者番号のloansと有効なreservationsをbooksと結合する |
| 返却する結果 | user・loans・reservationsを同じRDB読取スナップショットで取得する |
| データ定義 | [_model-summary.yaml](_model-summary.yaml)のtables、[所有者索引](../../../_cross-cutting/datastore/generated/table-index.yaml) |

<a id="read-transaction"></a>

## 読み取りと保存の境界

一覧とtotal、結合した書籍属性を同じ読取スナップショットから取得する。
監査の追記が確定してから応答し、読取・監査の失敗では503を返す。
読み取りと並行した貸出・返却・取消は次回取得で表示し、今回の応答内に異なる読取時点を混在させない。

<a id="user-exists"></a>

指定user_numberの利用者が存在しない場合は404で処理を終了する。

<a id="empty-result"></a>

対象が0件でも200を返す。一覧は空配列、件数は0とする。利用者が存在しない404とは区別する。

## 再取得

| ケース | 結果 |
|---|---|
| 同じ要求を再実行 | 最新の確定状態を読み直す。業務状態を変更しない |
| 通信失敗 | [TR-ERROR](../../../_cross-cutting/technical-rules.md#TR-ERROR)に従う。結果を成功と推定しない |
| 処理時間 | [NFR](../../../../../../nfr/latest/nfr-grade.yaml)のB.2.1.1（5秒）を満たす |

## ティア完了条件

```gherkin
Feature: 利用者の利用状況を参照するのAPI境界
  Scenario: 監査の失敗で情報を返さない
    Given 対象の参照には成功したが監査のINSERTが失敗する
    When getUserActivityを実行する
    Then 503を返し業務情報を応答へ含めない
```
