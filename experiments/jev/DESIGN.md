# Jev 実測ハーネス 設計

distillery の判定の一部を、判定専用モデル Jev (TypeSafe System One) に任せられるかを実測する。
配布プラグイン (`plugins/`) は変更しない。このディレクトリだけで完結させる。

## 目的と範囲

| 項目 | 内容 |
|---|---|
| 測る判定 A | クラウドデザインパターン 30 種 (`arch-design-patterns.md` の個別パターン見出し。組み合わせ見出し 5 件を除く) の適用可否 (dist-architecture) |
| 測る判定 B | 仕様 1 件が影響する RDRA モデル種別 8 種の該当有無 (dist-requirements) |
| 正解の候補 | 現行方式 (Claude) の成果物から機械抽出する。絶対の正解ではない |
| 測るもの | 確信帯の一致率、保留率、入力トークン、所要時間、質問文の言語 (en / ja) による差 |
| 対象外 | `target` (要素名) の生成、`action` (add / modify / delete)、NFR グレード、プラグイン本体への組み込み |

判定 B は 1 仕様に複数種別が付く多ラベルである (見本で確認済み)。Choice 1 問ではなく、種別ごとの Noul 8 問にする。

## Jev の事実 (公式文書で確認済み。推測で変えない)

| 項目 | 値 |
|---|---|
| エンドポイント | `POST https://api.typesafe.ai/v1/systemone` |
| 認証 | `Authorization: Bearer <TYPESAFE_API_KEY>` |
| モデル | `jev-1.13.0` を固定指定する (`jev-latest` は使わない) |
| リクエスト | `{ model, state, questions: { <id>: { type: "noul", instructions } } }` |
| レスポンス | `{ model, answers: { <id>: { type: "noul", noul: 0〜1 } }, usage: { input_tokens, output_tokens } }` |
| 上限 | リクエスト全体 64k tokens、state + 最長の質問で 32k tokens |
| レート制限 | 1,200 req/min。429 は指数バックオフで再試行 |
| 並列 | 1 リクエスト内の質問は独立・並列に評価される。質問 ID はモデルに送られない |
| state の参照 | 質問文から state の値をバッククォート付きパスで参照する (例: `` `activities` ``) |
| 苦手 | 数え上げ・数値比較、日付比較、多段推論、無関係な情報が多い大きな state、否定や暗黙条件 |
| 言語 | 英語が主。日本語は対応するが同等の精度ではない |

疎通は確認済み (日本語の state + 英語の質問、Noul 2 問で 603 ms、input_tokens 328)。

## 分担の原則

```text
入力ファイル ─▶ features.js (数える・数値を比べる・必要な部分だけ切り出す)
             ─▶ judge (Jev に意味の判定だけを聞く。生の確率を保存)
             ─▶ report.js (閾値を当てて正解の候補と比べる。Jev を呼び直さない)
```

- 数値条件はコードで判定する。Jev に数えさせない。ただし根拠が「または」や並列の複数シグナルの一部でしかない件数条件を
  必須 gate にすると、別のシグナルで適用になるケースを Jev に聞く前に非適用へ倒してしまう。そのため件数条件は 2 種類に分ける
  - `numericGates` (hard gate。1 つでも偽なら Jev を呼ばず非適用): (a) 根拠の RDRA シグナルが全て外部システムの存在を
    前提にしているパターンの `counts.externalSystems >= 1` (論理的な必要条件)、(b) 根拠の NFR シグナルに明示の閾値
    (「>= Lv3」) があるもの
  - `codeSignals` (支持シグナル。真偽をコードで確定し、`questions` の回答と同列に `combine` へ参加させる。確定値 (1 or 0)
    のため Jev を呼ばずに判定できる場合はそのまま code-decided にする): それ以外の並列的な件数条件
  - `excludeCodeSignals` (除外側の数値条件。真なら Jev を呼ばず非適用に確定する。除外側は常に OR)
