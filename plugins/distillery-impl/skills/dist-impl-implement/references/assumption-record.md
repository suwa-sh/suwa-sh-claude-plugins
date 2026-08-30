# AssumptionRecord(実装者が補った前提の記録)— 正本

Implementer は、仕様に書かれていないため**自分で決めた設計判断**を、コードと並ぶ成果物として
構造化ファイルに書き出す。Verifier はこのファイルを「反証対象の主張一覧」として仕様と照合し、
S9 の人間レビューで承認・却下を受ける。

出典: AssumptionMiner(arXiv:2607.22898)の「LLM が黙って決めた前提を第一級の成果物として吐かせる」発想。
distillery-impl では**抽出精度に依存せず「書き出させて差分として見る」構造**だけを取り込む。

## なぜ必要か

Verifier は「成果物 vs 仕様」を突合する。仕様に照合先が無い判断は原理的に検査から落ちる。
実走例(relay-gate UC 6078c4ed attempt-5)では blocker 3 件中 2 件がこの型だった:

| 実例 | Implementer が黙って決めたこと | 前提として書いていれば |
|---|---|---|
| F-002 | `occurred_at` を**秒精度**にした → event 順序が不定で tier BDD が flaky | `category: data_format`「時刻精度=秒」が契約未定義として S5 前に照合対象になる |
| F-003 | SSH 起動失敗時に status を **FAILED/UNKNOWN に変える**ことにした → 仕様の固定値 STARTING に違反 | `category: error_handling` として明示され、Verifier がリスト照合で `contradicts`(blocker)を即検出 |

## ファイルと配置

- パス: `docs/impl/latest/{uc_id}/stages/attempt-{n}/S4_tier-impl.{tier_id}.assumptions.yaml`
- 書き手: S4 Implementer(自 tier 分のみ。write-set は state-schema.md の正本表)
- 読み手: S5 Verifier(8 観点目)/ S8 feedback(as-built・CR 候補)/ S9 review(人間レビュー)
- **前提が 0 件でも必ず書く**(`assumptions: []`)。ファイル欠落は S4 受理拒否

## スキーマ

```yaml
schema_version: "1.0"
uc_id: "6078c4ed"
tier: "tier-facade"
attempt: 1
extraction:                # 抽出過程の検査可能性(復唱で埋めていないかを後から見る)
  candidate_count: 7       # 実装中に「自分で決めた」と自覚した判断の総数
  excluded_as_explicit: 4  # 仕様・契約・dev-rules・S4 固定指示に明示があったため除外した数
  recorded_count: 3        # assumptions[] の件数と一致させる。candidate_count = excluded + recorded(残数を許さない)
assumptions:               # 0 件なら [] を明示
  - id: A-001              # tier 内で一意。attempt をまたいで安定させる(同じ判断には同じ id)
    category: data_format  # 下表の 6 値
    assumption: "runner_result_events.occurred_at は秒精度 ISO8601 UTC で記録する"
    target: "facade/src/id_gateway.sh:28"        # 判断が実装されている箇所(file:line)
    reason: "契約 rdb-schema.yaml の runner_result_events に時刻精度の定義が無い"
    confidence: medium     # high | medium | low(この判断が意図に合っている自信)
    spec_refs:             # 探して「無かった」箇所。復唱防止の証跡(空配列は不可)
      - "docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml#runner_result_events"
      - "tier-facade.md#データモデル変更"
```

### カテゴリ(6 値)

| category | 何を決めたか | 典型例 |
|---|---|---|
| `input_validation` | 入力の受理・拒否の境界 | 必須/任意の解釈、長さ・範囲、正規化 |
| `data_format` | データの表現形式 | 時刻精度、シリアライズ形式、ID 形式、hash の正規化順 |
| `error_handling` | 失敗時の振る舞い | 失敗時の状態値、再試行、部分失敗の扱い |
| `persistence` | 永続化の方式・整合 | トランザクション境界、主キー選択、保持期間、冪等キー |
| `performance` | 性能上の選択 | インデックス、バッチ化、同期/非同期 |
| `security` | 認証・認可・秘密情報 | ヘッダの扱い、権限チェックの位置、ログ出力の除外 |

`persistence` と `security` は S9 で**人間回答が必須**になる(dist-impl-run の真理値表)。
迷ったらリスクの高い側(persistence / security)に分類する。Verifier が独立に `verified_category` を
判定し、不一致は minor finding になる(分類ミスは減点でなく可視化)。

## 抽出規則(復唱で埋めない)

1. **含めるのは「自分が補った判断」だけ**。次に明示されている事項は含めない:
   仕様(spec.md / tier md / _api-summary / _model-summary)/ 契約(contracts[] の source・生成物)/
   `docs/dev-rules/` / S4 固定指示(`dist-impl-run/references/stage-instructions/S4_tier-impl.md`)。
   **可変プロンプト(dispatch 時の引数・findings パス等)は除外集合に含めない**(Verifier が
   照合できないため。可変プロンプトの内容を実装判断に使ったなら、それは前提として書く)
2. 各前提に**「どこを探して無かったか」(`spec_refs`)を必ず書く**。探していない前提は書かない
3. 判断の粒度は「Verifier が仕様 1 箇所と突き合わせて真偽を言える 1 文」にする。
   複数の判断を 1 件にまとめない・1 つの判断を分割しない
