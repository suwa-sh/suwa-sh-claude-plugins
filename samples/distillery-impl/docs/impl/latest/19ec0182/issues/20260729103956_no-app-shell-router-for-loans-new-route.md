# /loans/new へのルーティング配線(アプリシェル/ルーター)がまだ存在しない

- stage: S4 tier-impl (tier-frontend) attempt-2
- 検出日時: 2026-07-29
- 深刻度: minor(画面コンポーネント自体は実装・テスト済み。実URL到達性のみの課題)

## 仕様の記載

`docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md` 画面仕様:

- 「URL: /loans/new?book_id={book_id}」

## 実装で判明した事実

`frontend/` ワークスペースには、react/react-dom 以外にルーティングライブラリ(react-router 等)の
依存が無く、アプリのエントリポイント(index.tsx / main.tsx 等でのマウント処理)も存在しない
(`frontend/src/` は本 UC のために attempt-1/2 で作成したファイルのみ)。つまりこのリポジトリには
まだ「アプリシェル」に相当する tier/生成物が無く、`/loans/new` という実際の URL パスへ本画面を
結び付ける配線(`<Route path="/loans/new" element={<LoanConfirmationPage />} />` 等)を置く場所が無い。

## 実装での対応

`frontend/src/pages/LoanConfirmationPage.tsx` を、`bookId` を Props で受け取ればいつでも
マウント可能な自己完結コンポーネントとして実装した。URL の `book_id` クエリパラメータ抽出は
純粋関数 `readBookIdFromLocation(search: string): string | null` として切り出し、単体テスト済み。
アプリシェル/ルーターが生成された時点で、この関数と `LoanConfirmationPage` をそのまま
`<Route>` に組み込める状態にしてある。

## 提案

- アプリシェル(ルーター・エントリポイント)を生成する tier/stage をオーケストレータ側で
  スコープに追加することを推奨する(このUC単体のスコープ外の可能性が高いため、本 issue は
  ブロッカーとはせず情報提供に留める)
