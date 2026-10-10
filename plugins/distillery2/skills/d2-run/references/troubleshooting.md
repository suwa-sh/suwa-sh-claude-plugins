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
