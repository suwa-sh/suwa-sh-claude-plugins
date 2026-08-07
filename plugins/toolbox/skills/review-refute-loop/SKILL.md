---
name: toolbox:review-refute-loop
description: git diff / プラン / 直近の成果物を、実行中とは別系統のコーディングエージェント (Claude Code 実行時は Codex、Codex 実行時は Claude Code) に第三者レビューさせ、各指摘をまず自分で吟味 (反証) してから、反証しきれないものだけ修正し、再レビューで収束するまで最大 3 ラウンド繰り返すスキル。「外部レビューして」「セカンドオピニオン」「指摘を反証して」「ファクトチェックしてほしい」「この diff/プランをレビューに投げて」と言われたら発動。
---

# review-refute-loop

## このスキルが解く問題

外部レビュアーを呼んで終わり、にしない。**レビュアーの指摘を鵜呑みにせず、実行中エージェントが自分の文脈を使って一度反証する**。反証しきれないものだけ修正する。修正後、再度レビュアーを回して残課題ゼロを確かめる。

- 自分と同じモデルの内製レビュー (`/code-review` 等) では「同じモデルの盲点」が残る
- そこで **実行中エージェントとは別系統のエージェントをレビュアーに使う** (クロスモデルレビュー)
- レビュアーには network アクセスを持たせ、`curl` / `gh` による一次情報照合まで自走させる
- レビュアーがワークスペースを書き換え得る場合は、プロンプトで「変更禁止・指摘のみ」を必ず明示する

## レビュアーの選択

**実行中のコーディングエージェントが何かで、レビュアーを切り替える**:

| 実行中エージェント | レビュアー | 呼び出し方 |
|---|---|---|
| Claude Code (または Codex 以外) | **Codex** | 親セッションから codex companion `task --background --write --fresh --prompt-file` を直接起動 (後述テンプレ A) |
| Codex | **Claude Code** | `claude -p` (後述テンプレ B) |

### 呼び出し経路の不変条件

Claude Code から Codex を呼ぶ場合は、以下をすべて守る。1 つでも満たせない場合はテンプレ C にフォールバックする。

- **Agent / Task ツール、`codex:codex-rescue`、`/codex:rescue` を経由しない**。これらは `--background` を除去して foreground 実行し、サブエージェントの約 10 分上限で Codex の turn を `turn_aborted` にする実績がある
- 本スキルがサブエージェント内で発動していると判明したらテンプレ A を実行しない。親セッションへ直接実行を返せる場合は返し、返せない非対話実行ではテンプレ C を 1 回だけ使って、それ以上ネストしない
- 起動・監視・回収は **Claude の親セッション自身**が行う。ジョブが `queued` / `running` の間は最終回答を返さず、親セッションを終了しない
- プロンプト本文を Bash の位置引数やダブルクォートへ展開しない。バッククォートや `$()` の誤実行を防ぐため、必ず `--prompt-file` で渡す
- `.tmp/review-refute-loop/round1.md` のような固定パスを使わない。同じ repository で並行する別セッションと prompt / result が衝突するため、起動ごとに `mktemp -d` で一意の review directory を作る
- `status=running` だけを生存根拠にしない。PID、ジョブログの更新時刻、rollout の `turn_aborted` を併せて判定する
- `completed` かつ出力契約を満たす結果だけをレビュー成功とする。途中の commentary や調査ログはレビュー結果として扱わない

外部 CLI が動かない場合 (未インストール / 認証不可 / ハング / 2 回試して失敗) は **サブエージェントにフォールバック**:

- 実行中エージェント自身のサブエージェント機構 (Claude Code なら Agent/Task ツールの general-purpose、Codex なら spawn agent) で、同じレビュープロンプトを **fresh context** で実行する
- クロスモデルの盲点除去効果は失われる (fresh context の第三者視点のみ)。最終サマリでその旨をユーザーに明示すること

## ワークフロー (全体像)

1. レビュー対象を確定する
2. レビュアーに第三者レビューを依頼 (1 ラウンド目)
3. 指摘を一件ずつ吟味 → **REFUTED / ACCEPTED / NEEDS_INFO** に分類
4. 分類結果をユーザーに表で見せる
5. ACCEPTED のものを修正
6. レビュアーに再レビューを依頼 (2 ラウンド目以降)
7. 収束したら最終サマリをユーザーに報告

