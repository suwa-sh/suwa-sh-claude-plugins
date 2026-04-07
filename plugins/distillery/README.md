# Distillery

> Distill raw requirements into production-ready design.

Distillery は、漠然とした要望テキストを段階的に精製し、要件定義・非機能要求・アーキテクチャ・インフラ・デザインシステム・詳細仕様までを一気通貫で生成する Claude Code プラグインです。RDRA 2.0 / USDM / IPA 非機能要求グレード / Event Sourcing / Spec-Driven Development をパイプラインとして統合しています。

## Pipeline

粗い原料から熟成された成果物へ、蒸留酒の製造工程になぞらえた7ステージ構成です。

```
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
┌──────────────────┐  Master      pipeline            全スキルの順次実行 (オーケストレーション)
│  pipeline        │
└──────────────────┘
```

## Skills

| Skill | Role |
|---|---|
| `distillery:requirements` | USDM 分解 + RDRA モデルの差分/フルビルド |
| `distillery:quality-attributes` | IPA 非機能要求グレード 2018 による品質特性推論 |
| `distillery:architecture` | システム/アプリ/データアーキテクチャ設計（ベンダーニュートラル） |
| `distillery:infrastructure` | MCL product-design 経由のクラウドインフラ設計 + Arch フィードバック |
| `distillery:design-system` | デザイントークン生成 + Storybook 変換 |
| `distillery:spec` | UC 単位詳細仕様 + OpenAPI/AsyncAPI + 全体横断 UX/UI 設計 |
| `distillery:pipeline` | 全スキルの順次実行（初期要望 or 変更要望を1コマンドで最終成果物へ） |

## Installation

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install distillery@suwa-sh-claude-plugins
```

## Usage

### 初回ビルド（新規プロジェクト）

```
/distillery:pipeline
```

初期要望テキストのパスを聞かれるので指定してください。7スキルが順次実行され、`docs/` 配下に全成果物が生成されます。

### 個別実行

```
/distillery:requirements   変更要望テキストのパス
/distillery:quality-attributes
/distillery:architecture
/distillery:infrastructure
/distillery:design-system
/distillery:spec
```

既存の `docs/{rdra,nfr,arch,infra,design,specs}/latest/` を読み込み、差分更新モードで動作します。

## Prerequisites

- **Claude Code** >= 最新安定版
- **Node.js** （`requirements` スキル内の `scripts/makeGraphData.js` / `makeZeroOneData.js` 実行用）
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

各スキルは `docs/*/latest/` を介した疎結合なファイル I/O で連携します。途中のステージから再実行したり、特定ステージだけを回すことも可能です。イベント履歴は `docs/*/events/` に全て残るため、差分の追跡・ロールバック・監査が可能です。

## Credits

RDRA ナレッジおよび初期実装は [suwa-sh/RDRAAgent](https://github.com/suwa-sh/RDRAAgent) に由来します。Distillery は RDRAAgent の `usdm-rdra` 系スキル群を汎用的なプラグインとして再パッケージしたものです。

- RDRA 2.0: https://vsa.co.jp/rdra/
- RDRAGraph: https://vsa.co.jp/rdratool/graph/v0.94/

## License

MIT
