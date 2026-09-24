# distillery2 サンプル

`distillery2` 0.1.0 を、図書館蔵書管理システムの要望 (`samples/distillery/pipeline/input/初期要望.txt` と同じ) に対して
headless (`claude -p`) で実走した結果。要求 → 決定 → 基盤 → UC 1 つ (貸出を登録する) の縦切りまで。

| ディレクトリ | 内容 |
|---|---|
| `library-loan/docs/` | 要求 (USDM / RDRA / UC 一覧)、非機能グレード表、ADR 8 件、開発ルール、画面一覧、as-built |
| `library-loan/contracts/` | 契約の正本 (OpenAPI / DB) と生成物 (bundle、UC slice) |
| `library-loan/features/` | 貸出 UC のシナリオ (10 件)、step 定義、Cucumber の support (API ドライバ、tracer 結線) |
| `library-loan/apps/`, `packages/` | 実装 (backend-api、frontend-staff) とテスト基盤。`packages/ui` と Storybook アプリは容量の都合で除外 |
| `library-loan/.distillery/` | 実行設定と、UC の実行状態 (events、done、AssumptionRecord、findings、ゲート結果、トレース、課題) |

## 実走の手順

段階ごとに `claude -p` を 1 回ずつ起動した。プロンプトは各段階の d2-run 呼び出し (`stage=requirements input=...` / `stage=decide` / `stage=foundation` / `uc=貸出を登録する`) に「人の承認は推奨どおり承認したものとして進める」「push・PR はしない」を添えたもの。
`--allowedTools` で node / npm / git を許可しないと検証スクリプトが飛ばされる (①は 2 回に分けた)。
実行時のプロンプトとログは対象リポの `.distillery/logs/` (git 管理外) に置く規約にしたため、このサンプルには含めない。

| 段階 | 備考 | 所要 | 結果 |
|---|---|---|---|
| ① 要求 | (2 回) | 31 分 | UC 32 件 (うち 6 件は対応する仕様が無く blocked)。検証すべて exit 0 |
| ② 決定 | | 16 分 | NFR 97 項目、ADR 8 件 (ティア 4: frontend-patron / frontend-staff / backend-api / worker)。ブラウザ受入は手で off にした |
| ③ 基盤 | | 43 分 | rules 6 / 依存規則 19 / test-support / 契約骨格 (API + DB) / config / CI / Storybook 部品 77 ファイル。static ゲート exit 0 |
| ④ 縦切り | | 55 分 | シナリオ 10 → 契約 `POST /loans` → 足場 (red 確認) → 2 ティア並列実装 → 5 ゲート pass → 別モデル検証 (blocker 0) → as-built → squash |

合計 2 時間 25 分 (私の確認待ちの間隔を含む)。

## 段階④の結果

| 項目 | 値 |
|---|---|
| ゲート | static / unit / contract / uc-bdd / acceptance すべて pass (`all_recorded: true`) |
| シナリオ | 10 件。受入基準 3 件をすべて網羅。@browser の 1 件は off 設定で skip |
| AssumptionRecord | 20 件 (backend-api 12 / frontend-staff 8)。回答必須 5 件 |
| findings | blocker 0 / major 6 / minor 16。差し戻しなし (attempt 1 で完了) |
| 還流の課題 | 7 件 (rule 3 / contract 2 / requirement 2)。headless のため PR / issue は未起票 |
| squash | `feat: 貸出を登録する` 1 commit。trailer に UC / Basis / Gates / Assumptions / As-Built |
| as-built | `docs/as-built/貸出業務/貸出を登録する/{index,sequence}.md` と `_system/` 5 ファイル (追跡表、API 一覧、データフロー、依存グラフ、一覧)。図はトレース 9 本から生成 (0.1.5 で再抽出、下記) |

## 0.1.5 での再結線と as-built の再抽出

as-built の認知負荷 (節が機械の都合順、前提が 3 か所に重複、シーケンス図がバックエンドの一部のレイヤしか出ない) を直した
0.1.5 で、段階④の integrate 相当を手で当て直し、UC BDD → 受入ゲート → as-built 抽出だけを再実行した (要求〜実装は再実走していない)。

- 結線の変更: `features/support/` (api ドライバの `asTransport`、composition root の `decorate` フックで usecase / repository / gateway を
  `traced()`、tracePg と middleware に placement)、`features/step_definitions/` (もし は frontend-staff の画面ロジック `submitLoanCheckout`
  から入る)、`apps/backend-api/src/test-app.ts` (`decorate` フックの追加)、`packages/test-support/` (tracer v2)
- 結果: uc-bdd / acceptance pass。トレース 9 本に frontend-staff (screen, api-client) と backend-api (presentation, usecase, repository, gateway)
  が乗り、シーケンス図が 司書 → 貸出受付画面 → backend-api → RegisterLoan → PgLoanRegistrationRepository → DB の入れ子になった
- `index.md` は 概要 → 結果 → 入口 → どう動くか (正常系 1 本 + 分岐表 + データフロー図) → 何を守るか → 決めたこと → 課題 → 証跡 → 付録。
  要約 3 ブロック (概要 / 整合性 / 課題) は 0.1.0 の要約を新しい書式 (見出しごとに根拠 1 行) に手で詰め直した

## トークンと時間 (v1 との比較)

`scripts/tokenReport.js` で各段階のセッションを集計した (重み: input 1 / cache_creation 1.25 / cache_read 0.1 / output 0)。

| 段階 | サブエージェント数 | 入力トークン (raw、cache 含む) | 重み付きコスト |
|---|---|---|---|
| ① 要求 (2 回) | 25 | 8.7M | 2.2M |
| ② 決定 | 2 | 4.2M | 0.66M |
| ③ 基盤 | 7 | 13.8M | 2.0M |
| ④ 縦切り | 10 | 31.1M | 4.3M |
| 合計 | 44 | 57.8M | 9.2M |

v1 との比較は同条件では取れていない。参考値として、v1 の仕様生成パイプライン (dist-pipeline、実装を含まない) のフル実行は
6 時間超・API 費用 400 ドル超の実績がある (2026-08 のサンプル再生成)。v2 は要求から 1 UC の実装・検証・文書抽出までを 2 時間 25 分で通した。
条件が違う (v1 は全 UC の個別仕様を生成、v2 は 1 UC のみ) ので、同じ UC 数での比較は今後の課題。

## 実走で見つかった課題

[`findings-0.1.0.md`](findings-0.1.0.md) に段階ごとに列挙した。0.1.1 で対応する主なもの:

- 生成した `apps/*/package.json` の test / lint / typecheck が仮の echo コマンド (static ゲートが本物ではない pass になる)
- `cucumber.js` の ESM 形式の誤り、dry-run 用プロファイルの不在
- tracer が日本語のシナリオ名を同じファイル名に潰す
- 消費側 (frontend) の API クライアントが生成されない
- as-built の前提一覧がティアをまたいで上書きされる
- 未起票の還流が trailer に `null` で出る
- verifier の既定モデル名が無効

## 注意

- `.distillery/runs/*/reports` と `traces` は対象リポでは gitignore されるが、サンプルとして残している
- as-built の `basis` / `code` / 付録の変更ファイルは対象リポの git から取る。このサンプルは git 履歴を含まないコピーなので、
  `extractAsBuilt.js --run` をこのコピーに当てても、それらの欄と図以外の一部は同じにならない (図・表・要約は再現する)
- パスは `<repo>` (対象リポの root) と `~` に置き換えている
