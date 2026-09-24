# as-built ドキュメントの形と情報源

段階④の最後に `extractAsBuilt.js` が実装から抽出する。節の見出しに **抽出** (決定論スクリプト) / **要約** (LLM) /
**転記** (実行記録の写し) のラベルを付ける。要約は `<!-- 要約:begin <名前> -->…<!-- 要約:end -->` の中だけに、
コード位置 `path:line` を根拠に書く。

読者の問いの順に並べる: 何をする機能か → 結果は → 入口はどこか → どう動くか → 何を守っているか → 何を決めたか →
残っている課題は → 証跡 → 付録。機械向けの情報 (sha、変更ファイルの全列挙、内部 ID) は本文に出さない。

## 出力ファイル

```
docs/as-built/
  <業務>/<UC>/                  # 業務・UC は use-cases.yaml の日本語名
    index.md                    # 下表の節。front matter に basis/generated_at/code/uc/slug/attempt
    sequence.md                 # 全シナリオの sequenceDiagram (index.md には正常系 1 本だけ載せる)
  _system/
    traceability-index.json     # 全 UC 横断の追跡表 (canonical JSON。UC 単位でマージ。tables_rw / instrumentation_gaps を持つ)
    api-inventory.md            # openapi bundle の全 operation と使用状況
    data-flow.md                # UC × テーブルの読み書き表と、UC → テーブルの図
    dependency-graph.md         # 実態 (dependency-cruiser JSON) の依存グラフと違反。JSON が無ければ config の
                                # ティア・契約から「決定からの図」を描く (実態か決定かを本文に明記。空にしない)
    index.md                    # 全 UC の as-built 一覧
```

0.1.4 以前の `coverage.md` は index.md の「証跡」に統合した (再実行時に古いファイルは消す)。

## index.md の節

| 節 | ラベル | 情報源と書き方 |
|---|---|---|
| (冒頭) 概要 | 要約 | 表 `\| 項目 \| 内容 \| 根拠 \|` (誰が / 何をする / 完了の条件)。要約ブロック名 `概要` |
| 結果 | 抽出 | 表 1 つ: ゲート (全段 pass / 部分実行 (未実行: …) / fail (落ちた段))、受入基準の被覆 n/m、シナリオ本数と pass (受入・ブラウザの内訳)、前提の件数と処遇の内訳、未決の課題の件数と種類、**計装の範囲** (トレースに現れたティアとレイヤ。UC の tiers に無いものは「計装なし」) |
| 入口 | 抽出 | 表: API operation (http.in トレース + slice のパス)、画面 (screens.yaml の `uc_slugs`)、発行 / 購読イベント。続けて「主要な部品」(call トレースの component をティアごとに) |
| どう動くか | 抽出 | 正常系 1 本のシーケンス図 (2xx を返した最も長いシナリオ)、他シナリオとの分岐表 (応答 / 書き込み / 発行)、sequence.md へのリンク。小節「データの流れ」に全シナリオ合算の flowchart (読み = 点線、書き = 太線、ティアごとに subgraph) |
| 何を守るか | 要約 | 表 `\| 守ること \| 手段 \| 根拠 \|` (原子性 / 競合 / 冪等 / 障害と副作用。手段は `<br>` で 1 行 1 つ)。要約ブロック名 `整合性` |
| 決めたこと | 転記 | AssumptionRecord を処遇 (人が承認 / 自動承認 / 却下 / 未確認) でグループ化した表: ティア / 分類 (日本語) / 何を決めたか (`title`) / 検証 (Verifier の判定。major 以上は太字で severity 併記) / 場所 (ファイル名:行)。前提の全文 (`assumption`) は各表の下の折りたたみ。続けて Verifier の未申告の判断、前提以外の指摘 (`title`。major 以上は本文、minor は折りたたみ、全文 `claim` は折りたたみ) |
| 課題 | 抽出 + 要約 | issues の表 (種類 = ルール / 契約 / 要求、題名) と要約ブロック `課題` (表 `\| 課題 \| 背景 \| 今の実装 \| 対処 \| 根拠 \|`) |
| 証跡 | 抽出 | ゲート 1 行、関与ティアの単体・契約件数、受入基準 (Given / When / Then を 3 行に分ける) → シナリオ (結果) の表。未カバーは太字 |
| 付録 | 抽出 | `<details>` 3 つ: 変更ファイル (ティア別)、シナリオの実行結果 (種別 / 結果 / ms)、生成情報 (basis と code は 7 桁、生成日時、試行、凡例) |

内部 ID の置き換え: category (`persistence` → 永続化 …)、verdict (`spec_absent` → 仕様に無い …)、
decision (`auto_confirmed` → 自動承認 …)、issue kind (`rule` → ルール …)。シナリオ名は `slug#` を外す。

## 要約の書式 (checkAsBuilt.js が機械で検査する)

