# 実行状態 (`.distillery/runs/<uc_slug>/`)

v1 の実行状態ディレクトリ (events ディレクトリ + latest + status + lease + NEXT) を次に簡素化した。
操作はすべて `<skills>/d2-common/scripts/lib/runState.js` を通す (CLI と require の両方)。

```
.distillery/
  config.yaml                       # 実行設定 (config-schema.md)
  runs/<uc_slug>/
    events.jsonl                    # 追記のみ。1 行 1 イベント {seq, ts, type, ...}
    stages/<stage>.done.yaml        # 完了の正。存在 = 完了。中身は完了時刻と要点 (commit, attempt など。scenario / contract / tier / integrate は carry_over_status (要求の差分で残った作業の項目ごとの対応状況 {item, status: done|cannot, detail}) も。0.1.30)
    attempt-<n>/
      assumptions.<tier>.yaml       # 実装者が補った前提 (AssumptionRecord)
      findings.<tier>.yaml          # Verifier の指摘 (ティアごと)
    reports/                        # gates.json と各ゲートの JSON レポート
    traces/<scenario_id>.jsonl      # UC BDD 実行時の計装トレース
    issues/<ts>_<slug>.md           # 仕様起因の課題 (front matter kind: rule | contract | requirement)。scenario / contract 段が書く
    issues/<ts>_<tier>_<slug>.md    # ティア実装者の課題 (並列の他ティアと衝突しないようにティアを入れる)
    learnings/<ts>_<slug>.md
    invalidated/<ts>_<stage>.done.yaml   # 無効化した done の退避
  logs/feedback/<b>/                # 還流のバッチの状態 (gitignore。feedbackBatch.js が書く): batch.json・<issue>.state・<issue>.result.json (派遣の結果)・<issue>.reason.txt・<issue>.failed.diff・gate.json・decision.json。取り込んだら消す
  worktrees/feedback/               # 還流の worktree (gitignore。0.1.27)。main から切り、取り込んだら消す
  worktrees/<uc_slug>/<issue>/      # review で「要求を直す」ときの一時の worktree (gitignore)
docs/feedback/<issue>.md            # 課題ファイル (追跡)。要求の差分 (要求の課題) と還流 (ルール・契約の課題) が反映したら消す。kind: plugin (プラグインへ持ち帰る課題) は人が消す
docs/feedback/README.md             # 課題の一覧 (genDocsReadme が生成。0 件なら消す)
```

## Git 追跡の方針 (`.gitignore` と整合)

- **commit する (追跡)**: `events.jsonl` / `stages/*.done.yaml` / `attempt-<n>/**` (assumptions・findings) / `issues/**` / `learnings/**` / `invalidated/**`。これらは実行の記録なので履歴に残す。
- **commit しない (gitignore)**: run の中では `reports/`(gates.json と各ゲートの JSON レポート) と `traces/`(計装トレース JSONL) のみ。いずれもテスト実行のたびに再生成できる生成物。run の外の `.distillery/logs/` (還流の記録を含む) と `.distillery/worktrees/` も追跡しない。
- genSkeleton が書く `.gitignore` は `.distillery/runs/*/reports/`、`.distillery/runs/*/traces/`、`.distillery/logs/`、`.distillery/worktrees/` と、symlink の `node_modules` を無視する。`attempt-*/` は無視しない。
- **`.distillery/logs/`**: headless 実行のプロンプト・起動スクリプト・完了報告ログなど、セッション単位の実行記録の置き場。UC に紐づかない記録はここに置き、リポ直下に独自ディレクトリ (`_run/` など) を作らない。git 管理外

## 段階 (stage) の順

`scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → deliver`