- 件数条件を `codeSignals` に入れる際は、根拠の文が「A、または B」のような独立した並列シグナルなのか、「A（数値）、B（結果）」
  のように読点でつながれた 1 つの連言 (AND) なのかを読み分ける。連言の場合に数値条件だけを `combine: any` に入れると、
  数値条件単独で適用を確定してしまう誤りになる (例: event-sourcing の「状態遷移が多く（8種以上）、変更履歴の完全な追跡が
  必要」は連言なので `combine: all` にした)。この点検は `codeSignals` を持つ全パターンに対して行う
- Jev に渡す state は、その質問群に関係する部分だけにする。パターンごとに実際に参照する slices だけを宣言し、
  グループの state は同じリクエストにまとめるパターンの slices の和集合にする
- 生の確率と閾値の適用を分ける。閾値を変えても API を呼び直さない

## ファイル構成

```text
experiments/jev/
  DESIGN.md
  README.md                 実行手順
  input/initial-request.md  小さな要望 (作成済み。変更しない)
  lib/jevClient.js          API 呼び出し
  lib/features.js           決定的な特徴量抽出
  lib/labels.js             正解の候補の抽出
  lib/patternJudge.js       判定 A
  lib/modelTypeJudge.js     判定 B
  patterns/patterns.json    30 パターンの判定定義
  run.js                    判定を実行して生の結果を JSON に保存
  report.js                 生の結果から比較レポート (Markdown) を作る
  results/                  生の結果とレポート (コミット対象)
  test/*.test.js            node:test。ネットワークを使わない
```

- CommonJS、`node:` 接頭辞、Node 20 以上。既存の `plugins/distillery/skills/*/scripts/*.js` の書き方に合わせる
- YAML はリポジトリ直下の devDependencies にある `yaml` パッケージで読む。依存を追加しない
- テストは `node --test experiments/jev/test/*.test.js` で実行する (ファイルのグロブを渡す。ディレクトリを直接渡す
  `node --test experiments/jev/test/` は Node のバージョンによっては `MODULE_NOT_FOUND` で失敗することを確認済み)。
  `tests/run-tests.js` (CI) には載せない

## 入力ディレクトリ

`--docs <dir>` は次の配置を持つディレクトリを指す。

```text
<dir>/rdra/latest/{BUC,アクター,外部システム,情報,状態,条件,バリエーション}.tsv, システム概要.json
<dir>/nfr/latest/nfr-grade.yaml
<dir>/usdm/latest/requirements.yaml
<dir>/arch/latest/arch-design.yaml, arch-design.md, decisions/*
```

(`decisions/*` は当初 `decisions/*.md` を想定していたが、`samples/distillery/pipeline` の実物は `decisions/*.yaml`
だったため、拡張子を問わず `decisions/` 配下の全ファイルを対象にする)

| 名前 | パス |
|---|---|
| 見本 (図書館) | `samples/distillery/pipeline` |
| 小さな要望 (備品貸出) | `/private/tmp/distillery-jev-test/docs` (基準の実行が完了すると出来る) |

実装とテストは見本だけで進める。小さな要望の成果物に依存するテストを書かない。

## lib/jevClient.js

- `resolveApiKey()`: 環境変数 `TYPESAFE_API_KEY`。無ければ `~/.zshrc` の `export TYPESAFE_API_KEY="..."` 行から読む。
  行頭が `#` のコメント行は拾わない (行頭が `export` で始まる行だけを対象にする)。キーをログ・例外・結果ファイルに出さない
- `ask({ state, questions, fetchImpl })`: 1 リクエストを送り `{ answers, usage, latencyMs, model }` を返す
- 429 と 5xx は指数バックオフで最大 3 回再試行する。4xx は本文の先頭 500 文字を付けて即失敗させる
- タイムアウト 30 秒。本文の読み取り (JSON パース) が完了するまでタイマーを維持し、`finally` で解除する
  (ヘッダー受信直後に解除すると、本文の読み取りが止まる場合にタイムアウトが効かなくなるため)
