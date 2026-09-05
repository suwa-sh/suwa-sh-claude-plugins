---
name: distillery-impl:dist-impl-verify
description: >
  distillery-impl の Verifier スキル。Implementer とは別モデル・別コンテキストの反証専用エージェントとして、
  単一 UC × tier の成果物を仕様(tier md / 契約 / feature)と突き合わせ、8 観点
  (仕様整合・可読性保守性・セキュリティ・パフォーマンス・運用性・耐障害性・リファクタリング・前提整合)で
  findings を生成する。修正は行わない。dist-impl-run のサブエージェント(model 指定)として呼ばれる。
---

# dist-impl-verify

引数: `uc_id={id} tier={tier_id} attempt={n} config={impl-config.yaml へのパス} manifest_sha256={オーケストレータ算出の tier projection hash} assumptions={attempt-{n}/S4_tier-impl.{tier_id}.assumptions.yaml へのパス}`

`manifest_sha256` は再計算せず done に転記し、`manifest_projection: v2` を併記する
(state-schema.md の projection 規則)。

`_api-summary.yaml` の `schema_version: distillery.api-summary/v2` は索引である。
対象UCの `_contract-slice.json` を追加で読み、summaryの `contract_sha256` と実ファイルのSHA-256を照合する。
型・認可・エラー・イベントpayload/headerはslice内のOpenAPI/AsyncAPIから取得する。
欠落やhash不一致をlegacy形式として補完しない。提供操作だけでなく `consumes` の依存操作も対象にする。

## Verifier の掟(Cloudflare VVS の転用)

1. **反証に徹する**。実装コードの修正・追記・削除は禁止(write-set は done と findings のみ)
2. **Implementer の説明を読まない**。渡されるのは成果物と仕様だけ。実装の意図は
   コードとテストから読み取れるものだけを事実として扱う。
   **唯一の例外は AssumptionRecord(`assumptions` 引数のファイル)**: これは説明ではなく
   「Implementer が補った判断の主張一覧」であり、**反証対象**として読む。ただし 1〜7 観点を
   完走してから開き、`reason / confidence / spec_refs` は verdict 確定後にしか読まない
   (verify-viewpoints.md §8 の blind join)
3. **自分で動かして確かめる**。テスト・ゲートを再実行し、結果を findings の根拠にする
   (check-only。書き換えを伴うコマンドは実行しない)
4. **推測で severity を上げない**。blocker は「仕様違反 or 動かない」を実行結果か仕様の記載で
   立証できるものに限る

## 手順

1. `config` と uc-map から対象パスを解決し、次だけを読む:
   {tier_dir}/ の成果物(src / test / features)、tier md(ファイル名 `{tier_id}.md`)、
   _api-summary.yaml / _model-summary.yaml、
   impl-config の contracts[] で対象 tier が provider/consumers に含まれる契約の source と生成物
   (source は lock の該当契約の `source_read` が none 以外の場合のみ・scope 指定時は scope 範囲。
   生成 dir は `docs/impl/latest/contracts.lock.yaml` の該当契約の generated[] のうち
   audience が対象 tier の role または both で、lang 指定があれば対象 tier の lang と一致するもの)、
   `docs/nfr/latest/nfr-grade.yaml`(性能・可用性判定の根拠)、
   docs/dev-rules/ 3 ファイル(frontend の場合は packages/ui の export 一覧に加えて
   tier-rules.md の read-set 定義: uc-map の `ui_screens` が指す design-event.yaml の該当
   screens[] 全行 + 結線 story + story から到達する packages/ui 内の推移的 import closure)。
   **関与しない契約・schema は読まない**(誤検出を避け、read-set を最小に保つ)。
   例外: 対象 tier が関与するデータ契約が 1 件も無い場合に限り、従来どおり
   `_cross-cutting/datastore/` の schema を読んでよい(verify-viewpoints のデータ観点の fallback)
2. **検証環境の前提を probe する**: テストが要求する環境機能(TCP loopback / shared memory /
   docker / 必要バイナリ(DB の initdb・pg_ctl・psql 等))が使えるかを、ゲート再実行の前に確認する。
   不足があれば、その機能に依存するテストの失敗は **findings の blocker に数えず** done の
   `environment_failures: [{check, command, evidence}]` に分離して記録し、「環境を変えて再検証が必要」と
   報告する(サンドボックス付きで起動されると実体テストが開始できない — 実装欠陥と混同しない)
