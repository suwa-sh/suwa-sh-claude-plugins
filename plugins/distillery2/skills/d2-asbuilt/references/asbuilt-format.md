# as-built ドキュメントの形と情報源

段階④の最後に `extractAsBuilt.js` が実装から抽出する。各節に **抽出** (決定論スクリプト) か **要約** (LLM) の
ラベルを付ける。要約は `<!-- 要約:begin -->…<!-- 要約:end -->` の中だけに、コード位置 `path:line` を根拠に書く。

## 出力ファイル

```
docs/as-built/
  <業務>/<UC>/                  # 業務・UC は use-cases.yaml の日本語名
    index.md                    # 9 節 (下表)。front matter に basis/generated_at/code/uc/slug
    sequence.md                 # シナリオごとに 1 つの mermaid sequenceDiagram
    coverage.md                 # 受入基準 → シナリオ の対応表
  _system/
    traceability-index.json     # 全 UC 横断の追跡表 (canonical JSON。UC 単位でマージ)
    api-inventory.md            # openapi bundle の全 operation と使用状況
    dependency-graph.md         # dependency-cruiser JSON からの依存グラフと違反
    index.md                    # 全 UC の as-built 一覧
```

## index.md の 9 節

| # | 見出し | ラベル | 情報源 |
|---|---|---|---|
| 1 | 見出し | 抽出 | basis / code sha / attempt (front matter と events.jsonl) |
| 2 | 実現の経路 | 抽出 | 関与ティア (変更ファイル)、API operation (http.in トレース + slice)、画面 (screens.yaml)、発行/購読イベント (publish トレース + slice)、入口ファイル (変更ファイルをティア分類) |
| 3 | シーケンス | 抽出 | sequence.md へのリンクとシナリオ数 |
| 4 | データの読み書き | 抽出 | シナリオごとの読み/書きテーブルと発行メッセージ (db.query / publish トレース) |
| 5 | 整合性の守り方 | 要約 | AssumptionRecord (persistence/error_handling/data_format) をヒントに LLM が要約 |
| 6 | 画面 | 抽出 | screens.yaml の該当 UC 行 (コンポーネント・バリアント)。無ければ「画面定義なし」 |
| 7 | 検証の証跡 | 抽出 | cucumber JSON のシナリオ表、gates.json のゲート結果、vitest JSON のティア別件数 |
| 8 | 補った前提と処遇 | 転記 | assumptions.<tier>.yaml + findings の verdict + events の review_approved 決定 |
| 9 | 逸脱と既知の課題 | 抽出 + 要約 | issues/*.md (front matter kind/title)、Verifier findings、要約ブロック |

## 要約ブロックの契約

- スクリプトは節 5 と節 9 に `<!-- 要約:begin -->` と `<!-- 要約:end -->` を必ず置く
- LLM はこの 2 行の間だけに書く。スクリプトを再実行しても、中身は保存される (順序で対応づける)
- 直前に `<!-- 要約: ... -->` のガイドコメントを置く。ここは書き換えない

## レポートの形 (Context7 で確認済み)

- **cucumber-js legacy JSON formatter** (`--format json:{report}`): feature オブジェクトの配列。
  `feature.elements[]` がシナリオ。`element.tags[].name`、`element.steps[].result.status`
  (小文字 `passed`/`failed`/`skipped`/`pending`/`undefined`/`ambiguous`)、`result.duration` (ナノ秒)。
  シナリオの結果はステップから導く (1 つでも failed なら failed、など)。
- **vitest JSON reporter** (`--reporter=json`): `numTotalTests` / `numPassedTests` / `numFailedTests` /
  `numPendingTests` / `numTodoTests` と `testResults[]`。ティア別件数はこの数を使う。
- **gates.json** (`runGates.js`): `{uc, result, gates:[{name, status, jobs:[...]}]}`。

## トレース JSONL が持つべき meta (消費側の期待)

`extractAsBuilt` / `renderSequence` が読む 1 行 = `{ts, scenario, kind, name, meta}`。
`scenario` はシナリオ ID (`<uc_slug>#<シナリオ名>`)。ファイル名はそれを sanitise したもの。

| kind | meta | 図・抽出での使い方 |
|---|---|---|
| `http.in` | `{method, path, status, operationId?, tier?}` | 実行者→ティア。operation を抽出。tier が受信ティア (無ければ name) |
| `http.out` | `{method, url, status, tier?}` | ティア→External |
| `db.query` | `{sql, tables:[...], rows?, component?}` | component→DB。SQL 動詞で read/write 分類 |
| `publish` | `{message, channel, component?}` | component-)Broker。message を抽出 |
| `call` | `{component, fn, tier?, args_summary?, duration_ms?}` | (呼び元)→component |

`tier` / `component` が meta に無ければ、直近の http.in / call から推定する。tracer がこれらを meta に入れると
図がより正確になる (P3 test-support への拡張要望)。

## 決定論の規則

- すべての一覧をソートする。`generated_at` だけ最新イベント ts (壁時計を使わない)
- traceability-index.json は key をソートした canonical JSON (`canonicalJson.js`)。UC 単位で置換し、
  横断マップ (acceptance / operations / tables) は全 UC から作り直す
