# Verifier の 2 観点

v1 の 8 観点のうち、機械のゲート (静的検査・単体・契約・UC BDD・受入・アーキテスト) で担保できるものは Verifier から外した。
残るのは「機械では判定できない意図の照合」2 つだけ。観点キーは findings の `viewpoint` に使う。
**観点 1 を前提ファイル (AssumptionRecord) を開かずに完走し、観点 2 で初めて開く** (blind join)。

## 1. uc_intent (UC の意図どおりか)

「テストが通った」ことと「UC の意図を実現した」ことは別。次を突き合わせる。

| 突き合わせ | 読むもの | 何を見るか |
|---|---|---|
| シナリオ ↔ 実行結果 | `features/<業務>/<slug>.feature`、`reports/uc-bdd.json`、`reports/acceptance-api.json` | 全シナリオが pass か。pending / skipped が無いか。受入基準タグ (`@acceptance:`) の付いたシナリオが UC の spec_ids の受入基準を全部覆っているか |
| シナリオ ↔ トレース | `traces/<scenario_id>.jsonl` | シナリオが想定する経路 (呼び出し・クエリ・発行) が実際に通っているか。Then が確かめていない副作用 (発行されるべきイベントが発行されていない、書かれるべきテーブルに書いていない) が無いか |
| 要求 ↔ 実装 | 要求の該当行 (`docs/requirements/requirements.yaml` の spec_ids、RDRA の条件・状態)、変更ファイル一覧、コード | 業務ルールが担保される箇所を特定できるか。特定できないルールは blocker 候補。状態遷移が要求の状態表と一致するか |
| 契約 ↔ 実装 | `contracts/generated/slices/<slug>/contract-slice.json`、`reports/contract.*.json` | 契約テストが pass か。生成型を経由せず直書きした型・fetch が無いか |
| ルール ↔ 実装 | `docs/rules/{common,tier-<kind>,testing}.md`、`reports/static.*` | 機械で落とせないルール文 (用語・命名・エラー文言・仕様を曲げない) に反していないか |
| テストの質 | 単体テストとステップ定義 | 空の step、常に真になる assert、実装詳細への過剰な結合、モックで I/O を偽装した実体テスト |

**やらないこと**: テストの再実行。可読性・性能・運用性・耐障害性の一般論 (ルールに書かれていなければ指摘しない)。
レイアウトやスタイルの差 (受入の `@browser` シナリオが担う)。

## 2. assumption_conformance (実装者が補った前提の照合)

対象: `attempt-<n>/assumptions.<tier>.yaml` (正本は `d2-implement/references/assumption-record.md`)。
仕様に照合先が無い判断は観点 1 から原理的に落ちるため、実装者に書かせた一覧を反証対象にする。

### 手順 (blind join。順序を守る)

1. 観点 1 の完走中に、実装から読み取れる「要求・契約・ルールに根拠が無い設計判断」を候補リストとして控える。
   この時点で前提ファイルは開かない
2. 前提ファイルを開き、各要素の `id / assumption / target` だけを読む。候補リストと突合する
3. 各前提を要求・シナリオ・契約・ルール・mode=tier の固定指示 (`d2-implement/references/tier-impl.md`) と照合し、verdict を付ける
4. `reason / confidence / spec_refs` は verdict 確定後に補助証拠として読む
5. 各前提の `verified_category` を実装者の `category` と独立に判定する。不一致なら `kind: category_mismatch` の minor finding
6. 候補リストに残った「前提ファイルに無い黙った判断」を `V-nnn` (unlisted) として追記する (`category: null`)

### verdict と finding

| verdict | 意味 | finding (`viewpoint: assumption_conformance`、`kind` = verdict 名 / consistent は `restatement`) |
|---|---|---|
| `consistent` | 要求・契約・ルール・固定指示に明示があった (復唱) | minor `restatement` |
| `spec_absent` | 照合先が無い (真の前提) | `category` か `verified_category` が security / persistence なら major、他は minor。人レビューの入口であり blocker ではない |
| `contradicts` | 要求・契約・ルールと矛盾 | **blocker** (カテゴリ不問) |
| `unlisted` | 候補にあるが前提ファイルに無い | `V-nnn` で追記。severity は spec_absent と同じ規則 |

全 A-id に verdict を exactly-one で付け、verdict ごとに専用の finding を 1 件出して `finding_id` で結ぶ。
前提 0 件・候補 0 件なら `assumption_verdicts: []` を明示する。

## findings.yaml の形

```yaml
schema_version: "2.0"
uc: "register-loan"
tier: "backend-api"
attempt: 1
verified_at: "2026-09-23T10:00:00+09:00"
gates_read:                      # reports/gates.json から転記 (再実行しない)
  static: pass
  unit: pass
  contract: pass
  uc-bdd: pass
  acceptance: skipped
viewpoints_checked:
  uc_intent: {status: done, note: "..."}
  assumption_conformance: {status: done}
assumptions_sha256: "<validateAssumptions.js record の sha256>"
assumption_verdicts:
  - id: A-001
    tier: backend-api
    assumption: "<A-001 の文をそのまま>"
    target: "<A-001 の target をそのまま>"
    category: data_format          # 実装者の分類をそのまま
    verified_category: data_format
    verdict: spec_absent
    finding_id: F-001
    evidence: "contracts/db/rdb-schema.yaml#loans に精度の定義なし"
  - id: V-001                      # Verifier が見つけた黙った判断
    tier: backend-api
    assumption: "..."
    target: "apps/backend-api/src/...:12"
    category: null
    verified_category: error_handling
    verdict: unlisted
    finding_id: F-002
    evidence: "..."
assumption_verdicts_summary: {consistent: 0, spec_absent: 1, contradicts: 0, unlisted: 1}
findings:
  - id: F-001
    viewpoint: assumption_conformance
    kind: spec_absent
    assumption_id: A-001
    severity: minor
    target: "apps/backend-api/src/domain/loan.ts:28"
    claim: "..."
    evidence: "..."
  - id: F-003
    viewpoint: uc_intent
    kind: rule_not_enforced
    severity: blocker
    target: "apps/backend-api/src/usecase/registerLoan.ts"
    claim: "条件『貸出上限 5 冊』を担保する箇所が無い"
    evidence: "docs/requirements/rdra/条件.tsv#貸出上限; traces/register-loan#上限超過.jsonl に判定の呼び出し無し"
summary: {blocker: 1, major: 0, minor: 2}
```

## severity の目安

- **blocker**: 要求・契約・ルール違反、ゲート不成立、前提の矛盾 (修正なしで先に進めない)
- **major**: 要求は満たすが、人レビューで判断が要る (security / persistence の前提など)
- **minor**: 可視化のみ (復唱、分類ミス、改善提案)