- `fetchImpl` を注入できるようにして、テストではネットワークを使わない

## lib/features.js

`extractFeatures(docsDir)` が次を返す。TSV は 1 行目が見出し。`""` だけのセルは空として扱う。

| キー | 内容 |
|---|---|
| `counts` | 外部システム数、アクター数、社外アクター数 (`社内外` 列)、情報数、状態モデルごとの遷移数の最大値、BUC 数、UC 数 (重複排除) |
| `nfr` | メトリクス ID → `grade` の対応 (`nfr-grade.yaml` を再帰的にたどり、`id` と `grade` を持つ要素を集める) |
| `slices.activities` | BUC.tsv から `{ buc, activity, uc, description }` を重複排除した配列 |
| `slices.externalSystems` | `{ name, role }` |
| `slices.actors` | `{ name, role, internalExternal }` |
| `slices.information` | `{ name, attributes, description }` |
| `slices.conditions` | `{ name, description }` |
| `slices.stateModels` | `{ model, transitions }` |
| `slices.overview` | システム概要.json の内容 |

## patterns/patterns.json (判定 A の中心)

`plugins/distillery/skills/dist-architecture/references/arch-design-patterns.md` の個別パターン (30 件。「パターンの組み合わせ」
節の組み合わせ見出し 5 件を除く) を、1 パターン 1 要素で定義する。
同ファイルの「RDRA シグナル」「NFR シグナル」「適用すべきでない場合」の行が根拠である。根拠に無い条件を足さない。

```json
{
  "id": "circuit-breaker",
  "name": "Circuit Breaker",
  "aliases": ["Circuit Breaker", "サーキットブレーカー"],
  "weakAliases": [],
  "group": "external-integration",
  "slices": ["activities", "externalSystems"],
  "always": false,
  "numericGates": [{ "feature": "counts.externalSystems", "op": ">=", "value": 1 }],
  "codeSignals": [],
  "excludeCodeSignals": [],
  "questions": [
    {
      "key": "calls_external",
      "en": "Do any of the `activities` call one of the `externalSystems` over the network?",
      "ja": "`activities` の中に、`externalSystems` のいずれかをネットワーク越しに呼び出すものがあるか"
    }
  ],
  "excludeQuestions": [],
  "combine": "all",
  "source": "arch-design-patterns.md: Circuit Breaker"
}
```

| フィールド | 意味 |
|---|---|
| `always` | true なら Jev を呼ばず「適用」とする (例: Health Endpoint Monitoring は「常に推奨」) |
| `numericGates` | コードで判定する hard gate。1 つでも偽なら Jev を呼ばず「非適用」。残せるのは (a) `counts.externalSystems >= 1` (根拠の RDRA シグナルが全て外部システムの存在を前提にしている場合の必要条件)、(b) NFR の明示閾値 (`nfr.A.2.1.1`、`nfr.B.1.1.1`、`nfr.B.1.1.2`、`nfr.A.3.1.1` の 4 件のみ) だけ |
| `codeSignals` | コードで真偽を確定する支持シグナル。根拠が「または」や並列の複数シグナルの一部でしかない件数条件はここに入れ、`questions` の回答と同列に `combine` へ参加させる。真偽が確定した時点 (`any` で真、または `all` で偽、かつ他の questions が空) で Jev を呼ばずに確定できる |
| `excludeCodeSignals` | コードで真偽を確定する除外シグナル (常に OR)。1 つでも真なら支持側を問わず Jev を呼ばず非適用に確定する。根拠の「適用すべきでない場合」が数値条件のときに使う (例: bulkhead の「外部連携先が1つのみ」) |
| `questions` | 適用を支持する意味の判定。各 1 問は 1 つの狭い判定にする。否定形にしない |
| `excludeQuestions` | 「適用すべきでない場合」に当たるかの判定。はいなら非適用に倒す |
| `combine` | `all` = `questions`（と `codeSignals`）が全てはい / `any` = どれか 1 つがはい |
| `group` | 同じリクエストにまとめる質問群 (バッチ単位)。グループごとに 1 リクエストにまとめる |
| `slices` | そのパターンの `questions`/`excludeQuestions` が実際に参照する `features.slices.*` のキー。グループの state は、そのリクエストに含まれる全パターンの `slices` の和集合にする (パターンごとに必要な slice が異なるため、固定のグループ別テーブルは使わない) |
| `aliases` | 正解の候補を成果物から探すときの強い別名 (パターン名として言及されたと信頼できる表記) |
| `weakAliases` | 一般語で、パターン名としての言及と断定できない別名 (例: `Retry`/`リトライ`、`Timeout`/`タイムアウト`、`CDN`、`API Gateway`、`ACL`、`BFF`、`署名付きURL`、`ヘルスチェック`)。自由記述中の出現は `applied`/`not_applied` を付けず `ambiguous` 止まりにするが、構造化された採用の文脈 (YAML の `name:` キーの値、Markdown 表の先頭2セル) での出現は強い別名と同列に扱う |

