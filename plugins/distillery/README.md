# Distillery

> Distill raw requirements into production-ready design.

Distillery は、漠然とした要望テキストを段階的に精製し、要件定義・非機能要求・アーキテクチャ・インフラ・デザインシステム・詳細仕様までを一気通貫で生成する Claude Code プラグインです。RDRA 2.0 / USDM / IPA 非機能要求グレード / Event Sourcing / Spec-Driven Development をパイプラインとして統合しています。

## Pipeline

粗い原料から熟成された成果物へ、蒸留酒の製造工程になぞらえた8ステージ構成です。

既存プロジェクトを取り込む場合は、先頭に **Harvest（原料の収穫）** ステージを差し込みます。
既存コード・定義・履歴を as-is 分析して USDM + RDRA を初期構築し、以降のステージへ合流させます。

```
（任意）既存プロジェクト
   │
   ▼
┌──────────────────┐  Harvest     harvest             既存コードから要求を逆生成（as-is 分析）
│  harvest         │────────────▶ docs/harvest/latest, docs/usdm/latest, docs/rdra/latest
└──────────────────┘
   │
   ▼（要望テキストの場合はここから）
要望テキスト
   │
   ▼
┌──────────────────┐  Mash        requirements       USDM 分解 + RDRA 差分/フルビルド
│  requirements    │────────────▶ docs/usdm/latest, docs/rdra/latest
└──────────────────┘
   │
   ▼
┌──────────────────┐  Ferment     quality-attributes  IPA NFR グレード推論
│ quality-         │────────────▶ docs/nfr/latest
│  attributes      │
└──────────────────┘
   │
   ▼
┌──────────────────┐  Distill     architecture        System/App/Data アーキテクチャ設計
│  architecture    │────────────▶ docs/arch/latest
└──────────────────┘
   │
   ▼
┌──────────────────┐  Mature      infrastructure      MCL 経由のクラウドインフラ設計 + Arch feedback
│  infrastructure  │────────────▶ docs/infra/latest
└──────────────────┘
   │
   ▼
┌──────────────────┐  Blend       design-system       デザイントークン + Storybook 生成
│  design-system   │────────────▶ docs/design/latest
└──────────────────┘
   │
   ▼
┌──────────────────┐  Bottle      spec                UC 単位 Spec + OpenAPI/AsyncAPI + 全体横断 UX
│  spec            │────────────▶ docs/specs/latest
└──────────────────┘
   │
   ▼
┌──────────────────┐  Label       spec-stories        UC Spec → Storybook ページ Story 生成
│  spec-stories    │────────────▶ docs/design/latest (Story 追記)
└──────────────────┘
   │
   ▼
┌──────────────────┐  Master      pipeline            全スキルの順次実行 (オーケストレーション)
│  pipeline        │
└──────────────────┘
```

## Skills

| Skill | Role |
|---|---|
| `distillery:dist-harvest` | 既存プロジェクトから要求を逆生成し USDM + RDRA を初期構築（as-is 分析・任意） |
| `distillery:dist-requirements` | USDM 分解 + RDRA モデルの差分/フルビルド |
| `distillery:dist-quality-attributes` | IPA 非機能要求グレード 2018 による品質特性推論 |
| `distillery:dist-architecture` | システム/アプリ/データアーキテクチャ設計（ベンダーニュートラル） |
| `distillery:dist-infrastructure` | MCL product-design 経由のクラウドインフラ設計 + Arch フィードバック |
| `distillery:dist-design-system` | デザイントークン生成 + Storybook 変換 |
| `distillery:dist-spec` | UC 単位詳細仕様 + OpenAPI/AsyncAPI + 全体横断 UX/UI 設計 |
| `distillery:dist-spec-stories` | UC Spec + デザインシステムから Storybook Story 生成 |
| `distillery:dist-pipeline` | 通常は全スキルを順次実行（デフォルト auto_adopt: ⭐推奨自動採用・完了時一括確認。`--interactive` で逐次対話）。単一feedback-request Markdownは内部でrouteして最小範囲を差分実行 |

