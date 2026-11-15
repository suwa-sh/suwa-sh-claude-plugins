# ② 決定

非機能グレード表と ADR を作り、確認して commit する。

1. sub `d2-decide` を派遣する
2. 引き継ぎファイルを処理し、決定のレビュー (`--point decide`) を回してから、`docs/adr/_review-summary.md` を材料に確認ページ (非機能グレード表の要点、各決定と却下した案、confidence: low の決定は選択肢として提示。モードの規則で人に返す問いがあるときだけ止まり、無ければ推奨で承認して記録)
3. 承認されたら `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A -- docs .distillery ':(exclude).distillery/logs' && git commit -m "decide: nfr and adr" -m "<attribution 行>"`。選択が変わった決定は ADR を直して (sub に戻す) 再提示

決定の差分 (実装で見つかったルールの穴を直す) の手順は、routing.md「上流の差分」にある。