NFR シグナルが「>= Lv3」のように数値で書かれているものだけ `numericGates`/`codeSignals` の対象にする。「グレードが高いほど優先度が上がる」のような程度の表現は対象にしない。
NFR のメトリクス ID は `nfr-grade.yaml` に実在する ID だけを使う。パターン定義の「A.2.1」のような上位 ID は、配下の重要メトリクス (例: `A.2.1.1`) に対応づけ、対応づけを `source`/`notes` に書く。対応が一意に決まらない場合は gate/codeSignal にせず、`notes` に未解決として書く。

件数条件が numericGates(a/b) と codeSignals/excludeCodeSignals のどちらに当たるかは、根拠の文が「〜が必要条件」なのか
「〜、または…」の並列シグナルの一部なのかを読み直して判断し、判断の根拠 (引用) を `notes` に書く。

質問の分割方針: 「適用すべきでない場合」に「。」や「または」で区切られた独立条件が複数あれば、`excludeQuestions` を
別々の質問に分ける。ただし state の slices に判断材料が無い条件は質問にせず、`notes` に「未モデル化 (入力に情報なし)」
と根拠の引用つきで書く。「判断材料が無い」とは、state のどの slice を見ても、バイトサイズ・実装コスト・応答時間
(NFR相当、対象外)・ティア構成 (arch出力であり RDRA/NFR入力ではない) のように、その質問に答えるための事実が
原理的に含まれ得ないことを指す (例: cache-aside の「キャッシュ対象データが大きすぎる」、sharding の「クロス
シャードの結合クエリが頻繁」、claim-check の「MQのサイズ制限」、valet-key の「ファイルサイズ・性能」、bulkhead の
「リソース隔離コスト」、gatekeeper-gateway-offloading/external-configuration-store の「サービス・環境の数」、
materialized-view の「リアルタイム性の最優先」、strangler-fig の「システム規模・移行リスク」)。

除外質問は、記述の不在を推測させる否定形 (「〜ではないか」「示していないか」) ではなく、明記された事実の有無を
問う肯定形で書く (例: 「`overview` に、単一リージョンでの運用で十分であると明記されているか」)。Jev は暗黙条件・
否定の読み取りが苦手なため (Jev の事実を参照)、確信を持って判定できるのは「明記された肯定的な事実がある/ない」の
方であり、「言及が無いことから非該当と推測する」形にはしない。

一方、`questions`（適用を支持する側）は、TypeSafe の公式指針 (原子的とは 1 文に限ることではなく、判定している関係
そのものを壊さない範囲で分ける) に沿い、独立した事実の複合だけを分割する。「複数ステップの業務の一部として外部を
呼ぶ」のように、それ自体が 1 つの関係を判定している質問 (saga / cqrs / priority-queue 等) は分割しない。valet-key
は「ファイル属性を持つ情報がある」と「アップロード/ダウンロードのアクティビティがある」という独立した 2 つの事実
なので、この方針の例外として 2 問に分割し `combine: all` にした。

