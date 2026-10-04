# Changelog

version の正本は `.claude-plugin/plugin.json`。

## [0.1.27] - 2026-10-04

課題ファイル (`docs/feedback/`) の循環を閉じた。UC は配送で終わり、溜まった課題は次の UC の前に、要求の差分と還流がまとめて片付けて消す (todo ④ の 2 版目)。

### Changed

- 還流を UC の外の独立した段階にした (`/distillery2:d2-run stage=feedback`、または自動選択)。ルール・契約の課題を worktree 1 つ (`.distillery/worktrees/feedback`) と branch 1 本 (`feedback/<b>`) でまとめて直し、
  ゲート・確認ページ・main への取り込みを 1 回ずつにした。0.1.26 の「2 件目以降の還流が必ず作り直しになる」問題 (試し運転の J1) と、`merge=hold` だと還流に届かない問題 (J8) が消えた
- 還流の git の状態遷移 (切り出し・課題の commit・止める・仕上げ・組み直し・取り込み・再開の判定) を新しいスクリプト `scripts/feedbackBatch.js` にした。d2-run はサブコマンドを呼び、JSON と終了コードで判断する
- 課題の commit には原本 (番号付きの ADR・契約の分割ファイル) だけを入れ、生成物は最後に「ADR の索引」→「ルールと契約の生成物」の 2 commit で作り直す (索引を同じ commit にするとルールの basis が commit 直後から古くなるため)。
  課題を外す・取り下げる・main が進んだときは、main の先端から原本の commit を cherry-pick して組み直す (0.1.26 の「rebase しない」を置き換えた)
- ゲート: 課題ごとの commit の直後に static (run 名 `d2-feedback`)。最後に 1 回 (ルールは static、契約は static と変えた契約を使う UC ごとの全段)。合否は branch の先頭の sha と一緒に記録し、一致しなければ取り込まない。落ちても原因を推測で外さず、確認ページで人に見せる
- 止まった課題は課題ファイルに書き足して残す (`stopped: true`・`stopped_count`・題名の頭に「止まった: 」(J10)・止まった理由と差分の中身)。次の還流で再挑戦し、2 回目以上は確認ページで「取り下げる / 残す」を聞く。止まった課題だけでは還流も要求の差分も始めない
- 要求の課題は、次の UC の前に要求の段階が差分で反映する (一括承認。外す課題は変更を捨ててやり直す)。要求で止まった UC の feature は `refs/distillery2/abandoned/` に退避し、UC は main から新しい run でやり直す
- 取り込んだ記録は commit の trailer (`Feedback-Consumed:` / `Feedback-Dismissed:` / `Feedback-Result:` / `Feedback-Stopped:`)。UC の run のイベントには書かない
- 契約の分割ファイルに差分が無い契約の課題は「取り込み済み」として確認なしで消す (J6)
- 起動時の段階の選び方: 進行中の UC → (main に切り替えて) 未 push の push → 途中の還流 → 要求の差分 → 還流 → 次の UC。要求の差分と還流は進行中の UC があれば止まる (main を進めると UC の配送が ff できなくなるため)
- UC の段階から `feedback` を外した (`runState.js` の `STAGES` の末尾は `deliver`)。配送の squash の前に `feedbackBatch.js file-issues` が UC の課題を課題ファイルにし、`unfiled_issues` が空でないと配送しない
- review で「要求を直す」ときの一時 branch を `feedback-req/<slug>/<issue>` にした (`feedback/` は還流のバッチ専用)
- d2-foundation の `phase=rules` をやめた (還流のルールの作り直しは feedbackBatch が F1・F2 のスクリプトを直接回す)
- genDocsReadme: `docs/README.md` に「未処理の課題」の節 (件数と種類ごとの内訳と一覧へのリンクだけ) を出し、一覧 `docs/feedback/README.md` を生成する (0 件なら消す)。`docs/feedback/` を「distillery2 以外の文書」に並べなくした (J11)
- 手順書のコマンド例を `git -C <dir>` にそろえ、headless の許可で止まる書き方 (`$VAR`・`$?`・`cd <dir> && git`) を troubleshooting に書いた (J9)

### Added

- `scripts/feedbackBatch.js` (サブコマンド: `file-issues` / `scan` / `hold` / `start` / `status` / `commit-issue` / `regen` / `discard` / `record-static` / `stop-issue` / `finalize` / `record-gate` / `decide` / `rebuild` / `merge`) と、使い捨ての git リポジトリでの統合テスト
- `runState.js status` の `unfiled_issues` (課題ファイルにしていない課題。表示にも出す。J5)

### Removed

- 課題ごとの worktree・還流 branch・受理済みの印 (`.ready`)・承認した sha (`.approved`) (J3)。還流の done の書き方の手順 (J4。還流は UC の段階ではなくなった)

### Migration

- 0.1.26 で配送して還流を終えていない run (`merge=hold` で止めた run など) の課題は、還流の最初に `feedbackBatch.js file-issues` で課題ファイルにする (自動)。0.1.26 の run が持つ `feedback.done.yaml` は読まない
- 0.1.26 の手順で作った `docs/feedback/` の課題ファイルはそのまま使える (止まった課題の `stopped: true` も読む)

## [0.1.26] - 2026-09-30

PR / issue (GitHub の `gh`) をやめ、配送と還流を git とファイルだけで完結させた。GitHub 以外のホスト (GitLab など) や remote の無いリポでも同じ手順で最後まで進む。

### Changed

- 段階の順を `asbuilt → deliver → feedback` にした (配送を還流の前へ)。還流は main から切るので、この UC の契約・課題・run ディレクトリがそろっている
  (0.1.24〜0.1.25 の課題の写し・未追跡ファイルの一覧・還流 branch 上の再開の後始末・「開始点に無い契約」の扱いが要らなくなった)
- 配送: squash した commit を main へ `git merge --ff-only` し、main の上で配送の done (`stages/deliver.done.yaml`) を `impl(<slug>): delivered` として commit する。
  remote `origin` があれば main を push (拒否されたら止まる。force push はしない)。PR を作らない。配送済みの正は done ファイル
- 還流: rule / contract は `.distillery/worktrees/<slug>/<issue>` に main から worktree を切り、持ち主のスキルが直す。受理の後に **main を壊さないことのゲート**
  (rule は static、contract は static と変えた契約を使う UC ごとの全段) を回し、確認ページ 1 回で取り込むものを決めて main へ ff merge する。
  ff できなければ rebase せず、最新の main から作り直す (上流の本文が同じなら再確認なし)
