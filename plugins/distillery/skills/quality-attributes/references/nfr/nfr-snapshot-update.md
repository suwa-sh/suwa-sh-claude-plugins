# NFR スナップショット更新

NFR イベントの nfr-grade.yaml を latest/ に反映するタスク。

## 入力

- `docs/nfr/events/{event_id}/nfr-grade.yaml` — 最新のイベント

## タスク手順

### 1. latest ディレクトリの確認

- `docs/nfr/latest/` が存在しない場合は作成する

### 2. スナップショット更新

- `docs/nfr/events/{event_id}/nfr-grade.yaml` を `docs/nfr/latest/nfr-grade.yaml` に **丸ごとコピー（上書き）** する
- NFR グレードは全カテゴリの整合性が重要なため、部分マージではなく全量置換とする

### 3. 更新確認

- `docs/nfr/latest/nfr-grade.yaml` が正しく更新されたことを確認する
- `version`, `event_id`, `created_at` が最新イベントの値と一致することを確認する

## 出力

- `docs/nfr/latest/nfr-grade.yaml` — 最新スナップショット

## 注意事項

- latest/ のファイルは常に最新のイベントと完全に一致すること
- 手動で latest/ を編集した場合は、その変更もイベントとして記録すること
