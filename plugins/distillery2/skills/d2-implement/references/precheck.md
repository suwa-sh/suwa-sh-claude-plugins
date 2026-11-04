# mode=precheck (機能の最初の点検)

機能の作業 (シナリオ・契約・実装) を始める前に、この UC を最後まで作るのに要る上流の決めごと (要求・決定・基盤) が揃っているかを、**読むだけ**で確かめる。
足りないものを引き継ぎファイルにまとめて書く。機能の途中で 1 件ずつ見つかって、そのたびに機能を止めて上流を直す往復を減らすため。

ティアごとに 1 つの派遣 (並列)。自ティアの目で見る。

## 読むもの (read-set)

- `.distillery/config.yaml` (ティアと能力)
- `docs/requirements/use-cases.yaml` の UC の行 (`spec_ids`・`tiers_hint`)、`docs/requirements/requirements.yaml` の該当する仕様と受入基準、`docs/requirements/rdra/**` (情報・状態・条件)
- `docs/adr/*.md` (決定と front matter の rules)、`docs/rules/**` (開発ルール)
- `contracts/**` (骨格: 共通のコンポーネント・エラーの型・既にある operation)
- 画面を持つティアなら `docs/design/screens.yaml` と `packages/ui/**`

## 書くもの (write-set)

- なし (読むだけ。書くのは引き継ぎファイル `{handoff}` だけ。追跡しているファイルを書かない)

## 進め方

1. UC の受入基準を 1 つずつ見て、自ティアで実装するのに要る決めごとを挙げる: データの持ち方・認可・同時の更新 (二重の登録など)・状態の遷移・エラーの返し方・期限や上限の値・画面の部品・外部とのやり取り
2. それぞれが要求 (受入基準・業務ルール)・決定 (ADR の rules)・開発ルール・契約の骨格・画面部品のどこかで決まっているかを確かめる
3. 決まっていない・食い違うものを引き継ぎファイルの `upstream_issues` に書く。戻し先は `requirements` / `decide` / `foundation` だけ
   (機能の中 (`scenario` / `contract` / `implementation`) の課題は書かない。まだ作っていないので、その段の担当が決める)
4. **1 件見つけたら、残りもすべて洗い出して同じファイルに書く** (1 件ずつ返すと、上流の直しと機能の往復が件数だけ増える)
5. 推奨の直し方 (`recommended_fix`) は、この UC だけでなく後の UC でも使える形で書く
6. 機能の中で決めて前提の記録 (AssumptionRecord) に残せる細かいことは課題にしない。課題にするのは、決めないと後の UC と食い違うものだけ
7. 機能の中で先に足してよいものは課題にしない: 画面の土台に無い横断の結線 (ADR で決めたサインイン・戻り先・API の宛先・開発時の中継。`docs/rules/tier-frontend.md`) は、最初に要る画面の機能が足す。
   ADR がその結線の方式を決めていないときだけ、戻し先 `decide` の課題にする
8. 戻し先が `plugin` (distillery2 の側の不具合) でも、リポの中で回避できるなら回避の仕方を `workaround` に書く (回避できる課題では機能を止めない。routing.md「プラグインの不具合」)

## 完了条件

- `node <skills>/d2-common/scripts/handoff.js validate {handoff}` が exit 0 (課題が 0 件でも空の配列で書く)

## 禁止

- 追跡しているファイルを書くこと (main の上で回るので、書くと main が汚れる)
- git 操作、`docs/feedback/` や `.distillery/runs/` に直接書くこと
