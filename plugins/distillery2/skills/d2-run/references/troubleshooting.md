# d2-run トラブルシューティング

オーケストレータ (d2-run) の実行環境 (headless の許可、npm、補助スクリプト) で踏んだ問題。実走で踏んだ環境依存の問題と回避策をためる (手順そのものには書かない)。項目は「症状 → 原因 → 回避」の順。
他のスキルの項目: [`d2-foundation`](../../d2-foundation/references/troubleshooting.md) / [`d2-contract`](../../d2-contract/references/troubleshooting.md)

③ の `npm install` は 0.1.22 から d2-foundation (F7) が回す。npm 10 で落ちる件は [d2-foundation の項目](../../d2-foundation/references/troubleshooting.md) に移した。

## headless (`claude -p`) で `$VAR` を含む Bash が承認待ちで止まる

- 症状: `Contains simple_expansion` と出て一部のコマンドが拒否される
- 原因: allowedTools の照合が変数展開を含むコマンドを通さない
- 回避: コマンドを分割し、変数展開を使わずに書く (パスは直書き)。`cd` を含む複合コマンドも同様に分ける

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
