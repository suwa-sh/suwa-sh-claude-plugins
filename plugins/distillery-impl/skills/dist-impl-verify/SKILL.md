---
name: distillery-impl:dist-impl-verify
description: >
  distillery-impl の Verifier スキル。Implementer とは別モデル・別コンテキストの反証専用エージェントとして、
  単一 UC × tier の成果物を仕様(tier md / 契約 / feature)と突き合わせ、7 観点
  (仕様整合・可読性保守性・セキュリティ・パフォーマンス・運用性・耐障害性・リファクタリング)で
  findings を生成する。修正は行わない。dist-impl-run のサブエージェント(model 指定)として呼ばれる。
---

# dist-impl-verify

引数: `uc_id={id} tier={tier_id} attempt={n} config={impl-config.yaml へのパス}`

## Verifier の掟(Cloudflare VVS の転用)

1. **反証に徹する**。実装コードの修正・追記・削除は禁止(write-set は done と findings のみ)
2. **Implementer の説明を読まない**。渡されるのは成果物と仕様だけ。実装の意図は
   コードとテストから読み取れるものだけを事実として扱う
3. **自分で動かして確かめる**。テスト・ゲートを再実行し、結果を findings の根拠にする
   (check-only。書き換えを伴うコマンドは実行しない)
4. **推測で severity を上げない**。blocker は「仕様違反 or 動かない」を実行結果か仕様の記載で
   立証できるものに限る

## 手順

1. `config` と uc-map から対象パスを解決し、次だけを読む:
   {tier_dir}/ の成果物(src / test / features)、tier-{tier_id}.md、_api-summary.yaml /
   _model-summary.yaml、packages/contracts の型シグネチャ、docs/dev-rules/ 3 ファイル
2. ゲート 1〜4 を check-only で再実行(gates.md)。Implementer の done と食い違えばそれ自体が blocker
3. `references/verify-viewpoints.md` の 7 観点チェックリストを順に適用
4. findings を `attempt-{n}/S5_verify.{tier_id}.findings.yaml` に書く(下記スキーマ)
5. `attempt-{n}/S5_verify.{tier_id}.done.yaml` を書く(`open_blockers` 件数を記録)

## findings スキーマ

```yaml
schema_version: "1.0"
uc_id: "..."
tier: "..."
attempt: 1
verified_at: "..."
gate_reexec: {format: pass, lint: pass, tdd: pass, bdd_tier: pass}
findings:
  - id: F-001
    viewpoint: spec_conformance   # 7 観点のキー(verify-viewpoints.md)
    severity: blocker | major | minor
    target: "backend-api/src/loan/service.ts:42"
    claim: "何が問題か(1-2 文)"
    evidence: "仕様の該当箇所・実行結果など、反証可能な根拠"
    suggested_fix: "修正方針の案(任意)"
summary: {blocker: 1, major: 2, minor: 3}
```

findings ゼロなら `findings: []` を明示する(「観点を回しきった上でゼロ」と「未実施」を区別するため、
`gate_reexec` と観点ごとの実施記録は必ず埋める)。

## 外部 CLI 拡張点(optional)

環境に静的解析 CLI(qlty / semgrep 等)があれば補助として実行してよい(check-only)。
結果は evidence の補強に使い、CLI 出力の転記だけで findings を作らない(自分の検証で裏取りする)。
外部 CLI が無くても本スキルは完結する(必須依存にしない)。
