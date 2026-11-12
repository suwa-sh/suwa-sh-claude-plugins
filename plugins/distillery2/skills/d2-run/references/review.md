# 人レビュー (review 段階)

実装を人が確認し、承認を記録する段階である。

| 順 | すること |
|---|---|
| 1 | 材料を集める |
| 2 | 前提の根拠の hash を算出する |
| 3 | 確認ページを作る |
| 4 | 回答に応じて、戻すか、止めるか、承認を記録する |
| 5 | 回答を記録する |

1. 材料: `reports/gates.json` (static の `advisory` があれば依存の脆弱性として載せる)、全ティアの findings (major / minor。「他 UC への波及」の `cross_uc_change` を含む)、AssumptionRecord と verdict、`issues/`、
   contract の done の `contract_changes` のうち「他の UC にも効く変更」(`also_used_by` の付いた own、`other_uc`、`shared`)
2. `validateAssumptions.js evidence <tier>:<assumptions_sha256>:<verdicts_sha256> ...` で `assumption_evidence_sha256` を算出する
3. human-html-review で確認ページを作る (auto でも必ず人に返す。recommend は下の推奨で答えて記録し、最後のまとめに載せる)。問いの順:
   - 何を作ったか (シナリオの結果、ゲートの結果)
   - **回答必須の前提** (verdict が spec_absent / unlisted で、category か verified_category が security / persistence のもの)。
     1 件ずつ「承認 / 実装を直す / 要求を直す」を選ばせる (推奨: 検証役の verdict が `contradicts` でなければ承認、`contradicts` なら実装を直す)
   - 回答任意の前提 (未回答は auto_confirmed)
   - Verifier の major / minor と issues (戻し先の案を添える)、レビューで反証した指摘と直した指摘、人に返す問い
   - 他の UC にも効く変更 (共有の契約の生成物と、前の UC の振る舞いが変わる箇所)
   - 判断: 「この実装で進めてよいか」
4. 回答を受けたら:
   - 「実装を直す」が 1 件でもあれば `review_rejected {rejected_assumptions}` を記録し、`rewind <run> implementation` で該当ティアを tier に戻す
   - 「要求を直す」があれば `issues/` に下書き (`target_step: requirements`) を書き、routing.md「上流で止めるとき」の手順で止める
     (review は done にしない。要求の差分が課題を反映した後、写し直して scenario から続ける)
   - 承認なら、全ティアの `record` / `verdicts` を再実行して hash が一致することを確認してから
     `review_approved {assumption_decisions[], assumption_evidence_sha256, gates_result, head}` を記録する。不一致なら承認を記録せず verify から再実行
5. 回答は `events.jsonl` と決めたことの記録 (`decisionLog.js add --run <run> --page page:review:...`) に記録する (review-notes ファイルは持たない)

## review_approved に書く値

| 値 | 書き方 |
|---|---|
| `head` | 承認した時点の `git rev-parse HEAD`。main マージ 1 の人の修正の判定に使う |
| `assumption_decisions` の `by` | 承認 (`decision: confirmed`) には `by: human | recommended` を付ける: 人が答えたら `human`、推奨で進めるモードで推奨案を採ったら `recommended` |

実装の記録がこの値で「人が承認」と「推奨案で承認」を書き分ける。