**収束ループが既定**: 「ACCEPTED を修正 → 再レビュー → 新規指摘を反証 → 反証しきれないものを修正 → …」を、**No findings になるか、そのラウンドの指摘がすべて REFUTED になるまで**繰り返す。レビューは上限 **3 ラウンド**。NEEDS_INFO だけが残ったら `terminal-unresolved` として停止する。3 ラウンド目の ACCEPTED は修正・ローカル検証まで行い、外部再レビュー未実施として残課題に明記する。

ユーザー承認の扱い:

- 対話セッションでは Step 4 → 5 の境目で **修正前に 1 回だけ** 承認を挟む
- ユーザーが「収束するまで確認不要」「自律的に進めて」と言った場合、または非対話 (agent-loop worker 等) で呼ばれた場合は承認待ちをスキップし、分類表は**報告だけ**して修正に進む
- NEEDS_INFO は自律モードでも勝手に ACCEPTED 扱いしない。ACCEPTED が併存すればそれだけ修正して次ラウンドへ進み、NEEDS_INFO しかなければ `terminal-unresolved` として最終サマリに積む
- 各ラウンドの修正は再レビュー前にテスト等で検証する (壊れた状態で投げない)。コミットはユーザーが求めた場合・既存ワークフローで合意済みの場合のみ (対象が URL やプランならそもそもコミットは無い)

---

## Step 1. レビュー対象の確定

引数や直前の会話文脈から決める。優先順位:

1. 引数で明示されたパス・URL があればそれ
2. 直前の会話で「このプラン」「さっき作った記事」など参照対象が明確ならそれ
3. それ以外は `git diff HEAD` (staged + unstaged の未コミット変更全体。引数なし `git diff` は staged を含まないので使わない。untracked は `git status --short` から明示的に拾う)
4. branch が main/master でなく diff が空なら `git diff <base>...HEAD`

確定したら **何をレビュアーに見せるか** をユーザーに一言通知する。例:
> 「`notes/zenn/articles/foo.md` を Codex でレビューします」
> 「現在の作業ツリー差分 (12 ファイル) を Claude Code でレビューします」

対象が巨大なとき (>30 ファイル, >5000 行 diff) は範囲を切るか確認する。

## Step 2. レビュープロンプト (共通)

レビュアーが何であれ、最初に一意の作業ディレクトリを作り、その絶対パスを以後の全ラウンドで保持する。固定の `.tmp/review-refute-loop/roundN.md` は並行セッションで上書きされる実績があるため禁止。

```bash
REVIEW_DIR="$(mktemp -d "${TMPDIR:-/tmp}/review-refute-loop.XXXXXX")" || exit 1
test -d "$REVIEW_DIR" || exit 1
printf '%s\n' "$REVIEW_DIR"
```

**Write ツールで `$REVIEW_DIR/prompt-round1.md` に書き出してから**呼び出しに渡す (長いヒアドキュメントは Bash ツールの tool call parse エラーを誘発するため禁止)。別の Bash 呼び出しでは変数が保持されないことがあるので、最初の出力で得た絶対パスをそのまま使う。

```markdown
あなたはシニアレビュアー。以下の対象を第三者視点でレビューしてください。

【対象】
<対象の説明と、レビュー範囲。diff の場合はそのまま貼る or `cd <repo> && git diff HEAD` を実行させる。untracked が対象ならパスを列挙して直接読ませる>

【あなたの権限】
- シェルと network アクセスあり
- 必要なら `curl` / `gh` / `git log` / `rg` を使って一次情報まで確認してよい
- ただし **ファイルの追記・編集・削除は禁止**。指摘のみ。

【出力形式 (厳守)】
各指摘を以下の構造で番号付きリストとして出してください。Markdown。

### 指摘 N
- **対象**: <file:line, URL, セクション名 など>
- **severity**: critical | high | medium | low | nit
- **claim**: 何が問題か(1-2 文)
- **evidence**: なぜそう言えるか。一次情報の引用・URL・実行結果を含めること
- **suggested_fix**: どう直すべきかの案(任意)

指摘がない場合は明示的に "No findings." と書くこと。

【重要な制約】
- あなた自身がレビューを完結させること。**サブエージェント・別セッション・スキル
  (review-refute-loop 等) によるクロスレビューの起動は禁止** (待ち合わせでスタックする実績あり)。
- 調査は **8 分以内**で切り上げ、その時点の指摘を必ず【出力形式】で直接出力して終了すること。
- 8 分で全件を確認できない場合も無回答で終わらず、確認済みの指摘を出し、未確認範囲を最後に明記すること。
```