4. 既存の「未定義リスト」「仮置き」(複数 tier / UC が共有する算出規則で契約に定義が無いもの)は
   **この記録に統合する**(たいてい `data_format`)。`issues/` への起票は「仕様と両立しない事実」
   (仕様どおりに実装すると動かない)に限定し、前提の二重記録をしない
5. `extraction` の 3 値を正直に書く。`recorded_count` は `assumptions[]` の件数と一致させる
   (検証器が照合する)

## 検証器

`${CLAUDE_PLUGIN_ROOT}/skills/dist-impl-implement/scripts/validateAssumptions.js`

```bash
# Implementer: 書いた直後に自分でも実行して ok を確認する
node "$V" record attempt-1/S4_tier-impl.tier-facade.assumptions.yaml --uc 6078c4ed --tier tier-facade --attempt 1
# → {"ok":true,"count":3,"by_category":{...},"sha256":"..."}

# オーケストレータ: S5 受理時に Verifier の判定を検査する
node "$V" verdicts attempt-1/S5_verify.tier-facade.findings.yaml --assumptions attempt-1/S4_tier-impl.tier-facade.assumptions.yaml --uc 6078c4ed --tier tier-facade --attempt 1
# → {"ok":true,"verdicts_sha256":"...","counts":{"consistent":0,"spec_absent":2,"contradicts":1,"unlisted":0}}


# オーケストレータ / S9: 承認証跡の集約 hash
node "$V" evidence tier-facade:<assumptions_sha256>:<assumption_verdicts_sha256> tier-worker:<sha>:<sha>
# → {"ok":true,"assumption_evidence_sha256":"...","tiers":2}
```

失敗時は `{"ok":false,"errors":[...]}` を出し exit 1。option はすべて必須(identity 照合を省略できない)。
`verdicts` は findings 側の identity(schema_version / uc_id / tier / attempt / verified_at)、各 verdict の `evidence`、
参照 finding の必須フィールド、**orphan の assumption_conformance finding(どの verdict からも参照されない)**も拒否する。

**再計算のタイミング**: S4/S5 受理時だけでなく、**S9 承認直前・S8 publish 直前・再開手順**でもオーケストレータが
全 tier に `record` と `verdicts` を再実行し、current の hash が S4/S5 done・S9 evidence と一致することを確認する
(一致しなければ該当 tier の S4/S5 と S9 を invalidate)。承認後にファイルを書き換えても旧承認が生き残らない。

### canonical hash の規則

`assumptions_sha256` = `assumptions[]` の各要素を **key 昇順の canonical JSON** にし、
`id` 昇順に並べ、各行を `{json}\n` で連結した文字列の sha256(state-schema.md の
`dispatch_targets.hash` と同型の「ソート→連結→ハッシュ」)。対象 key は
`id, category, assumption, target, reason, confidence, spec_refs`。

`assumption_verdicts_sha256` = Verifier の `assumption_verdicts[]` を同じ規則で hash する。
対象 key は `id, tier, assumption, target, category, verified_category, verdict`。
Verifier が追加した `V-nnn`(unlisted)は `category: null` を持つ(Implementer 分類が存在しないため)。

この 2 つの hash は S4/S5 done → S9 evidence(`assumption_evidence_sha256`)→ `review_approved` に通り、
**前提や判定の内容が変わると旧承認が無効になる**(承認の対象を固定する)。

## ライフサイクル

| 状態 | いつ | 正本 |
|---|---|---|
| unconfirmed | S4 が書いた時点 | assumptions ファイル |
| confirmed / rejected(spec_change) | S9 で人間が回答 | `review_approved.payload.assumption_decisions`(却下は `resolution: spec_change` のみ。`implementation_change` の却下は `review_rejected` に記録され approval には現れない) |
| auto_confirmed | 回答任意の前提で未回答のまま承認 | 同上 |
| (再生成) | attempt++ / stale 再実行で S4 が再実行された tier | 新 attempt のファイル(旧版は carry-forward 複製または `invalidated/` に残る) |

Stale の自動判定は持たない。S4 が再実行されれば前提も再生成され、S9 で再度人間判断を取る。

## Verifier の読み方(dist-impl-verify の 8 観点目の要約)

1. 前提ファイルを開かずに 1〜7 観点を完走し、「仕様に無い実装判断」の候補を控える(blind)
2. `id / assumption / target` だけを読み、候補と突合。仕様と照合して verdict を付ける
3. `reason / confidence / spec_refs` は verdict 確定後の補助証拠
4. S4 固定指示を読み、そこに明示された事項の復唱は `consistent`

| verdict | 意味 | finding |
|---|---|---|
| consistent | 仕様・契約・dev-rules・S4 固定指示に明示があった(復唱) | minor `restatement` |
| spec_absent | 照合先が無い(真の前提) | security / persistence は major、他は minor |
| contradicts | 仕様と矛盾 | **blocker**(カテゴリ不問) |
| unlisted | 候補にあるがファイルに無い黙った判断 | Verifier が `V-nnn` を追記。spec_absent と同じ規則 |

正本: `dist-impl-verify/references/verify-viewpoints.md` §8。
