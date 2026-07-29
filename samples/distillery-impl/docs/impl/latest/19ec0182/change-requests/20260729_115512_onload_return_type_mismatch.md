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
severity: improvement
---

# 変更要望: LoanConfirmation コンポーネント設計の Props(onLoan)と状態(loanResult)の受け渡し経路が閉じていない

## 現状の仕様

`tier-frontend.md`「コンポーネント設計 LoanConfirmation」は以下を定義している:
- Props: `onLoan: () => Promise<void>`(貸出実行ハンドラ)
- 状態: `isCompleted`, `loanResult (LoanResponse)`

## 実装で判明した問題

貸出完了メッセージ「貸出が完了しました。返却期限: YYYY-MM-DD」(ティア完了条件BDD Scenario
「貸出完了後の表示」)を描画するには、貸出結果(`LoanResponse`、返却期限 `due_date` を含む)を
どこかから取得する必要がある。しかし Props で宣言されている `onLoan` の戻り値は `Promise<void>` であり、
これを呼び出しただけでは `LoanResponse` を得られない。Props表と状態表の間で値の受け渡し経路が
仕様上閉じていない。

実装は `onLoan` の戻り値を `Promise<LoanResponse>` として解釈し(`LoanConfirmationScreen.tsx`)、
`isCompleted`/`loanResult` はコンポーネント内部の `useState` で保持、`onLoan()` の resolve 値を
そのまま `loanResult` にセットすることで矛盾を解消した。ティア完了条件(BDD)・単体テストはいずれも
この実装で pass しているため挙動上の齟齬は無いが、仕様の型定義としては不正確なままである。

根拠: `docs/impl/latest/19ec0182/issues/20260729103954_loanconfirmation-onloan-return-type-ambiguity.md`,
`docs/impl/latest/19ec0182/stages/attempt-2/S5_verify.tier-frontend.findings.yaml`(F-001)

## 提案する変更

`tier-frontend.md` のコンポーネント設計表の `onLoan` を `() => Promise<LoanResponse>` に修正するか、
`loanResult` を Props として親コンポーネントから渡す設計(親が保持)に明確化する。

## 影響範囲

- 本UCの frontend 実装のみ。挙動には影響しない型定義レベルの修正。
- 対象パイプライン: dist-spec(`tier-frontend.md`)。
