# 在庫状況一覧を参照するの画面仕様

## 責務

司書の操作をlistInventoryへ接続し、現在の条件に対応する応答を表示する。

## 画面

| 項目 | 接続先 |
|---|---|
| ルート | `/staff/reports/inventory`。[画面対応](../../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照する |
| 利用者 | 司書。[TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)を適用する |
| 部品 | [BookTable](../../../../../../design/latest/storybook-app/src/components/domain/BookTable.tsx)と[部品Stories](../../../../../../design/latest/storybook-app/src/components/domain/Books.stories.tsx) |

## データ取得

| 契機 | 入力元 | 使用する応答 |
|---|---|---|
| 初期表示・再試行 | URLのstates/page/page_size | listInventoryの200 |
| 条件の変更 | PageがURLと要求番号を更新する | 直近の要求番号と一致する応答だけを採用する |

## 部品への接続

| 受取先 | 供給元・処理 |
|---|---|
| BookTable | itemsのbook_id→id、title/author/isbn/publisherは同名、genre_name→genre、media_type→media、current_status→state、registered_at→registeredAt、reservation_count→reservationCountへ変換する。 |
| 表示とcallback | variant="inventory"。StatCard.valueにはtotalを渡し、ラベルを「表示条件に一致する蔵書数」とする。ToggleGroupで状態を選択したらstates[]を更新しpage=1から取得する。 |
| loading | 現在の要求が完了するまでtrue |
| Pagination | page/page_size/totalをpage/pageSize/totalへ渡す。onChangeでpageをURLへ書き、再取得する |

## 取得状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
条件変更でURLを更新し、最新要求の結果だけを採用する。

## ティア完了条件

```gherkin
Feature: 在庫状況一覧を参照するの画面境界
  Scenario: 古い応答を新しい条件へ表示しない
    Given 条件Aの要求が未完了である
    When 条件Bへ変更しBの応答後にAの応答を受け取る
    Then 条件Bの結果を維持する
```
