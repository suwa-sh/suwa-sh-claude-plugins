# AssumptionRecord (実装者が補った前提の記録)

実装者 (d2-implement mode=tier) は、要求・シナリオ・契約・ルールに書かれていないため**自分で決めた設計判断**を、
コードと並ぶ成果物として構造化ファイルに書く。Verifier (d2-verify) はこれを「反証対象の主張一覧」として
要求・契約・ルールと照合し、人レビューで承認・却下を受ける。

v1 (distillery-impl) からの変更は、置き場所と照合先だけ。抽出規則・ハッシュ・ライフサイクルは同じ。

## ファイルと配置

- パス: `.distillery/runs/<uc_slug>/attempt-<n>/assumptions.<tier_id>.yaml`
- 書き手: mode=tier の実装者 (自ティア分のみ)
- 読み手: d2-verify (assumption_conformance 観点) / 人レビュー / d2-asbuilt (補った前提と処遇の節)
- **前提が 0 件でも必ず書く** (`assumptions: []`)。欠落は tier 段階の受理拒否

## スキーマ

```yaml
schema_version: "2.0"
uc: "register-loan"          # use-cases.yaml の slug
tier: "backend-api"
attempt: 1
extraction:                  # 抽出過程の検査可能性 (復唱で埋めていないかを後から見る)
  candidate_count: 7         # 実装中に「自分で決めた」と自覚した判断の総数
  excluded_as_explicit: 4    # 要求・契約・ルール・固定指示に明示があったため除外した数
  recorded_count: 3          # assumptions[] の件数と一致させる (candidate = excluded + recorded)
assumptions:                 # 0 件なら [] を明示
  - id: A-001                # ティア内で一意。attempt をまたいで安定させる (同じ判断には同じ id)
    category: data_format    # 下表の 6 値
    assumption: "loans.due_at は日付のみ (時刻なし) で記録する"
    target: "apps/backend-api/src/domain/loan.ts:28"    # 判断が実装されている箇所 (file:line)
    reason: "契約 contracts/db/rdb-schema.yaml の loans.due_at に精度の定義が無い"
    confidence: medium       # high | medium | low
    spec_refs:               # 探して「無かった」箇所。復唱防止の証跡 (空配列は不可)
      - "contracts/db/rdb-schema.yaml#loans"
      - "features/貸出業務/register-loan.feature#返却期限"
      - "docs/requirements/rdra/条件.tsv#返却期限"
```

### カテゴリ (6 値)

| category | 何を決めたか | 典型例 |
|---|---|---|
| `input_validation` | 入力の受理・拒否の境界 | 必須/任意の解釈、長さ・範囲、正規化 |
| `data_format` | データの表現形式 | 時刻精度、シリアライズ形式、ID 形式 |
| `error_handling` | 失敗時の振る舞い | 失敗時の状態値、再試行、部分失敗の扱い |
| `persistence` | 永続化の方式・整合 | トランザクション境界、主キー選択、保持期間、冪等キー |
| `performance` | 性能上の選択 | インデックス、バッチ化、同期/非同期 |
| `security` | 認証・認可・秘密情報 | ヘッダの扱い、権限チェックの位置、ログ出力の除外 |

`persistence` と `security` は人レビューで**回答が必須**になる。迷ったらリスクの高い側に分類する。
Verifier が独立に `verified_category` を判定し、不一致は minor finding になる (分類ミスは減点でなく可視化)。

## 抽出規則 (復唱で埋めない)

1. **含めるのは「自分が補った判断」だけ**。次に明示されている事項は含めない:
   UC のシナリオ (`features/<業務>/<slug>.feature`) / 要求 (`docs/requirements/`) / 契約 (contracts/ と生成物) /
   `docs/rules/` / mode=tier の固定指示 (`d2-implement/references/tier-impl.md`)。
   可変プロンプト (派遣時の引数・findings パス等) は除外集合に含めない。その内容を判断に使ったなら前提として書く
2. 各前提に**「どこを探して無かったか」(`spec_refs`) を必ず書く**。探していない前提は書かない
3. 判断の粒度は「Verifier が要求・契約 1 箇所と突き合わせて真偽を言える 1 文」にする
4. 「仕様と両立しない事実」(要求どおりに実装すると動かない) は前提ではなく `issues/` に起票する。二重記録しない
5. `extraction` の 3 値を正直に書く。`recorded_count` は `assumptions[]` の件数と一致させる (検証器が照合する)

## 検証器

`${CLAUDE_PLUGIN_ROOT}/skills/d2-implement/scripts/validateAssumptions.js`

```bash
# 実装者: 書いた直後に自分でも実行して ok を確認する
node "$V" record attempt-1/assumptions.backend-api.yaml --uc register-loan --tier backend-api --attempt 1
# → {"ok":true,"count":3,"by_category":{...},"sha256":"..."}

# オーケストレータ: verify 段階の受理時に Verifier の判定を検査する
node "$V" verdicts attempt-1/findings.backend-api.yaml --assumptions attempt-1/assumptions.backend-api.yaml --uc register-loan --tier backend-api --attempt 1
# → {"ok":true,"verdicts_sha256":"...","counts":{"consistent":0,"spec_absent":2,"contradicts":1,"unlisted":0},"requires_answer":1}

# オーケストレータ / 人レビュー: 承認証跡の集約 hash
node "$V" evidence backend-api:<assumptions_sha256>:<verdicts_sha256> worker:<sha>:<sha>
# → {"ok":true,"assumption_evidence_sha256":"...","tiers":2}
```

失敗時は `{"ok":false,"errors":[...]}` を出し exit 1。option はすべて必須。

### canonical hash の規則

`assumptions_sha256` = `assumptions[]` の各要素を key 昇順の canonical JSON にし、`id` 昇順に並べ、
各行を `{json}\n` で連結した文字列の sha256。対象 key は `id, category, assumption, target, reason, confidence, spec_refs`。
`assumption_verdicts_sha256` は Verifier の `assumption_verdicts[]` を同じ規則で hash する
(対象 key `id, tier, assumption, target, category, verified_category, verdict`)。
この 2 つの hash は tier / verify の done → `review_approved` イベントの `assumption_evidence_sha256` に通り、
**前提や判定の内容が変わると旧承認が無効になる**。

## ライフサイクル

| 状態 | いつ | 正本 |
|---|---|---|
| unconfirmed | mode=tier が書いた時点 | assumptions ファイル |
| confirmed / rejected | 人レビューで回答 | `review_approved.assumption_decisions` (却下は `resolution: implementation_change | spec_change`) |
| auto_confirmed | 回答任意の前提で未回答のまま承認 | 同上 |
| (再生成) | attempt++ で mode=tier が再実行されたティア | 新 attempt のファイル |

却下が `implementation_change` なら attempt++ で該当ティアを再実装する。`spec_change` なら還流 (requirement) の issue になり、
UC は反映待ちで止まる。
