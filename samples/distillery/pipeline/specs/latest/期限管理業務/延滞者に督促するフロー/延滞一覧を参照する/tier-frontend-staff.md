# 延滞一覧を参照する司書画面

## 責務

延滞貸出と督促結果を表示し、選択した利用者の利用状況へ接続する。

## 画面と取得

| 項目 | 接続 |
|---|---|
| route | /staff/overdues |
| 初期表示とページ変更 | listOverdueLoansへURLのpage/page_sizeを渡す |
| 部品 | [LoanTables](../../../../../design/latest/storybook-app/src/components/domain/LoanTables.tsx)のOverdueTable、NotificationLogTable |
| Story | [Loans](../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx)のOverdueとNotifications |

## 部品への接続

| 受取先 | 供給元 |
|---|---|
| OverdueTable.rows | item.loan.loan_id→id、book_id/book_title/book_author→book、loan.user_number→userNumber、user_name→userName、loaned_on→loanedAt、due_date→dueDate、current_status→state |
| 最終督促列 | notificationsの先頭をlastReminderAt/lastReminderResultへ、件数をreminderCountへ渡す |
| today | [TR-DATE](../../../_cross-cutting/technical-rules.md#TR-DATE)に従い、表示時刻をAsia/Tokyoの日付へ変換する |
| onOpenUser | row.userNumberを/staff/users/:userId/statusへ渡す |
| NotificationLogTable.logs | 通知のnotification_id→id、notification_type→kind、recipient_email→to、subject→subject、sent_at→sentAt、send_result→result |
| ページ | APIのtotalをPaginationへ渡す。件数を画面内の行数から推定しない |

取得競合、空状態、失敗、再取得には[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。

## ティア完了条件

```gherkin
Feature: 延滞一覧画面
  Scenario: 対象利用者へ進む
    Given 表示したL-001のuserNumberがU-000123である
    When 司書が利用状況を選ぶ
    Then /staff/users/U-000123/statusへ進む
```
