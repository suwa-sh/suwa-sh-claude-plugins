# 実行状態 (`.distillery/runs/<uc_slug>/`)

v1 の実行状態ディレクトリ (events ディレクトリ + latest + status + lease + NEXT) を次に簡素化した。
操作はすべて `<skills>/d2-common/scripts/lib/runState.js` を通す (CLI と require の両方)。

```
.distillery/
  config.yaml                       # 実行設定 (d2-common/references/config-schema.md)
  runs/<uc_slug>/
    events.jsonl                    # 追記のみ。1 行 1 イベント {seq, ts, type, ...}
    stages/<stage>.done.yaml        # 完了の正。存在 = 完了。中身は完了時刻と要点 (commit, attempt など。0.1.30〜0.1.31 の run にある carry_over_status は読まない。0.1.32 で UC への持ち越しをやめた)
    attempt-<n>/
      attempt.json                  # attempt を開いた印 (rewind が書く。中身の無い attempt-<n> は数えない)
      assumptions.<tier>.yaml       # 実装者が補った前提 (AssumptionRecord)
      findings.<tier>.yaml          # Verifier の指摘 (ティアごと)
    reports/                        # gates.json と各ゲートの JSON レポート。gates.prev.json (main マージ 1 の 2 で作り直す前の控え)・gates.failed-1.json (回し直す前の控え)
    traces/<scenario_id>.jsonl      # UC BDD 実行時の計装トレース
    issues/<ts>_<slug>.md           # 仕様起因の課題 (front matter target_step と互換の kind)。scenario 段と handoff.js file-drafts が書く
    issues/consumed/<file>.md       # 機能の中で巻き戻して直した課題の下書き (runState.js rewind が移す。課題ファイルにしない。0.2.0)
    handoff/<段>[-<tier>]-<ts>.yaml # 担当の引き継ぎファイル (人に聞くこと・前のステップの課題・反証。0.2.0)
    decisions.jsonl                 # 決めたことの記録 (decisionLog.js。0.2.0)
    reviews/<場所>[-<tier>]/        # 縦・横レビューの依頼文と結果 (reviewStep.js。0.2.0)
    learnings/<ts>_<slug>.md
    invalidated/<ts>_<stage>.done.yaml   # 無効化した done の退避 (写し直しで退避したレビューの置き場は invalidated/<ts>_reviews_<場所>/)
    resume/<n>/<path>.diff          # n 回目の写し直しで統合できなかった機能側の差分 (resumeAfterUpstream.js。担当が反映するか取り下げる)
  archive/runs/<uc_slug>/<ts>/      # 開き直した UC の前の run (追跡。runState.js reopen が移す。reports/・traces/ は消してから移す。reopened.json に開き直した段・引き継いだ段・きっかけの課題。0.1.35・0.2.0)
  handoff/<段>-<ts>.yaml            # 上流の段 (①②③・上流の差分) の引き継ぎファイル (追跡。0.2.0)
  decisions.jsonl                   # 上流の段の決めたことの記録 (追跡。0.2.0)
  reviews/<場所>/                   # 上流の段の縦・横レビュー (追跡。0.2.0)
  logs/feedback/<b>/                # 0.1.x の還流のバッチの状態 (gitignore)。0.2.0 では途中で止まったものを片付けるだけ (routing.md)
  worktrees/<uc_slug>/<issue>/      # 上流で止めるときの一時の worktree (gitignore)
  logs/resume-<uc_slug>.json        # 写し直しの処理の記録 (gitignore。途中で止まったら続きから行う。終わったら消える)
docs/feedback/<issue>.md            # 課題ファイル (追跡)。戻し先 (target_step) で振り分け、反映したら消す (routing.md「課題の消し方」)。kind: plugin (プラグインへ持ち帰る課題) は人が消す
docs/feedback/README.md             # 課題の一覧 (genDocsReadme が生成。0 件なら消す)
```

## Git 追跡の方針 (`.gitignore` と整合)

- **commit する (追跡)**: `events.jsonl` / `stages/*.done.yaml` / `attempt-<n>/**` (assumptions・findings) / `issues/**` / `learnings/**` / `invalidated/**`。これらは実行の記録なので履歴に残す。
- **commit しない (gitignore)**: run の中では `reports/`(gates.json と各ゲートの JSON レポート) と `traces/`(計装トレース JSONL) のみ。いずれもテスト実行のたびに再生成できる生成物。run の外の `.distillery/logs/` と `.distillery/worktrees/` も追跡しない。
- genSkeleton が書く `.gitignore` は `.distillery/runs/*/reports/`、`.distillery/runs/*/traces/`、`.distillery/logs/`、`.distillery/worktrees/` と、symlink の `node_modules` を無視する。`attempt-*/` は無視しない。
- **`.distillery/logs/`**: headless 実行のプロンプト・起動スクリプト・完了報告ログなど、セッション単位の実行記録の置き場。UC に紐づかない記録はここに置き、リポ直下に独自ディレクトリ (`_run/` など) を作らない。git 管理外

