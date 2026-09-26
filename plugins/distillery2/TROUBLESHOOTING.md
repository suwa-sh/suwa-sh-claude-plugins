# distillery2 トラブルシューティング

実走で踏んだ環境依存の問題と回避策をためる (手順そのものには書かない)。項目は「症状 → 原因 → 回避」の順。

## npm 10 の `npm install` が `Cannot read properties of null (reading 'edgesOut')` で落ちる

- 症状: ③ 基盤の `npm install` が npm 10 の内部エラーで止まる (2026-09-26 の実走)
- 原因: 任意の peer 依存の解決 (vitest → browser-playwright → jsdom → canvas) で npm 10 が落ちる
- 回避: `npx npm@11 install` で `package-lock.json` を作る。その lockfile があれば npm 10 の `npm ci` (CI と同じ) は通る。
  npm 11 は esbuild の postinstall を走らせないが、その後の `npm ci` を含めゲートは通った

## `qlty init` が「already initialized」で何も出さない

- 症状: `.qlty/qlty.toml` がある状態で `qlty init --dry-run` を回すと拒否される
- 原因: qlty は既存の設定があると dry-run でも初期化を拒む
- 回避: `genQlty.js --refresh` を使う (提案を取る間だけ設定を退避して戻す)。手で回すなら `qlty.toml` を一時的に別名にする

## qlty の提案に osv-scanner (依存の脆弱性検査) が入らない

- 症状: `qlty.toml` の plugins に osv-scanner が無い
- 原因: 提案はその時点でリポにあるファイル種別で決まる。lockfile が無い時点で提案を取ると入らない
- 回避: `npm install` の後に `genQlty.js --refresh` を回す (d2-run ③ の手順に入っている)

## 契約テストが `biome format` で落ちる

- 症状: 生成した `apps/<tier>/test/contract/*.ts` の埋め込み JSON を biome が展開して format_check が落ちる
- 原因: 生成物先頭の `// biome-ignore-all format:` は biome 2.2.5 では効かない (2.5.14 では効く)
- 回避: ルート `biome.json` の `files.includes` に `!**/test/contract/**` を入れる (0.1.15 の genSkeleton は入れる。旧リポは `genSkeleton.js --migrate`)

## headless (`claude -p`) で `$VAR` を含む Bash が承認待ちで止まる

- 症状: `Contains simple_expansion` と出て一部のコマンドが拒否される
- 原因: allowedTools の照合が変数展開を含むコマンドを通さない
- 回避: コマンドを分割し、変数展開を使わずに書く (パスは直書き)。`cd` を含む複合コマンドも同様に分ける

## `git add -N` が `index.lock` で失敗し、`genQlty.js` が固定リストに落ちる

- 症状: `genQlty --refresh: 追加なし (未追跡ファイルを index に載せられない ...)`
- 原因: 別の git プロセスが index を掴んでいる
- 回避: 他の git 操作が終わってから再実行する。固定リストで生成された場合は後で `--refresh` すれば提案の分が足される

## `"type": "module"` のリポで補助スクリプトを `.js` で書くと ESM として読まれて失敗する

- 症状: `require is not defined` / `module is not defined` で、オーケストレータが書いた補助スクリプトが落ちる
- 原因: 生成するルートの `package.json` は `"type": "module"`。`.js` は ES module として読まれる
- 回避: 補助スクリプトは `.cjs` にする (CommonJS)。`.distillery/logs/` に置く

## イベント記録と完了記録を同じ行に `&&` と `| cut` でつなぐと、失敗しても完了記録が走る

- 症状: 承認の記録が失敗したのに review の完了記録とコミットが走った (invalidate で復旧)
- 原因: パイプの終了コードは最後のコマンド (`cut`) のもので、前の失敗が隠れる
- 回避: 1 コマンド = 1 目的で分けて実行し、終了コードを見てから次へ進む。パイプで整形しない

## headless で `shasum` が承認待ちで止まる

- 症状: `shasum -a 256` を含むコマンドが allowedTools に無く止まる
- 回避: `node -e` の `crypto.createHash('sha256')` で計算する (node は許可済み)

## 契約テストの 401 が、提供側のテスト用ヘッダ補完のせいで落ちる (0.1.16 より前の実装)

- 症状: 0.1.15 以前に作った提供側の `test-app.ts` が Authorization を補うため、`x-headers: { Authorization: null }` の 401 テストが 200 になる
- 原因: 契約テストがヘッダを送れなかった頃の回避策が残っている
- 回避: 既存の operation にも `x-test-headers` を足して契約テストを作り直し、そのうえで提供側の補完を外す (0.1.16 の再実走でこの順に実施)

