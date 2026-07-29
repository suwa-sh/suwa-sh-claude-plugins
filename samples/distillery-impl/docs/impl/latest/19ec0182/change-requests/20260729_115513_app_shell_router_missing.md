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
severity: spec-gap
---

# 変更要望: /loans/new へ実URL到達させるアプリシェル/ルーターの生成主体が仕様に存在しない

## 現状の仕様

`tier-frontend.md` 画面仕様は「URL: /loans/new?book_id={book_id}」と定義しているが、この URL を
実際にどのコンポーネントへルーティングするか(アプリシェル、ルーター定義、エントリポイント)を
担当する tier/生成物がアーキテクチャ(arch)・仕様のどこにも定義されていない。

## 実装で判明した問題

`frontend/` ワークスペースには react/react-dom 以外にルーティングライブラリの依存が無く、
アプリのエントリポイント(index.tsx / main.tsx 等でのマウント処理)も存在しない。
つまりこのリポジトリには「アプリシェル」に相当する tier/生成物自体が無く、
`<Route path="/loans/new" element={<LoanConfirmationPage />} />` のような配線を置く場所が無い。

実装は `LoanConfirmationPage.tsx` を `bookId` を Props で受け取ればいつでもマウント可能な
自己完結コンポーネントとして実装し、URL の `book_id` クエリパラメータ抽出も純粋関数
`readBookIdFromLocation` として単体テスト可能な形に切り出すことで、アプリシェルが将来
生成された時点でそのまま `<Route>` に組み込める状態にとどめた。本UC単体では画面コンポーネント自体は
実装・テスト済みだが、実URLへの到達性は未検証のまま。

根拠: `docs/impl/latest/19ec0182/issues/20260729103956_no-app-shell-router-for-loans-new-route.md`

## 提案する変更

アプリシェル(ルーター・エントリポイント)を生成する tier/stage を arch(アーキテクチャ設計)側に
追加するか、少なくとも「どのUC/tierがアプリシェルの生成責務を持つか」を明示する。現状は
全UCの画面仕様が個別に `/xxx` という URL を持つ一方、それらを束ねるルーター定義の生成元が
不在のまま各UCが個別実装を進めている状態である。

## 影響範囲

- frontend tier を持つ全UC(蔵書管理業務・貸出管理業務・予約管理業務・利用者管理業務・閲覧業務・
  統計業務の各UC)が同じ「実URL到達性が検証できない」制約を共有している可能性が高い。
- 対象パイプライン: dist-architecture(アプリシェル/ルーターの生成責務を持つ tier の定義)。