## lib/patternJudge.js

1. `always`、`numericGates` (hard gate) をコードで処理する
2. `excludeCodeSignals` を評価する。1 つでも真なら、支持側を問わず Jev を呼ばずに非適用に確定する (除外側は OR)
3. 残りの `codeSignals` を評価し、支持側 (`codeSignals` + `questions`) の verdict を求める:
   `combine: "all"` は `codeSignals` に1つでも偽があれば即座に非適用確定。`codeSignals` が全て真かつ `questions` が
   空なら適用確定。`combine: "any"` は `codeSignals` に1つでも真があれば適用確定 (ただし `excludeQuestions` が
   残っていれば、支持側が確定していても除外質問だけは Jev に聞く。**支持側の短絡確定が除外質問を飛ばしてはいけない**)。
   `codeSignals` が全て偽かつ `questions` が空なら非適用確定。それ以外は未確定 (Jev が必要)
4. まだ確定しないパターンをグループごとに 1 リクエストにまとめる。支持側が確定済みで除外側だけ残っている場合は
   `questions` を送らず `excludeQuestions` だけを送る (無駄な呼び出しを避ける)。質問 ID は `<patternId>.<key>`
   (`codeSignals`/`excludeCodeSignals` は `<patternId>.codesignal.<key>` / `<patternId>.exclude.codesignal.<key>`
   という擬似回答キーで `rawAnswers` に注入し、確定値 1 or 0 として `questions`/`excludeQuestions` の回答と同列に
   扱えるようにする)。state はそのグループに含まれるパターンの `slices` の和集合
5. 生の確率 (と codeSignals/excludeCodeSignals の擬似回答) を返す。適用 / 非適用 / 保留の決定はしない (report.js の責務)

## lib/modelTypeJudge.js

- `requirements.yaml` の仕様 1 件につき 1 リクエスト、Noul 8 問 (種別ごと)
- state は `{ requirement, reason, specification, acceptance_criteria }`
- 質問文は判定対象が RDRA モデルの記述であることを明示し、かつ state のキーをバッククォートで直接参照する形にする
  (「この仕様」「this specification」という指示語だけで済ませない):
  「`specification` と `acceptance_criteria` に書かれた内容により、RDRA の<種別名>モデルに要素を追加する、または
  既存要素の記述を変更する必要があるか。<種別名>モデルとは: <定義>」
  (「人や役割そのものを新しく作るか」のように読めてしまう表現は避ける)。種別の定義は
  `plugins/distillery/skills/dist-requirements/references/usdm/usdm-decompose.md` と RDRA の意味に沿って 1〜2 文で書く。en / ja の両方を用意する

## lib/labels.js

正解の候補は 3 値 (`applied` / `not_applied` / `ambiguous`) にする。単純な部分文字列検索だと「CQRS は不採用」のような
却下の言及や decisions の却下案まで適用として数えてしまうため、出現箇所を adopted (採用の文脈) / rejected (却下の文脈) に
分類する。

| 関数 | 内容 |
|---|---|
| `patternLabels(docsDir, patterns)` | `arch-design.yaml` / `arch-design.md` / `decisions/*` に `aliases`/`weakAliases` の出現を集め、下記のルールでラベルを決める。出現箇所 (ファイル・行・別名・分類) を返す (各分類最大 3 件) |
| `modelTypeLabels(docsDir)` | 仕様 ID → `affected_models[].type` の集合 |

出現の分類:
- rejected = decisions の `alternatives_considered:` 以降 (decision record の schema 上、最後のキーであることを利用し、
  その行から末尾までを却下ゾーンとする)、または同じ行に「不採用」「採用しない」「見送」「過剰」「不要」「却下」を含む
