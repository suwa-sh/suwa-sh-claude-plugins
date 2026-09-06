# 書籍詳細の利用者画面仕様

## 責務

書籍の照会条件をAPIへ渡し、受け取った結果と次の操作を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| ルート | `/books/:bookId`。[ScreenMapping](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)の「書籍詳細・在庫状況画面」 |
| 利用条件 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)。認証された利用者 |
| 部品Story | [Books Stories](../../../../../design/latest/storybook-app/src/components/domain/Books.stories.tsx) のCardDetail |

## データの取得

| 操作 | 入力元 | 使用する応答 | 取得中と失敗時 |
|---|---|---|---|
| getBook | URLのbookId | 対象の表示値とversion | 完了まで入力または確定操作を表示しない |

操作の型と応答コードは[_api-summary.yaml](_api-summary.yaml)の該当operationから分割契約を参照する。

## 部品への接続

| 部品と定義先 | 受取先 | 供給元または処理 |
|---|---|---|
| [BookCard](../../../../../design/latest/storybook-app/src/components/domain/BookCard.tsx) | book / variant | getBookのbook_id→id、current_status→state、media_type→media、genre_name→genre、reservation_count→reservationCount、registered_at→registeredAt。titleとauthorは同名、isbnとpublisherのnullは空文字。variant=detail |
| [BookCard](../../../../../design/latest/storybook-app/src/components/domain/BookCard.tsx) | onReserve | book_idを`/books/:bookId/reserve`へ渡す。紙かつ貸出中または予約待ちの有効状態はBookCardとRDRA条件を参照 |
| [ReservationQueueTracker](../../../../../design/latest/storybook-app/src/components/domain/ReservationQueueTracker.tsx) | state / position / total | my_reservationが非nullのときcurrent_status、queue_position、reservation_countを渡す。nullなら部品を表示しない |

予約情報は本人の予約だけを表示し、他人の利用者番号、氏名、連絡先を表示しない。
在庫状態は照会時点の値として扱い、予約登録時の再判定結果を優先する。

## 状態の所有者

| 状態 | 所有者 | 更新契機 | 保持と破棄 |
|---|---|---|---|
| 対象識別子 | URL | 対象への遷移 | 再読込時もURLから復元する |
| 書籍と本人予約 | Page | getBook完了 | 対象切替で破棄し、古い応答を新しい対象へ適用しない |

## 操作後の接続

取得と失敗回復は[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#ui-read-取得状態と応答の採用)を適用する。
本人予約がnullなら予約順位の部品を表示しない。
書籍IDの切替では書籍情報と本人予約を同時に入れ替える。

## ティア完了条件

```gherkin
Feature: 書籍詳細を参照するの画面接続
  Scenario: 遅れて到着した結果を捨てる
    Given 1件目の要求の後に別条件の2件目を送信している
    When 2件目の成功後に1件目の成功が到着する
    Then 2件目の結果を保持し、1件目の結果に戻らない

  Scenario: 直リンクから編集対象を取得する
    Given URLの識別子がB-001で画面状態が空である
    When 画面を再読込する
    Then URLの識別子で対象を取得し、取得前に確定操作を利用できない
```
