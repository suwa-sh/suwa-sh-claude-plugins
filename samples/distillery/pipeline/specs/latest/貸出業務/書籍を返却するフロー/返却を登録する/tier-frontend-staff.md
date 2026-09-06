# 返却を登録するの画面仕様

## 責務

司書の操作をreturnLoanへ接続し、確定結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| route | /staff/returns/new。 [ScreenMapping](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照 |
| 構成 | [ReturnRegisterPanel](../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx)。[Loans.stories.tsx](../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx)のReturnRegisterWithReservationを参照 |

## データの取得

| 契機 | 操作 | 入力元 | 応答の利用 |
|---|---|---|---|
| 初期表示または入力確認 | getReturnPreview | 画面のbookId | 部品への接続表に従う |
| 404 | 同じ要求 | 同じ対象ID | 対象なしを表示し確定操作を隠す |
| 通信失敗 | 再取得操作 | 保持した入力 | Alertに理由と再取得操作を表示 |

## 部品への接続

| 受取先またはcallback | 供給元と処理 |
|---|---|
| onLookup | getReturnPreviewへbookIdを渡し、応答のloan.loan_idとversionを保持する。 |
| lookup | loanとbookをUI型へ変換し、next_book_state→nextBookState、next_reservation??undefined→firstReservationを渡す。 |
| today | ブラウザの現在時刻をAsia/Tokyoの日付へ変換する。返却確定日はreturnLoanのサーバ側business_dateで判定する |
| onConfirm | 確認したloan_idとversionでreturnLoanを呼ぶ。 |
| phase | 初期input、予約なしfound、予約ありfound-with-reservation、成功done。 |
| lookup（成功後） | ReturnResult.loanとbook_stateで更新する。通知要求の受付を送信成功とは表示しない。 |
| onNotify | 成功結果のloan_idを/staff/returns/:loanId/notifyへ渡す。追加の送信要求は発行しない。 |

## 取得と送信の状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
[UI-WRITE](../../../_cross-cutting/ux-ui/ui-design.md#UI-WRITE)を適用する。
画面固有の保持値とcallbackは部品への接続表を参照する。

## ティア完了条件

```gherkin
Feature: 返却を登録するの画面
  Scenario: 対象変更後の古い応答を破棄する
    Given 対象Aの照会後に対象Bを照会した
    When Bの応答の後にAの応答が到着する
    Then Bの結果を表示したままにする
```
