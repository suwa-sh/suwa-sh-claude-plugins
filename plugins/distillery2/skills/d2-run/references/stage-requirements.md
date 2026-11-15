# ① 要求

要望テキストから要求を作り、人の承認を得て commit する。

| 順 | すること |
|---|---|
| 1 | 要望テキストを写し、要求担当を派遣する |
| 2 | 引き継ぎファイルを処理し、要求のレビューを回し、確認ページを作る |
| 3 | 承認されたら commit する。差し戻しなら 1 に戻る |

1. 要望テキストを `docs/input/要望-<YYYYMMDD>.md` に写す (本文で渡されたときも、リポの外のファイルで渡されたときも。要求の入力の正本として 3 の commit に入る。要求のレビューが縦の整合を見る相手)。sub `d2-requirements` (input=<写したファイルのパス>) を派遣する
2. 引き継ぎファイルを処理し、要求のレビュー (routing.md。`--point requirements`) を回す。その後 `docs/requirements/_review-summary.md` を材料に human-html-review で確認ページを作る
   (UC 一覧、業務ルール、状態遷移、受入基準、人に返す問い、レビューの結果。判断は「この要求で進めてよいか / 直す点」。auto でも必ず人に返す。recommend は推奨で承認して記録)
3. 承認されたら `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A -- docs .distillery ':(exclude).distillery/logs' && git commit -m "req: initial requirements" -m "<attribution 行>"` で commit する。差し戻しなら指摘を input に足して 1 に戻る

手順 3 の commit には、引き継ぎファイル、決めたことの記録、レビューの結果も入れる。
`.distillery/logs/` は入れない。
`.gitignore` は基盤の段で初めて作られるので、それまでは pathspec で外す。

## 要求の差分 (未処理の要求の課題があるとき)

UC の実装で見つかった要求の穴 (戻し先が requirements の課題ファイル) を要求に反映する。
自動選択の `requirements-diff` で入る (`stage=requirements` の直接指定も同じ)。

既存の持ち越し (0.1.30〜0.1.31 形式の残った作業: `FB scan` の `carry_over_rows` (`use-cases.yaml` の `carry_over` の行) と `carry_over_pending`) が残っているときは、要求の課題が 0 件でも入る (3 で宛先へ流す)。

| 順 | すること |
|---|---|
| 1 | 一時の branch を切り、既存の持ち越しを控える |
| 2 | 要求担当を派遣し、報告の 3 つの欄を控え、要求のレビューを回す |
| 3 | 確認ページを作る。承認は一括 |
| 4 | 承認されたら、残った作業を宛先に流し、commit して main へ確定する |
| 5 | 上流で止めた UC の feature は消さない |
| 6 | 決定と契約への波及を見つけ、完了報告に載せる |
| 7 | 自動選択をもう一度呼んで続ける |

### 手順 1: branch と、既存の持ち越しの控え

1. 前提: 進行中の UC が無い。routing.md「上流の差分の branch」の 1 で一時の branch を切る (以降の commit はこの branch に入れ、4 の後に main へ確定する)。
   **既存の持ち越しを先に控える**: `FB scan` の `carry_over_rows` (slug と items) と `carry_over_pending` (slug と items) を 3 の材料として書き留める

控える理由: 2 の再生成は `carry_over` の行を引き継がず消すので、2 の後には読めない。
要求担当の差分更新も `genUseCases.js` も、同じく消す。

### 手順 2: 要求担当の派遣

2. sub `d2-requirements` (`input=<feedbackBatch.js scan の upstream.requirements と requirement_all の課題ファイルのパス (すべて)>`。差分更新)。課題の本文は自分では読まない。

報告の次の 3 つの欄を、3 の材料に控える。

| 欄 | 中身 |
|---|---|
| 「残った作業」 | 要求担当の write-set の外で必要になった作業。種類 `design` / `assumption` と対象付き |
| 「決定と違う反映」 | 課題の決定と違う反映にした課題・決定・実際の反映・理由 |
| 「仮に決めた反映」 | 課題に決定が無く要求担当が案を選んだもの: 課題・選んだ案・理由。課題の決定の外の論点を要求担当が選んだもの: 課題・論点・選んだ案・理由 |

決めずに返した論点は引き継ぎファイルの問いとして routing.md で振り分ける。
続けて要求のレビュー (`--point requirements`) を回す。

`genUseCases.js` を d2-run が回す場合:

