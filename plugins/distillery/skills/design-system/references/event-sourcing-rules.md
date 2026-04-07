# Event Sourcing Rules (Design System)

デザインシステムの変更をイベントとして記録し、スナップショットを逐次更新する方式。
差分イベント + latest マージ方式を採用する。

## 基本概念

```
events/        — 差分イベント履歴（変更要素のみ。追記のみ、不変）
latest/        — 最新スナップショット（実ディレクトリ。差分をマージした結果）
```

- `events/` 配下のファイルは一度書き込んだら変更・削除しない（イミュータブル）
- `latest/` は実ディレクトリであり、差分イベントをマージした結果を保持する
- 新しい変更は `events/` に差分イベントとして記録してから `latest/` にマージする

## イベント ID 生成

- フォーマット: `{YYYYMMDD_HHMMSS}_design_system`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない**
- 例: `20260329_100000_design_system`
- 同一秒に複数イベントが発生する場合: `_2`, `_3` サフィックスを付与

## トリガーイベント

各イベントには前段スキルのイベントIDを記録する:

- `trigger_event`: 前段イベントID（例: `rdra:20260329_100000_initial`, `arch:20260329_110000_initial_arch`）
- `design-event-diff.yaml` のメタデータおよび `_changes.md` に記録する

## ハイブリッド方式の概要

本スキルはハイブリッド方式を採用する。成果物によって差分マージと全量再ビルドを使い分ける:

| 成果物 | 方式 | 理由 |
|--------|------|------|
| `design-event.yaml` | **差分マージ** | トークン/コンポーネント/画面は ID で独立して管理可能 |
| `assets/` (SVG) | **差分マージ** | SVG は独立ファイル。追加/削除が明確 |
| `decisions/` | **差分マージ** | artifact_id で照合。イベントごとに追加・上書き |
| `storybook-app/` | **全量再ビルド** | トークン→コンポーネント→Story の相互依存が強く、部分更新で壊れやすい |

**events/ に含めるもの**: design-event-diff.yaml, 追加/変更 assets, decisions/, _changes.md, _inference.md, source.txt
**events/ に含めないもの**: storybook-app/（全量再ビルドのため履歴化する意味が薄い。latest/ でのみ管理）

## ディレクトリ構造

```
docs/design/
  events/
    {event_id}/
      design-event-diff.yaml  # 変更要素のみ（差分）
      assets/                  # 追加/変更された SVG のみ（差分）
      decisions/               # 決定記録（design-decision-{NNN}.yaml）
      _changes.md              # 変更サマリ
      _inference.md            # 推論根拠
      source.txt               # トリガー説明
  latest/
    design-event.yaml          # 全要素の完全版（マージ結果）
    design-event.md            # Markdown 表現
    assets/                    # Logo SVG 3種 + Icon SVG セット（マージ結果）
    decisions/                 # 決定記録（events/ からコピー。全量置換）
    storybook-app/             # ★ 全量再ビルド対象（events/ には含めない）
```

## イベントの構成

各イベントディレクトリには、**変更があった要素のみ**を含める（差分イベント）。

### design-event-diff.yaml

変更要素のみを含む。各要素はそれぞれのマージキーで照合する。

```yaml
meta:
  event_id: "{event_id}"
  trigger_event: "rdra:{rdra_event_id}"
  created_at: "2026-03-29T10:00:00"
brand:                              # ブランド情報の変更（あれば）
  primary_color: "#1a73e8"
portals:                            # 追加/変更されたポータルのみ
  - id: "admin-portal"
    name: "管理者ポータル"
tokens:                             # 追加/変更されたトークンのみ
  primitive:
    - name: "color-blue-500"
      value: "#1a73e8"
  semantic:
    - name: "color-primary"
      ref: "color-blue-500"
  component:
    - name: "button-primary-bg"
      ref: "color-primary"
components:                         # 追加/変更されたコンポーネントのみ
  - name: "ReservationCard"
    type: "molecule"
    props: [...]
screens:                            # 追加/変更された画面のみ
  - route: "/reservations"
    portal_id: "admin-portal"
    components: ["ReservationCard"]
states:                             # 追加/変更された状態マッピングのみ
  - entity: "Reservation"
    states: ["pending", "confirmed", "cancelled"]
```

### _changes.md