長い文は認知負荷が高い (ユーザー指摘)。要約は**表で書き、文章で書かない**。

| 規則 | 内容 |
|---|---|
| R1 | ブロックは空でない |
| R2 | ブロックに表が 1 つ以上ある |
| R3 | 表のセル 1 行 (`<br>` で分けた単位) は 40 字以内。最後の列 (根拠) とコード位置 `path:line` は数えない |
| R4 | 表の外の文は 1 文 50 字以内 |
| R5 | 見出し (`#`) を使わない |

転記する記録も同じ思想で、AssumptionRecord と findings は `title` (30 字以内) を持ち、表には title だけを載せる
(`validateAssumptions.js` が字数を検査する)。

## 要約ブロックの契約

- スクリプトは `概要` / `整合性` / `課題` の 3 か所に `<!-- 要約:begin <名前> -->` と `<!-- 要約:end -->` を必ず置く
- LLM はこの 2 行の間だけに書く。スクリプトを再実行しても、中身は名前で対応づけて保存される
  (0.1.4 以前の名前無しブロックは出現順に 整合性 / 課題 へ対応づける)
- 直前に `<!-- 要約: ... -->` のガイドコメントを置く。ここは書き換えない

## レポートの形 (Context7 で確認済み)

- **cucumber-js legacy JSON formatter** (`--format json:{report}`): feature オブジェクトの配列。
  `feature.elements[]` がシナリオ。`element.tags[].name`、`element.steps[].result.status`
  (小文字 `passed`/`failed`/`skipped`/`pending`/`undefined`/`ambiguous`)、`result.duration` (ナノ秒)。
  シナリオの結果はステップから導く (1 つでも failed なら failed、など)。
- **vitest JSON reporter** (`--reporter=json`): `numTotalTests` / `numPassedTests` / `numFailedTests` /
  `numPendingTests` / `numTodoTests` と `testResults[]`。ティア別件数はこの数を使う。
- **gates.json** (`runGates.js`): `{uc, result, all_recorded, gates:[{name, status, jobs:[...]}]}`。
  未実行の段は `status: missing` として残り、`all_recorded` は全段が記録済みなら true。
  部分実行 (`--from`/`--upto`/`--only`) では `result: pass` でも `all_recorded: false` になり得る。
  traceability-index の UC エントリは `gates_complete` にこの値を持つ。

## トレース JSONL の形 (tracer.ts v2 が書き、traceTree.js が読む)

1 行 = `{ts, ts_end?, seq, parent?, scenario, kind, name, meta}`。`scenario` はシナリオ ID (`<uc_slug>#<シナリオ名>`)。

- `ts` は**開始**、`ts_end` は完了。行は完了時に書くのでファイルは完了順。読み手は `seq` (開始順) で並べ直す
- `parent` は呼び出し元 span の `seq`。HTTP 越しは `x-scenario-span` ヘッダで運ぶ。これで
  画面 → API → ユースケース → リポジトリ → DB の入れ子が復元でき、要求が DB クエリより前に描かれる
- `seq` の無い旧形式は、http.in の直前に並ぶ行をその要求の子として扱う

| kind | meta | 図での使い方 |
|---|---|---|
| `http.in` | `{method, path, status, operationId?, tier, layer?}` | 送信元 → ティア。operation を抽出 |
| `http.out` | `{method, url, status, tier, layer?}` | 直下に http.in があれば 1 本の矢印にまとめる (画面 → API)。無ければ外部ホストとの往復 |
| `db.query` | `{sql, tables:[...], component, tier, layer?}` | 部品 → DB。SQL 動詞で読み / 書きに分類 |
| `publish` | `{message, channel, component, tier}` | 部品 -) Broker |
| `call` | `{component, fn, tier, layer?, result}` | 送信元 → 部品。子があれば activate して ok / error で戻る |

`meta.tier` / `meta.layer` は **部品ごと**に付く (`traced(name, obj, {tier, layer})`)。同一プロセスで複数ティアを
動かす in-process 実行のため、プロセス既定 (`setTier`) だけに頼らない。

## 計装の範囲 (トレースに出ない部品は図に出ない)

- UC の `tiers` (use-cases.yaml) のうちトレースに現れないティアを「計装なし」として結果の表と
  traceability-index の `instrumentation_gaps` に出す。d2-run はこれを integrate の不備として扱う
- ティアごとの ADR のレイヤ (arch_test `level: layer` の glob `apps/<tier>/src/<layer>/**`) と観測レイヤは
  情報として持つ (domain のような純粋関数の層は計装しないのが正常なので、欠けを不備とはしない)

## 決定論の規則

- すべての一覧をコードポイント順にソートする (`localeCompare` は使わない)。`generated_at` だけ最新イベント ts
- traceability-index.json は key をソートした canonical JSON (`canonicalJson.js`)。UC 単位で置換し、
  横断マップ (acceptance / operations / tables) は全 UC から作り直す