- 要求の課題が 0 件 (既存の持ち越しだけ) なら要求担当は派遣せず、`node <skills>/d2-requirements/scripts/genUseCases.js` を回して `use-cases.yaml` を再生成する (決定論。`carry_over` の行が消える。他の変更は無い)
- 要求担当を派遣した後も、1 で控えた `carry_over_rows` が空でなく `use-cases.yaml` に `carry_over` の行が残っていれば (要求担当が再生成しなかった)、3 の確認ページの前に `node <skills>/d2-requirements/scripts/genUseCases.js` を回す (`carry_over` の行が消える。要求が変わっていれば `spec_ids` も変わり得るので、確認ページはこの再生成の後の差分で作る)

### 手順 3: 確認ページ

3. ① と同じ材料で確認ページを作る (課題ごとに反映した要求・仕様を添える。auto でも必ず人に返す)。**承認は一括** (差分更新はインプレースなので、課題ごとに切り分けられない)。

加えて載せるもの:

- **「決定と違う反映」** (課題ごとに決定・反映・理由。無ければ「なし」。違いを戻すなら「直す点」で 2 から)
- **「仮に決めた反映」** (課題ごとに選んだ案・理由。無ければ「なし」。「決定と違う反映」と並べて載せる。課題の決定の外の論点は論点も添える。違う案にするなら「直す点」で 2 から)
- **「残った作業」** を種類ごとに載せ、1 件ずつ「**対応する / 無視**」で聞く (「次の UC で拾う」は無い)
- **やり直す UC**: 要求担当の反映の後の作業ツリーで `FB scan` を回し、`uncovered_done` の UC ごとに網羅されていない受入基準を載せる。「やり直す / 後で」で聞く (下の「やり直し」の節)

「残った作業」の載せ方:

- `design` (画面の見本): 要求担当の報告の項目。項目のファイルは `docs/design/storybook-app/src/<相対パス>` で指す。報告が `packages/ui/<相対パス>` (取り込み先) で書いていたら `docs/design/storybook-app/src/<相対パス>` に読み替え、実在を確かめる。無ければ「対応づけられない」と出して派遣しない (人は無視を選ぶ)。
  対応づいた項目の推奨 (初期選択) は「対応する」(要求担当が要求の変更に合わせて必要とした作業なので)。「無視」の横に影響を書く: 要求と画面の見本が食い違ったまま次の UC に入り、そのシナリオか実装で同じ課題がまた出る見込み (既存の持ち越しを `design` に振る項目も同じ)
- `assumption` (前提の記録を閉じる): UC の slug・ティア・attempt・`A-xxx` の id と、閉じる決定の要点。細目は下の「assumption の候補の出し方」
- 既存の持ち越し (1 で控えた `carry_over_rows` と `carry_over_pending` の `items`) も同じ一覧に載せる (種類は人が `design` / `assumption` / 無視 を選ぶ。`assumption` の候補は上と同じに列挙する。黙って失わない)

問い: 「この差分で進めてよいか / 直す点 / 外す課題 / 残った作業ごとに対応するか無視か / やり直す UC」。

| 答え | すること |
|---|---|
| 直す点 | 指摘を input に足して 2 から |
| 外す課題 | 変更を捨てて (`git checkout -- docs/requirements` と `git clean -fd -- docs/requirements`) その課題を除いて 2 から。外した課題は「取り下げる / 残す」を聞く |
| 残す課題 | 理由をファイルに書いて `feedbackBatch.js hold <issue> --reason-file <ファイル>` (止まった印を付ける。止まった課題だけでは要求の差分を始めない) |

#### assumption の候補の出し方

項目に slug か attempt が無ければ (既存の持ち越しは「frontend の A-004」のようにしか書いていない)、d2-run が候補を列挙して載せる:
`grep -l "id: A-xxx" .distillery/runs/*/attempt-*/assumptions.<tier>.yaml` で id を持つ (slug, attempt) の組をすべて出し、1 件なら確定、複数なら確認ページで人に選ばせる (同じ id が別の UC・別の attempt にあるので推測しない)。
候補が 0 件か人が選ばなければ「無視」(報告に「特定できなかった項目」として残す)。

1 つの項目に複数の id (例「A-004 / A-005 / A-006」) があれば **id ごとに分けて**候補を列挙し、id ごとの選択から `targets` の要素を 1 つずつ組む (id ごとに attempt が違ってよい)。

