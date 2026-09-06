# 期間別貸出統計を参照するの画面仕様

## 責務

司書の操作をgetLoanStatisticsへ接続し、現在の条件に対応する応答を表示する。

## 画面

| 項目 | 接続先 |
|---|---|
| ルート | `/staff/reports/loans`。[画面対応](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)を参照する |
| 利用者 | 司書。[TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)を適用する |
| 部品 | [PeriodStatChart](../../../../../design/latest/storybook-app/src/components/domain/Reports.tsx)と[部品Stories](../../../../../design/latest/storybook-app/src/components/domain/Reports.stories.tsx) |

## データ取得

| 契機 | 入力元 | 使用する応答 |
|---|---|---|
| 初期表示・再試行 | URLのperiod_type/period_start/period_end | getLoanStatisticsの200 |
| 条件の変更 | PageがURLと要求番号を更新する | 直近の要求番号と一致する応答だけを採用する |

URLに期間がなければ、Asia/Tokyoの当月1日から当日まで、period_type=日で初期化してURLへ反映する。
不正なURL値はAPIを呼ばず、PeriodSelectorの入力修正を求める。

## 部品への接続

| 受取先 | 供給元・処理 |
|---|---|
| PeriodStatChart | response.seriesをseriesへ、response.period_typeをgranularityへ渡す。StatCard.valueにはtotal_loansを渡す。 |
| 表示とcallback | PeriodSelector.valueのgranularity/from/toをperiod_type/period_start/period_endへ接続する。最初と最後のbucketは要求期間の開始日・終了日で切り詰める。 |
| loading | 現在の要求が完了するまでtrue |

## 取得状態

[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#UI-READ)を適用する。
条件変更でURLを更新し、最新要求の結果だけを採用する。

## ティア完了条件

```gherkin
Feature: 期間別貸出統計を参照するの画面境界
  Scenario: 古い応答を新しい条件へ表示しない
    Given 条件Aの要求が未完了である
    When 条件Bへ変更しBの応答後にAの応答を受け取る
    Then 条件Bの結果を維持する
```
