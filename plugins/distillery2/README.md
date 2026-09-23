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
| C コードから導く | UC ごとの as-built 文書・追跡表・シーケンス図・依存の実態 | 実装後に抽出する。手で書かない |

## 流れ

```
要望 → ① 要求 → ② 決定 (NFR 表 + ADR) → ③ 基盤 (rules / arch test / 契約骨格 / 計装 / 画面部品)
                                                 │
        ┌────────────────────────────────────────┘
        ▼  UC ごとに繰り返す
  シナリオ (人が承認) → 契約差分 → 足場 → ティア実装 (並列) → ゲート (安い順) → 別モデル検証 (2 観点)
  → 人レビュー → as-built 抽出 → 還流を分類 (rule / contract / requirement) → 1 commit に squash → PR
```

ゲートは 静的 → 単体 → 契約 → UC BDD (API 面) → 受入 (タグ絞り込み、`@browser` はブラウザドライバ) の順。落ちたゲートで止まる。

## スキル

| skill | 役割 |
|---|---|
| `distillery2:d2-run` | オーケストレータ。通常はこれだけ呼ぶ |
| `distillery2:d2-requirements` | ① 要求。USDM / RDRA / UC 一覧 |
| `distillery2:d2-decide` | ② 決定。非機能要求グレード表 + ADR (機械可読 rules 付き) |
| `distillery2:d2-foundation` | ③ 基盤。rules / arch test / テスト基盤 / 契約テスト / 設定 / CI |
| `distillery2:d2-design` | ③ 画面部品。tokens + Storybook |
| `distillery2:d2-contract` | 契約カタログ (skeleton / uc の 2 モード) |
| `distillery2:d2-implement` | ④ 実装者 (scenario / scaffold / tier / integrate) |
| `distillery2:d2-verify` | ④ 別モデルの検証 (UC の意図・前提の整合) |
| `distillery2:d2-asbuilt` | ④ 実装からの文書抽出 |

## 対象プロジェクトの構成

一般的なモノレポ + Cucumber + Playwright + ADR の慣習に合わせる。独自のテストディレクトリは作らない。

```
apps/<tier>/           src/ (単体テストは同居)  test/contract/ (生成物)  migrations/
packages/contracts/    契約からの codegen
packages/ui/           tokens + 部品 + stories
packages/test-support/ tracer (計装)、pglite、Cucumber World
contracts/             契約の正本 (openapi/ asyncapi/ db/) と generated/
features/              <業務>/<uc>.feature (UC シナリオ = 要求)、acceptance/、step_definitions/、support/drivers/{api,browser}
docs/                  requirements/ nfr/ adr/ rules/ design/ as-built/
.distillery/           ツールの実行状態 (config.yaml、runs/<uc>/)
```

履歴は Git。生成物は先頭に `basis: requirements@<sha> adr@<sha> contracts@<sha>` を持ち、PR は trailer (`UC:`, `Basis-*:`, `Gates:`, `Assumptions:`) を持つ。

## Installation

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install distillery2@suwa-sh-claude-plugins
```

## 状態

イテレーション 1 (縦切り 1 UC が通るまで) を実装中。変更履歴は [CHANGELOG.md](CHANGELOG.md)。
旧版 (`distillery` / `distillery-impl`) はそのまま残る。
