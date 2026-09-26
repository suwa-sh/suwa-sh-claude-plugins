---
kind: requirement
title: "返却前の貸出の表と書籍名は画面で出せない"
uc: "register-return"
tier: "frontend"
---

## 事実

- 構造の正である story `packages/ui/stories/ReturnRegister.stories.tsx` は、次の値を表示している。
  - Default (登録前): Card「この書籍の貸出」に LoanTable (書籍名・利用者・貸出日・返却期限・返却日・状態) を出す (37-41 行目)。
  - ReturnedAvailable / ReturnedOnHold: Alert の本文に書籍名 (`loan.bookTitle`) を出す (26-34 行目)。
- この UC の契約は `POST /returns` (registerReturn) だけである。
  - 返却前に、書籍IDから未返却の貸出を取得する operation は無い。
  - 応答 `ReturnRegistration` は `loan` (Loan) と `bookStatus` を返す。`Loan` に書籍名と利用者の氏名は無い。
- このため frontend は、Default の表と、結果の Alert の書籍名を契約どおりには出せない。

## 実装側の対応 (暫定)

| 状態 | story | 実装 |
|---|---|---|
| Default | 入力欄 + 「この書籍の貸出」の表 | 入力欄とボタンだけ。表は出さない |
| ReturnedAvailable | 「{書籍名}」は 在庫あり になりました | 書籍ID {bookId} の書籍は 在庫あり になりました |
| ReturnedOnHold | 「{書籍名}」は 予約待ち になりました + 取り置きの案内 | 書籍ID {bookId} の書籍は 予約待ち になりました + 取り置きの案内 (文言は story のまま) |
| Error | 固定文言「この書籍IDの貸出が見つかりません…」 | 応答 Problem の `title` (例: 「この書籍には返却できる貸出がありません」) |

- 使う部品 (PageHeader / Card / Input / Button / Alert / BookStatusBadge) と並び順は story と揃えた。
- LoanTable は使っていない (出すデータが無い)。
- 暫定の表示方法は AssumptionRecord A-004 / A-005 に記録した。

## 求める変更 (どれかを選ぶ)

| 案 | 内容 | frontend への影響 |
|---|---|---|
| ⭐推奨 1 | story の Default から「この書籍の貸出」の表を外し、結果の Alert は書籍IDで示す文言にする | 変更不要 |
| 2 | 書籍IDで未返却の貸出 (書籍名・利用者を含む) を得る operation を要求と契約に追加する | 入力後にその operation を呼び、表と書籍名を出す |
| 3 | registerReturn の応答に書籍名を足す | Alert に書籍名を出す (表は案 1 か 2 で別途決める) |
