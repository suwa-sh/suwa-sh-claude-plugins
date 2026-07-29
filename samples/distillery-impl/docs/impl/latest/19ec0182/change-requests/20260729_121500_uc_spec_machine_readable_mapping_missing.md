---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S1 uc-init(event: 20260729_095000_s1_uc_init_completed)"
related_ids: [REQ-002, SPEC-002-01, SPEC-002-02, SPEC-001-01]
related_files:
  - "usdm/latest/requirements.yaml"
  - "docs/impl/latest/uc-map.yaml"
  - "docs/impl/events/20260729_095000_s1_uc_init_completed/event.yaml"
severity: spec-gap
---

# 変更要望: UC ↔ SPEC-ID(criterion粒度)の機械可読マッピングが dist-spec の出力に存在しない

## 現状の仕様

distillery(dist-spec)の出力には「UC → SPEC-ID・criterion」の機械可読な対応表が存在しない。
現状 `uc-map.yaml` の `atdd_scenarios`(例: 本UCの `["SPEC-002-01-1", "SPEC-002-01-2"]`)は、
S1(uc-init)が `usdm/latest/requirements.yaml` の
`requirements[].specifications[].affected_models[]`(`type: "buc"` のエントリ)を手がかりに
候補を機械生成し、**ユーザー確認を経て初めて確定・永続化**される human-in-the-loop 運用になっている。

この手がかり自体に3つの構造的な弱点があることを `usdm/latest/requirements.yaml` の実データで
確認した:

1. **キー名の不一致**: `affected_models[]` の要素は `name` ではなく `target` というキーで
   BUC名を保持している(例: `requirements.yaml:68-70` `type: "buc", action: "add", target: "貸出管理フロー"`)。
   このキー名はどの skill の手順にも明記されておらず、実装者が読み解いて対応する必要がある。
2. **affected_models に buc エントリが無い SPEC が実在する**: `SPEC-002-02`(利用者が書籍の返却
   手続きをWeb画面から行える。`requirements.yaml:71-81`)の `affected_models` は `information`
   (`貸出`, action: modify)と `state`(`書籍貸出状態`, action: modify)のみで、`type: "buc"` の
   エントリが無い。「返却」という業務行為が既存の「貸出管理フロー」BUCに属することは自明だが、
   機械的にはこの SPEC から BUC(延いてはUC)を導出できない。
3. **1 SPEC が複数 UC の受け入れ基準を含む実例がある**: `SPEC-001-01`(書籍情報を登録・編集・削除
   できる。`requirements.yaml:13-27`)の `acceptance_criteria` は「登録」(1件目)と「編集」
   (2件目)の2基準を持ち、これは「書籍を登録する」UCと「書籍情報を編集する」UCという**別々のUC**の
   基準に対応する。SPEC単位の対応では1 SPECが1 UCに対応する前提が崩れており、
   `acceptance_criteria[]`(criterion)粒度での対応関係が必要。

## 実装で判明した問題

本UC(19ec0182)の S1(uc-init)実行時、上記の弱点により機械的に一意なUC↔SPEC対応を導出できず、
「BUC粒度候補を機械生成 → ユーザーに提示して確認 → `uc-map.yaml` の `atdd_scenarios` に手動で
永続化する」という human-in-the-loop を毎回強いられた。S1イベントログにこの事実が記録されている:

```yaml
# docs/impl/events/20260729_095000_s1_uc_init_completed/event.yaml
finding: "usdm affected_models の BUC 名キーは name でなく target(SKILL 手順にキー名明記なし → 改善候補)"
lineage_ok: false
atdd_confirmed_by: user
```

本UCはこの1回のユーザー確認で解決できたが、`uc-map.yaml` の全17 UC(`atdd_confirmed: false` が
現時点で16件)が同様にS1でこの手動確認を要求される見込みであり、dist-impl-run のオーケストレーションが
UC単位で人手を介さず自走する上でのボトルネックになる。

## 提案する変更

dist-spec が spec 生成時(S1が読む `usdm/latest/requirements.yaml` の生成元、または後続の
spec-event.yaml 相当の出力)に、「UC ↔ SPEC-ID-criterion 連番」の機械可読マッピングを出力する。
具体例: `spec-event.yaml` の `use_cases[]` 各要素に `atdd_refs: ["SPEC-001-01-1"]`
(SPEC-ID + acceptance_criteria のインデックス番号)を追加し、以下を満たす:

1. BUC名の参照キーを `target` に統一(または `name` へのエイリアスを追加)し、dist-impl側の
   SKILL手順にもキー名を明記する。
2. `affected_models` に `type: "buc"` が無い SPEC(例: SPEC-002-02)についても、
   親 `REQ-*` が属する業務/BUCへの帰属を明示する(例えば SPEC 単位でなく REQ 単位で BUC を
   確定させ、SPEC はそれを継承する設計にする)。
3. 1 SPEC が複数 UC の基準を含むケース(例: SPEC-001-01)に対応できるよう、
   `acceptance_criteria` の配列インデックス(criterion)粒度で UC への対応を記録する。

これにより S1(uc-init)は `atdd_scenarios` の候補生成をユーザー確認なしで機械的に確定でき、
`uc-map.yaml` の `atdd_confirmed: false` を解消する運用が可能になる。

## 影響範囲

- `uc-map.yaml` に列挙された全17 UC(本UC以外の16 UCは `atdd_confirmed: false`)の S1(uc-init)。
- 特に `affected_models` に `buc` エントリが無い SPEC を持つUC(例: SPEC-002-02 → 「書籍を返却する」
  UC)、および1 SPEC が複数UCの基準を含むケース(例: SPEC-001-01 → 「書籍を登録する」/
  「書籍情報を編集する」の2 UC)。
- 対象パイプライン: dist-spec(`usdm/latest/requirements.yaml` の `affected_models` 構造、
  または spec 生成時に別途出力する UC↔SPEC マッピング)。
