# NFR スナップショット更新

NFR イベントの内容を latest/ に反映するタスク。モードにより手順が異なる。

## 入力

- 初期構築時: `docs/nfr/events/{event_id}/nfr-grade.yaml`（完全版）
- 差分更新時: `docs/nfr/events/{event_id}/nfr-grade-diff.yaml`（変更メトリクスのみ）+ `_changes.md`

## タスク手順

### 1. latest ディレクトリの確認

- `docs/nfr/latest/` が存在しない場合は作成する

### 2. スナップショット更新

#### 初期構築時

- `docs/nfr/events/{event_id}/nfr-grade.yaml` を `docs/nfr/latest/nfr-grade.yaml` に **丸ごとコピー（上書き）** する

#### 差分更新時

- `nfr-grade-diff.yaml` の変更メトリクスを `docs/nfr/latest/nfr-grade.yaml` にマージする
  - マージキー: メトリクスの `id`（`A.1.1.1` 形式。カテゴリ階層内で一意）
  - `confidence: "user"` の既存メトリクスは上書きしない（ユーザー確定値を保護）
  - `_changes.md` の削除セクションに記載されたメトリクスを latest から除去
- マージ後、latest の `event_id` / `created_at` を最新イベントの値に更新する

### 3. 更新確認

- `docs/nfr/latest/nfr-grade.yaml` が正しく更新されたことを確認する
- `version`, `event_id`, `created_at` が最新イベントの値と一致することを確認する
- 差分更新時はマージ後の latest に対してバリデーションを再実行する:
  `node ${CLAUDE_PLUGIN_ROOT}/skills/dist-quality-attributes/scripts/validateNfrGrade.js docs/nfr/latest/nfr-grade.yaml`

## 出力

- `docs/nfr/latest/nfr-grade.yaml` — 最新スナップショット
- `docs/nfr/latest/nfr-grade.md` — 最新スナップショットの Markdown（generateNfrGradeMd.js で再生成）

## 注意事項

- events/ は不変（イミュータブル）。latest/ だけを更新する
- 手動で latest/ を編集した場合は、その変更もイベントとして記録すること