```markdown
# 変更サマリ

- event_id: {event_id}
- trigger_event: rdra:{rdra_event_id}

## 追加
- components: ReservationCard（予約カード）
- screens: /reservations（予約一覧画面）

## 変更
- tokens/semantic: color-primary の参照先を変更

## 削除
- なし
```

## スナップショット更新ルール

### latest へのマージ

イベント確定後、`latest/design-event.yaml` に差分をマージする:

- **マージキー**:
  - `portals`: `id` で照合
  - `tokens`: 層（primitive/semantic/component）+ `name` で照合
  - `components`: `name` で照合
  - `screens`: `route` で照合
  - `states`: `entity` で照合
  - `brand`: キー単位で上書き
- **追加**: latest に存在しない要素を追加
- **変更**: 同一キーの要素を上書き
- **削除**: `_changes.md` に削除と記載された要素を latest から除去

### assets/ の差分マージ

- 追加 SVG: `events/{event_id}/assets/` から `latest/assets/` にコピー
- 変更 SVG: 同名ファイルを上書き
- 削除 SVG: `_changes.md` に記載された SVG を `latest/assets/` から除去

### decisions/ の差分マージ

- `events/{event_id}/decisions/` の YAML ファイルを `latest/decisions/` にコピーする（全量置換）
- マージキー: `artifact_id` で照合
- 追加: latest に存在しない `artifact_id` のファイルを追加
- 変更: 同一 `artifact_id` のファイルを上書き
- 初期構築時は `events/{event_id}/decisions/` の内容をそのまま `latest/decisions/` にコピーする

### ★ storybook-app/ の全量再ビルド（ハイブリッド方式）

**storybook-app/ は差分マージではなく全量再ビルドする。** トークン→コンポーネント→Story の依存チェーンがあるため、部分更新では CSS 変数の不整合やインポートエラーが発生しやすい。

再ビルド手順:
1. `latest/design-event.yaml`（マージ済み完全版）を入力として、以下を再生成する:
   - `src/styles/design-tokens.css` — 全トークンを反映
   - `src/app/globals.css` — `@theme inline` のトークン登録を更新
   - 変更/追加されたコンポーネントの TSX + Story
   - DesignTokens.mdx — トークン一覧を再生成
2. `npx storybook build` で全体の整合性を検証する
3. storybook-app/ は events/ にコピーしない（latest/ でのみ管理）

**events/ に storybook-app/ を含めない理由:**
- 全量再ビルドのため、各イベント時点の storybook-app/ は latest/design-event.yaml から再現可能
- storybook-app/ は数百〜数千ファイルになり、events/ に毎回コピーするとディスクを圧迫する

### マージ手順（まとめ）

```bash
# Phase 1: design-event.yaml の差分マージ
# 1. latest/design-event.yaml を読み込み
# 2. events/{event_id}/design-event-diff.yaml の各セクションを照合
# 3. マージキーで追加/上書き
# 4. _changes.md の削除セクションに記載された要素を除去
# 5. latest/design-event.yaml を書き出し
# 6. latest/design-event.md を再生成

# Phase 2: assets/ の差分マージ
# 7. events/{event_id}/assets/ の SVG を latest/assets/ にマージ

# Phase 2.5: decisions/ の差分マージ
# 7.5. events/{event_id}/decisions/ を latest/decisions/ にコピー（artifact_id で照合）

# Phase 3: storybook-app/ の全量再ビルド（★ ハイブリッド）
# 8. latest/design-event.yaml を入力として storybook-app/ を再ビルド
# 9. npx storybook build で検証
```

## 初期構築時の扱い

`docs/design/latest/` が空（または存在しない）場合は初期構築モードとなる:

1. RDRA モデル + アーキテクチャ設計から全要素を生成する
2. 全量を `design-event.yaml`（差分ファイル名ではなく完全版）として `events/{event_id}/` に記録する
3. 同じ内容を `latest/design-event.yaml` にコピーする
4. assets/ と storybook-app/ を `latest/` に生成する
5. 初期構築イベントの `_changes.md` には全要素を「追加」として記載する
6. 以後の更新は差分イベント方式で動作する

## source.txt

各イベントのトリガー説明を記録する:
- 例: "初期デザインシステム生成: 貸し会議室マッチングSaaS"

## 注意事項

- イベントは時系列順に適用すること（event_id のソートで時系列が保証される）
- latest/ のファイルを直接手動編集した場合、events/ との整合性が崩れる — その場合は手動編集もイベントとして記録する
- Storybook の差分更新後は必ず `storybook build` で検証すること
