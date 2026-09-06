# 人気書籍ランキングを参照するの画面仕様

## 責務

司書の操作をgetPopularBooksへ接続し、現在の条件に対応する応答を表示する。

## 画面

| 項目 | 接続先 |
|---|---|
| ルート | `/staff/reports/ranking`。[画面対応](../../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照する |
| 利用者 | 司書。[TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)を適用する |
| 部品 | [RankingList](../../../../../../design/latest/storybook-app/src/components/domain/Reports.tsx)と[部品Stories](../../../../../../design/latest/storybook-app/src/components/domain/Reports.stories.tsx) |

## データ取得

| 契機 | 入力元 | 使用する応答 |
|---|---|---|
| 初期表示・再試行 | URLのperiod_type/period_start/period_end | getPopularBooksの200 |
| 条件の変更 | PageがURLと要求番号を更新する | 直近の要求番号と一致する応答だけを採用する |

URLに期間がなければ、Asia/Tokyoの当月1日から当日まで、period_type=日で初期化してURLへ反映する。
不正なURL値はAPIを呼ばず、PeriodSelectorの入力修正を求める。

## 部品への接続

| 受取先 | 供給元・処理 |
|---|---|
| RankingList | itemsのranking→rank、book_id/book_title/book_author/genre_name→book.id/title/author/genre、loan_count→countへ変換する。 |
| 表示とcallback | limitにはAPIのpage_sizeを渡す。PeriodSelector.valueのgranularity/from/toをperiod_type/period_start/period_endへ接続する。StatCard.valueにはtotalを渡し「貸出実績のある書籍数」と表示する。 |
| loading | 現在の要求が完了するまでtrue |
| Pagination | page/page_size/totalをpage/pageSize/totalへ渡す。onChangeでpageをURLへ書き、再取得する |

## 取得状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
条件変更でURLを更新し、最新要求の結果だけを採用する。

## ティア完了条件

```gherkin
Feature: 人気書籍ランキングを参照するの画面境界
  Scenario: 古い応答を新しい条件へ表示しない
    Given 条件Aの要求が未完了である
    When 条件Bへ変更しBの応答後にAの応答を受け取る
    Then 条件Bの結果を維持する
```