- 上記に当たらなければ adopted

`weakAliases` の出現は、原則 adopted/rejected の判定に使わず `ambiguous` の材料にしかしない。ただし次のどちらかに
当たる「構造化された採用の文脈」での出現は、強い別名と同列に扱い（却下ゾーン/キーワードに当たれば rejected にもなる）:
- (a) YAML の `name:` キーの値の中 (例: `name: "Retry + Circuit Breaker + Timeout"`)
- (b) Markdown 表の行の先頭 2 セル (ID 列・名前列を想定) の中

ラベルの決定:
- 強い別名 (`aliases`) および構造化された `weakAliases` の adopted 出現が 1 つ以上、rejected 出現が 0 → `applied`
- 上記の adopted・rejected が両方ある → `ambiguous` (混在)
- 上記の出現が rejected だけ → `not_applied`
- 上記の出現が無く、`weakAliases` の自由記述中の出現がある → `ambiguous`
- 出現が無い → `not_applied`

出現ベースの正解は粗い (言及 = 適用とは限らない)。`ambiguous` は一致率の分母から除外し、人が見る一覧に出現箇所つきで出す。

## run.js

```bash
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang en --judge patterns
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang ja --judge model-types
```

- 出力: `experiments/jev/results/<name>-<judge>-<lang>.json`
- 内容: 実行日時、モデル、言語、各質問の生の確率、コードで決めた項目とその理由、リクエストごとの `usage` と `latencyMs`、正解の候補
- `--dry-run`: API を呼ばず、送る予定のリクエスト (state と質問) を標準出力に出す。質問文のレビューに使う

## report.js

```bash
node experiments/jev/report.js experiments/jev/results/*.json --hi 0.8 --lo 0.2 > experiments/jev/results/report.md
```

- `--hi`/`--lo` は有限の数で `0 <= lo < hi <= 1` であることを検証する。値が欠落・不正なら理由を標準エラーに出し、
  終了コード 2 で終わる

| 指標 | 定義 |
|---|---|
| 確信帯 | 確率が `hi` 以上 (はい) か `lo` 以下 (いいえ)。欠落・非数値の回答も保留として扱う |
| 保留 | 確信帯の外 (欠落を含む)。Claude に回す想定 |
| 一致率 | 確信帯かつ正解の候補が `ambiguous` でない項目のうち、正解の候補と一致した割合 |
| 保留率 | 正解の候補が `ambiguous` でない全項目のうち保留の割合 |

- 判定 A は、回答（`questions`/`codeSignals`/`excludeQuestions`/`excludeCodeSignals` の擬似回答を含む）をそれぞれ
  yes/no/pending の3値に変換したうえで、次の3値論理で結論を決める。回答が1つでも保留だからといって結論全体を
  保留にはしない (確信帯の回答だけで結論が決まる場合は決める):
  - 支持側 (`combine: any`): yes が1つでもあれば yes。全て no なら no。それ以外 pending
  - 支持側 (`combine: all`): no が1つでもあれば no。全て yes なら yes。それ以外 pending
  - 除外側 (常に OR): yes が1つでもあれば yes。全て no なら no (除外条件が無ければ no で確定)。それ以外 pending
  - 結論: 支持 no → 非適用 / 除外 yes → 非適用 / 支持 yes かつ 除外 no → 適用 / それ以外 → 保留
- 正解の候補が `ambiguous` の項目は一致率・保留率の分母から除外し、「人が見る一覧」に出現箇所（分類つき）で出す
- 判定 B は、送った質問 (仕様 ID × 8 種、`requests[].questions` のキー) を分母にする。欠落した回答は保留に数え、
  欠落件数を別に表示する
- 結果ファイルごとの表 (件数、一致率、保留率、入力トークン合計、リクエスト数、所要時間の中央値) と、食い違い・保留・
  ambiguous の一覧 (項目名、確率、正解の候補、根拠の出現箇所) を出す
