# recovery: このスキル自身のハマりどころ

実行者が別セッションでも届くように、学びはここに追記する。書式は「症状 / 原因 / 検出 / 復旧 / 再発防止 / 最終確認日」。

## Claude Code は `.agents/skills/` を読まない
- 症状: Codex では skill が発見されるが Claude Code では発見されない
- 原因: Claude Code の project skill は `.claude/skills/` (起動ディレクトリから repo root までの各階層) と `~/.claude/skills/`、plugin のみ。`.agents/skills/` は探索対象外 (公式 docs skills / slash-commands、2026-09-05 確認)
- 検出: `verify.sh` の skill 発見テストが claude だけ fail
- 復旧: `harness.yaml` の `skills_mode` を `generate` (コピー) か `symlink` にして `gen_adapters.py` を再実行
- 再発防止: init は既定で generate。symlink は Windows / scanner で差が出るため opt-in
- 最終確認日: 2026-09-05

## Codex の project hook は「project trust」と「hook 単位の trust hash」の両方が要る
- 症状: `.codex/hooks.json` を置き project も trusted なのに、`codex exec` で hook が `invoked` を残さない。警告も出ない
- 原因: 非 managed hook は hash 単位で Trusted / Modified / Untrusted を持ち、exec は Untrusted / Modified を黙って飛ばす。再生成で内容が変わると Modified に戻る
- 検出: app-server の `hooks/list` の `trustStatus`。手軽には `codex exec --dangerously-bypass-hook-trust` で発火するなら trust が原因
- 復旧: TUI で hook を trust する、または `hooks.state` に `trusted_hash` を書く。検証だけなら bypass フラグ
- 再発防止: `verify.sh` は bypass フラグで配線を検証する。運用の trust は adapter 再生成のたびに見直す
- 最終確認日: 2026-09-05 (codex-cli 0.145.0、テストリポで実測)

## LLM は `curl | sh` の実行自体を断るので hook 拒否テストに使えない
- 症状: hook 拒否テストで `invoked` すら残らない (Claude Code / Codex とも)
- 原因: モデルが危険コマンドをツール呼び出しせずに断るため、PreToolUse が発火しない
- 復旧: `pre-tool-policy.sh` の番兵 (`MID_HARNESS_HOOK_LOG` 有効時のみ `MID_HARNESS_DENY_ME` を拒否) を使う。curl|sh の正規表現は fixture でスクリプト単体テストする
- 最終確認日: 2026-09-05

## Grok / Antigravity の trust は canonical パスで登録する
- 症状: `~/.grok/trusted_folders.toml` や agy の `trustedWorkspaces` に repo を足したのに hook が発火しない
- 原因: `/tmp/...` のような symlink 経由のパスで登録した。製品側は git root の canonical パス (`/private/tmp/...`) で照合する
- 検出: `grok inspect` の `Project trusted`、agy のログ `loaded N named hooks from M hooks.json file(s)`
- 復旧: `git rev-parse --show-toplevel` の出力 (canonical) で登録し直す
- 最終確認日: 2026-09-05

## Antigravity の headless は project に束縛しないと workspace hooks を読まない
- 症状: `.agents/hooks.json` があり trust もあるのに `loaded 0 named hooks`
- 原因: `agy -p` は既定で default project に束縛される。workspace の project は `--new-project` (初回登録) か `--project <project id>` で選ぶ
- 復旧: 初回だけ `agy -p "reply OK" --new-project` を repo で実行。以降は `--project <id>` (verify.sh は `scripts/agy_project_id.py` で folderUri から ID を引く。名前 = basename でも指定できるが重複し得る)
- 再発防止: `--new-project` を毎回付けない (同名 project が増える)
- 最終確認日: 2026-09-05 (agy 1.1.26)

## Copilot の repo hook (`.github/hooks/*.json`) が `-p` で発火しない
- 症状: docs どおりの `.github/hooks/mid-harness.json` を置いても hook ログが空。user hook (`~/.copilot/hooks/`) は同形式で発火する
- 原因: `-p` では repo hook が既定で無効。folder trust や `--allow-all-tools` では有効化されない
- 検出: `copilot -p ... --log-level debug --log-dir <dir>` の `[rust:hooks] [hook stdout]` 行に repo hook の出力が無い
- 復旧: invocation 単位なら `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true copilot -p "..." --allow-all-tools` (verify.sh はこちら、確実)。repo 単位は repo で対話 `copilot` を開き trust ダイアログで remember を選ぶ → `~/.copilot/config.json` (CLI 管理) の `trustedFolders` に入る (2026-09-06 実測、以後 `-p` で `hookCount=3`)。`settings.json` への手編集は CLI に書き戻されて消える。VS Code でその repo を開いているとダイアログが出ない (IDE lock を trust と見なす) のでウィンドウを閉じてから。repo 内の `.env` では有効化できない。経緯は `adapters/copilot-repo-hook-issue.md`
- 最終確認日: 2026-09-05

