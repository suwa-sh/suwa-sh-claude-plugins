---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-frontend)"
related_ids: [REQ-002, SPEC-002-01]
related_files:
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md"
severity: improvement
---

# 変更要望: tier-frontend.md 内で返却期限の表記がスラッシュ区切りとハイフン区切りで食い違う

## 現状の仕様

`tier-frontend.md` 内に返却期限の表記が2箇所ある:

1. 表示要素とコンポーネントマッピング表「返却期限表示 | テキスト | - | 「返却期限: YYYY/MM/DD」」、
   および操作フロー「4. 成功 → 「貸出が完了しました。返却期限: YYYY/MM/DD」表示」→ スラッシュ区切り。
2. ティア完了条件(BDD) Scenario「貸出完了後の表示」の Then 句「貸出が完了しました。返却期限:
   2026-04-26」が表示される → ハイフン区切り。

## 実装で判明した問題

同一メッセージ(貸出完了時の表示文言)について、プロース(表示要素表・操作フロー)と実行可能な
gherkin(ティア完了条件)とで区切り文字が矛盾している。test-strategy.md の転写ルールにより
gherkin の例文は「意訳・要約・補完を禁止」かつゲート4の判定根拠そのものであるため、gherkin
(ハイフン区切り)を正として `formatDateHyphen` を貸出完了メッセージ用に実装した。一方、プロースが
言及する「予定返却期限(今日+14日)」の事前表示(貸出前のプレビュー、gherkinでは未検証)は
プロースの記載どおりスラッシュ区切り(`formatDateSlash`)のまま実装している。結果として、
実装上は「貸出前のプレビュー」と「貸出完了後の確定表示」で区切り文字が異なる状態になっている。

根拠: `docs/impl/latest/19ec0182/issues/20260729101417_due-date-format-slash-vs-hyphen.md`

## 提案する変更

`tier-frontend.md` の返却期限表記をどちらかに統一する(スラッシュ/ハイフンいずれか)。実運用上、
貸出前プレビューと貸出完了後の確定表示で区切り文字が異なるのはユーザー体験として気づきにくい不整合
であり、仕様定義時点での統一が望ましい。

## 影響範囲

- 本UCの frontend 表示文言のみ。挙動(BDD)には影響しない字句レベルの修正。
- 対象パイプライン: dist-spec(`tier-frontend.md`)。
