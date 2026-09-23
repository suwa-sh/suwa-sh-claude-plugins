---
name: distillery2:d2-implement
description: >-
  段階④の実装者。mode=scenario (UC のシナリオを features/ に書き、人が承認) / mode=scaffold (step 骨格と最初の red 単体テスト) /
  mode=tier (ティアごとの単体 TDD。静的・単体ゲートを通し、仕様に無くて自分で決めた前提を AssumptionRecord に書く) /
  mode=integrate (UC BDD と受入の step 実装、tracer の結線)。d2-run のサブエージェントとして呼ばれる。
---

# d2-implement

> 実装状況: P6 で v1 `distillery-impl:dist-impl-implement` (assumption-record、gates、validateAssumptions.js) を移植し、4 mode に再構成する。

## mode ごとの入出力

| mode | 読むもの | 書くもの |
|---|---|---|
| scenario | `docs/requirements/use-cases.yaml` の該当行、RDRA の条件・状態、USDM の受入基準 | `features/<業務>/<uc_slug>.feature` (`@uc:<slug>`、`@acceptance:<SPEC>-<n>`、必要なら `@browser`) |
| scaffold | feature、契約 slice、`docs/rules/testing.md` | `features/step_definitions/`、各ティアの最初の失敗する単体テスト |
| tier | `docs/rules/{common,tier-<kind>,testing}.md`、契約 slice と `packages/contracts/`、feature、(frontend) `packages/ui` 一覧 | `apps/<tier>/src`、`.distillery/runs/<slug>/attempt-<n>/assumptions.<tier>.yaml` |
| integrate | step 骨格、`packages/test-support` の README、契約 slice | step 実装、テスト用 composition root (tracer 結線)、`@browser` シナリオのブラウザドライバ step |

設計書と個別仕様書は読まない。仕様に無いことを決めたら必ず AssumptionRecord に書く。