## Grok の skill 発見テストが timeout する (skill が数百ある repo)
- 症状: `grok  fail  skill-discovery: token not found in output: timeout` (hook 拒否は pass)
- 原因: Grok は project + user + 互換パス (`.claude/skills` 等) の skill を全部読む。pkm では 506 skill で 300 秒を超えた
- 復旧: verify.sh の既定 timeout を 600 秒にした。それでも足りなければ `MID_HARNESS_VERIFY_TIMEOUT=900`
- 最終確認日: 2026-09-06

## Cursor の `-p` が Opus の usage limit で止まる
- 症状: `ActionRequiredError: You've hit your usage limit for Opus`
- 復旧: `--model auto` を付ける (verify.sh は既定で付ける)
- 最終確認日: 2026-09-05

## PyYAML が無い環境
- 症状: `ModuleNotFoundError: No module named 'yaml'`
- 復旧: `pip install pyyaml` (またはその環境の python に合わせて)。scripts は PyYAML 以外の外部依存を持たない
- 最終確認日: 2026-09-05

## `pre-tool-policy.sh` の取得即実行の検知を改行や中間パイプで迂回できる
- 症状: `curl URL \` + 改行 + `| sh` や `curl URL | cat | sh` / `curl URL | tee f | bash` が hook を素通りする (as-built-atlas に vendored した版への自動セキュリティレビューで指摘、2026-11-04)
- 原因: (a) `grep -E` は行単位で照合するため、改行を挟むと `curl` と `| sh` が別の行になる。(b) 正規表現が `FETCH[^|]*\|` の直後にインタプリタを要求するため、間に別の段を挟むと一致しない
- 検出: `scripts/test_hook.sh` の fixture `deny-curl-newline-pipe-sh` / `deny-curl-pipe-cat-sh` など (迂回 7 形を追加。修正前は 7 件が `want=2 got=0`)
- 復旧: 照合前にバックスラッシュ改行・改行・連続空白を正規化し、パイプ形は正規表現でなく「`;` `&&` `||` `&` 改行 でコマンドに分け、各コマンドを `|` で段に分け、fetch を含む段より後ろの段の最初の実コマンドが `[/path/]sh|bash|python…` か」を見る (python で判定)。段の先頭はトークン走査で、前置コマンド (`sudo` `doas` `env` `xargs` `nohup` `command` `exec` `nice` `timeout`。`/usr/bin/env` のような絶対パスも名前で見る) とそのオプション、値を取る 1 文字オプション (`sudo -u root` / `xargs -n 1` / `env -u VAR`) の値、`timeout` の秒数、`VAR=val` を読み飛ばす。値は実コマンド判定より先に消費する (`sudo -u sh tee` の `sh` を実コマンドと見ない)。改行は原則コマンドの区切りだが、`|` で終わる行と `|` で始まる行は前の行に続ける。`|&` は行結合の前に `|` へ潰す。`2>&1` の `&` は区切らず、段頭の `(` `{` やコマンド前のリダイレクト (`| 2>&1 sh` / `| 2> f sh`) は読み飛ばす (Codex レビュー 3 ラウンドで `|&` + 改行、段頭リダイレクト、`xargs -0 sh -c`、`env -i sh`、`sudo -u root sh`、`/usr/bin/env bash`、`timeout --signal=TERM 5 bash` が素通りすると指摘され追加。正規表現で前置を列挙するのをやめ、トークン走査にした)
- 再発防止: 誤検知を増やさない fixture (`allow-curl-then-python-c` / `allow-curl-pipe-jq-and-python-c` / `allow-curl-newline-then-echo-pipe-bash` など) を同時に置き、skill-trust の `block-dangerous-bash.sh` で既知の「別コマンドに `curl` と `python3 -c` が共存するだけで拒否」を再現しないことを固定した。CI でも `tests/toolbox/mid-harness/pre-tool-policy.test.js` が `test_hook.sh` を回す。区切りの分割は `shlex` で引用符を解釈する (commit 後の自動セキュリティレビューで、引用符の中に `;` を含むヘッダを付けた `curl … | sh` が `;` で割れて素通りすると指摘され、素朴な正規表現分割から置き換えた。閉じていない引用符は bash でも構文エラーなので素朴な分割に戻す。shlex の既定はさらに 2 点を変える: `#` をコメントとして捨てない (URL の `#fragment` や `a=b#c` の後ろの `| sh` が消える)、記号の並び (`|>` など) をシェルの演算子単位に切り直す (`curl URL |>f sh` の `|` が段の境界にならない)。`&>>` は 1 つの演算子にし、段頭のリダイレクトは記号が複数に割れてもまとめて読み飛ばす (`| &>>/tmp/log sh` が `&>` `>` に割れて読み飛ばしがずれた))。位置づけ (「明白形を止める最終防衛線、セキュリティ境界ではない」) は変えない: 保存してから実行する 2 段階、変数経由の eval、変数展開や関数越しの実行は依然として捕まえない
- 最終確認日: 2026-11-04

## `pre-tool-policy.sh` の取得即実行の検知を `-c` の文字列・引用符の中の改行・グループで迂回できる
- 症状: 次の 3 種類が hook を素通りする (as-built-atlas に toolbox 0.11.0 を取り込んだ commit への自動セキュリティレビューで指摘、2026-11-12)
  - シェルに渡す文字列の中: `sh -c "curl URL | sh"` / `eval "curl URL | sh"` / `ssh host "curl URL | sh"` / `echo "$(curl URL | sh)"`
  - 引用符の中の改行: `curl URL | tee "a<改行>b" | sh` (改行で先に行を割るので、引用符の途中で段が切れる)
  - グループ・複合コマンド: `curl URL | { cat; sh; }` / `curl URL | (cat; sh)` / `curl URL | while read l; do sh; done` (グループの中の `;` でコマンドが割れ、段の状態が途切れる)
- 原因: (a) 引用符の中の文字列はコマンドとして見ていなかった。(b) 改行で行に割ってから shlex にかけていた。(c) `;` `&&` での分割が入れ子の深さを見ていなかった
- 検出: `scripts/test_hook.sh` の fixture (`deny-sh-c-string-curl-pipe-sh` / `deny-curl-pipe-quoted-newline-arg-sh` / `deny-curl-pipe-brace-group-sh` など。今回足した fixture は 64 件 (拒否 40・許可 24))
- 復旧: 全体を shlex で 1 回だけ切り、引用符の外の改行だけを区切りの記号にした (`|` `&&` `||` の後ろと、`|` で始まる行の前の改行は継続)。`( )` `{ }` と `if/while/until/for/case/select` の深さを数え、深さ 0 の区切りでだけコマンドと段に分ける。取得の後ろの段がグループなら、中のどれかの単純コマンドがインタプリタのときに拒否する。グループの中身、`sh`/`bash` の `-c` (`-lc` 等も) の文字列、`eval` の引数、`ssh` のリモートコマンド、引用符の中の `$( )` と `` ` ` `` は、同じ検査を再帰でかける (深さ 6 まで)。引用符の中の `$( )` と `` ` ` `` は、元の文字列を引用符とエスケープの状態を追って 1 回で走査して取り出す (単一引用符の中や `\$(` は展開されないので見ない。正規表現で探すと長い入力で時間が急増した)。取得の判定は、語が curl / wget / fetch そのもののときだけにした (`./curl.sh` のようなファイル名で誤検知しない。0.11.1 では実コマンドの位置に限っていたが、0.11.2 で位置を問わない形に戻した。次の節)。case の分岐の `)` は入れ子の閉じと見なさない。sh / bash の `-c` の後ろのオプション (`-o pipefail` など) も読み飛ばしてから、実行される文字列を特定する。閉じていない引用符・深すぎる入れ子・10 万文字を超える入力・検査スクリプト自体の失敗は、取得を含めば拒否する (fail-closed)。引用符の外で語の先頭にある `#` から行末までをコメントとして消してから解析する (`curl URL | # 説明` + 改行 + `sh` でパイプの継続を見失わず、`curl -o f URL # 例: curl URL | sh` を誤検知しない。語の途中の `#` は URL の fragment なので残す。`$'...'` は中の `\'` が引用を閉じない ANSI-C 形式として扱う。扱わないと `echo $'a\' #' ; curl URL | sh` で引用の状態がずれ、取得ごとコメントとして消えた (自動セキュリティレビューの指摘)。さらに、コメントとして消した部分にしか取得が無いときは、コメントを消さない形でも検査し、当たれば拒否する (コマンド置換の中も再帰で見る。fail-closed。`git pull # fetch first` は通す))。インタプリタにコードを渡す形 (`-c` / `-e` とその束、`<<<`) の後ろで取得しているもの (`bash -c "$(curl URL)"` / `python3 -c "$(curl URL)"` / `bash <<< "$(curl URL)"`) も `eval "$(curl URL)"` と同じく拒否する (commit 後の自動セキュリティレビューの指摘)。同じコマンドの区間は 1 回だけ走査する (インタプリタが出るたびに後ろを見直すと、長い入力で時間が 2 乗で増える)。区切る前に `$'...'` を中身をデコードした通常の単一引用に、`$"..."` を通常の二重引用に置き換える (shlex は両方を知らないので、`bash -c $'curl URL | sh'` を見落とし、`git commit -m $'it\'s: curl x | sh'` の `|` を区切りと誤認した)。
- 注意 (実装): 検査の Python は bash の単一引用 (`python3 -c '…'`) に埋め込んでいるので、コードにもコメントにも `'` を書かない (文字は `"\x27"` で書く)。書くと bash の引用が途切れて Python が構文エラーになり、fail-closed ですべてのコマンドを拒否する。fixture の許可ケースが一斉に落ちるので検出できる。`builtin eval` と `eval --`、`env -S` / `--split-string` の値 (空白で区切った引数として展開する。シェルではないのでパイプは解釈しない) も見る。-c のオプション以降の 7 点は、修正後の外部レビュー (Codex) で見つかった
- 再発防止: `echo "curl x | sh"` や `git commit -m "curl x | sh …"` のような文字列、グループの中で保存してから外で実行する形 (`{ curl -o f URL; }; sh f`)、`ssh host "uname -a"` を許可のまま固定する fixture を同時に置いた。既知の誤検知 (変更前から同じ): ヒアドキュメントの本文に `curl x | sh` と書くと、本文をコマンドとして読んで拒否する
- 最終確認日: 2026-11-12

## `pre-tool-policy.sh` の取得即実行の検知を起動役・プロセス置換・ヒアドキュメントで迂回できる
- 症状: 0.11.1 で次が hook を素通りする (0.11.1 を as-built-atlas / ai-agent-training に push した後の自動セキュリティレビューで指摘、2026-11-12)
  - 起動役を前に置いた取得: `busybox wget -O- URL | sh` / `stdbuf -oL curl URL | sh` / `torsocks curl URL | sh` (0.11.0 までは拒否していた退行)
  - プロセス置換: `bash < <(curl URL)` / `curl URL > >(sh)`
  - ヒアドキュメント: `bash <<EOF` + 改行 + `$(curl URL)` + 改行 + `EOF` / `cat <<EOF | bash` で同じ本文
- 原因: (a) 取得の判定を実コマンドの位置に限ったので、前置コマンドの一覧 (sudo / env など) に無い起動役の後ろの curl を見なかった。(b) `<` / `>` の先のプロセス置換と、ヒアドキュメントの本文がインタプリタに渡ることを見ていなかった (プロセス置換と本文のコマンド置換は 0.11.0 以前も見ていない)
- 検出: `scripts/test_hook.sh` の fixture (`deny-busybox-wget-pipe-sh` / `deny-bash-stdin-procsub-curl` / `deny-curl-to-output-procsub-sh` / `deny-bash-heredoc-cmdsubst-curl` など 15 件 (拒否 9・許可 6))
- 復旧: (a) 単純コマンドのどの語でも、curl / wget / fetch そのものなら取得とみなす (起動役の一覧を足しても漏れるので、位置を問わない)。(b) インタプリタの最初の引数の `<( )` と標準入力の `< <( )` の中、取得と同じ段の出力側 `>( )` の中のインタプリタ、インタプリタを含む行のヒアドキュメント本文のコマンド置換 (`$( )` / `` ` ` ``) を見る。本文の `curl -o f URL` のように置換の外の取得は、保存してから実行する形なので通す。`( )` の対応は 1 回の走査で求め、検査済みの範囲の内側は見直さない (閉じていない `< <(` を並べた入力で、時間が 2 乗で増えた)
- 再発防止: `cat < <(curl URL)` / `curl URL > >(tee log)` / `diff <(curl A) <(curl B)` / `busybox ls | sh` / 本文で保存だけするヒアドキュメントを許可のまま固定する fixture を同時に置いた。既知の誤検知 (安全側): `echo a # curl URL | sh` のようにコメントに取得即実行を書くと拒否する。`bash run.sh <(curl URL)` は bash 側の grep で拒否する
- 最終確認日: 2026-11-12
