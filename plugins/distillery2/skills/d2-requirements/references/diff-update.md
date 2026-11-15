# 差分更新 (既存の要求をインプレース編集する)

既存の `docs/requirements/` があるときの手順である。
変更要望のテキストを USDM で解釈し、既存ファイルを**編集**する。
作り直さない。

## 入力が課題ファイルのとき

入力が課題ファイル (`docs/feedback/<issue>.md`) のときがある。
課題ファイルは、実装で見つかった要求の穴を書いたものである。

- 課題ごとに、本文の事実、選択肢、決定を、変更要望として読む
- 課題ファイルは読むだけで、消さない (反映を人が承認した後に d2-run が消す)
- 最終報告には、課題ごとに、反映した要求と仕様の ID を書く

**課題ファイルの「決定」に従って反映する**。決定と違う反映にするなら、最終報告の「**決定と違う反映**」に課題・決定・実際の反映・理由を書く (無ければ「なし」)。
d2-run がこれを確認ページに載せ、人が差し戻せるようにする。

## 手順

1. `docs/requirements/requirements.yaml` に、要求、仕様、受入基準を追記または修正する。ID は既存と重複させない
2. 影響する `docs/requirements/rdra/*.tsv` を編集する
3. 検証、Markdown、ビュー、不整合チェックを更新する (下の「再実行するコマンド」)
4. **UC 一覧**を再生成する
5. **確認材料**を作り直す
6. 最終報告に「変更したファイル」と「追加／変更／削除した要求・UC」を列挙する
7. 最終報告に「**残った作業**」を書く: 課題を反映するために write-set (`docs/requirements/**`) の外で必要になった作業
8. 最終報告に「**仮に決めた反映**」を書く
9. 最終報告に「**決定と違う反映**」を書く (上の「入力が課題ファイルのとき」)

### 手順 1: 仕様を UC 単位に分ける

仕様は 1 つの UC で確かめられる単位に分ける (`usdm-decompose.md` 5 節)。
課題が「他の UC の振る舞いが受入基準に混ざっている」なら、仕様自体を UC ごとに分け、手順 4 で `spec_ids` / `spec_ids_rejected` を整える。

### 手順 3: 再実行するコマンド

初期構築の手順 2・3・5・8 を再実行する。
**差分更新では入力ディレクトリを `docs/requirements/rdra` にする**。
一時ディレクトリ `1_RDRA/` は、初期構築の手順 9 で削除済みのためである。

```bash
node <skills>/d2-requirements/scripts/validateRequirements.js docs/requirements/requirements.yaml
node <skills>/d2-requirements/scripts/generateRequirementsMd.js docs/requirements/requirements.yaml
node <skills>/d2-requirements/scripts/generateRdraMd.js docs/requirements/rdra --lint
node <skills>/d2-requirements/scripts/generateRdraMd.js docs/requirements/rdra
```

関連データと ZeroOne は、TSV を変えたときだけ再生成する。

```bash
node <skills>/d2-requirements/scripts/makeGraphData.js docs/requirements/rdra
node <skills>/d2-requirements/scripts/makeZeroOneData.js docs/requirements/rdra
```

### 手順 4: UC 一覧の再生成で引き継がれるもの

既存の `slug`・`status`・`tiers_hint`・`spec_ids_rejected` は、uc_id で引き継がれる。
`spec_ids` は、却下済みを除いた推定候補との和集合になる。
編集の決まりは [use-cases.md](use-cases.md) にある。

### 手順 7: 残った作業

種類は 2 つに限る。

- `design` (画面の見本): 対象 = `docs/design/storybook-app/src/<相対パス>` (見本 `stories/<Name>.stories.tsx` でも部品 `components/**` でもよい。取り込み先 `packages/ui/` ではなく見本側のパス) と直す内容
- `assumption` (前提の記録を閉じる): 対象 = UC の slug・ティア・attempt・`A-xxx` の id (`.distillery/runs/<slug>/attempt-<n>/assumptions.<tier>.yaml`) と、今回の決定で閉じる理由

自分では触らない (write-set の外)。無ければ「なし」。
どちらでもない作業 (既存の feature の受入タグなど) は、作業に入れない。
「仮に決めた反映」か「決定と違う反映」に書く。

d2-run が確認ページに種類ごとに載せ、人が「対応する / 無視」を選ぶ。

| 種類 | 「対応する」が選ばれたとき |
|---|---|
| `design` | 画面部品の担当 (d2-design mode=feedback) に再派遣して、取り込み直す |
| `assumption` | 要求の差分で閉じる |

### 手順 8: 仮に決めた反映

次の 2 つを書く。無ければ「なし」。

- 課題に決定が無く (選択肢だけで人が決めていない) 自分が案を選んで反映したもの (課題・選んだ案・理由) と、課題の決定の外の論点を自分が案を選んで反映したもの (課題・論点・選んだ案・理由)

課題が想定していない論点 (課題の決定の外で、反映するのに人の判断が要るもの) も決めずに返さない。推奨の案で反映し、「仮に決めた反映」に論点・選んだ案・理由を書く。
問いとして返すと、確認ページに載せる場所が無いためである。

d2-run が、確認ページに「決定と違う反映」と並べて載せ、人が差し戻せるようにする。
