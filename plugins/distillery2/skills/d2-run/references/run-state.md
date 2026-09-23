# 実行状態 (`.distillery/runs/<uc_slug>/`)

v1 の実行状態ディレクトリ (events ディレクトリ + latest + status + lease + NEXT) を次に簡素化した。
操作はすべて `scripts/lib/runState.js` を通す (CLI と require の両方)。

```
.distillery/
  config.yaml                       # 実行設定 (config-schema.md)
  runs/<uc_slug>/
    events.jsonl                    # 追記のみ。1 行 1 イベント {seq, ts, type, ...}
    stages/<stage>.done.yaml        # 完了の正。存在 = 完了。中身は完了時刻と要点 (commit, attempt など)
    attempt-<n>/
      assumptions.<tier>.yaml       # 実装者が補った前提 (AssumptionRecord)
      findings.yaml                 # Verifier の指摘
    reports/                        # gates.json と各ゲートの JSON レポート
    traces/<scenario_id>.jsonl      # UC BDD 実行時の計装トレース
    issues/<ts>_<slug>.md           # 仕様起因の課題 (front matter kind: rule | contract | requirement)
    learnings/<ts>_<slug>.md
    invalidated/<ts>_<stage>.done.yaml   # 無効化した done の退避
```

## 段階 (stage) の順

`scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → feedback → deliver`

- 再開は done が無い最初の段階から。`node runState.js status <runDir>` で確認する
- `tier` と `verify` は attempt ごとに繰り返す。blocker で戻るときは `invalidate` で `tier` 以降の done を退避してから attempt を進める
- 上流 (要求・ADR・契約) が変わったら、`basis.js check` で古くなった成果物を見つけ、対応する段階を `invalidate` する

## イベントの種類 (最小)

| type | いつ |
|---|---|
| run_opened | 初回 open |
| stage_completed / stage_invalidated | done の作成 / 退避 |
| scenario_approved / review_approved | 人の承認。承認した内容の要点と評価対象のハッシュを持つ |
| assumption_decided | 前提の承認・却下 (id と処遇) |
| feedback_filed | 還流 (kind と PR / issue の URL) |
| (delivered) | events には書かない。squash 後の追記は tree を汚すため、`reports/delivered.json` (gitignore) と GitHub の PR を正にする |

status ファイルは持たない。必要なら events と done から都度計算する。