## 段階 (stage) の順

`scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → deliver`

- 0.1.27 で UC は main マージで終わるようにした。UC の課題は main マージのときに課題ファイルにし、0.2.0 からは戻し先 (`target_step`) で振り分ける (上流の差分か開き直し。routing.md)
- 0.1.26 の run が持つ `stages/feedback.done.yaml` は読まない (main マージの done があれば旧形式と判定しない)。0.1.26 で main マージして還流を終えていない run の課題は、起動時の移行 (`feedbackBatch.js scan` の `unfiled_runs`。自動選択の `migrate`) が課題ファイルにする
- 0.1.25 までの run (還流の done があり main マージの done が無い) は `status` の `legacy_order: true` で次の段階を出さない。d2-run が人に main マージ済みかを聞き、
  main マージ済みなら `node runState.js mark-legacy-delivered <runDir>` で main マージの done (`legacy: true`) を作る。まだなら `invalidate <runDir> feedback` で新しい順に戻す

- 再開は done が無い最初の段階から。`node runState.js status <runDir>` で確認する。`status` は有効な分岐元 `base_head` (最後の `resumed_after_upstream` の `base_head`、無ければ `branch_started` の `base_head`)、上流で止まっているか (`paused`・`paused_issues`)、写し直しの回数 (`resumes`・`resume_limit`) も返す
- 上流で止めた機能は、止めた課題がすべて main から消えたら `resumeAfterUpstream.js run` が新しい main の上に写し直し、続きの段以降の done とレビューの置き場を退避する (写し直しは 3 回まで)
- `tier` と `verify` は attempt ごとに繰り返す。tier へ戻るときは `rewind <run> implementation` (tier 以降の done を退避して attempt を進める)。契約・シナリオへ戻るときは `rewind <run> contract | scenario`。巻き戻しと as-built からの差し戻しは合わせて 3 回まで (超えると exit 3。人に返す)
- 後ろの段階をまとめて退避するときは `invalidate <run> <stage> <reason> --from` を使う (その段階と後ろの done をすべて退避する。1 つずつ呼ぶと漏らしやすい)
- 上流 (要求・ADR・契約) が変わったら、`basis.js check` で古くなった成果物を見つけ、対応する段階を `invalidate` する
- `event` / `done` の data は argv の JSON か `--data-file <json ファイル>` (排他)。長い JSON (日本語の項目の一覧など) はファイルで渡す (argv の長い日本語をハーネスの検査が止める。0.1.32 O18)

## イベントの種類 (最小)

