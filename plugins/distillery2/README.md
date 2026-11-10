# distillery2

> 要求から実装までを 1 プラグインで回す。distillery (仕様生成) + distillery-impl (実装ハーネス) の再設計版。

## なぜ作り直したか

v1 は「事前に決めるべきこと」と「コードから導けること」を区別せず、全部を事前に文書化していた。
個別仕様の考慮漏れ → 変更要求 → 上流再生成の往復が 4 本あり、Verifier の読解突合と LLM の帳簿作業がトークンと時間を食っていた。

v2 は成果物を 3 つに分ける。

| 分類 | 何 | 作り方 |
|---|---|---|
| A 人が決める | 要求 (USDM / RDRA)・受入基準・UC のシナリオ・非機能要求グレード表・ADR | 事前に。人が承認する |
| B 機械が検証する | 契約と契約テスト・開発ルール・依存方向の検査・デザイン部品・テスト基盤と計装 | 事前に骨格、以後は差分。文章にしない |
| C コードから導く | UC ごとの as-built 文書 (結果 / 入口 / どう動くか (画面 → API → ユースケース → DB のシーケンス図とデータフロー図) / 何を守るか / 決めたこと / 課題)・追跡表・依存の実態 | 実装後に抽出する。手で書かない。図は UC BDD のトレースから描くので、UC が通る全ティア・全レイヤを計装する |

## 流れ

```
要望 → ① 要求 → ② 決定 (NFR 表 + ADR) → ③ 基盤 (rules / arch test / 契約骨格 / 計装 / 画面部品)
                                                 │
        ┌────────────────────────────────────────┘
        ▼  UC ごとに繰り返す
  最初の点検 → シナリオ → 契約差分 → 足場 → ティア実装 (並列) → ゲート (安い順) → 別モデル検証 (2 観点)
  → 人レビュー → as-built 抽出 → 課題を課題ファイル docs/feedback/ にして、1 commit に squash して main へ取り込む
        │
        ▼  前のステップの課題は、戻し先のステップへ戻す
  機能の中 (シナリオ・契約・実装) はその場で巻き戻す / main マージ済みの UC はその段から開き直す /
  上流 (要求・決定・基盤) は一時のブランチで直して main に入れ、止めた機能の作業ブランチを
  新しい main の上に写し直して続きの段から再開する (作業は捨てない。戻り道はそれぞれ 3 回まで)
```

最初の点検は、シナリオを書く前に、要る決定や部品が上流にそろっているかを見る。足りなければ機能の作業が無いうちに上流を直すので、写し直しが要らない。
前のステップの課題にするのは、食い違う / 後の機能と食い違う / 方式が決まっていない、のどれかに当たるものだけ ([handoff.md](skills/d2-common/references/handoff.md))。機能の中で足せる結線は止めずに先に直して報告する。
起動のたびに、次にすること (片付け・進行中の機能・上流の直し・写し直し・次の機能) を `nextAction.js` が決める。

どのステップも同じ型で進む: 担当が作る → 形式の検査 → 成果物ごとの縦・横レビュー (別系統のモデル。要求・決定・基盤・シナリオ・契約・実装・as-built の 7 か所) → 担当が反証して直す → 進行役が振り分け。
担当は引き継ぎファイルで「人に聞くこと」と「前のステップの課題」を返し、進行役がモードの規則で人に返すか推奨で決めて記録する。
起動の引数 `mode=auto` (既定。不明点・課題は人に返す。要求の承認と人レビューは必ず止まる) / `mode=recommend` (推奨で進めて最後にまとめて見せる)。
PR / issue は作らない。git とファイルだけで完結し、GitHub 以外のホストや remote の無いリポでも動く。
直す場所が distillery2 側と分かった課題は `kind: plugin` にして、一覧の別の表に出す。

ゲートは 静的 → 単体 → 契約 → UC BDD (API 面) → 受入 (タグ絞り込み、`@browser` はブラウザドライバ) の順。落ちたゲートで止まる。

## スキル

