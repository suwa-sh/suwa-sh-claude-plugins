---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-backend-api)"
related_ids: [REQ-002, SPEC-002-01]
related_files:
  - "docs/specs/latest/_cross-cutting/datastore/kvs-schema.yaml"
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md"
severity: spec-gap
---

# 変更要望: 冪等キー重複時の挙動が kvs-schema.yaml(一般)と tier-backend-api.md(個別)で矛盾する

## 現状の仕様

- `_cross-cutting/datastore/kvs-schema.yaml` の `idempotency:{idempotency_key}` パターンの
  `value_description` は「処理済みレスポンスのJSON文字列。重複リクエスト時にキャッシュから返却」と
  記載されており、重複時は元の成功レスポンス(201)をキャッシュから返す、という一般的な冪等性の
  挙動を示唆している。
- 一方 `tier-backend-api.md` のエラーレスポンス表・ティア完了条件(BDD)「冪等キー重複での二重貸出防止」は
  `409 | 冪等キー重複 | RFC 7807: detail="このリクエストは既に処理済みです"` と明記しており、
  この API に限っては明示的に 409 を返す、とテストされている。

## 実装で判明した問題

両者は一般ルール(kvs-schema.yaml、全API共通の説明)と個別ルール(tier-backend-api.md、本UC固有かつ
BDDで実行検証される)の関係にあるが、記述としては矛盾している。実装は後者(具体的かつテスト可能な
本UCの正本)を優先し、`createLoanUseCase` は冪等キー重複時に常に 409 を返す実装とし、キャッシュ済み
レスポンスの再送はしなかった。ティア BDD シナリオ2はこれで pass しているが、この判断は本UC固有の
解釈であり、他UCが同じ `idempotency:{idempotency_key}` パターンを使う際に同じ判断を独自に
行う必要が生じる。

根拠: `docs/impl/latest/19ec0182/issues/20260729_011214_idempotency_conflict_semantics.md`

## 提案する変更

- 全API共通で 409 に統一するなら `kvs-schema.yaml` の `value_description` を訂正する
  (「重複リクエスト時にキャッシュから返却」という記述を削除、または「エラー応答の判定にのみ使用」に修正)。
- API ごとに挙動が異なり得るのであれば、「重複時の挙動は各API仕様(tier-*.md のエラー表)を優先する」旨を
  `kvs-schema.yaml` に補足する。

## 影響範囲

- 同じ `idempotency:{idempotency_key}` パターンを使う他UC(予約作成・予約キャンセル等の状態変更操作)。
- 対象パイプライン: dist-spec(`kvs-schema.yaml`)。
