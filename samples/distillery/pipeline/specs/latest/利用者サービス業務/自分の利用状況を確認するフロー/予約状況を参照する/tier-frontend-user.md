# 予約状況を参照するの画面仕様

## 責務

利用者の操作をlistMyReservationsへ接続し、現在の条件に対応する応答を表示する。

## 画面

| 項目 | 接続先 |
|---|---|
| ルート | `/me/reservations`。[画面対応](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照する |
| 利用者 | 利用者。[TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)を適用する |
| 部品 | [ReservationTable](../../../../../design/latest/storybook-app/src/components/domain/LoanTables.tsx)と[部品Stories](../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx) |

## データ取得

| 契機 | 入力元 | 使用する応答 |
|---|---|---|
| 初期表示・再試行 | URLのpage/page_size。本人番号はトークンからAPIが解決する | listMyReservationsの200 |
| 条件の変更 | PageがURLと要求番号を更新する | 直近の要求番号と一致する応答だけを採用する |

## 部品への接続

| 受取先 | 供給元・処理 |
|---|---|
| ReservationTable | itemsのreservation_id→id、book_id/book_title/book_author→book、user_number→userNumber、user_name→userName、accepted_at→acceptedAt、queue_position→position、current_status→state。有効予約だけを受け取りpositionは1以上とする。 |
| 表示とcallback | showUser=false。onCancelは変換済み行のidを予約取消画面のrouteへ渡す。ReservationQueueTrackerには選択行のstateとpositionを供給する。 |
| loading | 現在の要求が完了するまでtrue |
| Pagination | page/page_size/totalをpage/pageSize/totalへ渡す。onChangeでpageをURLへ書き、再取得する |

## 取得状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
条件変更でURLを更新し、最新要求の結果だけを採用する。

## ティア完了条件

```gherkin
Feature: 予約状況を参照するの画面境界
  Scenario: 古い応答を新しい条件へ表示しない
    Given 条件Aの要求が未完了である
    When 条件Bへ変更しBの応答後にAの応答を受け取る
    Then 条件Bの結果を維持する
```