| skill | 役割 |
|---|---|
| `distillery2:d2-run` | オーケストレータ。通常はこれだけ呼ぶ |
| `distillery2:d2-requirements` | ① 要求。USDM / RDRA / UC 一覧 |
| `distillery2:d2-decide` | ② 決定。非機能要求グレード表 + ADR (機械可読 rules 付き) + C4 図 (architecture.md)。決定の差分では mode=feedback でルールの穴を ADR 1 本にする |
| `distillery2:d2-foundation` | ③ 基盤。rules / arch test / テスト基盤 / 設定 / CI / 依存の導入。契約の骨格と画面部品の後の仕上げ (契約込みの再生成・画面部品の取り込み・骨格分の契約テスト・チェックポイント) |
| `distillery2:d2-design` | ③ 画面部品。tokens (ブランド起点) + Storybook + アセット + 目視証跡 |
| `distillery2:d2-contract` | 契約カタログ (skeleton / uc の 2 モード。例ごとに URL の値・ヘッダ・テスト用データを指定して契約テストを作る) |
| `distillery2:d2-implement` | ④ 実装者 (precheck / scenario / scaffold / tier / integrate)。precheck は機能の最初の点検 |
| `distillery2:d2-verify` | ④ 別モデルの検証 (UC の意図・前提の整合) |
| `distillery2:d2-asbuilt` | ④ 実装からの文書抽出 (依存グラフの実態・抽出・要約・書式の検査まで) |
| `distillery2:d2-common` | 他のスキルが参照する共通定義。直接は起動しない。**処理と入出力の正本** ([dataflow.yaml](skills/d2-common/references/dataflow.yaml)) と、そこから生成した DFD ([dataflow.md](skills/d2-common/references/dataflow.md)) |

呼び出し名は `/distillery2:<skill>`。SKILL.md の `name` は Agent Skills 仕様どおりディレクトリ名 (`d2-run` など) で、Claude Code がプラグイン名を前置する。
スキル間の入出力 (各スキルの読む / 書く、基盤の phase 表、d2-run の直接の読み書き。派遣表の write-set は正本から生成する。0.1.31) は正本と
`tests/distillery2/integration/dataflow.test.js` で照合する。入出力を変えたら正本も直して `node skills/d2-common/scripts/genDataflow.js` で図を作り直す。

`docs/README.md` は `skills/d2-common/scripts/genDocsReadme.js` が各段階の commit 前に生成する (共通のスクリプトはすべて `skills/d2-common/scripts/`。手順書は `<skills>/d2-common/scripts/...` と書く。0.1.29) (上流から下流まで辿る入口。管理ブロックの外と distillery2 以外の文書は触らない)。

## 対象プロジェクトの構成

一般的なモノレポ + Cucumber + Playwright + ADR の慣習に合わせる。独自のテストディレクトリは作らない。

```
apps/<tier>/           src/ (単体テストは同居)  test/contract/ (生成物)  migrations/
packages/contracts/    契約からの codegen
packages/ui/           tokens + 部品 + stories + assets (ロゴ/アイコン)
packages/test-support/ tracer (計装)、pglite、Cucumber World
contracts/             契約の正本 (openapi/ asyncapi/ db/) と generated/
features/              <業務>/<uc>.feature (UC シナリオ = 要求)、acceptance/、step_definitions/、support/drivers/{api,browser}
docs/                  requirements/ nfr/ adr/ rules/ design/ as-built/
.distillery/           ツールの実行状態 (config.yaml、runs/<uc>/)
```

履歴は Git。生成物は先頭に `basis: requirements@<sha> adr@<sha> contracts@<sha>` を持ち、UC の squash commit は trailer (`UC:`, `Basis-*:`, `Gates:`, `Assumptions:`) を持つ。

## Installation

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install distillery2@suwa-sh-claude-plugins
```

## 状態

0.3.x は、要望から複数の UC を main マージまで通し、後のステップで見つけた問題を、機能の作業を捨てずに前のステップへ戻して直す範囲を対象にする。
会議室の予約の題材で 2 つの UC が main に入るところまで確かめた (`mode=recommend`。`mode=auto` は確かめていない)。リリース後の変更入口・ドリフト検知・既存プロダクトの取り込みは未対応。変更履歴は [CHANGELOG.md](CHANGELOG.md)。
実走で踏んだ環境依存の問題と回避策は、スキルごとの `references/troubleshooting.md` にためる: [d2-run](skills/d2-run/references/troubleshooting.md) (headless の許可) / [d2-foundation](skills/d2-foundation/references/troubleshooting.md) (npm 10 の失敗、qlty / biome) / [d2-contract](skills/d2-contract/references/troubleshooting.md) (契約テスト)。
旧版 (`distillery` / `distillery-impl`) はそのまま残る。