## Installation

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install distillery@suwa-sh-claude-plugins
```

## Usage

### 初回ビルド（新規プロジェクト）

```
/distillery:dist-pipeline
```

初期要望テキストのパスを聞かれるので指定してください。7スキル（requirements〜spec の6スキル + Step6a の spec-stories）が順次実行され、`docs/` 配下に全成果物が生成されます。

**対話ポリシー**: デフォルトは **auto_adopt**（確認推奨項目の⭐推奨を自動採用して完走。
confidence: low の項目は仮採用 + `docs/todo.md` 登録とし、完了サマリで一括確認 →
必要なら feedback request で差分修正）。従来どおり途中で逐次確認したい場合は `--interactive` を付けます。

```
/distillery:dist-pipeline --interactive
```

**Step 別モデル指定**: `docs/pipeline/pipeline-config.yaml` の `step_models` で Step ごとに
モデルを指定できます（未作成ならデフォルト値で自動生成。既定は Step4b/6a のみ `sonnet`、他はセッション既定）。
詳細は [pipeline-config-schema.md](skills/dist-pipeline/references/pipeline-config-schema.md) を参照してください。

**通知**: 対話待ち・エラー・完了時にデスクトップ通知（音付き）が届きます。
macOS（osascript）/ Windows（PowerShell バルーン通知）/ Linux（notify-send + paplay、未インストールならスキップ）に対応。

### 既存プロジェクトの取り込み（リバースエンジニアリング）

既存リポジトリから要求・要件を吸い上げて distillery に取り込み、そこから再設計します。

```
/distillery:dist-harvest ./repo
/distillery:dist-harvest ./frontend ./backend      # モノレポ・複数リポジトリも可
```

コード・エンドポイント定義・データストア定義・テスト・コミット履歴を RDRA 4レイヤーで as-is 分析し、
「コードから読み取った事実」と「LLM の推測」を evidence / confidence で区別しながら、
`docs/harvest/latest/` + `docs/usdm/latest/` + `docs/rdra/latest/` を初期構築します。以降は
`/distillery:dist-quality-attributes` 以降のスキル（または `/distillery:dist-pipeline`）が無変更で動作します。

> **初期構築専用**: 既に `docs/rdra/latest/` が存在するプロジェクトには適用しません。既存モデルへの
> 変更は差分更新モード（`/distillery:dist-requirements 変更要望テキストのパス`）を使用してください。

### distillery-impl の複数フィードバックを1回で反映

dist-pipelineへ渡す入力は、distillery-implが公開したMarkdownのパス1つです。
このMarkdownが変更要求の外部正本です。
stage名、stage別指示、レビュー情報は含めません。

```text
/distillery:dist-pipeline docs/impl/latest/19ec0182/feedback-requests/20260729_121600_impl_feedback_19ec0182.md
/distillery:dist-pipeline docs/impl/latest/19ec0182/feedback-requests/20260729_121600_impl_feedback_19ec0182.md --recommended-auto
```

dist-pipelineは次の順に処理します。

1. Markdownを検証し、不変な`input.md`として保存する。
2. 各変更要求を内部work unitへ分け、所有stageを判定する。
3. 所有stage以降の依存stageを、それぞれ最大1回実行する。
4. 要求ごとの結果と証跡を`result.json`へ保存する。

曖昧さの扱いは実行モードで決まります。

| モード | 動作 |
|---|---|
| 既定の対話モード | 推奨案、代替案、影響、根拠を提示して回答を待つ |
| `--recommended-auto` | 要求の意味を変えない安全なroutingだけを自動採用する |

要求の再解釈、設計判断、競合、根拠不足、破壊的な範囲拡大は自動採用しません。
回答者が内部stage名を知る必要はありません。

実行記録は`docs/pipeline/feedback-runs/{feedback_id}/`へ保存します。
中断後は外部Markdownを読み直さず、このrun directoryから再開します。
同じfeedback IDと入力SHAの組み合わせは、保存済み証跡を検証してから再開またはno-opにします。

入力書式は[feedback-request-format.md](skills/dist-pipeline/references/feedback-request-format.md)を参照してください。
内部状態と再開条件は[feedback-run-state.md](skills/dist-pipeline/references/feedback-run-state.md)を参照してください。

### 個別実行

```
/distillery:dist-requirements   変更要望テキストのパス
/distillery:dist-quality-attributes
/distillery:dist-architecture
/distillery:dist-infrastructure
/distillery:dist-design-system
/distillery:dist-spec
/distillery:dist-spec-stories
```

既存の `docs/{rdra,nfr,arch,infra,design,specs}/latest/` を読み込み、差分更新モードで動作します。

## Prerequisites

- **Claude Code** >= 最新安定版
- **Node.js** （`requirements` スキル内の `scripts/makeGraphData.js` / `makeZeroOneData.js` / `generateRdraMd.js` 実行用）
- **任意**: `architecture` スキルは同マーケットプレイスの [ddd](../ddd/) プラグイン（`ddd-architecture` スキル）に依存します。Phase 0 のドメイン設計（サブドメイン分類 / 境界づけられたコンテキスト / コンテキストマップ / 集約境界仮説）で DDD 概念リファレンスとして参照します。未インストール時はスキル冒頭でインストール案内が表示されます
  ```
  /plugin install ddd@suwa-sh-claude-plugins
  ```
- **任意**: `infrastructure` スキルは [multi-cloud-lifecycle-skills](https://github.com/suwa-sh/multi-cloud-lifecycle-skills) の `mcl-common` / `mcl-product-design` プラグインに依存します。未インストール時は手動でインフラ設計を行う動作になります
- **任意**: `design-system` スキルは `design-system`, `ui-ux-pro-max`, `brand`, `storybook-config` 等のスキルが環境にあれば利用します

## Methodologies

Distillery は以下の手法を統合しています:

- **RDRA 2.0** — Relationship Driven Requirement Analysis（神崎善司氏）
- **USDM** — Universal Specification Describing Manner（清水吉男氏）
- **IPA 非機能要求グレード 2018** — 情報処理推進機構
- **Event Sourcing** — 要件・設計の差分を不変イベントとして記録
- **Spec-Driven Development** — OpenAPI 3.1 / AsyncAPI 3.0 を中核に据えた仕様駆動
- **UI-UX Pro Max** — UX 心理学・データ可視化・アクセシビリティの統合ガイド

## Data Flow

各スキルは `docs/*/latest/` を介した疎結合なファイル I/O で連携します。途中のステージから再実行したり、特定ステージだけを回すことも可能です。イベント履歴は `docs/*/events/` に全て残るため、差分の追跡・ロールバック・監査が可能です。feedback request runの計画・進捗・work unit適用結果は`docs/pipeline/`に保存します。

## Credits

RDRA ナレッジおよび初期実装は [suwa-sh/RDRAAgent](https://github.com/suwa-sh/RDRAAgent) に由来します。Distillery は RDRAAgent の `usdm-rdra` 系スキル群を汎用的なプラグインとして再パッケージしたものです。

`dist-harvest`（既存プロジェクトからの要求逆生成）の解析観点・RDRA リバース手法は
[suwa-sh/claude-code-rdra-rev](https://github.com/suwa-sh/claude-code-rdra-rev)（RDRA リバース分析）の
プロンプト資産を distillery の references 構成に再編して移植したものです。

- RDRA 2.0: https://vsa.co.jp/rdra/
- RDRAGraph: https://vsa.co.jp/rdratool/graph/v0.94/

## License

MIT