> 【重要な制約】ブロックは省略禁止。レビュアー (特に Codex) はプロンプト中の「review-refute-loop」
> という文脈につられて自前のクロスレビューを起動し、その完了待ちで無期限スタックすることがある
> (2026-07 実績: 96 分無活動)。

8 分で扱えない大きさ (目安: 30 ファイル、5000 行、独立した検証項目 20 件超) は、起動前に独立範囲へ分割する。1 ジョブに「20〜30 分調査して最後に一括回答」を要求しない。

出力は `$REVIEW_DIR/round1.md` のように保存する。ユーザーへの提示と再レビュー時の参照に使い、最終報告まで削除しない。

**レビュー開始前の共通手順 (テンプレ A/B 共通)**: レビュアーは書き込み能力を持ち得る。可能なら実ワークスペースを渡さず、`$REVIEW_DIR/input/` に対象のコピーまたは diff を置き、runner の cwd も `$REVIEW_DIR` にする。URL・プラン・単体文書・Git 管理外パスはこの隔離方式を既定とする。

リポジトリ全体の検索や `git log` が必要で実ワークスペースを見せる場合だけ、開始前の状態をワークスペース外へ退避する。これは暴走時の切り分け用であり、binary や ignored file を含む完全バックアップではない。レビュー対象の untracked・ignored・外部ファイルは実体もコピーし、必要な binary は `git diff --binary HEAD` で保全する:

```bash
mkdir -p "$REVIEW_DIR/pre-review"
git diff HEAD > "$REVIEW_DIR/pre-review/pre-review.diff"
git diff --binary HEAD > "$REVIEW_DIR/pre-review/pre-review-binary.diff"
git status --short > "$REVIEW_DIR/pre-review/pre-review-status.txt"
# レビュー対象の untracked / ignored / 外部ファイルは cp で実体も退避する
```

### テンプレ A: Codex を呼ぶ (実行中が Claude Code 等の場合)

**このテンプレートだけが正規経路**。Agent / Task ツールや `codex:codex-rescue` にプロンプトを渡してはならない。

同梱スクリプトを使う。companion の版解決、`--background --write --fresh --prompt-file` の固定、PID / log mtime / `turn_aborted` の状態確認、結果の出力契約検証をスクリプトに集約している。

```bash
# SKILL_DIR には、このスキル読込時に表示された "Base directory for this skill" の絶対パスを入れる
SKILL_DIR="<Base directory for this skill>"
RUNNER="$SKILL_DIR/scripts/codex-review-job.sh"
REVIEW_CWD="$REVIEW_DIR"  # 隔離コピーが既定
# リポジトリ全体の検索が必要な場合だけ: REVIEW_CWD="$PWD"

# 起動。標準出力は job ID だけ。失敗や空 job ID はその場で打ち切る
JOB_ID="$("$RUNNER" start "$REVIEW_DIR/prompt-round1.md" "$REVIEW_CWD")" || exit 1
test -n "$JOB_ID" || exit 1

# 親セッションから 30〜60 秒ごとに確認。verdict だけを分岐に使う
"$RUNNER" status "$JOB_ID" "$REVIEW_CWD"

# verdict=done を検知した同じ親セッション内で直ちに回収。出力契約不一致なら非ゼロ終了
"$RUNNER" result "$JOB_ID" "$REVIEW_DIR/round1.md" "$REVIEW_CWD"
```