- 課題 (要求の穴・止まった還流) は GitHub の issue ではなく、main の `docs/feedback/<issue>.md` にする。止まった還流は理由を並べて書く
- `feedback_filed` は `{kind, ref, issue_path}` (`ref` = main に入った commit の sha か課題ファイル)。`feedback_deferred` は新しくは書かない
- d2-run の引数 `merge=hold`: 配送と還流を main へ取り込む手前で止める (headless 用。引数なしで再開すると取り込みから続く)
- 生成する CI は main と `feature/**` への push で回す (pull_request をやめた)。unit と contract の手順に `--passWithNoTests` を付ける
  (テストの無いティアで main の CI が必ず赤になっていた。ローカルのゲートは変えない)
- `.gitignore` の管理ブロックに `.distillery/worktrees/` と `node_modules` (末尾スラッシュ無し。worktree に張る symlink も無視する) を足した。`genSkeleton.js --migrate` で既存のリポも直る
- UC の squash commit に Feedback trailer を付けない (還流は配送の後)

### Added

- `runState.js`: `mark-legacy-delivered` (0.1.25 までに PR で配送済みの run に配送の done を作る。人が確認ページで答えたときだけ)、status の `legacy_order` と `filed_issues`

### Migration

- 0.1.25 までの run (還流の done があり配送の done が無い) は、再開すると d2-run が「配送済みか」を確認ページで聞く。配送済みなら印を付け、まだなら還流の done を退避して新しい順で配送から続ける
- 既存のリポは `genSkeleton.js --migrate` で `.gitignore` を更新し、CI を作り直す (genCi)。還流は worktree を作る前に `.gitignore` を確かめ、足りなければ止まってこれを求める

## [0.1.25] - 2026-09-28

0.1.24 の試し運転で見つかった穴 (還流の派遣が止まった課題が保留のまま残り、配送を止め続ける) を直した。

### Changed

- 還流 (rule / contract) の派遣が止まった課題は、種類を問わず止まった理由を添えて `gh issue create` し、`feedback_filed` で記録する (保留にしない)。
  理由は止まり方ごとに書き分け (ADR で表せない・この UC 自身の契約の穴・absent だが開始点にあった・検査で落ちた・書き込み範囲の外を変えた・結果ファイルが無い)、重なればすべて並べる
- issue の本文に印の行 `distillery2-feedback: <slug>/<issue>` を入れ、作る前に同じ印の issue を検索する (issue を作った直後・記録の前に中断しても重複しない)
- `feedback_deferred` は、PR / issue を作れない実行と、止まった課題の issue の照合・起票が失敗したときだけにした
- git-delivery の配送の条件と Feedback trailer に、止まった rule / contract の issue を明記した

## [0.1.24] - 2026-09-28

還流 (実装で見つかった上流の穴を PR / issue にする) で、d2-run が ADR・開発ルール・契約を自分で書き換えていた手順をやめ、
持ち主のスキルに派遣するようにした (配送と還流を別スキルに分けるかの判断の結果。分けずに、書き換えだけを寄せた)。

### Changed

- 還流の rule は d2-decide `mode=feedback` (ADR を 1 本足す) → d2-run が ADR を commit → d2-foundation `phase=rules` (開発ルールとアーキテストの作り直し)、
  contract は d2-contract `mode=feedback` (分割ファイルを直し、生成物を全部作り直す)。d2-run は還流 branch・派遣・受理・commit・PR だけを行う
- 還流 branch を `feedback/<slug>/<issue>` (課題ごとに決まる名前) にし、中断からの再開を PR → リモート branch → ローカル branch の順に判定する
- 課題は `.distillery/logs/feedback/<slug>/` に写してから branch を切り替え、`feedback_filed` は feature branch に戻ってから記録する
  (還流 branch には `issues/` も run ディレクトリも無い)
- 受理はファイルで行う: 結果ファイル (`applied` / `absent` / `blocked`) で分岐し、生成物の `--check` 群を commit の前に回す
- 止まったとき (ADR で表せない・検査で落ちた) は差分を残して還流 branch を捨て、`feedback_deferred {kind, issue_path, reason}` にする。
  いま実装中の UC 自身の契約の穴 (開始点の契約に対象が無い) は、`git grep` で確かめてから contract の issue にする

### Added

- genRules.js・genArchTests.js の `--check` (書かずに、生成物が無いか古ければ exit 1)
- 入出力の正本に還流の処理 (派遣 3・受理の検査 5) と、課題の写し・結果ファイル・止まったときの差分を足した。整合性テストが d2-run の還流節と d2-decide / d2-contract の還流の読む / 書くを照合する

### Known issues

- 契約の生成物 (契約テスト等) の basis は、生成物を契約と一緒に commit した直後から古いと判定される (④ contract 段にもある既存の挙動。還流も同じ順にそろえた)

## [0.1.23] - 2026-09-27

0.1.22 の試し運転で見つかった課題 (いずれも 0.1.22 以前から) を直した。

### Fixed

- 新規の ③ でチェックポイント (F9) の quality が必ず落ちる: genSkeleton が biome.json に書くフォルダ除外を `!**/test/contract/**` から `!**/test/contract` にした
  (biome 2.2.0 以降の既定の規則 `useBiomeIgnoreFolder` が末尾 `/**` を違反にする。0.1.15 から)。`genSkeleton.js --migrate` は旧い形を同じ位置で置き換える
