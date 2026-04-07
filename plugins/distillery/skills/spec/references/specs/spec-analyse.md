# モデル分析タスク

> **読み込みタイミング**: Step1 で使用。モデル分析手順を定義。

全入力モデル（RDRA, NFR, Arch, Design）を分析し、Spec 生成の方針を決定する。

## 入力

- `docs/rdra/latest/*.tsv` — RDRA モデル
- `docs/nfr/latest/nfr-grade.yaml` — NFR グレード
- `docs/arch/latest/arch-design.yaml` — アーキテクチャ設計
- `docs/design/latest/design-event.yaml` — デザインシステム

## システム名の使い分け

パイプライン全体で2種類のシステム名が存在する。Spec 工程では以下のルールで使い分ける:

| 用途 | 参照元 | 例 |
|------|--------|-----|
| API ドメイン、コード識別子、OpenAPI info.title | `design-event.yaml` `brand.name`（英語） | `RoomConnect` |
| 仕様書の見出し、UI ラベル（日本語）、ドキュメントタイトル | USDM `system_name`（和名） | `貸し会議室マッチングSaaS` |

和名の参照先は `docs/usdm/latest/requirements.yaml` の `system_name`、または `docs/rdra/latest/システム概要.json` の `system_name`。

## 出力

- 生成対象 UC 一覧（業務/BUC/UC のツリー）
- 全体横断 UX/UI 設計の方針
- `_inference.md`（分析根拠の記録）

## 分析手順

### 1. RDRA モデルから UC 階層を抽出

BUC.tsv を読み込み、以下の階層構造を構築する:

```
{業務名}
  └── {BUC名}
        └── {UC名}
              ├── アクター: {アクター名}
              ├── 画面: {画面名}
              ├── 情報: {情報名}
              ├── 条件: {条件名}
              └── 外部システム: {外部システム名}
```

BUC.tsv の列構成:
- 1列目: 業務
- 2列目: BUC
- 3列目: アクティビティ
- 4列目: アクター
- 5列目: 画面
- 6列目: UC
- 7列目: 情報
- 8列目: 条件
- 9列目: 外部システム

### 2. Arch 設計からの技術コンテキスト抽出

arch-design.yaml から以下を抽出する:

- **system_architecture.tiers**: ティア構成（presentation, application, data）
- **app_architecture.layers**: レイヤー構成（API、ドメイン、インフラ）
- **data_architecture.entities**: データエンティティと関連
- **technology_context**: 技術スタック（言語、フレームワーク、DB）
- **policies**: セキュリティ、認証、認可ポリシー

### 3. Design システムからの画面・コンポーネント抽出

design-event.yaml から以下を抽出する:

- **portals**: ポータル一覧（id, name, actor, primary_color）
- **screens**: 画面一覧（name, portal, route, components）
- **components.ui**: UI 共通コンポーネント
- **components.domain**: ドメイン特化コンポーネント
- **states**: 状態モデル表示仕様
- **tokens**: デザイントークン

### 4. UC と画面・コンポーネントのマッピング

BUC.tsv の「画面」列と design-event.yaml の screens を照合する:

| UC名 | RDRA画面 | Design画面 | ポータル | コンポーネント |
|------|---------|-----------|---------|-------------|
| {UC名} | {BUC.tsvの画面列} | {screens[].name} | {screens[].portal} | {screens[].components} |

### 5. API エンドポイントの推定

各 UC の操作（CRUD + 状態遷移）から API エンドポイントを推定する:

- UC の操作動詞から HTTP メソッドを推定
- 情報.tsv のエンティティからリソース名を推定
- arch-design.yaml の API 設計パターンに合わせる

### 6. 非同期イベントの特定

以下の条件で非同期イベントを特定する:

- 外部システム.tsv で「連携種別」が非同期のもの
- 状態.tsv で状態遷移の通知が必要なもの
- arch-design.yaml で message_queue/event_bus が定義されているもの

### 7. 全体横断 UX/UI 設計の方針決定

**ユーザーフロー**: 業務フロー横断で主要なアクターごとのフローを抽出する
- BUC.tsv のアクティビティ列から操作順序を推定
- 複数 UC をまたぐフローを特定

**情報アーキテクチャ**: design-event.yaml の screens と portals からサイトマップを構築する

**データ可視化対象**: 情報.tsv の指標データ（数値型属性）を持つエンティティを特定する

### 8. _inference.md の記録

以下を `_inference.md` に記録する:

```markdown
# Spec 生成 分析根拠

## 分析日時
{日時}

## UC 一覧
{業務/BUC/UC のツリー}

## UC-画面マッピング
{UC と Design 画面の対応表}

## API エンドポイント推定
{推定した API 一覧}

## 非同期イベント
{特定した非同期イベント一覧}

## 全体横断設計方針
### ユーザーフロー
{主要フロー}

### 情報アーキテクチャ
{サイトマップ構造}

### データ可視化対象
{対象画面・指標}

## NFR 反映事項
{NFR グレードから導出した設計判断}
```