- `status` の JSON は `verdict` を返す。`done` なら同一親セッション内で直ちに `result`、`healthy` なら待機、`stuck` / `failed` / `timed_out` なら `cancel`、`unknown` なら 1 回だけ再確認して変わらなければ `cancel` する。個別の `pid_alive` / age / `turn_aborted` を親が再解釈しない
- `cancel` は companion の成功だけを信用せず、起動時の process group が停止したことを確認し、必要なら KILL してから lock を解放する。非ゼロなら 1 回だけ `status` を再確認する。`done` なら競合で完了したので lock を保持したまま `result`、`failed` / `cancelled` なら終了、それ以外は lock を保持して失敗として報告する
- runner は job 作成から 600 秒を polling deadline とし、`status` で超過した active job を `timed_out` と判定する。これは watchdog ではないため、親セッションは必ず `cancel` まで実行する。プロンプトの調査予算 480 秒に最終回答生成用 120 秒を加えた値である。途中成果を salvage して `cancel` し、再起動は 1 回までにする
- completed ジョブも Claude の SessionEnd で companion のインデックスから削除される。`done` を検知してから親セッションを終えず、必ず先に `roundN.md` へ回収する
- 再起動も失敗したらテンプレ C にフォールバックする。同じ壊れたジョブを待ち続けたり、3 回以上起動したりしない
- **前景の `task --write` (`--background` なし) は使わない**。Bash / サブエージェントの実行上限で `turn_aborted` になり空振りする
- `--write` (workspace-write) は **ファイル書込サンドボックスの切替であって、network 解放ではない**。シェルの `curl` / `gh` を通すには `~/.codex/config.toml` に `[sandbox_workspace_write]` `network_access = true` が必要 (未設定でも Codex 内蔵の web 検索は動くが、`gh` / `curl` は失敗する)。一次照合を期待するなら起動前に設定を確認する
- ファイル変更禁止はプロンプトで縛る。`--fresh` で前セッションを引きずらない
- 待機は 1 回の Bash 内で長時間ループさせない。親エージェントが短い `status` 呼び出しを繰り返し、その間もユーザーへ進捗を通知する

### テンプレ B: Claude Code を呼ぶ (実行中が Codex の場合)

```bash
# preflight: 認証を先に確認。失敗したら以降を実行せず、2 回粘らず即テンプレ C へ
if ! claude auth status; then
  echo "claude 未認証 → テンプレ C にフォールバック"
  exit 1   # ここで打ち切る (|| echo で続行しない)
fi

# SKILL_DIR には、このスキル読込時に表示された "Base directory for this skill" の絶対パスを入れる
SKILL_DIR="<Base directory for this skill>"
RUNNER="$SKILL_DIR/scripts/claude-review-job.sh"
REVIEW_CWD="$REVIEW_DIR"  # 隔離コピーが既定
# リポジトリ全体の検索が必要な場合だけ: REVIEW_CWD="$PWD"
JOB_ID="$("$RUNNER" start "$REVIEW_DIR/prompt-round1.md" "$REVIEW_DIR/round1.md" "$REVIEW_CWD")" || exit 1
test -n "$JOB_ID" || exit 1

# 親セッションから 30〜60 秒ごとに確認。done なら result、timed_out/stuck/failed なら cancel → テンプレ C
"$RUNNER" status "$JOB_ID"
"$RUNNER" result "$JOB_ID"
```

- **`--allowedTools` は自動承認リストであって制限リストではない** (未指定ツールも permission mode 次第で許可され得る)。ツールレベルでファイル変更を縛るのは `--disallowedTools "Write,Edit,NotebookEdit"`。Bash 経由の書き込みは残るので、プロンプトの「ファイル変更禁止」も必須
- runner は `--safe-mode`、`--disable-slash-commands` と tool 制約を固定する。Claude 側の hooks / MCP / CLAUDE.md を隔離して再帰や SessionEnd による worker 巻き込みを防ぎ、PID、exit code、600 秒の polling deadline、出力契約を統合して管理する。prompt は stdin で渡し、stdout と stderr は分離する。親は前景 `claude -p` を直接待たず、`timed_out` を検知したら必ず `cancel` する
- **`--disable-slash-commands` を省略しない**。レビュー対象やプロンプトに `review-refute-loop` が含まれると、Claude 側レビュアーが同スキルを再発火して再帰し、exit 0・空出力になる実績がある
- サンドボックス内 (Codex から呼ぶ場合) は keychain 遮断で `claude` が未認証に見えることがある。preflight で検出したら即フォールバック
- `healthy` の間は親が 30〜60 秒ごとに短く status を確認し、ユーザーへ進捗を通知する。`timed_out` / `stuck` / `failed` は `cancel` 後にテンプレ C へフォールバックする

### テンプレ C: サブエージェントフォールバック

外部 CLI が 2 回試して動かないとき、またはテンプレ B の preflight (認証確認) が失敗したとき (この場合は再試行せず即フォールバック)。実行中エージェントのサブエージェント機構で、Step 2 冒頭の共通プロンプトを fresh context で実行させる。

- Claude Code: Agent ツール (general-purpose) にプロンプトを渡し、最終テキストとして指摘リストを返させる
- Codex: サブエージェント / spawn agent 相当で同様に
- レビュアーが自分と同系統になった事実を `$REVIEW_DIR/roundN.md` の冒頭と最終サマリに記録する

