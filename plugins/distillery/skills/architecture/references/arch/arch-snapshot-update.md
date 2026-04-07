# アーキテク��ャ スナップショット更新

アーキテクチャイベントの arch-design.yaml と arch-design.md を latest/ に反映するタスク。

## 入力

- `docs/arch/events/{event_id}/arch-design.yaml` — 最新のイベント
- `docs/arch/events/{event_id}/arch-design.md` — 最新の Markdown

## タス���手順

### 1. latest ディレクトリの確認

- `docs/arch/latest/` が存在しない場合は作成する

### 2. スナップショット更新

- `docs/arch/events/{event_id}/arch-design.yaml` を `docs/arch/latest/arch-design.yaml` に **丸ごとコピー（上書き）** する
- `docs/arch/events/{event_id}/arch-design.md` を `docs/arch/latest/arch-design.md` に **丸ごとコピー（上書き）** する
- アーキテクチャ設計は全セクション（システム・アプリ・データ）の整合性が重要なため、部分マージではなく全量置換とする

### 3. 更新確認

- `docs/arch/latest/arch-design.yaml` が正しく更新されたことを確認する
- `version`, `event_id`, `created_at` が最新イベントの値と一致することを確認する

## 出力

- `docs/arch/latest/arch-design.yaml` — 最新スナ��プショット
- `docs/arch/latest/arch-design.md` — 最新 Markdown

## 注意事項

- latest/ のファイルは常に最新のイベントと完全に一致すること
- 手動で latest/ を編集した場合は、その変更もイベントとして記録すること
