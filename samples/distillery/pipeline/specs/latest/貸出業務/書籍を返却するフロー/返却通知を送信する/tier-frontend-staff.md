# 返却通知を送信するの画面仕様

## 責務

司書の操作をrequestReturnNotificationへ接続し、確定結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| route | /staff/returns/:loanId/notify。 [ScreenMapping](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照 |
| 構成 | [ConfirmPanel](../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx)。[Loans.stories.tsx](../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx)のConfirmSendNotificationを参照 |

## データの取得

| 契機 | 操作 | 入力元 | 応答の利用 |
|---|---|---|---|
| 初期表示または入力確認 | getReturnNotificationStatus | route.loanId | 部品への接続表に従う |
| 404 | 同じ要求 | 同じ対象ID | 対象なしを表示し確定操作を隠す |
| 通信失敗 | 再取得操作 | 保持した入力 | Alertに理由と再取得操作を表示 |

## 部品への接続

| 受取先またはcallback | 供給元と処理 |
|---|---|
| summary | book.title、recipient.name、対象予約IDから確認内容を構成する。 |
| blocked | reservation=nullまたはpending_requestsにqueued/unknownがある場合true。理由を明示する。 |
| onConfirm | reservation.reservation_idとversionをrequestReturnNotificationへ送る。 |
| NotificationLogTable.logs | 確定した成功/失敗通知だけをUI型へ変換する。queued/unknownは別のAlertで表示する。 |
| 受付後 | 202後にgetReturnNotificationStatusを再取得する。queued中は5秒ごとに再取得し、画面離脱で停止する。 |

## 取得と送信の状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
[UI-WRITE](../../../_cross-cutting/ux-ui/ui-design.md#UI-WRITE)を適用する。
画面固有の保持値とcallbackは部品への接続表を参照する。

## ティア完了条件

```gherkin
Feature: 返却通知を送信するの画面
  Scenario: 対象変更後の古い応答を破棄する
    Given 対象Aの照会後に対象Bを照会した
    When Bの応答の後にAの応答が到着する
    Then Bの結果を表示したままにする
```