### 複数対象 (PR 群など) のレビュー

「PR #18 / #19 / #20 をそれぞれレビュー」のように独立した対象が複数ある場合:

- **同じ workspace root の companion job は直列実行する**。companion 1.0.4 の state 更新は排他制御のない read-modify-write であり、並行 worker が別 job の state / job file / log を消す競合がある
- runner は canonical workspace root 単位の atomic directory lock を取得し、別セッションからの同時 `start` も拒否する。起動失敗・`result` 成功・停止確認済みの `cancel` で解放する。既存 job が明示的に `failed` / `cancelled` かつ記録済み process group の停止も確認できた場合だけ stale lock を自動回収し、unknown・status 取得失敗・停止未確認では安全側に倒して lock を保持する
- 対象ごとに同じ一意な `$REVIEW_DIR` 内で prompt / result 名を分け、1 件ずつ `start → status → result` を完了させる。出力は `round1-pr18.md` のように対象別に保存する
- 並列化が必要なら対象ごとに別 worktree / workspace root を用意し、companion の state directory も分離する。同一 workspace のまま出力パスだけ分けても不十分
- **`git checkout` / `git switch` を必ず禁止事項に明示する**。並列レビュアーが同一作業ツリーを共有するため、checkout されると他のレビューが壊れる。PR は checkout せずに `gh pr diff <N>` で差分、`git show origin/<branch>:<path>` でファイル全体を参照させる
- 積み上げ PR (base が別 PR のブランチ) は「この PR 自体の差分だけをレビューする」ことと base ブランチ名をプロンプトに明記する

---

## Step 3. 各指摘の反証 (Refute フェーズ)

ここがこのスキルの核。レビュアーの指摘を **一件ずつ** 評価する。実行中エージェントは対象コード/ドキュメントの文脈、過去の会話、プロジェクトの慣習をレビュアーより把握しているので、レビュアーがそれを取り違えた指摘は反証できる。

各指摘について、以下の 3 択で分類する:

- **REFUTED** — 反証できる。理由を 1-2 文で書く。例:
  - 「レビュアーは `foo()` が未定義と言うが、`utils/legacy.ts:42` で定義されており検索が漏れている」
  - 「レビュアーは古い API 仕様を引いている。Context7 で確認した最新仕様では本コードが正しい」
  - 「レビュアーは『テストが無い』と言うが、テスト不要の手順書 (md) を対象にしているため対象外」
- **ACCEPTED** — 反証できない。修正が必要。修正方針も書く
- **NEEDS_INFO** — 単独では判断できない。ユーザーに聞くか、追加調査が必要。理由を書く

判断時の自戒:

- **「レビュアーが言うから正しい」も「面倒だから refuted にする」もダメ**。両方とも検証コストを払わずに済ませている
- severity が high/critical の指摘は反証根拠を厚めに。「念のため受け入れて修正」も選択肢
- nit は基本 ACCEPTED でよい(コストが低い)が、スタイルポリシーと衝突するなら REFUTED
- 一次情報 (URL, ファイル) で確認できるものは確認する。レビュアーの `evidence` 欄をそのまま信じない

## Step 4. ユーザーへの提示

分類結果を表でまとめてユーザーに見せる。例:

```
| # | severity | 対象 | 分類 | 反証/対応方針 |
|---|----------|------|------|---------------|
| 1 | high     | foo.ts:42 | REFUTED  | utils/legacy.ts で定義済み |
| 2 | medium   | bar.md L80 | ACCEPTED | 出典 URL を <…> に差し替え |
| 3 | low      | baz.py    | NEEDS_INFO | このフラグの意図を確認したい |
```

その上で:
> 「ACCEPTED 2 件を修正します。NEEDS_INFO の #3 は ◯◯ を教えてもらえますか?」

対話セッションではユーザーの承認 (または NEEDS_INFO への回答) を待ってから Step 5 へ。自律モードでは承認を待たず、表を報告してそのまま Step 5 に進む。

反証の根拠固めはレビュアーの evidence を鵜呑みにせず自分でも確認する。特に:

- 「この PR の退行」と言われたら **その箇所が本当にこの diff で変わったか** を `gh pr diff <N>` / `git show <base>:<path>` で確認する。既存挙動ならスコープ外として REFUTED 候補
- 「ドキュメントに明記済みの意図的トレードオフ」は REFUTED の典型パターン

## Step 5. 修正

