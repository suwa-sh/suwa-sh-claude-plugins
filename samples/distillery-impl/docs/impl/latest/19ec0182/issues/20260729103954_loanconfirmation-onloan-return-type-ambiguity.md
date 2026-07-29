# LoanConfirmation コンポーネント設計の Props/状態が型として整合しない(onLoan の戻り値)

- stage: S4 tier-impl (tier-frontend) attempt-2
- 検出日時: 2026-07-29
- 深刻度: minor(実装判断で解消済み。仕様側の記載精度の問題)

## 仕様の記載

`docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md`
「コンポーネント設計 LoanConfirmation」:

- Props: `onLoan: () => Promise<void>`(貸出実行ハンドラ)
- 状態: `isCompleted`, `loanResult (LoanResponse)`

## 実装で判明した事実

`loanResult`(LoanResponse型、返却期限 due_date を含む)を LoanConfirmation コンポーネント自身の
状態として保持し、貸出完了メッセージ「貸出が完了しました。返却期限: YYYY-MM-DD」(ティア完了条件 BDD の
Scenario「貸出完了後の表示」)を描画するには、貸出結果(LoanResponse)そのものをどこかから取得する
必要がある。しかし Props で宣言されている `onLoan` の戻り値は `Promise<void>` であり、これを呼び出した
だけでは LoanResponse を得られない。Props 表と状態表の間で、値の受け渡し経路が閉じていない。

## 実装での対応

`onLoan` の戻り値を `Promise<LoanResponse>` として実装した(`frontend/src/components/LoanConfirmationScreen.tsx`)。
`isCompleted`/`loanResult` はコンポーネント内部の `useState` で保持し、`onLoan()` の resolve 値を
そのまま `loanResult` にセットする。これにより Props 表の「onLoan: 貸出実行ハンドラ」という役割と
状態表の「loanResult (LoanResponse)」の両方を矛盾なく満たせる。呼び出し元(`LoanConfirmationPage`)は
`() => controller.submitLoan(bookId, idempotencyKey)`(Promise<LoanResponse> を返す)を渡している。

ティア完了条件(BDD)の 2 シナリオ(gate 4)・単体テスト(gate 3)はいずれもこの実装で pass 済み。

## 提案

- tier-frontend.md のコンポーネント設計表を「onLoan: () => Promise<LoanResponse>」に修正するか、
  もしくは「loanResult は Props として別途渡す(親が保持)」という設計に明確化することを推奨する。
  次回のspec更新時に反映されたい。挙動・BDDシナリオには影響しない字句レベルの修正。