- as-built から integrate へ戻すときの記録と退避が手順に無かった: `runState.js return-to-integrate` の 1 操作で、同じ attempt の findings を
  `invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移し (先に移すので途中で止まっても古い findings が残らない。何度戻っても上書きしない)、
  integrate 以降の done をまとめて退避し、イベント `returned_to_integrate` を記録する。attempt は上げない (計装の結線は integrate の担当)。verify と review もやり直す。
  退避先 `<run>/invalidated/**` を正本と d2-run の書き込み先に載せた
- genDocsReadme が gitignore のパス (`docs/design/storybook-app/node_modules/**` など) の README を載せ、commit ではリンク切れになっていた。git が無視するパスと `node_modules` を飛ばす (入口の選び方、中身がすべて無視されたディレクトリ、既知の文書へのリンクも含む。必須のリンクが無視されたファイルを指したらリンク切れとして exit 1)
- F3 が作る `tsx-register.js` (cucumber.js が読む ESM ローダ) が正本・phase 表・派遣表の write-set に無かった
- ③ で仕上げが作る config・C4 図・画面部品の取り込み記録の basis が空 (契約と画面部品が未 commit): 仕上げの派遣の前に d2-run が契約の骨格と画面部品を commit する。F8 の C4 図は `contracts=contracts` で契約も basis に記録する

### Added

- `runState.js` の `invalidateFrom` (CLI `invalidate ... --from`) と `returnToIntegrate` (CLI `return-to-integrate`)

## [0.1.22] - 2026-09-27

d2-run が直接回していた作業を、段階の持ち主のスキルに移した。d2-run に残すのは派遣・受理時の検査・確認ページ・genDocsReadme・git だけ。

### Changed

- ③ 基盤: npm install・genQlty --refresh・config / CI / C4 図の再生成・画面部品の取り込み・骨格分の契約テスト・チェックポイントを d2-foundation に移した
  - d2-foundation の phase を追加: F7 依存の導入、F8 契約込みの再生成、F9 チェックポイント。F4 は「骨格分の契約テストの生成」になった
  - `phase=all` = F1→F2→F3→F5→F7、新しい `phase=finish` = F8→F6→F7→F4→F9。F6 は d2-run が渡す `ui=true|false` (今回の design が部品を生成したか。skip なら false) で決め、前の実行の `docs/design/` が残っていても取り込まない
  - d2-run の ③ は「基盤 → 契約の骨格 → design → 基盤の仕上げ → 確認ページ」。design は config も契約も読まないので、仕上げの前に動かした (仕上げを 1 回の派遣にまとめるため)
  - d2-run は仕上げを `.distillery/runs/bootstrap/reports/gates.json` で受理する (派遣前に消し、前回の結果で受理しない。`gates` 配列の static が pass)。static は契約テストの生成を見ないので、`genContractTests.js --check` (読むだけ) も受理の条件にする。design の完了報告 (生成か skip か) が届くまで仕上げに進まない
  - lockfile の書き手は ③ では d2-foundation だけ (単一 writer は変わらない)
- ④ asbuilt: depcruise・extractAsBuilt・checkAsBuilt を d2-asbuilt が通しで回す。d2-run は受理時の検査 (checkAsBuilt と集計ファイル) だけ
  - extractAsBuilt が集計 `<run>/reports/asbuilt.json` (slug・attempt・generated_at・計装なしのティア) を書く (一時ファイルから rename)
  - 計装なし / 正常系に部品なしなら integrate へ戻す判断は d2-run に残し、要約役の報告文ではなく集計ファイルで判断する。d2-run は派遣前に集計を消し、slug と attempt を照合する。抽出は前回の要約を残すので、as-built だけは要約役の完了報告も受理の条件にする
- 派遣文の git 禁止に例外を明記: スクリプト内部の git の読み取りと、genQlty.js の一時的な `git add -N` (index は書き戻す)
- 派遣表の基盤の行に `npm install` が作る `node_modules/**` (gitignore) を例外として明記
- npm 10 の回避策を d2-run から d2-foundation の troubleshooting に移した
- DFD: 派遣単位の図が上限 (箱 9・矢印 12) を超えるサブエージェントは、内訳ごとに描く。正本に kind `llm` (サブエージェントの中の LLM の作業) を追加

## [0.1.21] - 2026-09-26

### Changed

- DFD (`skills/d2-common/references/dataflow.md`) の図を分けた。0.1.20 は全体図が箱 50・矢印 143、③ と ④ の d2-run が箱 35〜38 で読めなかった
  - 全体図は 3 枚 (① 〜 ④ / ④ 実装まで / ④ 検証と as-built)。段階を箱、受け渡しを矢印にし、ラベルにファイル群の名前を書く。
    前向きの受け渡しだけを描き、後の段階が書き戻す後ろ向きの受け渡しは表に分けた。文書の入口の更新と検査 (広く読むだけ) の読みは全体図に描かない
  - 処理ごとに 1 枚 (d2-run が回すスクリプトも 1 枚ずつ)。ファイルが 8 を超える処理はファイル群にまとめ、正確なパスは図の下の表に出す
  - `dataflow.yaml` に `store_groups` と各 store の `group` を追加
- 各図が箱 9 以下・矢印 12 以下であることをテストで固定

## [0.1.20] - 2026-09-26

スキル群の整合性を保つため、処理と入出力の正本を共通スキルに置き、手順書との食い違いをテストで検出する。

### Added

- 共通スキル `skills/d2-common/`。`references/dataflow.yaml` (処理・ファイル・段階の正本。`writes` / `allowed_writes` / `notes` / `origin` など) と、
  `scripts/genDataflow.js` で生成する DFD `references/dataflow.md` (全体図・段階ごとの詳細図・ファイルの一覧)。各スキルの SKILL.md から相対パスで参照する
- `tests/distillery2/integration/dataflow.test.js`: 正本と手順書 (派遣表の write-set、各スキルの読む / 書く、基盤の phase 表、d2-run の表) の照合、
  並列の処理が同じファイルに書かないこと、書き手・読み手のいないファイル、図の鮮度、Agent Skills 仕様 (name・frontmatter)
- d2-run SKILL に「d2-run が直接読み書きするもの」の表 (ゲートの実行が読むファイルを含む)

### Changed

- 全スキルの `name` を Agent Skills 仕様に合わせてディレクトリ名 (`d2-run` など) にした。Claude Code での呼び出し名 (`/distillery2:d2-run`) は変わらない
- 基盤の phase 表を、パスだけの列と表の外の説明に分けた (F4 は委譲と明記、F5 の説明は表の下へ)

### Fixed (正本を起こして見つかった食い違い)

- 並列のティア実装者が同じ `issues/` に同じ形の名前で書いていた。ティアの課題は `<ts>_<tier>_<slug>.md` にする
- 派遣表の write-set: 基盤に `cucumber.js`・`.qlty/qlty.toml` が無かった / 画面部品の担当に `packages/ui/**` を許していた (取り込みは d2-run の F6) /
  要約役に `docs/as-built/_system/**` を許していた (スクリプトの生成物)
- 読む / 書くの記述がパスになっていなかった箇所 (Verifier の前提ファイル、ティアの test ファイル、scaffold の test-support、scaffold / integrate が完了条件で書く reports / traces)

## [0.1.19] - 2026-09-26

実走 (0.1.10 / 0.1.13 / 0.1.16) で手順が止まった箇所と、記録・報告が見えなかった箇所を直す。

### Fixed

- ティアの実装者が記録付きのゲートを回せなかった (オーケストレータが代行していた)。runGates は `gates.json` をゲート名単位で置き換えるため、
  並列の実装者に回させると互いの記録を消す。実装者は runGates を使わず commands を直接回し (`{report}` は OS の一時ファイル)、
  記録付きの `runGates --upto unit` は全ティアの受理後に d2-run が 1 回だけ回す。単独の段 (scaffold / integrate) の write-set に reports / traces を追加
- scaffold がテストの import する入口ファイルを置けず、動的 import で回避されていた。新規ファイルに限り最小の入口スタブ (型に合う中立の値を返す) を許可し、
  既存の非テストファイルの変更・削除を受理時に検査する
- push / PR ができない実行で feedback 段を終えられなかった (3 回連続)。`feedback_deferred {kind, issue_path, reason}` を追加し、feedback は「全 issue が起票済みか保留」で done。
  保留は deliver の前に起票して commit してから squash する。`runState.js` に `pendingFeedback` を追加し、`status` に `pending_feedback` を出す
  (0.1.18 以前の「url が空の `feedback_filed`」も保留として数える)。人レビューの「要求を直す」もその場で起票か保留にして停止する
- リモートが無いリポで branch の開始条件 (upstream と HEAD が一致) を判定できなかった。upstream が無ければ飛ばして報告に書く

### Added

- `skills/d2-contract/scripts/classifyContractChanges.js`: 変わった契約の生成物を own / other_uc / shared に分ける (同じ operation を使う他 UC を併記)。
  d2-run が contract 段の done (`contract_changes`) に記録し、他の UC にも効く変更を人レビューに載せる
- d2-verify の観点 1 に「他 UC への波及」(`kind: cross_uc_change`、major)。d2-run が追跡表から初期候補を渡し、Verifier が import 元を辿って候補を足す。read-set に例外を追加
- asbuilt の要約役に extractAsBuilt の標準出力 1 行を渡す
- 差し戻し後の integrate も必ず派遣し、結線の変更が不要なら完了条件を満たした報告で done (`wiring_changed: false`)

## [0.1.18] - 2026-09-26

### Changed

- トラブルシューティングを agent skills の形式に合わせ、スキルごとの `references/troubleshooting.md` に分割
  (`d2-run`: npm 10 / headless の許可 / 補助スクリプト、`d2-foundation`: qlty / biome、`d2-contract`: 契約テスト)。プラグイン直下の `TROUBLESHOOTING.md` は削除
- 実走の課題一覧 (`samples/distillery2/findings-*.md`) を git 管理から外す (作業メモは git 管理外の `tmp/` に置く)

## [0.1.17] - 2026-09-26

### Changed

- TROUBLESHOOTING.md に 0.1.16 の再実走 (返却 UC) で分かった 4 件を追記: `"type": "module"` のリポでは補助スクリプトを `.cjs` に、
  記録コマンドをパイプでつながない、headless の `shasum` は node の crypto で、旧 test-app のヘッダ補完の外し方
- サンプルを 2 UC 分 (貸出 + 返却) に更新。`findings-0.1.16.md` (再実走の結果と新しい気づき 8 件)

## [0.1.16] - 2026-09-26

0.1.13 の再実走の持ち越し (ユーザー判断: 小さな修正 5 件 + 品質に効く 3 件。検証役は同じモデルでも進める。npm の件はトラブルシューティングにためる)。

### Added

- **契約テストの要求ヘッダ**: 文書直下 / operation の `x-test-headers` (既定) と request example の `x-headers` (上書き。`null` で送らない) を `.set()` で送る。
  `'{uuid}'` は毎回新しい UUID (Idempotency-Key 用)。生成される契約テストが認証情報を送れず、提供側にテスト専用のヘッダ補完が要った (0.1.10 ④-3 / 0.1.13 ④-3)
- `extractAsBuilt.js --dry-run`: 何も書かずに計装の集計だけ返す (integrate 担当が docs/as-built を書いて write-set の外に出ていた。0.1.13 ④-5)
- `TROUBLESHOOTING.md`: 実走で踏んだ環境依存の問題と回避策 (npm 10 の `edgesOut`、qlty init の拒否、osv-scanner の欠落、biome の版差、headless の `$VAR`、index.lock)

### Changed

- **検証役 (Verifier) のモデル**: 独立検証の条件は「別のサブエージェント (文脈が新しい) で、実装役と同等以上のモデル」。同じモデル ID に解決されても止めない (記録だけ残す)。
  別名 `opus` の解決先は Claude Code 側で変わる (0.1.10 は claude-opus-4-7、0.1.13 は claude-opus-5-5)
- `captureStories.js`: 静的ビルドをローカル http で配信して撮る (file:// では ES modules が読めず全 Story が白紙だった。0.1.10 ③-4)
- d2-run ③: 契約の後に `genArchitectureDoc.js` も再生成する (C4 図に契約の矢印が無かった。0.1.13 ③-4)

### Fixed

- `genApiClient.js --check` を単体で流すと所有タグの有無が genContractTests の出力と食い違い stale になった (0.1.13 ④-4)。同じヘッダにする
- `genUseCases.js` が既存の `no_spec_reason` (blocked の理由) を引き継がず、再生成で validateUseCases が落ちた (0.1.13 ①)
- genSkeleton の `.gitignore` に qlty の作業ディレクトリ (`.qlty/logs` `out` `results` `plugin_cachedir` `sources`) を足す。`--migrate` も更新する (0.1.13 ③-5)

## [0.1.15] - 2026-09-26

0.1.13 のフル再実走 (`samples/distillery2/findings-0.1.13.md`) で分かったこと。

### Fixed

- 生成した契約テストの `biome-ignore-all format` は **biome 2.2.5 では効かない** (2.5.14 では効く)。ルート `biome.json` の `files.includes` に
  `!**/test/contract/**` を足して版に依らず外す (`!!` は 2.2.5 では `**` 入りを受け付けない)。`--migrate` は includes に足りない項目だけ足す
- d2-run ④: 全段の証跡を揃える `runGates.js` は `--tiers <関与ティア>` 付きで回す (省くと UC に関与しないティアの unit がテスト 0 件で落ちる)

## [0.1.14] - 2026-09-26

### Added

- **`genQlty.js --refresh`**: 既存の `.qlty/qlty.toml` に、いまの qlty の提案で増えたプラグインだけを足す (減らさない。上乗せと手編集は保持、冪等)。
  提案はその時点でリポにあるファイル種別で決まる (0.1.13 の実走では genQlty が npm install の前に走り lockfile が無く osv-scanner が抜けた)。
  d2-run は ③ の npm install の後と、④ の各 UC の integrate で全ゲートを回す前に回す (増えた plugins の指摘は static に出て、verify / review / as-built の前に直す) (ユーザー方針: 骨格を広げてから導入 + 実装後に提案を追加する段)

### Changed

- d2-run ③: design (packages/ui の取り込み) の後に `npm install` をもう一度 (workspace が増え lockfile を更新する。0.1.13 の実走で必要だった)

## [0.1.13] - 2026-09-26

0.1.10 フル再実走の課題 (`samples/distillery2/findings-0.1.10.md`) のうち、ゲートを止める 7 件と小さな修正 5 件。

### Fixed

- **基盤③**
  - genSkeleton: tsconfig の配列を biome の整形 (短い配列は 1 行) と同じ形で書く (③-1)。空の `src/index.ts` (`export {};`) を置き、
    `types: ["node"]` と `@types/node` を入れる (③-2)
  - d2-run ③ の順序を「骨格 → npm install → 契約の骨格 → 契約込みで genConfig / genCi を再生成 → design → 契約テスト」にする (③-3 / ③-5)
- **縦切り④**
  - runGates: contract ゲートは契約の提供側ティアだけに回す (消費側はテスト 0 件で vitest が exit 1 になっていた。④-1)
  - 生成する .ts (契約テスト・codegen・DB 契約テスト) の先頭に `biome-ignore-all format / lint` を置き、biome の整形・lint を丸ごと抑止する
    (埋め込み JSON を biome が展開して format_check が落ちた。④-2)。ルートの biome.json も生成物ディレクトリを `!!` で外す
  - genSkeleton: 単体 (`vitest.config.ts` = src/) と契約テスト (`vitest.contract.config.ts` = test/contract/) の設定を分ける (④-5)。
    `--migrate` が旧 `test:contract` を差し替える
  - scaffold.md: dry-run は `-p dryrun` プロファイルで (④-4)
  - prTrailers: `Basis-*` は base branch との merge-base から遡る (squash で消える branch 上の commit を指していた。④-6)。
    `--base <ref>` で起点指定、UC branch で変えた上流は `Basis-Changed` に出す。`--co-author` で Co-Authored-By を付ける (④-7)
  - d2-contract: 課題ドラフトは `issues/<ts>_<slug>.md` + front matter (`kind: contract`, `title`) (④-11)
  - models_resolved はモデル ID だけ。Verifier は報告 1 行目に `model: <ID>` を書き、d2-run が記録し直す。extractAsBuilt は注記が混ざっても最初の語だけ使う (④-12)
  - genSkeleton --migrate: .gitignore の管理ブロック更新が `.distillery/logs/` を取りこぼして毎回書き換わっていたのを直す
- **Codex レビュー (3 ラウンド、指摘 13 件) で直したもの**
  - 提供側ティアに仮の `src/test-app.ts` (`createTestApp(): never`) を置く (契約テストと api ドライバの import 先。③ の static チェックポイントで typecheck が通る)
  - runGates: 提供側が 1 つも無い config では contract ゲートを pass (検査対象なし)。provider の無い / tiers に無い契約エントリと空の `--tiers` は設定エラー
  - genCi の contract job も提供側だけ
  - prTrailers: `Basis-Changed` は index と base の差 (squash 手順の reset --soft の後でも出る)、`--base` の解決失敗はエラー、`Basis-Base` trailer (--strict で必須)。配送手順は `--base <base_head>` を渡す
  - `--migrate` が旧 vitest.config.ts / tsconfig / root の @types/node / biome.json の files.includes も移行する (手編集は据え置いて報告)

## [0.1.12] - 2026-09-25

### Changed

- **qlty のプラグイン選定を qlty 自身の提案優先にする** (ユーザー指摘: 固定リストではなく qlty の suggest を優先したい)
  - 新規 `genQlty.js` (F5 の最後): `qlty init --yes --dry-run` の出力を土台に distillery2 の上乗せ (biome 版固定・生成物の除外・
    `**/db/**` `**/config/**` は除外しない・lockfile 非除外・`features/**` を test・radarlint-* を low)。同じ入力に 2 回当てても同じ結果
  - qlty init は git 追跡済みファイルしか見ない (実測: 未追跡だと trufflehog しか提案されない) ので、未追跡ファイルを `git add -N` で
    一時的に index に載せて提案を取り、保存しておいた index ファイルをそのまま書き戻す (利用者の staged 変更を壊さない)。
    qlty CLI が無い / git 外 / dry-run や add -N が失敗なら固定リストにフォールバック (`--fallback` で強制)
  - `genSkeleton.js` は `.qlty/qlty.toml` を書かない (biome.json の $schema の版決めは共有: `existingBiomeVersion`)
  - 実測 (0.1.10 実走リポのコピー): 提案 9 plugins (actionlint / bandit / biome / osv-scanner / radarlint-python / ripgrep / ruff / trufflehog / zizmor)、
    上乗せ後のゲートで biome の指摘 0 件 (版固定前は 65 件)

## [0.1.11] - 2026-09-25

### Added

- **qlty を基盤に入れる** (ユーザー指摘: v1 同様 fmt / lint / test / SAST は qlty で。pkm の idea-implement のナレッジを移植)
  - `genSkeleton.js` が `.qlty/qlty.toml` を生成 (plugins: biome / radarlint-js / actionlint / zizmor / trufflehog / osv-scanner。
    生成物・vendored は `exclude_patterns`、コードスメルは `[[triage]]` で low)
  - `.distillery/config.yaml` に `commands.quality` (`qlty check --all --no-fix --no-progress --no-upgrade-check --no-formatters --fail-level medium`)。
    `runGates.js` の static ゲートがリポ全体で 1 回回す (config に無ければ skipped)。`genCi.js` は `qltysh/qlty-action/install` (SHA ピン) の後に同じコマンド
  - 規則を `docs/rules/common.md` と test-infra.md に焼き込む: `qlty check --fix` は使わない、整形は `qlty fmt --all`、無視は `[[ignore]]` / `[[triage]]`

### Changed

- `genCi.js`: zizmor の指摘に従い `permissions: contents: read` と checkout の `persist-credentials: false` を付ける
- 生成物・テンプレートが biome を通るように修正: `genContractTests.js` / `genRdbDdl.js` の補間の無いテンプレートリテラル、
  hooks.ts の非 null アサーション、world.ts の不要なコンストラクタ、tracer.ts の文字列連結と optional chain
- 既存リポ (package.json あり) では qlty の biome プラグインの版を lockfile / package.json の版に合わせる (Codex 指摘: 新規既定の 2.2.5 と食い違う)
- vitest を `^4.1.11` に (それ未満は CVE-2026-84373 (@vitest/mocker) が未修正で osv-scanner が止める)

## [0.1.10] - 2026-09-25

### Added

- **どのモデルで実行したかを残す** (ユーザー要望)。d2-run は run を開いた直後に `models_resolved` イベント
  (`{session, implementer, verifier}` の解決済みモデル名) を記録し、as-built の付録「生成情報」に
  「モデル: 実装 … / 検証 … / オーケストレータ …」を転記する。イベントが無い旧 run は config の設定値を
  「実行時の解決名は未記録」と明示して出す。セッション単位のモデルは `tokenReport.js` が transcript から集計する

## [0.1.9] - 2026-09-25

### Changed

- `docs/adr/architecture.md` のシステムコンテキスト図とコンテナ図を Mermaid の `graph` で描く (ユーザー指摘: C4Context / C4Container 記法はレンダラで崩れて読みづらい)。
  アクターは丸端の箱 (社外は「(社外)」を添える)、システムは subgraph、ティアは箱 (kind / lang と役割)、データストアは円筒、
  契約は consumer → provider のラベル付き辺。色は classDef (actor / system / tier / store / external)。内容と向きは変えない
- サンプルの `architecture.md` を再生成

## [0.1.8] - 2026-09-25

### Changed

- 辿りやすさの指摘 4 件 (ユーザー)
  - `docs/README.md` の「② 決定」: `adr/architecture.md` (C4 図) が無ければ「C4 図: 未生成 (d2-decide の genArchitectureDoc.js で生成)」と明示する (決めることに挙げた文書はリンクか未生成かを必ず書く)
  - `docs/rules/index.md`: 「ファイル | 対象」表を実在する (生成する) ファイルへのリンクにする (雛形の `tier-<kind>.md` ではなく `tier-backend.md` など)。`genRules.js` が `<!-- rules:files -->` を置き換える
  - as-built のデータフロー図の辺ラベルを `Read` / `Write` / `Read/Write` / `Publish` にする (旧: 読 / 書 / 読/書 / 発行)
  - `docs/as-built/_system/index.md`: 見出しを「実装の記録 (UC ごと)」にし、UC 名そのものをリンクにする (slug 列と「index」リンクをやめる)
- サンプル: `docs/adr/architecture.md` (C4 図) を 0.1.3 の `genArchitectureDoc.js` で生成、rules / as-built / README を再生成

## [0.1.7] - 2026-09-25

### Added

- **`docs/README.md` の生成** `scripts/genDocsReadme.js` (ユーザー要望: どこに何があるか覚えないと仕様を辿れない)。
  読者の問い 3 つ (どこに何があるか / この UC は上流のどれから来てどこまでできたか / 決めたことは何か) に、
  段階の表・UC 一覧 (業務 → UC の 1 行に 要求 → シナリオ → 契約 → 画面 → as-built) ・ADR / 非機能 / ルール / 契約 / 横断 で答える。
  既存の正本 (use-cases.yaml、requirements.yaml、features の @uc タグ、uc-index.yaml、screens.yaml、traceability-index、ADR の front matter) から
  決定論生成。d2-run が各段階の commit 前に実行する
  - 書くのは `<!-- distillery2:begin/end -->` の管理ブロックだけ。人が書いた部分は触らない。印の無い既存 README には末尾に足す
  - docs/ 直下の知らないディレクトリ・ファイルは「distillery2 以外の文書」に名前と入口だけ列挙 (消さない・要約しない)。
    知っているディレクトリの中で参照しなかった md も列挙
  - 実在するものだけ載せ、ブロック内のリンク切れは exit 1。`--check` で生成結果との一致 (ドリフト) を検査
- as-built の「入口」に上流へのリンク (要求 / シナリオ / 契約 slice) を追加。下流から上流へも辿れる

## [0.1.6] - 2026-09-25

### Changed

- **as-built の長い文をなくす** (ユーザー指摘: 長い文章の認知負荷が高い。テクニカルライティング、リストや表で伝える)
  - AssumptionRecord と findings に `title` (30 字以内・1 行) を必須にし、`validateAssumptions.js` が字数を検査する。
    as-built の「決めたこと」の表と「Verifier の指摘」の箇条書きには title だけを載せ、全文 (`assumption` / `claim`) は折りたたみに置く。
    `schema_version: "2.1"` で title 必須、`"2.0"` (0.1.5 以前の記録) は title 任意 (as-built は全文で代用)
  - 要約ブロック 3 つ (概要 / 整合性 / 課題) は**表で書く**ことに固定 (列と行を asbuilt-format.md に規定)。
    `checkAsBuilt.js` を追加し、空 / 表なし / セル 40 字超 (見出し行も) / 表の外の文 (長さを問わず) / 見出し を機械で検査する (d2-asbuilt の完了条件、d2-run の asbuilt 段階のゲート)
  - 抽出側: 受入基準は Given / When / Then を 3 行に分ける、「計装の範囲」はティアごとに 1 行。再抽出時に引き継いだ要約が
    書式違反なら標準出力で知らせる (旧形式の文章は d2-asbuilt が表に書き直す)
  - issues の `title` は 40 字以内 (課題の表に載る)
- サンプル: 前提 20 件・findings 22 件に title を追記 (hash 対象外なので sha256 は不変)、要約 3 ブロックを表に書き直して再抽出

## [0.1.5] - 2026-09-24

### Changed

- **as-built を読者の問いの順に組み替え** (ユーザー指摘: 認知負荷が高い)。`index.md` は 概要 (要約) → 結果 → 入口 → どう動くか →
  何を守るか (要約) → 決めたこと → 課題 (抽出 + 要約) → 証跡 → 付録。メタ情報・変更ファイルの全列挙・シナリオ表は
  付録の `<details>` へ、内部 ID (`spec_absent` / `auto_confirmed` / category / issue kind) は日本語へ、sha は 7 桁へ、
  シナリオ名の `slug#` は外す。前提は処遇 (人が承認 / 自動承認 / 却下) でグループ化し、Verifier の判定を「検証」列に統合
  (5 節のヒント・8 節の表・9 節の指摘の三重化を解消)。`coverage.md` は「証跡」に統合して廃止。要約ブロックは
  名前付き (`<!-- 要約:begin 概要|整合性|課題 -->`) にし、旧形式の名前無しブロックは順序で引き継ぐ
- **シーケンス図を e2e の入れ子で描く**: tracer v2 (`seq` / `parent` / `ts_end`) と `traceTree.js` で
  画面 → API → ユースケース → リポジトリ → DB の呼び出しの木を復元し、要求受信を DB クエリより前に描く
  (旧: 応答完了時に記録していたため順序が逆だった)。参加者は読める名前 (アクターは use-cases.yaml の actors、
  部品は component 名)、ティアが複数あれば `box` で囲む、連続する SELECT は 1 本にまとめる。index.md には正常系 1 本と
  分岐表だけを載せ、全シナリオは sequence.md
- **計装を部品ごとのティア・レイヤに**: `traced(name, obj, {tier, layer})` / `tracedFn` / `tracePg` / `tracePublisher` /
  `tracedFetch` が placement を受け、同一プロセスで複数ティアを動かす in-process 実行に対応。`expressScenarioMiddleware` は
  `x-scenario-span` ヘッダで HTTP 越しの親子を運ぶ。api ドライバに `asFetch(placement)` を追加し、step が frontend の
  画面ロジックを経由して backend を叩けるようにした (integrate.md: 入口は UC の最前のティアから、レイヤ境界は全部 `traced()` で包む)
- **計装の範囲を検出**: UC の `tiers` のうちトレースに現れないティアを「計装なし」として結果の表・標準出力・
  traceability-index の `instrumentation_gaps` に出す。d2-run の asbuilt 行はこれを integrate の結線漏れとして扱う

### Added

- **データフロー図** `renderDataFlow.js`: UC の全シナリオを合算した flowchart (アクター → ティアごとの部品 → テーブル / メッセージ。
  読み = 点線、書き = 太線) を index.md の「どう動くか」に、UC × テーブルの読み書き表と UC → テーブルの図を
  `_system/data-flow.md` に出す (traceability-index に `tables_rw`)
- tracer の実行テスト (`tracerSpans.test.js`: transpile して span の親子・開始順・ヘッダ伝播・エラー記録を実測)

## [0.1.4] - 2026-09-24

### Changed

- 実行記録 (headless 実行のプロンプト・起動スクリプト・完了報告ログ) の置き場を `.distillery/logs/` と定め、
  生成する `.gitignore` の管理ブロックで git 管理外にする。リポ直下に独自ディレクトリを作らない (run-state.md)

## [0.1.3] - 2026-09-24

### Added

- **C4 図 (決めたもの)**: `genArchitectureDoc.js` を追加。accepted な ADR (ティア構成 ADR の `tiers[]` /
  `datastore_owner` / 任意の `contexts[]`)・`contracts/contracts.json`・RDRA (`アクター.tsv` / `外部システム.tsv`)
  から `docs/adr/architecture.md` を決定論的に生成する。システムコンテキスト図 (Mermaid `C4Context`)・コンテナ図
  (`C4Container`、契約を consumer→provider のラベル付き辺 (C4 の uses は利用側→提供側) にし datastore_owner を明示)・コンテキストマップ
  (flowchart。`contexts[]` があるときだけ) を描く。d2-decide 手順 3 で `genAdrIndex` の前に走らせ、`index.md` から
  `architecture.md` へリンクする。決定領域に「コンテキストの境界」(任意の 9 番目) を追加。
- **C4 図 (実態)**: as-built 段階で `depcruise --output-type json` を撮り、`extractAsBuilt.js` の `dependency-graph.md`
  を「実態 (dependency-cruiser)」として描く。JSON が無いときは `.distillery/config.yaml` のティア・契約から
  「決定からの図」(契約の consumer→provider) を描き、実態か決定かを本文に明記する (ファイルを空にしない)。
- **ブランド方針**: ADR の `ui.brand` (`name` / `colors` / `typography` / `tone` / `source` / `confidence`) を追加。
  d2-decide は `brand` スキルがあれば走らせて (`source: brand skill`)、無ければ RDRA から推論 (`source: inferred`・
  `confidence: low`) して埋める。d2-design のトークンは `ui.brand` を起点にする (再推論しない)。`_review-summary.md`
  にブランドの由来を載せる。
- **アセット生成の復活**: `references/design/design-assets.md` を追加 (ロゴ SVG / ファビコン / アイコンセットの方針)。
  d2-design 手順 3.5 で `docs/design/storybook-app/src/assets/` に書き、F6 の `importUi.js` が `packages/ui/assets/`
  に取り込む (`src/` を丸ごとコピーするため設定変更不要)。
- **目視の証跡**: `captureStories.js` を追加。Storybook を静的ビルドし、`playwright` が対象リポで解決できれば
  headless chromium で各 Story を撮って `docs/design/screenshots/<StoryId>.png` と `index.md` を書く (exit 0)。
  playwright 無し / ビルド失敗 / Story 0 件 / chromium 起動・撮影失敗は exit 2 (目視未実施) を明示する。
  再撮影時は現行 Story ID に無い古い PNG を除いて証跡を実行履歴に依存させない。d2-design 手順 4 の目視確認で使う。

### Changed

- ADR スキーマ (`schema-adr.json`) に `contexts[]` と `ui.brand` / `ui.rendering` 等の型を追加。
- d2-run / d2-asbuilt の as-built 手順に depcruise JSON の生成を追記。

## [0.1.2] - 2026-09-24

### Changed

- `docs/rules/*.md` の生成構造を改善。ADR 由来のルールを平坦な箇条書きで並べるのをやめ、
  依存の向き (arch_test) は「アーキテストが強制する表」に、それ以外は「ADR 番号 + 題名の見出し」の下にまとめる。
  目次 (index.md) に各ファイルの読み方 (節ごとの読み方) を追記

## [0.1.1] - 2026-09-24

初回サンプル実走 (register-loan) で見つかった不具合の修正。

### Fixed

- **genSkeleton / importUi**: apps/*/package.json の scripts を実コマンド化 (`vitest run` / `tsc --noEmit -p .` / `biome lint .` / `biome format .`)。echo プレースホルダで静的ゲートが偽の pass になる問題を解消。root devDependencies に biome / @redocly/cli / json-schema-ref-parser を追加、frontend ティア時は react 系も追加。各 app に tsconfig.json / vitest.config.ts、root に biome.json を生成。importUi が packages/ui/package.json (@repo/ui) を書き npm workspace で解決可能に。
- **.gitignore**: `reports/` と `traces/` のみ除外し `attempt-*/` は追跡する (run-state.md と整合)。
- **cucumber 設定**: ESM の default export を既定プロファイルそのものにする (`{ default: {...} }` の二重包みを解消)。実装アプリ未生成でも `--dry-run` できる `dryrun` プロファイルを追加。
- **tracer**: sanitizeScenarioId に sha256 8 桁を接尾し、日本語シナリオ名が同一ファイルへ衝突する問題を解消。
- **消費側 API クライアント生成**: genApiClient.js を追加し、OpenAPI から types.ts / client.ts / server.ts を生成する (v1 の openapi-generator codegen の置き換え)。
- **genApiClient の型変換**: JSON Schema → TypeScript の境界ケースを正しく変換する。名前付き・インライン object の `allOf` を交差型 (`A & B & { ... }`) として保持し、既知プロパティと衝突する `additionalProperties` は index signature ではなく `{ ... } & Record<string, T>` にして TS2411 を回避。ハイフン等の識別子にできない path/query パラメータ名は `args["book-id"]` でアクセスし、`args.["book-id"]` の構文エラーを解消。
- **genSkeleton の app tsconfig**: `rootDir` を外し、契約テスト (`test/contract/*.test.ts`) 生成後も `tsc --noEmit -p .` が TS6059 を出さないようにする。frontend ティアがある場合は `jsdom` を root devDependencies へ追加 (frontend の vitest は `environment: 'jsdom'`)。
- **importUi の冪等化**: 既存の `packages/ui/package.json` は管理キー (`name` / `type` / `main`) だけ更新し、手編集した `exports` 等を保持する。`.imported.yaml` に `content_sha256` を持たせ、取り込み内容が同じなら `imported_at` を据え置いて再実行をバイト一致させる。
- **as-built**: 前提の処遇を tier + id で引き、別ティアの同 id が上書きする問題を解消。
- **prTrailers**: url が無い還流を `Feedback: rule:null` として出さない。
- **config**: verifier 既定を有効な model 別名 `opus` にする (`claude-opus-5` は model パラメータとして無効)。
- **d2-run ドキュメント**: サブエージェント報告の捏造禁止、clean-tree 判定の範囲、implementer/verifier のモデル解決を明記。
- **決定候補 / d2-design**: 単一 frontend を既定にし、d2-design が ADR の `ui:` ヒント (framework / SPA vs SSR) に従うようにする。