同じ (slug, tier, attempt, id) を指す項目が複数あれば (要求担当の項目と既存の持ち越しが重なったときなど)、1 件にまとめて聞き (まとめた元の項目を添える)、`targets` には 1 回だけ入れる。
閉じる決定の要点が項目ごとに違えば、まとめずに両方の決定を並べて載せ、どちらで閉じるか (または無視) を人に選ばせる (`assumption_resolved` の `decision` は 1 つなので推測で選ばない)

### 手順 4: 残った作業を流し、commit する

4. 承認されたら、まず「対応する」残った作業を種類ごとの宛先に流す:

- `design`: sub `d2-design mode=feedback items=<項目のファイル (docs/design/storybook-app/src/<相対パス>。stories も部品も) と直す内容を 1 行ずつ>` (派遣表「① 要求の差分 (画面部品)」。項目が部品なら、報告の「影響する Story」(その部品から import を Story まで辿った一覧) を完了報告に転記する)。受理の条件と受理後の作業は下の「design の受理」
- `assumption`: 3 でまとめた (slug, tier, attempt, id) ごとに 1 回だけ、対象の UC の run (main) に `node runState.js event .distillery/runs/<slug> assumption_resolved --data-file <json>` を追記する。JSON は `{"targets": [{"tier": "<tier>", "attempt": <n>, "id": "A-xxx"}], "decision": "<要求の差分の決定の要点>", "by": "req: feedback"}`
  (`runState.js` が各 target を `attempt-<n>/assumptions.<tier>.yaml` で確かめ、無い組は拒む。最新でない attempt の前提も閉じられる。AssumptionRecord の yaml は変えない)
- 既存の持ち越しを流したら、`carry_over_pending` の run には `node runState.js event .distillery/runs/<slug> carry_over_migrated --data-file <json>` (`{"items": [...], "to": "req: feedback"}`) を追記する (再び移行の対象にしない)。`use-cases.yaml` の `carry_over` の行は 2 の再生成 (要求担当の差分更新か `genUseCases.js`) で消える
- やり直す UC: 下の「やり直し」の節の `reopen` を UC ごとに回す

次に、反映した課題ファイルと取り下げた課題ファイルを `git rm` し、genDocsReadme → `git add -A -- docs packages/ui .distillery` (`packages/ui` は design の作業があったときだけ。無いパスを名指ししない) → 本文ファイル (`.distillery/logs/req-feedback-<ts>.txt`。1 行目 `req: feedback`、空行、trailer) を書いて `git commit -F <本文ファイル>` (main マージ 3 と同じ書き方)。
trailer は反映した課題ごとに `Feedback-Consumed: docs/feedback/<issue>.md`、取り下げた課題ごとに `Feedback-Dismissed: docs/feedback/<issue>.md`、最後に attribution 行 (git-delivery.md「commit の attribution」)。
続けて routing.md「上流の差分の branch」の 3 で main へ確定する (push を含む)

#### design の受理

受理の条件は、次のすべてである。

- 報告に `npx storybook build` が通ったことがある
- d2-run が回す `node <skills>/d2-design/scripts/validateScreens.js docs/design/screens.yaml --app docs/design/storybook-app/src --use-cases docs/requirements/use-cases.yaml` が exit 0 (Story を消したときの `screens.yaml` の参照漏れを拾う)
- write-set (`docs/design/**`) の外が変わっていない
- `git status --porcelain --untracked-files=all -- docs/design` の変わったファイル (変更・追加・削除を 1 ファイルずつ) がすべて、項目のファイルか、報告の「項目の外の変更」に項目との対応付きで載っているか、`docs/design/screens.yaml` (画面・Story・variant を足したか消したか名前を変えた項目があるときだけ) か、撮り直した `docs/design/screenshots/**` のどれかに入る
- **項目がすべて「直した」**

受理しないとき:

- 上のどれにも入らないファイルがあれば、理由の無い削除も含めて受理せず、変更を捨てて止まって報告する
- 報告に「直せない (理由)」が 1 件でもあれば受理せず、変更を捨てて (`git checkout -- docs/design` と `git clean -fd -- docs/design`) 止まって報告する。人が項目を直すか「無視」に変えて 3 からやり直す。既存の持ち越しは再生成で消えるので、黙って先へ進まない

受理後の作業:

