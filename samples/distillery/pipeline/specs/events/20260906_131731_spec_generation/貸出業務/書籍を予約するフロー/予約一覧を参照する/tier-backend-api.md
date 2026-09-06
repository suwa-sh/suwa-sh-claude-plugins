# 予約一覧を参照するのAPI仕様

## 責務

書籍単位の有効予約を権限内の利用者表示情報と結合する。

## 契約

| 操作 | 参照 | 認証と認可 |
|---|---|---|
| listReservations | [API索引](_api-summary.yaml)のlistReservations | 司書、館内経路 |

## 実行条件

| 判断 | 処理 |
|---|---|
| 対象 | 予約中と通知済みだけを対象とする。取消と終了は有効順位一覧へ混ぜない。 |
| 整合した表示 | queue_position昇順、同順位ならreservation_id昇順。書籍と予約一覧は同一読取snapshotで取得する。 |

## データ操作

[_model-summary.yaml](_model-summary.yaml)を参照する。
書籍と予約、利用者の同一読取snapshotを取得する。
業務データは更新せず、[TR-AUDIT](../../../_cross-cutting/technical-rules.md#TR-AUDIT)に従い参照監査を保存する。

## 照会の失敗

| 条件 | 結果 |
|---|---|
| 認証と経路が不成立 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)の401/403 |
| 対象書籍がない | 404 |
| DBまたは監査を利用できない | 503。部分的な一覧を返さない |
| 通信切断 | 同じbook_idとページ条件で再取得する |

## ティア完了条件

```gherkin
Feature: 予約一覧を参照するのAPI
  Scenario: 権限外の呼出を拒否する
    Given 期限切れの認証トークンがある
    When listReservationsを呼ぶ
    Then 401を返し、データの読取結果を返さず更新もしない
```
