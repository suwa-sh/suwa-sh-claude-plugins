# 予約一覧を参照するの画面仕様

## 責務

司書の操作をlistReservationsへ接続し、確定結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| route | /staff/books/:bookId/reservations。 [ScreenMapping](../../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照 |
| 構成 | [ReservationTable](../../../../../../design/latest/storybook-app/src/components/domain/LoanTables.tsx)。[Loans.stories.tsx](../../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx)のReservationsを参照 |

## データの取得

| 契機 | 操作 | 入力元 | 応答の利用 |
|---|---|---|---|
| 初期表示または入力確認 | listReservations | route.bookId | 部品への接続表に従う |
| 404 | 同じ要求 | 同じ対象ID | 対象なしを表示し確定操作を隠す |
| 通信失敗 | 再取得操作 | 保持した入力 | Alertに理由と再取得操作を表示 |

## 部品への接続

| 受取先またはcallback | 供給元と処理 |
|---|---|
| reservations | reservation_id→id、book_id/book_title/book_author→book、user_number→userNumber、user_name→userName、accepted_at→acceptedAt、queue_position→position、current_status→state。 |
| showUser | 司書ポータルでtrue。 |
| ReservationQueueTracker | 各行の状態と順位を渡す。totalにはAPIが返した全有効予約件数を渡す。 |
| 再取得 | 画面再表示時に同じbookIdで取得し、別書籍への遷移時は古い応答を破棄する。 |

## 取得と送信の状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
画面固有の保持値とcallbackは部品への接続表を参照する。

## ティア完了条件

```gherkin
Feature: 予約一覧を参照するの画面
  Scenario: 対象変更後の古い応答を破棄する
    Given 対象Aの照会後に対象Bを照会した
    When Bの応答の後にAの応答が到着する
    Then Bの結果を表示したままにする
```
