# d2-run トラブルシューティング

オーケストレータ (d2-run) の実行環境 (headless の許可、npm、補助スクリプト) で踏んだ問題。実走で踏んだ環境依存の問題と回避策をためる (手順そのものには書かない)。項目は「症状 → 原因 → 回避」の順。
他のスキルの項目: [索引](../../d2-common/references/troubleshooting.md) (d2-common)

③ の `npm install` は 0.1.22 から d2-foundation (F7) が回す。npm 10 で落ちる件は [d2-foundation の項目](../../d2-foundation/references/troubleshooting.md) に移した。

## headless (`claude -p`) で `$VAR`・`$?`・`cd <dir> && git ...` を含む Bash が承認待ちで止まる

- 症状: `Contains simple_expansion` などと出て一部のコマンドが拒否される (0.1.26 の試し運転では還流の worktree での `cd <wt> && git ...` と、終了コードを見る `echo $?` で止まった)
- 原因: allowedTools の照合が、変数展開・`cd` を含む複合コマンドを通さない
- 回避: コマンドを分割し、変数展開を使わずに書く (パスは直書き)。別のディレクトリの git は `cd` せずに `git -C <dir> ...` で打つ。
  終了コードは `$?` を表示せず、コマンドを単独で回してツールの結果 (exit code) で見る。還流の git の操作は `feedbackBatch.js` のサブコマンドを 1 つずつ回す (JSON と終了コードで判断する)
- 0.1.27 の試し運転でも、還流の worktree での `cd <wt> && git status` と、受理の検査 (validateAdr・compileContracts など) を 1 つの sh にまとめたものが同じ症状で止まった。
  受理の検査も `git -C <wt>` と同様に worktree のパスを直書きして 1 コマンドずつ回す (手順書の例のとおり)
