# NFR イベントソーシングルール

NFR グレードの変更をイベントとして記録し、スナップショットを逐次更新する方式。
差分イベント + latest マージ方式を採用する。

## 基本概念

```
events/        — 差分イベント履歴（変更メトリクスのみ。追記のみ、不変）
latest/        — 最新スナップショット（実ディレクトリ。差分をマージした結果）
```

- `events/` 配下のファイルは一度書き込んだら変更・削除しない（イミュータブル）
- `latest/` は実ディレクトリであり、差分イベントをマージした結果を保持する
- 新しい変更は `events/` に差分イベントとして記録してから `latest/` にマージする

## ディレクトリ構成

```
docs/nfr/
  events/{event_id}/
    nfr-grade-diff.yaml    # 変更メトリクスのみ（差分）
    _changes.md            # 変更サマリ（何を追加/変更/削除したか）
    _inference.md          # 推論根拠サマリ
    source.txt             # トリガー説明
  latest/
    nfr-grade.yaml         # 全メトリクスの完全版（マージ結果）
    nfr-grade.md           # Markdown 表現
```

## イベント ID

- 形式: `{YYYYMMDD_HHMMSS}_{変更名}`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない**
- `created_at` 等のタイムスタンプも `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する
- 変更名は変更内容を表す短い snake_case の名前
- 例:
  - 初期構築: `20260327_100000_initial_nfr`
  - RDRA 差分起因: `20260327_150000_nfr_update_for_reservation`

## トリガーイベント

各イベントには前段スキルのイベントIDを記録する:

- `trigger_event`: 前段イベントID（例: `rdra:20260327_143000_add_reservation`）
- `_changes.md` および `nfr-grade-diff.yaml` のメタデータに記録する

## イベントの構成

各イベントディレクトリには、**変更があった NFR メトリクスのみ**を含める（差分イベント）。

### nfr-grade-diff.yaml

変更メトリクスのみを含む。メトリクスは `category` + `subcategory` + `metric_id` で照合する。

```yaml
meta:
  event_id: "{event_id}"
  trigger_event: "rdra:{rdra_event_id}"
  created_at: "2026-03-27T15:00:00"
categories:
  - category: "可用性"
    subcategory: "継続性"
    metrics:
      - metric_id: "availability_target"
        grade: "C"
        target: "99.9%"
        rationale: "予約システムは業務時間内の可用性が重要"
```

### _changes.md

```markdown
# 変更サマリ

- event_id: {event_id}
- trigger_event: rdra:{rdra_event_id}

## 追加
- 可用性/継続性/availability_target: 予約システム向け可用性目標を追加

## 変更
- 性能/応答時間/response_time: グレード B → C に変更（予約照会の応答要件緩和）

## 削除
- なし
```

### source.txt

トリガー説明テキスト。

## スナップショット更新ルール

### latest へのマージ

イベント確定後、`latest/nfr-grade.yaml` に差分をマージする:

- **マージキー**: メトリクスの `category` + `subcategory` + `metric_id`
- **追加**: latest に存在しないメトリクスを追加
- **変更**: 同一キーのメトリクスの `grade` / `target` / `rationale` を上書き
- **削除**: `_changes.md` に削除と記載されたメトリクスを latest から除去
- **ユーザー確定値の保護**: `confidence: "user"` のメトリクスは差分更新で上書きしない

マージ後、`nfr-grade.md` を再生成する。

### マージ手順

```bash
# 1. latest/nfr-grade.yaml を読み込み
# 2. events/{event_id}/nfr-grade-diff.yaml の各メトリクスを照合
# 3. confidence: "user" でないメトリクスのみ追加/上書き
# 4. _changes.md の削除セクションに記載されたメトリクスを除去
# 5. latest/nfr-grade.yaml を書き出し
# 6. latest/nfr-grade.md を再生成
```

## 初期構築時の扱い

`docs/nfr/latest/` が空（または存在しない）場合は初期構築モードとなる:

1. RDRA モデルから全メトリクスを推論する
2. 全量を `nfr-grade.yaml`（差分ファイル名ではなく完全版）として `events/{event_id}/` に記録する
3. 同じ内容を `latest/nfr-grade.yaml` にコピーする
4. 初期構築イベントの `_changes.md` には全メトリクスを「追加」として記載する
5. 以後の更新は差分イベント方式で動作する

## 差分更新モードの動作

既存の NFR グレードがある状態で RDRA が更新された場合:

1. 前段 RDRA イベントの `_changes.md`（`docs/rdra/events/{rdra_event_id}/_changes.md`）を読み取る
2. 変更された RDRA 要素に関連する NFR メトリクスのみを再推論する
3. 再推論結果を `nfr-grade-diff.yaml` として新イベントに記録する
4. `latest/nfr-grade.yaml` に差分をマージする
5. `confidence: "user"` のメトリクスはスキップする（ユーザー確定値を保護）

## 注意事項

- NFR グレードは RDRA モデル + ユーザー対話の結果であるため、RDRA が更新されても自動更新しない
- RDRA 更新後に NFR の再評価が必要かはユーザーが判断する
- イベントは時系列順に適用すること（event_id のソートで時系列が保証される）
- latest/ のファイルを直接手動編集した場合、events/ との整合性が崩れる — その場合は手動編集もイベントとして記録する
