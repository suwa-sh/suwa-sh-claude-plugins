# 延滞者に督促するフロー

## 概要

所属UCと契約の呼出依存を示す生成ビュー。依存は実行順序を意味しない。

## 所属 UC 一覧

| UC | 提供する操作 |
|----|--------------|
| [延滞を判定する](%E5%BB%B6%E6%BB%9E%E3%82%92%E5%88%A4%E5%AE%9A%E3%81%99%E3%82%8B/spec.md) | publishDunning, consumeOverdueSchedule |
| [延滞一覧を参照する](%E5%BB%B6%E6%BB%9E%E4%B8%80%E8%A6%A7%E3%82%92%E5%8F%82%E7%85%A7%E3%81%99%E3%82%8B/spec.md) | listOverdueLoans |
| [督促を送信する](%E7%9D%A3%E4%BF%83%E3%82%92%E9%80%81%E4%BF%A1%E3%81%99%E3%82%8B/spec.md) | consumeDunning |