- 0.1.27 で UC は配送で終わるようにした。UC の課題は配送のときに課題ファイルにし、次の UC の前の要求の差分と還流 (UC の外の独立した段階。`<skills>/d2-common/scripts/feedbackBatch.js`) が取り込む
- 0.1.26 の run が持つ `stages/feedback.done.yaml` は読まない (配送の done があれば旧形式と判定しない)。0.1.26 で配送して還流を終えていない run の課題は、起動時の移行 (`feedbackBatch.js scan` の `unfiled_runs`。自動選択の 3 の 2) が課題ファイルにする
- 0.1.25 までの run (還流の done があり配送の done が無い) は `status` の `legacy_order: true` で次の段階を出さない。d2-run が人に配送済みかを聞き、
  配送済みなら `node runState.js mark-legacy-delivered <runDir>` で配送の done (`legacy: true`) を作る。まだなら `invalidate <runDir> feedback` で新しい順に戻す

- 再開は done が無い最初の段階から。`node runState.js status <runDir>` で確認する
- `tier` と `verify` は attempt ごとに繰り返す。blocker で戻るときは `invalidate` で `tier` 以降の done を退避してから attempt を進める
- 後ろの段階をまとめて退避するときは `invalidate <run> <stage> <reason> --from` を使う (その段階と後ろの done をすべて退避する。1 つずつ呼ぶと漏らしやすい)
- 上流 (要求・ADR・契約) が変わったら、`basis.js check` で古くなった成果物を見つけ、対応する段階を `invalidate` する

## イベントの種類 (最小)

| type | いつ |
|---|---|
| run_opened | 初回 open |
| models_resolved | open 直後。`{session, implementer, verifier}` (解決済みのモデル ID だけ。注記を混ぜない)。verify 段で Verifier の自己申告 (報告 1 行目 `model:`) と違えば記録し直す (最後が有効)。as-built の生成情報に転記される |
| stage_completed / stage_invalidated | done の作成 / 退避 |
| scenario_approved / review_approved | 人の承認。承認した内容の要点と評価対象のハッシュを持つ。review_approved は残った作業の処遇 `carry_over: {done, carry, ignore}` も持つ (配送の squash で `carryOver.js move` が読む。0.1.30) |
| assumption_decided | 前提の承認・却下 (id と処遇) |
| feedback_filed | UC の課題を課題ファイルにした記録。`{kind, ref, issue_path}` (issue_path は `issues/<file>.md`、`ref` は `docs/feedback/<issue>.md`)。`feedbackBatch.js file-issues` が書く。0.1.26 の記録の `ref` (main に入った還流の commit の sha) と 0.1.25 までの `url` (PR / issue) も起票済みとして数える。取り込んだ記録は commit の trailer (`Feedback-Consumed:`) で、イベントには書かない |
| feedback_deferred | (0.1.25 までの記録だけ。0.1.26 からは書かない) 還流の保留。`{kind, issue_path, reason}`。同じ issue_path の `feedback_filed` で解消する |
| blocked_on_requirement | 人レビューで「要求を直す」を選び、要求の反映待ちで停止した |
| returned_to_integrate | asbuilt の受理時に集計 (`reports/asbuilt.json`) の計装なし / 正常系に部品なしのティアが空でなく、integrate へ戻した。`{from: "asbuilt", instrumentation_gaps, instrumentation_happy_gaps, moved_findings}`。`runState.js return-to-integrate` が 同じ attempt の `findings.<tier>.yaml` を `invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移し、integrate 以降の done を退避してから記録する (attempt は上げない) |

`runState.js status` は、起票済みの課題を `filed_issues`、課題ファイルにしていない `issues/*.md` を `unfiled_issues` (表示にも出す)、0.1.25 までの記録の未解消の保留を `pending_feedback` に出す
(0.1.18 以前の記録にある「url が空の `feedback_filed` (`issue` にパス)」も保留として数える)。配送は `unfiled_issues` が空でないと done にしない。
配送済みの正は `stages/deliver.done.yaml` (main の上で `impl(<slug>): delivered` として commit する。0.1.25 までは GitHub の PR が正で、done ファイルを作らなかった)。

status ファイルは持たない。必要なら events と done から都度計算する。