ACCEPTED の指摘を順に適用する。普通の編集作業。修正後の git diff を簡潔に報告。

NEEDS_INFO はユーザーの回答に応じて REFUTED か ACCEPTED に再分類してから扱う。

## Step 6. 再レビュー (2 ラウンド目以降)

Step 2 と同じテンプレで再度レビュアーを呼ぶ。プロンプトに **前ラウンドの指摘リストを添付** し、

> 「以下が前回の指摘です。修正後の現在の状態で、(a) 残っている指摘 (b) 修正によって新たに生じた問題 を出してください。重複指摘は不要。」

を加える。これで「同じことを蒸し返す」を抑制し、回帰だけ拾える。REFUTED にした指摘は「対応せず (反証): <理由>」として添付し、再反論は新たな一次情報がある場合のみ受け付けると明記する。

出力は同じ一意な `$REVIEW_DIR/round2.md` に保存。新規指摘は Step 3 と同様に反証する。

- 1〜2 ラウンド目: ACCEPTED を修正・ローカル検証して次ラウンドへ進む
- 3 ラウンド目: ACCEPTED を修正・ローカル検証するが、外部再レビュー未実施として最終サマリの残課題に載せる
- NEEDS_INFO のみ: 同じ指摘を再レビューせず `terminal-unresolved` で停止する
- No findings または全件 REFUTED: 収束として停止する

## Step 7. 最終サマリ

ユーザーへ:

- 各ラウンド: 指摘 N 件 → REFUTED M / ACCEPTED K / NEEDS_INFO J
- 修正: 計 K 件適用
- 最終ラウンド: 残課題 X 件 (内訳: 新規 Y / 再掲 Z)
- 残課題があれば一件ずつ簡潔に列挙し、対応するか・残すかをユーザーに委ねる
- サブエージェントフォールバックを使った場合は、クロスモデルレビューでなかった旨を明記

`$REVIEW_DIR/round*.md` の絶対パスも添えると後で見返せる。

---

## 注意事項

- **レビュアーが暴走してファイルを書き換えたら**: 開始前 snapshot と突き合わせ、**レビュアー由来の hunk だけを Edit で戻す**。`git checkout -- <path>` は自分の未コミット変更ごと消すので使わない。binary・untracked・ignored は diff だけでは復旧できないため、退避した実体から対象だけ戻す。再発するなら実ワークスペースを渡さず、隔離コピーまたは diff 本文だけをレビューさせる
- **Codex が無反応 / タイムアウト**: ①`--background` (または nohup) で起動しているか、②companion のパスが変わっていないか (`ls ~/.claude/plugins/cache/openai-codex/codex/`) を確認
- **companion `status` の running 表示を信用しない (スタック検知)**: Codex runner は PID、ジョブログと最新 rollout の mtime、最新 terminal event、job の総経過時間を統合して `verdict` を返す。親は `verdict` だけを見る。ジョブログと rollout のどちらも 300 秒以上更新されない場合を `stuck`、active のまま総経過 600 秒以上なら `timed_out` とする。Claude runner は text 出力が完了まで更新されないため PID・exit code・総経過時間で判定する。どちらも `timed_out` は自動停止ではないので親が `cancel` する
- **スタックしたジョブの途中成果の回収**: rollout JSONL の `agent_message` を抽出すれば、最終出力前
  でも「どこまで照合したか」(例: `go test -race` 通過済み等) を salvage できる。再起動プロンプトの
  重複調査の削減に使える
- **claude -p が動かない**: `which claude` で CLI の有無を確認。無ければテンプレ C にフォールバック
- **Agent / Task / rescue 経路は使わない**。`codex:codex-rescue` は `--background` を除去するため約 10 分上限で foreground Codex が中断される。`/codex:rescue` は read-only で外部通信も不足する。Claude Code からは必ず親セッションがテンプレ A を直接実行する
- **テストを書く類の指摘**: レビュアーが「テストを追加すべき」と言ってきても、対象がドキュメントや一発スクリプトなら REFUTED で良い。コード本体なら ACCEPTED 候補
- **トークン消費**: レビュアーは別プロセスで走るため実行中エージェント側コンテキストは食わないが、stdout を全文 Read すると食う。要点だけ取って `$REVIEW_DIR/round*.md` に逃がす
- **旧名**: このスキルは `codex-refute` からのリネーム。過去の journal / 実施記録に出てくる `codex-refute` は本スキルの旧名を指す