| type | いつ |
|---|---|
| run_opened | 初回 open |
| models_resolved | open 直後。`{session, implementer, verifier}` (解決済みのモデル ID だけ。注記を混ぜない)。verify 段で Verifier の自己申告 (報告 1 行目 `model:`) と違えば記録し直す (最後が有効)。as-built の生成情報に転記される |
| stage_completed / stage_invalidated | done の作成 / 退避 |
| scenario_approved / review_approved | 人の承認。承認した内容の要点と評価対象のハッシュを持つ。scenario_approved は `{feature, feature_sha256, acceptance: {<path>: <sha256>}}` (受入の feature が無ければ `acceptance: {}`。0.1.32 O14)。`runState.js scenario-approve <run> --feature <path> [--acceptance-dir <dir>]` が書く: feature_sha256 は feature の bytes の sha256、acceptance は `@uc:<slug>` を持つシナリオがある `features/acceptance/*.feature` (**人が承認した対象**。`checkScenario.js` は印タグの整合のために受入 dir の全ファイルを読むが、他 UC だけのファイルは承認の対象でないのでハッシュに入れない。0.1.32 実走 P16)。review_approved は `{assumption_decisions[], assumption_evidence_sha256, gates_result}`。0.1.30〜0.1.31 の review_approved にある `carry_over: {done, carry, ignore}` は読まない (非空の `carry` は要求の差分が宛先へ流す。`feedbackBatch.js scan` の `carry_over_pending`。0.1.32) |
| assumption_decided | 前提の承認・却下 (id と処遇) |
| assumption_resolved | main マージ済み UC の前提の記録 (AssumptionRecord) を要求の差分の決定で閉じた。`{targets: [{tier, attempt, id}], decision, by: "req: feedback"}`。各 target は `attempt-<n>/assumptions.<tier>.yaml` にある id (`runState.js` が検査する。最新でない attempt も可)。AssumptionRecord の yaml は書き換えない (review の hash と Verifier の照合の対象)。as-built の生成器 (`extractAsBuilt.js`) が最新 attempt の target を読んで処遇を「要求の差分で閉じた」にする (0.1.32 J2) |
| carry_over_migrated | 0.1.30〜0.1.31 の `review_approved.carry_over.carry` を要求の差分の「残った作業」に載せて宛先へ流した印。`{items: [...], to: "req: feedback"}`。これがある run は `carry_over_pending` に出ない (0.1.32) |
| feedback_filed | UC の課題を課題ファイルにした記録。`{kind, ref, issue_path}` (issue_path は `issues/<file>.md`、`ref` は `docs/feedback/<issue>.md`)。`feedbackBatch.js file-issues` が書く。0.1.26 の記録の `ref` (main に入った還流の commit の sha) と 0.1.25 までの `url` (PR / issue) も起票済みとして数える。取り込んだ記録は commit の trailer (`Feedback-Consumed:`) で、イベントには書かない |
| feedback_deferred | (0.1.25 までの記録だけ。0.1.26 からは書かない) 課題の保留。`{kind, issue_path, reason}`。同じ issue_path の `feedback_filed` で解消する |
| mode_resolved | ④ の開始時。`{mode: auto \| recommend}` (0.2.0) |
| rewound | 機能の中で前のステップへ巻き戻した。`{to, stage, attempt, issue, reason, over_limit?}` (`runState.js rewind` が書く。0.2.0) |
| inherited | 開き直しで前の run から done と scenario の承認を引き継いだ。`{from, stages, archive}` (`runState.js reopen --from` が書く。0.2.0) |
| review_rejected | 人レビューで「実装を直す」。`{rejected_assumptions}` |
| blocked_on_upstream | 上流 (要求・決定・基盤) の反映待ちで停止した。`{issues: [{id, target, resume_from?}]}` (課題ファイルの名前・戻し先・写し直した後に続ける段)。0.2.0 の `{target, issues: [<パス>]}` も読む。課題ファイルを main に入れ、feature の run に記録して commit する (自動選択が進行中とみなさない) |
| resumed_after_upstream | 上流を直した後の main の上に写し直した。`{base_head, from_head, from_stage, paused_ref, issues, conflicts, diffs, regenerated, stale}` (`resumeAfterUpstream.js` が書く。これより後の `blocked_on_upstream` が無ければ止まっていない。0.3.0) |
| reviews_set_aside | 写し直しで続きの段以降のレビューの置き場を `invalidated/` へ移した。`{reason, moved}` (0.3.0) |
| blocked_on_requirement | (0.1.x の記録。0.2.0 からは blocked_on_upstream) 要求の反映待ちで停止した。`{stage: scenario \| review}`: `review` は人レビューで「要求を直す」を選んだとき、`scenario` はシナリオの検査で他 UC の振る舞いを含む受入基準が残り、要求の課題にしたとき (0.1.32 J1)。どちらも課題ファイルを main に入れ、feature の run に記録して commit する (自動選択が `git show` で読み、進行中とみなさない) |
| returned_to_integrate | asbuilt の受理時に集計 (`reports/asbuilt.json`) の計装なし / 正常系に部品なしのティアが空でなく、integrate へ戻した。`{from: "asbuilt", instrumentation_gaps, instrumentation_happy_gaps, moved_findings}`。`runState.js return-to-integrate` が 同じ attempt の `findings.<tier>.yaml` を `invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移し、integrate 以降の done を退避してから記録する (attempt は上げない) |

`runState.js status` は、起票済みの課題を `filed_issues`、課題ファイルにしていない `issues/*.md` を `unfiled_issues` (表示にも出す)、0.1.25 までの記録の未解消の保留を `pending_feedback` に出す
(0.1.18 以前の記録にある「url が空の `feedback_filed` (`issue` にパス)」も保留として数える)。main マージは `unfiled_issues` が空でないと done にしない。
main マージ済みの正は `stages/deliver.done.yaml` (main の上で `impl(<slug>): delivered` として commit する。0.1.25 までは GitHub の PR が正で、done ファイルを作らなかった)。

status ファイルは持たない。必要なら events と done から都度計算する。
