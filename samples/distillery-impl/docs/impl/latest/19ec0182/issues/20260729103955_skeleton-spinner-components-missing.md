# packages/ui に Skeleton / Spinner コンポーネントが未生成(ローディング表示を代替実装で対応)

- stage: S4 tier-impl (tier-frontend) attempt-2
- 検出日時: 2026-07-29
- 深刻度: minor(既知の設計システム生成不足。`packages/ui/.imported.yaml` に一般論として記録済みだが、
  本 UC での具体的な影響箇所として個別に起票する)

## 仕様の記載

`docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md` UIロジック:

- 「ローディング: 書籍情報取得時は Skeleton UI、貸出申請時はボタン disabled + Spinner」

## 実装で判明した事実

`packages/ui/.imported.yaml` に記録されている通り、design(dist-design-system)側の生成が
16 画面中 1 画面(LoanCheckout)分しか完了しておらず、`packages/ui/components/` には
BookCard / BookLoanStatusBadge / Badge / Button の 4 コンポーネントしか存在しない。
Skeleton・Spinner に相当するコンポーネントは存在しない。

coding-rules.md rule 2「frontend の UI コンポーネントは packages/ui/ のみ使用。新規コンポーネントの
自作は禁止」に従い、新規に Skeleton/Spinner コンポーネントを自作することはしなかった。

## 実装での対応(代替)

- 書籍情報取得中(`LoanConfirmationPage`): `<output>読み込み中...</output>` のプレーンテキストで代替
  (`packages/ui/stories/Pages/UserPortal/LoanCheckout.stories.tsx` の Error/Completed 状態が
  素の `<p>` 要素で表現されているのと同水準)
- 貸出申請中(`LoanConfirmationScreen` の貸出するボタン): Button コンポーネントの `disabled` +
  ラベルを「処理中...」に切り替えることで代替(Spinner は追加していない。同 Story の
  Loading variant「処理中...」表記と同じ表現)

## 提案

- design(dist-design-system)側で Skeleton・Spinner コンポーネントを追加生成した後、
  上記のテキスト代替箇所を置き換えることを推奨する
- 対象箇所: `frontend/src/pages/LoanConfirmationPage.tsx`(読み込み中表示)、
  `frontend/src/components/LoanConfirmationScreen.tsx`(送信中ボタン表示)