- コードで決めた項目 (always / numericGates / codeSignal / excludeCodeSignal での短絡確定) は、Jev の食い違い一覧とは
  別の表で一覧にする

## 既知の限界

- **入れ子の論理「(A かつ B) または C」を表せない**: `patterns.json` の1パターンは `combine`（`all`/`any`）を1つしか
  持てず、支持側の signal（`codeSignals` + `questions`）全体に同じ論理を適用する。根拠の文が
  「(数値条件 A かつ 意味条件 B) または (独立した意味条件 C)」の形をしている場合、この形式では表現できない
  - event-sourcing: 根拠は「(状態遷移が8種以上 かつ 変更履歴の完全な追跡が必要) または (監査・証跡ルールが存在する)」
    と読める。実装では前半を1つの質問 (`full_history_or_audit_needed`) にまとめて `codeSignal` と `combine: all` で
    判定しており、後半（監査・証跡ルールだけが独立に成り立つケース）を別枝として持てない。監査・証跡ルールはあるが
    状態遷移が8種未満、というケースは非適用側に倒れる
  - backends-for-frontends: 根拠は「(アクター種別3以上 かつ UI要件が大きく異なる) または (画面固有の集約パターンが
    ある)」と読める。実装では前半だけを `codeSignal` + `divergent_ui_needs` の `combine: all` で判定しており、
    後半（画面固有の集約パターンだけが独立に成り立つケース）は未モデル化。アクター種別が3未満でも画面固有の集約
    パターンがあれば適用してよいケースは非適用側に倒れる
  - どちらも、独立シグナルだけが成り立つ案件では実際には適用すべきパターンを非適用と判定する（偽陰性）方向にしか
    倒れない設計になっている（安全側ではあるが、見逃しのリスクがある）

## テスト (node:test、ネットワーク不使用)

| 対象 | 確かめること |
|---|---|
| features | 見本から件数と slices が取れる。`""` セルを空として扱う |
| labels | 見本で Cache-Aside が applied、CQRS が not_applied になる。retry/timeout が name: キーの構造化された出現で applied になる。adopted/rejected の分類、weakAliases の自由記述中の出現が ambiguous になることを確かめる。仕様 ID と種別集合が取れる |
| patterns.json | 30 件ある。`arch-design-patterns.md` の個別パターン見出し 30 件と 1 対 1 に対応する。必須フィールドが揃う。`nfr.*` の ID が見本の `nfr-grade.yaml` に実在する。`numericGates` に残るのは type(a)/(b) だけ。`questions`/`excludeQuestions` が参照するバッククォート付きキーが `slices` に含まれる。event-sourcing の combine が all であること。valet-key のみ questions が2分割されていること |
| jevClient | 注入した fetch で、成功・429 後の再試行・4xx 即失敗を確かめる。キーが例外文に含まれない。本文の読み取りが止まる場合もタイムアウトが効く。不正な JSON 本文はエラーにする。`~/.zshrc` のコメント行を拾わない |
| patternJudge | always/numericGates/codeSignal/excludeCodeSignal（短絡確定）の項目は fetch を呼ばない。支持側が真で確定しても excludeQuestions が残る場合は除外質問だけ送る。グループごとに 1 リクエストになる。全パターンの質問が参照するキーがそのリクエストの state に含まれる |
| modelTypeJudge | 全質問（en/ja）が state のキーを参照し、`specification` を必ず参照する |
| report | 固定の結果 JSON から、一致率と保留率（ambiguous除外、欠落は保留に加算）が手計算と一致する。3値論理の combine/exclude/結論テーブル。`--hi`/`--lo` の検証 |

## 完了条件

- `node --test experiments/jev/test/*.test.js` が全て通る
- `run.js --dry-run` が見本に対して両方の判定で動く
- 実 API の呼び出しは実装担当は行わない (計画役が実測で行う)
- `plugins/`、`samples/`、`tests/` を変更しない
- コミットしない