### 移行手順 (0.1.0 → 0.1.1)

0.1.0 で生成済みのプロジェクトは、リポジトリのルートで移行コマンドを 1 回実行する。

```bash
node <plugin>/skills/d2-foundation/scripts/genSkeleton.js --adr docs/adr --migrate
```

`--migrate` は次を行う。既存ファイルは書き換え対象を限定し、手編集は保持する。

- **不足ファイルの生成**: 0.1.0 に無かった各 app の `tsconfig.json` / `vitest.config.ts` と root の `biome.json` を新規作成する (既存は上書きしない)。
- **`.gitignore` の管理ブロック更新**: `# distillery2 実行状態` から始まる管理ブロックを最新化し、`.distillery/runs/*/attempt-*/` の除外を外す (attempt は成果物として追跡する)。
- **app package.json の実コマンド化**: `apps/*/package.json` の scripts が 0.1.0 の echo プレースホルダと完全一致する場合だけ、実コマンド (`vitest run` / `tsc --noEmit -p .` / `biome lint .` / `biome format .`) へ差し替える。手編集済みの script は触らない。
- **変更の報告**: 変更したファイルと内容を標準出力へ列挙する。

移行後は `npm install` で追加依存 (frontend では `jsdom`) を取得する。

## [0.1.0] - 2026-09-23

