---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-frontend) / S6 uc-bdd attempt-1差し戻し"
related_ids: [REQ-002, SPEC-002-01]
related_files:
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/_api-summary.yaml"
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md"
  - "docs/impl/latest/uc-map.yaml"
  - "docs/specs/latest/_cross-cutting/api/openapi.yaml"
severity: spec-gap
---

# 変更要望: UC が呼び出すが所有しない cross-UC API を機械可読に宣言する仕組みが無い

## 現状の仕様

- `_api-summary.yaml`(本UC)の `endpoints` には `POST /api/v1/loans` のみが宣言されている。
- 一方 `tier-frontend.md` UIロジック(34行)は「書籍情報を GET /api/v1/books/:id で取得」と明記しており、
  frontend 実装(`loanConfirmationApiClient.ts` の `getBook`)もこれを前提にしている。
- `GET /api/v1/books/{id}` 自体は `_cross-cutting/api/openapi.yaml`(operationId: `getBook`)に定義があり
  システム全体としては存在するAPIだが、そのオーナー tier(「書籍を登録する」または「書籍情報を編集する」UC の
  tier-backend-api)がこのUCの attempt 時点で未実装。
- `docs/impl/latest/uc-map.yaml` は UC 単位のメタ情報(business/buc/uc/path/tiers/atdd_scenarios)を機械可読で
  持つが、「この UC が実行時に依存する、他 UC が所有する API/イベント」という cross-UC 依存関係は
  どの機械可読ファイルにも存在しない。

## 実装で判明した問題

- S6(UC BDD, attempt-1)は `GET /api/v1/books/:id` の欠如により4シナリオ全てが「書籍情報の取得に失敗」で
  fail した(`docs/impl/latest/19ec0182/stages/S6_uc-bdd.done.yaml` attempt_history[0]参照)。
- 本UCの Implementer(tier-backend-api)がオーナーでないエンドポイントを暫定実装(`backend-api/src/http/booksController.ts`。
  `id`/`title`/`status` 以外は空文字列フォールバック)することで回避した。この暫定実装は正規の書籍データを
  持たないため、他UC(書籍を登録する/書籍情報を編集する)の実装が完了した際に置き換えが必要という技術的負債が
  無条件に発生する。
- この cross-UC 依存の存在は、実装が S6 で実際に fail するまでオーケストレータ・Implementer のいずれにも
  事前に検出できなかった(`_api-summary.yaml` にも `uc-map.yaml` にも手がかりが無いため)。
  根拠: `docs/impl/latest/19ec0182/issues/20260729_113000_books_get_endpoint_undeclared_in_api_summary.md`

## 提案する変更

1. `_api-summary.yaml` の生成ロジック(dist-spec)に、「自 UC が呼び出すが所有しない cross-UC API」を
   明示する欄(例: `external_dependencies: [{method, path, owner_uc}]`)を追加する。
2. `uc-map.yaml`(または同等の機械可読UC台帳)に、UC 間の呼び出し依存グラフを出力し、
   S1(uc-init)の時点で「依存先UCが未実装/未着手」を検出してユーザーに提示できるようにする
   (実装が進んでからS6で初めて判明する現状のフローを避ける)。
3. 依存先が未実装の場合の運用方針(暫定実装を許容するか、依存先UCの先行実装を要求するか)を
   dist-impl-run 側の判断基準として明文化することもあわせて検討されたい。

## 影響範囲

- 影響UC: 少なくとも本UC(書籍を貸出する)と「書籍を登録する」「書籍情報を編集する」の3UC。
  `GET /api/v1/books/:id` を参照する他UC(貸出状況を確認する、蔵書検索フロー等)も同様の潜在リスクを持つ。
- 対象パイプライン: dist-spec(`_api-summary.yaml` 生成ロジック)、必要なら uc-map.yaml を出力する
  distillery-impl 側のオーケストレーション(S1 uc-init)。
