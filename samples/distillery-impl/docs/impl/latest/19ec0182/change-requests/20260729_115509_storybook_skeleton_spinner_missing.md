---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-frontend) attempt-2"
related_ids: [REQ-002, SPEC-002-01]
related_files:
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md"
  - "packages/ui/.imported.yaml"
severity: spec-gap
---

# 変更要望: packages/ui の Storybook 生成が本UCの要求(Skeleton/Spinner)を満たしていない

## 現状の仕様

`tier-frontend.md` UIロジック(36行)は「ローディング: 書籍情報取得時は Skeleton UI、貸出申請時は
ボタン disabled + Spinner」と明記している。`coding-rules.md` rule 2 は「frontend の UI コンポーネントは
packages/ui/ のみ使用。新規コンポーネントの自作は禁止」と規定している。

## 実装で判明した問題

`packages/ui/.imported.yaml` の記録によれば、design(dist-design-system)側の生成が16画面中1画面
(LoanCheckout)分しか完了しておらず、`packages/ui/components/` には `BookCard` / `BookLoanStatusBadge` /
`Badge` / `Button` の4コンポーネントしか存在しない。`Skeleton` / `Spinner` に相当するコンポーネントは
未生成。

coding-rules.md rule 2 に従い新規コンポーネントの自作はせず、以下のテキスト代替で `tier-frontend.md` の
要求を部分的にのみ満たした:
- 書籍情報取得中: `<output>読み込み中...</output>`
- 貸出申請中: `Button` の `disabled` + ラベル「処理中...」

S5 verify(attempt-2/3)はいずれもこれを minor finding(F-002)として記録し、実装判断としては妥当と
評価しているが、`tier-frontend.md` が要求する視覚表現(Skeleton UI / Spinner)は実現できていない。

根拠: `docs/impl/latest/19ec0182/issues/20260729103955_skeleton-spinner-components-missing.md`,
`docs/impl/latest/19ec0182/stages/attempt-2/S5_verify.tier-frontend.findings.yaml`(F-002)

## 提案する変更

dist-design-system 側で `Skeleton` / `Spinner` コンポーネントを追加生成し、本UCおよび他UCの
テキスト代替箇所を置き換える。対象箇所: `frontend/src/pages/LoanConfirmationPage.tsx`(読み込み中表示)、
`frontend/src/components/LoanConfirmationScreen.tsx`(送信中ボタン表示)。

## 影響範囲

- Skeleton/Spinner を要求する他UC(16画面中15画面が design 側で未生成のため相当数に上る可能性)。
- 対象パイプライン: dist-design-system(`packages/ui` の生成対象コンポーネント一覧)。
