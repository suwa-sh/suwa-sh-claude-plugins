# 集計結果の表示

| 画面 | 入力 | 表示部品 |
|---|---|---|
| 在庫状況一覧 | 状態別件数と書籍一覧 | StatCard、BookTable |
| 人気書籍ランキング | 書籍ごとの貸出回数と順位 | RankingList、StatCard |
| 期間別貸出統計 | 指定期間の件数系列 | PeriodSelector、PeriodStatChart、StatCard |
| 延滞状況 | 延滞貸出と最終督促結果 | OverdueTable、NotificationLogTable |

[Reports Stories](../../../../../design/latest/storybook-app/src/components/domain/Reports.stories.tsx)と[Loans Stories](../../../../../design/latest/storybook-app/src/components/domain/Loans.stories.tsx)を参照する。
集計対象と順位はAPI結果を表示する。
期間変更時は古い要求を取り消し、最後に指定した期間に対応する結果だけを採用する。
