# アーキテクチャ スナップショット更新

アーキテクチャイベントを `docs/arch/latest/` に反映するタスク。初期構築モードと差分更新モードを区別する。

詳細なマージキー・整合性ルールは `references/event-sourcing-rules.md` を参照。

## 入力

### 初期構築モード

- `docs/arch/events/{event_id}/arch-design.yaml` — 全セクション完全版

### 差分更新モード

- `docs/arch/events/{event_id}/arch-design-diff.yaml` — 変更セクションのみ
- `docs/arch/events/{event_id}/_changes.md` — 追加/変更/削除の明細
- `docs/arch/latest/arch-design.yaml` — 既存スナップショット（マージ先）

## モード判定

- `docs/arch/latest/arch-design.yaml` が存在しない、または空 → **初期構築モード**
- 既に存在 → **差分更新モード**

## タスク手順

### 1. latest ディレクトリの確認

- `docs/arch/latest/` が存在しない場合は作成する

### 2. スナップショット更新

#### 初期構築モード

- `events/{event_id}/arch-design.yaml`（全セクション完全版）を `latest/arch-design.yaml` に **丸ごとコピー（上書き）** する
- 差分マージは行わない（events 側に diff は存在しない）

#### 差分更新モード

`events/{event_id}/arch-design-diff.yaml` の変更セクションを `latest/arch-design.yaml` にマージする。マージキー・追加/変更/削除の扱いは `event-sourcing-rules.md` の「スナップショット更新ルール」に従う:

- **マージキー**:
  - `system_architecture.tiers`: `id` で照合
  - `app_architecture.tier_layers`: `tier_id` で照合
  - `data_architecture.entities`: `name` で照合
  - `data_architecture.policies`: `name` で照合
- **追加**: latest に存在しない要素を配列に追加
- **変更**: 同一キーの要素を上書き
- **削除**: `_changes.md` の削除セクションに記載された要素を latest から除去
- **ユーザー確定値の保護**: `confidence: "user"` の項目は差分更新で上書きしない

### 3. Markdown 再生成

スナップショット更新後、`latest/arch-design.md` を再生成する:

```bash
node <skill-path>/scripts/generateArchDesignMd.js docs/arch/latest/arch-design.yaml
```

### 4. decisions/ のスナップショット更新

`latest/decisions/` はイベントの `decisions/` ディレクトリを **全置換** で更新する（マージではない）:

1. `latest/decisions/` が存在する場合は中身を全て削除する
2. `events/{event_id}/decisions/` の全ファイルを `latest/decisions/` にコピーする

これにより、latest の決定記録は常に最新イベントの決定記録と一致する。

### 5. 更新確認

- `docs/arch/latest/arch-design.yaml` が正しく更新されたことを確認する
- `version`, `event_id`, `created_at` が最新イベントの値と一致することを確認する

## 出力

- `docs/arch/latest/arch-design.yaml` — 最新スナップショット
- `docs/arch/latest/arch-design.md` — 最新 Markdown
- `docs/arch/latest/decisions/arch-decision-{NNN}.yaml` — 最新決定記録

## 注意事項

- `latest/` のファイルは常に最新イベントを反映していること
- 手動で `latest/` を編集した場合は、その変更もイベントとして記録すること（`events/{event_id}/` への記録）
- 差分マージのキー定義に変更がある場合は `event-sourcing-rules.md` を更新し、本ファイルは参照のみとする（二重管理を避ける）
