# ③ 基盤

骨格、契約の骨格、画面部品を作り、仕上げてから commit する。

順序は「骨格・依存 → 契約の骨格 → design → 仕上げ (契約込みの config / CI / C4 図・画面部品の取り込み・契約テスト・チェックポイント)」。

順序の理由:

- 契約の骨格は redocly (npm install 後) が要り、config / CI は契約 (`contracts/contracts.json`) を読むので、契約の後にもう一度生成する
- design は config も契約も読まないので、契約の骨格の直後に回し、仕上げを 1 回の派遣にまとめる

スクリプトは d2-foundation が回す (phase の中身は d2-foundation の SKILL.md)。
d2-run は派遣と受理だけを行う。
どの派遣も再実行して安全 (中断したら同じ手順から再開する)。

| 順 | すること |
|---|---|
| 1 | 骨格・設定・依存を入れる |
| 2 | 契約の骨格を作る |
| 3 | 画面部品を作る (frontend ティアがあるとき) |
| 4 | 契約の骨格と画面部品を、先に commit する |
| 5 | 仕上げを派遣し、受理の検査をする |
| 6 | 引き継ぎファイルを処理し、基盤のレビューを回し、確認して commit する |

1. sub `d2-foundation phase=all` (F1→F2→F3→F5→F7。骨格・設定・依存を入れる・qlty の提案を足す。この時点の genConfig は `contracts: []` の警告付きでよい)
2. sub `d2-contract mode=skeleton` (compile に redocly を使う)
3. (frontend ティアがあれば) sub `d2-design`。design が部品を生成したときだけ次の仕上げに `ui=true` を渡す。
   frontend ティアが無い (design を派遣しない) か、design が「画面を持たないプロダクトのため skip」と報告したら `ui=false`
   (前の実行の `docs/design/` が残っていても取り込ませない)。design の完了報告が届くまで仕上げに進まない (subagent-template.md の例外)
4. 仕上げの前に、契約の骨格と画面部品だけを先に commit する: `git add contracts docs/design && git commit -m "foundation: contracts and design" -m "<attribution 行>"`
   (`docs/design` が無ければ `contracts` だけ。変更が無ければ飛ばす)
5. `.distillery/runs/bootstrap/reports/gates.json` があれば消してから、sub `d2-foundation phase=finish ui=<true|false>` (F8→F6→F7→F4→F9)。受理時の検査は下のとおり。
   満たさなければ報告を添えて人に見せ、先へ進まない
6. 3 つの派遣 (骨格・契約の骨格・画面部品・仕上げ) の引き継ぎファイルを処理し、基盤のレビュー (`--point foundation`) を回す。`.distillery/config.yaml` の tiers / contracts / commands / capabilities を確認ページに載せ (モードの規則で人に返す問いがあるときだけ止まり、無ければ推奨で承認して記録)、承認後に `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A && git commit -m "foundation: rules, tests, config" -m "<attribution 行>"`
   (差し戻しで契約の骨格や design をやり直したら、4 から繰り返す)

手順 4 で先に commit する理由:
仕上げが作る config・C4 図・画面部品の取り込み記録は、入力を最後に commit した commit を basis に記録する。
未 commit のままだと basis が空になり、契約や画面が変わっても古さを検出できない

## 仕上げの受理時の検査 (手順 5)

読むだけで、runGates を回し直さない。
次のすべてを満たすことを確かめる。

- `.distillery/runs/bootstrap/reports/gates.json` があり、`uc` が `bootstrap`、`result` が `pass`、`gates` (`{name, status}` の配列) のうち `name` が `static` の要素の `status` が `pass`
- `node <skills>/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root . --check` が exit 0 (骨格分の契約テストが今の契約から生成済み。static のゲートは契約テストの生成を見ないため)
- `node <skills>/d2-foundation/scripts/genCheck.js --cwd . --check` が exit 0 で、`git config core.hooksPath` が `.githooks` (機械チェックの一括実行とコミットのときの hook が入っている)

基盤の差分の手順は、routing.md「上流の差分」にある。