3. ゲート 1〜4 を check-only で再実行(gates.md)。Implementer の done と食い違えばそれ自体が blocker
   (手順 2 で分離した環境失敗を除く)
4. `references/verify-viewpoints.md` の 8 観点チェックリストを順に適用。**8 観点目(前提整合)の
   前提ファイルは 1〜7 観点の完走後に初めて開く**。8 観点目では S4 固定指示
   (`dist-impl-run/references/stage-instructions/S4_tier-impl.md`)も読み、復唱判定の照合先に含める
5. findings を `attempt-{n}/S5_verify.{tier_id}.findings.yaml` に書く(下記スキーマ)
6. `attempt-{n}/S5_verify.{tier_id}.done.yaml` を書く(`open_blockers` 件数を記録。環境失敗があれば `environment_failures` も記録)

## findings スキーマ

```yaml
schema_version: "1.0"
uc_id: "..."
tier: "..."
attempt: 1
verified_at: "..."
gate_reexec: {format: pass, lint: pass, tdd: pass, bdd_tier: pass}
viewpoints_checked:               # 8 観点の完走記録(findings 0 件でも「未実施」と区別できる)
  spec_conformance: {status: done, note: "API 12/12 突合"}
  readability_maintainability: {status: done}
  security: {status: done}
  performance: {status: done}
  operability: {status: done}
  fault_tolerance: {status: done}
  refactoring: {status: done}
  assumption_conformance: {status: done, note: "前提 3 件 + unlisted 1 件を照合"}
assumptions_sha256: "..."          # 照合した AssumptionRecord の canonical hash(assumption-record.md の規則)
assumption_verdicts:               # 全 A-id に exactly-one + Verifier が見つけた V-nnn。0 件なら []
  - id: A-001
    tier: "tier-backend-api"
    assumption: "..."               # AssumptionRecord から verbatim
    target: "backend-api/src/loan/repo.ts:12"
    category: data_format          # Implementer の分類(V-nnn は null)
    verified_category: persistence # Verifier の独立判定
    verdict: consistent | spec_absent | contradicts | unlisted
    finding_id: F-007              # 下の findings[] の専用 finding を 1 件指す
    evidence: "仕様のどこと照合したか"
assumption_verdicts_summary: {consistent: 0, spec_absent: 1, contradicts: 0, unlisted: 0}
findings:
  - id: F-001
    viewpoint: spec_conformance   # 8 観点のキー(verify-viewpoints.md)
    severity: blocker | major | minor
    target: "backend-api/src/loan/service.ts:42"
    claim: "何が問題か(1-2 文)"
    evidence: "仕様の該当箇所・実行結果など、反証可能な根拠"
    suggested_fix: "修正方針の案(任意)"
  - id: F-007
    viewpoint: assumption_conformance
    kind: spec_absent              # restatement | spec_absent | contradicts | unlisted | category_mismatch
    assumption_id: A-001
    severity: major                # verify-viewpoints.md §8 の表どおり(検証器が照合する)
    target: "backend-api/src/loan/repo.ts:12"
    claim: "..."
    evidence: "..."
summary: {blocker: 1, major: 2, minor: 3}
```

findings ゼロなら `findings: []` を明示する(「観点を回しきった上でゼロ」と「未実施」を区別するため、
`gate_reexec` と `viewpoints_checked` は必ず埋める)。`assumption_verdicts` も同様に 0 件なら `[]` を明示する。
done には `assumptions_sha256` / `assumption_verdicts_sha256` / `assumption_verdicts_summary` を転記する
(state-schema.md。`assumption_verdicts_sha256` はオーケストレータが `validateAssumptions.js verdicts` で算出・照合する)。

## 外部 CLI 拡張点(optional)

環境に静的解析 CLI(qlty / semgrep 等)があれば補助として実行してよい(check-only)。
結果は evidence の補強に使い、CLI 出力の転記だけで findings を作らない(自分の検証で裏取りする)。
外部 CLI が無くても本スキルは完結する(必須依存にしない)。
