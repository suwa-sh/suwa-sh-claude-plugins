# 貸出を登録するの画面仕様

## 責務

司書の操作をcreateLoanへ接続し、確定結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| 初期入力 | query.bookIdがあれば入力欄へ設定する。getLoanEligibilityで現在の書籍と利用者を確認するまで確定操作は表示しない |
| route | /staff/loans/new。 [ScreenMapping](../../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照 |
| 構成 | [LoanRegisterPanel](../../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx)。[Loans.stories.tsx](../../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx)のLoanRegisterInteractiveを参照 |

## データの取得

| 契機 | 操作 | 入力元 | 応答の利用 |
|---|---|---|---|
| 初期表示または入力確認 | getLoanEligibility | 画面が保持するbookIdとuserNumber | 部品への接続表に従う |
| 404 | 同じ要求 | 同じ対象ID | 対象なしを表示し確定操作を隠す |
| 通信失敗 | 再取得操作 | 保持した入力 | Alertに理由と再取得操作を表示 |

## 部品への接続

| 受取先またはcallback | 供給元と処理 |
|---|---|
| onLookup | bookIdとuserNumberをqueryにしてgetLoanEligibilityを呼ぶ。 |
| lookup | book/userをUI型へ変換し、eligible→allowed、reason??undefined→deniedReason、due_date??undefined→dueDate、loan_period_days??undefined→loanPeriodDaysを渡す。 |
| today | 照会前はブラウザの現在時刻をAsia/Tokyoの日付へ変換する。照会後はgetLoanEligibility.business_dateを渡す。確定時の業務日はサーバが再判定する。 |
| onConfirm | 確認時のbookId/userNumberを固定し、createLoanへ送る。 |
| phase | 確認前input、eligible=trueでallowed、falseでdenied、201後done。入力変更でlookupを破棄してinputへ戻す。 |
| onReset | 入力と結果をクリアし、新しい操作のキーを作成する。 |

## 取得と送信の状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
[UI-WRITE](../../../_cross-cutting/ux-ui/ui-design.md#UI-WRITE)を適用する。
画面固有の保持値とcallbackは部品への接続表を参照する。

## ティア完了条件

```gherkin
Feature: 貸出を登録するの画面
  Scenario: 対象変更後の古い応答を破棄する
    Given 対象Aの照会後に対象Bを照会した
    When Bの応答の後にAの応答が到着する
    Then Bの結果を表示したままにする
```
