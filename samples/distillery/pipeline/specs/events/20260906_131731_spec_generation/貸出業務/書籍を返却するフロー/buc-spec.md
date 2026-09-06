# 書籍を返却するフロー

## 概要

所属UCと契約の呼出依存を示す生成ビュー。依存は実行順序を意味しない。

## 所属 UC 一覧

| UC | 提供する操作 |
|----|--------------|
| [返却を登録する](%E8%BF%94%E5%8D%B4%E3%82%92%E7%99%BB%E9%8C%B2%E3%81%99%E3%82%8B/spec.md) | returnLoan, getReturnPreview |
| [返却通知を送信する](%E8%BF%94%E5%8D%B4%E9%80%9A%E7%9F%A5%E3%82%92%E9%80%81%E4%BF%A1%E3%81%99%E3%82%8B/spec.md) | requestReturnNotification, getReturnNotificationStatus, publishReturnNotification, consumeReturnNotification |

## 契約の呼出依存

| 利用UC | operation | 所有UC |
|--------|-----------|--------|
| 返却を登録する | publishReturnNotification | [貸出業務/書籍を返却するフロー/返却通知を送信する](%E8%BF%94%E5%8D%B4%E9%80%9A%E7%9F%A5%E3%82%92%E9%80%81%E4%BF%A1%E3%81%99%E3%82%8B/spec.md) |