初版。distillery + distillery-impl の再設計。UC 1 つの縦切りが通る範囲を対象にする。

### Added

- 共有ライブラリ `scripts/lib/` (yaml / canonicalJson / schemaValidate / basis / gherkin / resolveDep / runState)
- `scripts/runGates.js` (5 ゲートを安い順に実行)、`scripts/prTrailers.js`、`scripts/tokenReport.js`
- `d2-run`: オーケストレータ (段階の振り分け、派遣テンプレート、実行状態、git 配送、還流の分類)
- `d2-requirements`: v1 dist-requirements を移植。events/latest を廃止し `docs/requirements/` に直接書く。`use-cases.yaml` を新設
- `d2-decide`: v1 dist-quality-attributes を移植。ADR (機械可読 `rules[]`、`tiers[]`) と決定候補カタログを新設。設計 yaml は書かない
- `d2-foundation`: rules 生成、依存方向のアーキテスト、テスト基盤 (計装 tracer、pglite、Cucumber support)、config、CI、骨格、Storybook 取り込み
- `d2-design`: v1 dist-design-system を移植。`screens.yaml` に集約
- `d2-contract`: v1 dist-spec の契約部分を移植。`uc-index.yaml`、契約テストと DB migration の生成、examples 必須
- `d2-implement`: scenario / scaffold / tier / integrate の 4 mode。AssumptionRecord と検証器を v1 から移植
- `d2-verify`: 2 観点 (UC の意図、前提の整合) に縮小。テストを再実行しない
- `d2-asbuilt`: 実装からの文書抽出 (抽出 / 要約の分離、追跡表、シーケンス図)
- `agents/d2-verifier.md`

### 未対応 (今後の版で)

harvest、リリース後の 3 入口、ドリフト検知、`@browser` の既定 on、プロセスをまたぐトレース、KVS 契約
