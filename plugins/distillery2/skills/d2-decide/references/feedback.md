# mode=feedback (決定の差分)

実装で見つかった「ルールの穴」を、新しい ADR 1 本の `rules[]` にする mode である。

## いつ呼ばれるか

d2-run が、決定の差分で派遣する。
作業ディレクトリはリポのルートで、clean な main である。

対象は、戻し先が `decide` の課題ファイル `docs/feedback/<issue>.md` である (古い課題は `kind: rule`)。
課題が非機能グレード表の誤りなら、表を直す。

開発ルールとアーキテストは作り直さない。
課題をすべて ADR にした後に、d2-run が作り直す。

## 手順

| 順 | すること |
|---|---|
| 1 | 課題を読む。既存の ADR をすべて読み、課題がどの決定に関わるかを決める |
| 2 | ADR で直せない課題なら、**ADR を書かずに**止まる (下の「止まる条件」) |
| 3 | 課題が非機能グレード表の誤りなら、表を直す (下の「非機能グレード表を直す」) |
| 4 | 新しい ADR を 1 本書く |
| 5 | 既存の決定を置き換えるときだけ、新旧の ADR に置き換えを記録する |
| 6 | 検証と索引を回し、要約に追記する |
| 7 | 結果ファイルへ `status: applied` を書く |

### 手順 2: 止まる条件

次のどれかに当たるなら、結果ファイルへ `status: blocked`、理由、理由の種類 `reason_kind` を書いて止まる。

| 当たるもの | `reason_kind` | d2-run の扱い |
|---|---|---|
| ADR の `rules[]` で表せない (生成器の直し、設定ファイルの直し、手順書の直し) | `reason_kind: plugin` | 課題を `kind: plugin` に書き換える。直す場所は distillery2 側である |
| ティア構成、データストア、testing の capabilities を変える必要がある (config と骨格の作り直しが要る) | `reason_kind: scope` | 戻し先を基盤 (`foundation`) にするか、人に返す |

設定ファイル (`biome.json` など) は、生成器が作り直す。
対象リポジトリで直しても戻るので、ADR では直せない。

### 手順 3: 非機能グレード表を直す

課題が非機能グレード表 (`docs/nfr/nfr-grade.yaml`) の誤りのときだけ行う。
誤りとは、根拠の書き違いか、レベルの見直しである。

表を直して、段階②と同じ 2 つを回す。
md は手で書かない。

```bash
node <skills>/d2-decide/scripts/validateNfrGrade.js docs/nfr/nfr-grade.yaml
node <skills>/d2-decide/scripts/generateNfrGradeMd.js docs/nfr/nfr-grade.yaml
```

- レベルを変えずに済むなら、ADR は書かず、手順 6 へ進む
- レベルを変えたら、そのレベルに依る決定を、手順 4 の新しい ADR で直す

### 手順 4: 新しい ADR を書く

形は [adr-format.md](adr-format.md) にある。

| 項目 | 書き方 |
|---|---|
| 連番 | 既存の最大 + 1 |
| `status` | `accepted` |
| `basis` | 既存の ADR と同じ書き方 |
| `rules[]` | 1 つ以上 |
| 本文の背景 | 課題の要点を書く (課題のファイル名と、front matter の `from_uc`) |

### 手順 5: 置き換えの記録

既存の決定を置き換えるときだけ行う。

- 新しい ADR に `supersedes` を書く
- 旧 ADR は、front matter の `status: superseded` と `superseded_by` の 2 項目だけを変える

旧 ADR の本文と旧 `rules[]` は変えない (決定の履歴を残す)。
既存の ADR を、それ以外で変えない。

### 手順 5 の後: main マージ済みの UC への波及

足した ADR に合わせて、main マージ済みの UC (`docs/requirements/use-cases.yaml` の `status: done`) のシナリオ・契約・実装を直す必要があるかを、ADR の `rules[]` と UC の一覧から判断する。
直す必要がある UC は、UC ごとに引き継ぎファイルの `upstream_issues` に書く (戻し先は `scenario` / `contract` / `implementation` のうち直し始める段。`uc` にその UC の slug)。
進行役が課題ファイルにし、次の自動選択がその UC をその段から開き直す。
書かなかった UC は、開き直しの推奨にならない (決定が変わっただけでは作り直さない)。

### 手順 6: 検証、索引、要約への追記

`validateAdr.js` → `genAdrIndex.js` を回す (段階②と同じコマンド)。
自分が足した ADR (と、置き換えで front matter を変えた旧 ADR) の違反は、PASS するまで直す。
この派遣で触っていない既存の ADR だけが落ちるときは、その ADR を直さない (手順 5 の「既存の ADR を変えない」が先に立つ)。
自分の変更を残したまま、結果ファイルへ `status: blocked`、`reason_kind: scope`、理由 (落ちた ADR と検査の出力の要点) を書いて止まる。
`genArchitectureDoc.js` は回さない (ティアを変えないので、図は変わらない)。

`_review-summary.md` は作り直さず、**追記する**。

| 追記する節 | 書くこと |
|---|---|
| 「作り方の決定」 | 足した ADR。置き換えなら、旧 ADR を置き換えた旨 |
| 「確認してほしいこと」 | 足した ADR の `confidence: low` の前提と、直した非機能グレード表の根拠を、1 行ずつ |

既存の行は、置き換えた ADR の行だけ直す。
それ以外の既存の行には、注記も足さない (足した ADR の行に「どの決定を補うか」を書けば足りる)。
追記しないと、要約を読む人に変更が見えない。
決定のレビューが、毎回「要約が古い」を課題にする。

### 手順 7: 結果ファイル

結果ファイルへ、次を書く。

- `status: applied`
- `targets`: 足した ADR のファイル名と、置き換えた旧 ADR。表を直したら `docs/nfr/nfr-grade.yaml`
- `reason`: 1 行

結果ファイルは JSON 1 つ: `{"status": "applied" | "blocked", "targets": [...], "reason": "...", "reason_kind": "plugin" | "scope"}` (`reason_kind` は `blocked` のとき必須)。
d2-run は、このファイルで分岐する。
受理は `validateAdr.js` で行う (報告文では判断しない)。

## mode=feedback: 読むもの

- 課題ファイル `docs/feedback/<issue>.md` (派遣文で渡す)
- `docs/adr/*.md` (既存の ADR と索引)、`docs/nfr/nfr-grade.yaml` (決定の根拠)
- `docs/requirements/use-cases.yaml` (main マージ済みの UC への波及を判断するとき)

## mode=feedback: 書くもの

- `docs/adr/NNNN-<slug>.md` (新しい ADR 1 本。置き換えなら旧 ADR の front matter 2 項目も)、`docs/adr/index.md` (genAdrIndex)
- `docs/nfr/nfr-grade.yaml` / `nfr-grade.md` (課題が非機能グレード表の誤りのときだけ)
- 結果ファイル `.distillery/logs/decide-<issue>.result.json` (派遣文で渡す)
- git は使わない (commit は d2-run が行う)

## mode=feedback: 完了報告

次のものだけを報告する。

- 結果ファイルの `status`
- 足した ADR と、置き換えた旧 ADR のパス
- `validateAdr.js` の結果 (blocked なら理由)