- 0.1.28 の試し運転でも `genDocsReadme.js; echo exit=$?` と、受理の検査をまとめた sh で再発した。手順書の例には `$?` も sh も無い。コマンドを単独で回し、ツールの結果の exit code で見る
- 0.1.30 の試し運転では `cd <wt> && git status` は止まったが、`cd <wt> && node <スクリプト>` は通った (止まるのは git を含む複合コマンド)。還流の受理の検査 (契約のスクリプトに `--cwd` は無い) は `cd <wt> && node ...` の形でよい
- 0.1.32〜0.1.34 の試し運転でも `; echo exit=$?` 付きのコマンドで再発した (「A variable in this command can't be checked before it runs」)。どれも分けて回して進めた

## headless で runGates の出力を `> <ファイル>` に保存できない

- 症状: `runGates.js ... > /tmp/gates.txt` が「作業ディレクトリの外への書き込み」で拒否され、`; echo $?` も拒否される (0.1.29 の試し運転では `| tail -30` で代えた)
- 原因: allowedTools の照合がリダイレクトと複合コマンドを通さない
- 回避: 出力を保存しない。runGates は `<run>/reports/gates.json` に job ごとの `output_tail` (末尾 4000 文字) と `failed_tests` (落ちたテスト名。0.1.30) を書くので、落ちた内容はそこを読む。
  還流の `FB record-gate --detail` にはその gates.json をそのまま渡す (落ちた段だけ要約される。複数の UC はカンマ区切り)。回し直す前の写しは `cp` で `<run>/reports/gates.failed-1.json` に (作業ディレクトリの中なので通る)

## `"type": "module"` のリポで補助スクリプトを `.js` で書くと ESM として読まれて失敗する

- 症状: `require is not defined` / `module is not defined` で、オーケストレータが書いた補助スクリプトが落ちる
- 原因: 生成するルートの `package.json` は `"type": "module"`。`.js` は ES module として読まれる
- 回避: 補助スクリプトは `.cjs` にする (CommonJS)。`.distillery/logs/` に置く

## イベント記録と完了記録を同じ行に `&&` と `| cut` でつなぐと、失敗しても完了記録が走る

- 症状: 承認の記録が失敗したのに review の完了記録とコミットが走った (invalidate で復旧)
- 原因: パイプの終了コードは最後のコマンド (`cut`) のもので、前の失敗が隠れる
- 回避: 1 コマンド = 1 目的で分けて実行し、終了コードを見てから次へ進む。パイプで整形しない

## headless で `mktemp` が拒否される (tier の実装者がゲートの `{report}` の置き換え先を作れない)

- 症状: `mktemp` を含むコマンドが allowedTools に無く止まる (0.1.31 の試し運転 O17)
- 回避: `node -e "console.log(require('os').tmpdir()+'/d2-'+Date.now()+'.json')"` で OS の一時ディレクトリのファイル名を作り、それを `{report}` に使う (node は許可済み)。使い終えたら消す (tier-impl.md 4)

## `runState.js event` / `done` に長い日本語の JSON を argv で渡すとハーネスの検査で止まる

- 症状: 項目の一覧 (残った作業・閉じた前提の決定など) を含む JSON を引数にした `node runState.js event ...` が承認待ちで止まる、か引用符の扱いで壊れる (0.1.31 の試し運転 O18)
- 回避: JSON をファイル (`.distillery/logs/<name>.json`。gitignore) に書き、`--data-file <ファイル>` で渡す (argv の JSON と排他)

## headless で `shasum` が承認待ちで止まる

- 症状: `shasum -a 256` を含むコマンドが allowedTools に無く止まる
- 回避: `node -e` の `crypto.createHash('sha256')` で計算する (node は許可済み)。scenario の承認のハッシュは `runState.js scenario-approve` が計算するので、進行役が計算する場面は無い (0.1.33)

## headless で `/tmp` などリポの外への控えの保存が拒否される

- 症状: 作業の控え (diff や一覧) を `/tmp/<file>` に書こうとして「作業ディレクトリの外への書き込み」で止まる (0.1.32 の試し運転 P14)
- 回避: 控えは `.distillery/logs/` (gitignore) に置く。`git show <ref>:<path>` で読めるものは保存しない

## 手順書に書いていない扱い (迷ったら)

試し運転で進行役が迷ったが、自分で正しく処理できた事象 (0.1.35 で手順書の本文には足さず、ここにまとめた)。迷ったらこのとおりに扱う。

| 場面 | 事象 | 扱い |
|---|---|---|
| 要求の差分 | 既存の持ち越しの内容が、今回の課題の決定と食い違う | 新しい決定 (今回の課題) を推奨にし、両方を並べて人に選ばせる |
| 要求の差分 | 課題ファイルの本文の前提の番号 (`A-xxx`) が、実際の記録と食い違う | 本文の番号を信じず、3 の候補の列挙 (`grep -l "id: A-xxx"`) で照合する |
| 派遣文 | 書き込み範囲の行を「そのまま貼る」とき、どこまで貼るか | 派遣表の書き込み範囲の欄の中身だけを貼る (表の縦棒と段の名前は要らない) |
| 要求を直す | コマンド列の `<issue>` に拡張子を付けるか | 付けない (課題名だけ) |
| シナリオで止まる | 執筆役の下書きのファイル名の時刻が実際と違う | そのまま課題ファイルにしてよい (0.1.34 でも困らなかった)。進行役が時刻を取るときは `date -u +%Y%m%dT%H%M%SZ` |
| シナリオで止まる | 執筆役の下書きの front matter が `uc:` (定義は `from_uc`) | そのままでよい。`file-issues` が `from_uc` に直す |
| シナリオで止まる | 止まった後の作業ブランチが feature のまま | そのままでよい。次の起動は clean なら main に切り替える |
| 人レビュー | 全体の承認だけで、個別に答えていない回答任意の前提 | 未回答として `auto_confirmed`。検証役が足した前提 (`V-xxx`) も同じ |
| verify | 検証役に渡す「変わったファイルの一覧」と「共有の候補」を作るスクリプトが無い | `git diff --name-only <base_head>..HEAD` で一覧を作る。共有の候補はそのうち `packages/`・`features/support/`・`features/step_definitions/` の変更。補助スクリプトは `.distillery/logs/` に `.cjs` で置く |
| main マージ | 止まったときに並べる「指摘の対象ファイル」に、合否に関わらない軽い指摘の対象も出る | 合否を決める重さ (`--fail-level`) 以上の指摘の対象だけで判定する |
| main マージ | static で落ちると、単体テスト以降の段が回っていない | 報告に「単体テスト以降は回っていない」と添える |
| main マージ | squash の本文 (`prTrailers.js` の出力) をファイルにする方法 | 標準出力を `.distillery/logs/` の下のファイルへリダイレクトし、`git commit -F` で渡す (作業ディレクトリの中なら通る。`/tmp` は上の節のとおり拒まれる) |
| 名指しの起動 | 既存の持ち越しや旧形式の run が片付かない | 設計どおり (名指しは ④ だけ)。完了報告に「引数なしの起動で片付く」と添える |
| 還流・移行 | 契約の課題が既に契約に入っていた (`already-applied`) | 手順どおり次の課題へ (派遣が空回りするだけ) |
| 要求の差分 | 決定記録 (ADR) がすべて STALE と出る | basis が要求全体の最後の commit 1 つのため。完了報告に載せるだけでよい |
| 要求の差分 | `use-cases.yaml` を作り直すと、引用符の付け方だけが変わる | 中身は同じ。一度作り直せば揃う |
| 全体 | 空のディレクトリ (`.distillery/logs/feedback/`、退避した feature の run の `learnings/` など) が残る | git は追跡しない。消してよい |
| ゲート | 回し直すと通るテストが、記録だけで課題にならない | 回し直しの規則どおり。対象リポのテストの問題として完了報告に書く |
| 人レビュー | 検証役の指摘 (major / minor) が課題ファイルにならない | 指摘は前提の記録に結びつき、人レビューで「承認 / 実装を直す / 要求を直す」を選ぶ。承認した前提は as-built の「決めたこと」に残る。直したいときは「要求を直す」を選ぶ |
| main マージ | 人が feature で直した commit (UC と無関係な検査の設定など) が squash で UC の 1 commit に入る | 手順どおり (feature の上で直す規則)。完了報告にその commit を挙げる |
| verify | 検証役が「git は禁止」を読み取りの git まで禁止と解釈し、差分でなく今のコードで照合する | 受理してよい。検証役の手順は git を使わない (変更ファイルは一覧で渡し、照合先は今のコード) |
| やり直し | 新しい run の前提の記録の番号が、前の run の番号の続きから始まる | そのままでよい。`validateAssumptions.js` が見るのは 1 つの記録ファイルの中で番号が重ならないことだけ |
| 画面の見本 | Story を足したとき、`screens.yaml` の状態一覧に載せるかの規定が無い | 規定は無い。受理は `validateScreens.js` が通るかで決める (載せなくても受理する) |
| 画面の見本 | 修正役が項目に無い表現 (ボタンを押せなくするなど) を足しても、受理の検査 (ファイル単位) で拾えない | 項目のファイルの中の変更は受理する。確認ページの差分で人が見る |
| 要求の差分 | 6 の `docs/adr/[0-9]*.md` をそのまま渡すか、展開して列挙するか | シェルの展開で列挙して渡す (`basis.js` は引数をそのままファイルとして読み、展開しないので、そのままだと MISSING になる) |

## 既知の不具合 (未確認)

1 回ずつ出たが、原因と対処を確かめていない事象。出たら課題 (`kind: plugin`) にする。

| 事象 | 出た版 |
|---|---|
| 画面の見本の担当が、要求に無い画面 (利用者一覧) を `screens.yaml` に出した | 0.1.10 |
| メール送信の UC に `tiers_hint` の frontend が付く (`genUseCases.js` の `inferTiers` が RDRA の画面の有無で判定する) | 0.1.13 |
| 生成物の `x-test-headers` を既存の operation に足すと、他の UC の契約テストも変わる | 0.1.19 ごろ |
| `classifyContractChanges.js` の copy の記録で、変わっていないコピー元も分類される | 0.1.19 |
| `genApiClient.js --check` の単体実行を、実走で確かめていない (単体テストはある) | 0.1.16 |