- `node <skills>/d2-foundation/scripts/importUi.js --from docs/design/storybook-app --cwd .` で `packages/ui/**` に取り込み直す (前回の一覧にあって消えたファイルは消える)
- 続けて、回帰の相手 (`node runState.js regression-targets .` の全件。`status: done` の UC と開き直した UC) のうち `tiers` に frontend を含むものごとに `runGates.js --uc <slug> --tiers frontend --only unit` を回す (取り込んだ部品を使う既存 UC の回帰)。落ちたら止まって報告する (design の差し戻し。commit しない)

### 手順 5〜7

5. 上流で止めた UC の feature は消さない (止めた課題がすべて main から消えると、次の自動選択が `resume` を返して写し直す。要求の課題は scenario から続く)
6. 決定・契約への波及は `node <skills>/d2-common/scripts/lib/basis.js check <対象ファイル…> requirements=docs/requirements adr=docs/adr contracts=contracts` で見つける (スクリプトは `scripts/lib/` にある)。
   STALE は完了報告に載せるだけで、自動では追随しない (as-built はその UC を次に回したときに作り直す)。
7. 自動選択をもう一度呼んで続ける (写し直し待ちの機能・次の上流の差分・次の UC)

手順 6 の対象ファイルは存在するものだけ: `docs/adr/[0-9]*.md` (決定の本文。`_review-summary.md` と `index.md` は生成物なので渡さない。渡すと STALE に出る)、`docs/adr/architecture.md`、`docs/as-built/*/*/index.md` (as-built がまだ無ければ省く。無いパスを渡すと読み込みで落ちる)。

閉じた前提 (`assumption_resolved`) も同じ: 完了報告に「閉じた前提 (UC・ティア・attempt・id) と、as-built は次にその UC を回したときに反映 (最新でない attempt の前提は as-built に出ない)」を書く

## やり直し (main マージ済みの UC に新しい受入基準が付いたとき)

`FB scan` の `uncovered_done` は、`status: done` の UC のうち、シナリオ (`features/**/<slug>.feature`) が UC の仕様の受入基準を網羅しないもの (`checkScenario.js` の `missing`) と、
受入基準の文面が main マージの時点から変わったもの (`acceptance_changed: true`。main マージの done の受入基準の指紋と比べる。0.1.34 までに main マージした UC は指紋が無いので、番号が増えたときだけ出る)。
`error` 付きの UC は feature が無いか検査が落ちた UC で、やり直さずに報告する。

1. **聞く**: 確認ページで UC ごとに「やり直す / 後で」。推奨は「やり直す」。「後で」の影響: 付いた仕様は実装されないまま残り、起動のたびに完了報告に載る (`uc=<slug>` の名指しでやり直せる)
2. **退避**: 「やり直す」なら main の上で `node runState.js reopen <リポのルート> <slug> --from scenario --data-file <scan の uncovered_done のその UC の記録 (missing と acceptance_changed) の json>` を回す
   (run を `.distillery/archive/runs/<slug>/<ts>/` へ移し、`reports/`・`traces/` は消し、`use-cases.yaml` の `status` を `planned` にする。進行中の UC は拒む)。
3. **回す**: 自動選択がやり直し中の UC を次の機能より先に選ぶ (名指しの起動ならそのまま続ける)。④ は main から新しい run で始まり、段ごとに次が変わる。派遣文に `reopened.json` の `missing` と `acceptance_changed` を添える (文面だけが変わった UC は `missing` が空で `acceptance_changed: true`)

手順 2 の退避を回す場所:

| 場面 | 回す場所と commit |
|---|---|
| 要求の差分の中 | 要求担当の反映の後の作業ツリー (未 commit) のまま回し、同じ `req: feedback` の commit に入れる |
| 名指しの起動 | clean な main で回し、`genDocsReadme.js` → `git add -A -- docs .distillery/runs .distillery/archive` → `req(<slug>): reopen` で commit する |

手順 3 で、段ごとに変わること:

- scenario: 既存の feature に、網羅されていない受入基準のシナリオを足す (`acceptance_changed` なら、UC の受入基準をすべて既存のシナリオと照らし合わせ、文面が変わった受入基準のシナリオを直す。網羅の検査は番号しか見ないので、照らし合わせた結果を報告に書く)
- contract: 既存の operation も直してよい (d2-contract の UC モード)
- scaffold: 既存の `<slug>.steps.ts` は残し、足りない step だけ pending で足す。red は新しい受入基準を実装するティアだけに求め、`runGates.js --uc <slug> --only unit --expect-red unit --tiers <そのティア>` で確かめる (scaffold の報告のティア)
- tier 以降: 新しい UC と同じ
