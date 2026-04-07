# Event Sourcing Rules (Spec)

Spec の変更をイベントとして記録し、スナップショットを逐次更新する方式。
UC 単位の差分イベント + latest マージ + cross-cutting 後付け方式を採用する。

## 基本概念

```
events/        — 差分イベント履歴（変更 UC のみ + cross-cutting。追記のみ、不変）
latest/        — 最新スナップショット（実ディレクトリ。差分をマージした結果）
```

- `events/` 配下のファイルは一度書き込んだら変更・削除しない（イミュータブル）
- `latest/` は実ディレクトリであり、差分イベントをマージした結果を保持する
- 新しい変更は `events/` に差分イベントとして記録してから `latest/` にマージする

## イベント ID 生成

- フォーマット: `{YYYYMMDD_HHMMSS}_spec_generation`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない**
- 例: `20260329_100000_spec_generation`
- 同一秒に複数イベントが発生する場合: `_2`, `_3` サフィックスを付与

## トリガーイベント

各イベントには前段スキルのイベントIDを記録する:

- `trigger_event`: 前段イベントID（例: `rdra:20260329_100000_initial`, `arch:20260329_110000_initial_arch`, `design:20260329_120000_design_system`）
- `spec-event.yaml` のメタデータおよび `source.txt` に記録する

## ディレクトリ構成

```
docs/specs/
  events/{event_id}/
    {業務名}/                      # 変更 UC のみ含む（差分）
      {BUC名}/
        buc-spec.md                # BUC 俯瞰仕様（影響 BUC のみ）
        {UC名}/
          spec.md
          tier-*.md
          _api-summary.yaml
          _model-summary.yaml
    _cross-cutting/                # latest 参照で全量再生成した結果
      ux-ui/
      api/
      datastore/
      traceability-matrix.md
    decisions/                     # 設計判断記録（Decision Records）
      spec-decision-001.yaml
      ...
    _changes.md                    # 変更サマリ（追加/変更/削除 UC 一覧）
    spec-event.yaml                # メタデータ
    spec-event.md                  # Markdown 概要
    README.md                      # UC 一覧インデックス
    _inference.md                  # 分析根拠
    source.txt                     # トリガー説明
  latest/                          # マージ結果（実ディレクトリ）
    {業務名}/
      {BUC名}/
        buc-spec.md
        {UC名}/
          spec.md
          tier-*.md
          _api-summary.yaml
          _model-summary.yaml
    _cross-cutting/
    decisions/                     # 設計判断記録（events からコピー）
    spec-event.yaml
    spec-event.md
    README.md
```

## イベントの構成

### _changes.md

```markdown
# 変更サマリ

- event_id: {event_id}
- trigger_event: rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id}

## 追加 UC
- 会議室予約業務/会議室予約フロー/予約を確認する

## 変更 UC
- 会議室予約業務/会議室予約フロー/予約を登録する（情報モデル変更に伴う更新）

## 削除 UC
- なし

## 影響 BUC
- 会議室予約業務/会議室予約フロー（UC 追加/変更に伴い buc-spec.md 再生成）

## cross-cutting 再生成
- openapi.yaml: 全 UC から再統合
- rdb-schema.yaml: 全 UC から再統合
- traceability-matrix.md: 網羅率再計算
```

### UC 差分

events/{event_id}/ には **変更があった UC ディレクトリのみ** を含める。
変更がない UC は events/ に含めない（latest/ にのみ存在する）。

### cross-cutting

events/{event_id}/_cross-cutting/ には **latest/ の全 UC を参照して再生成した全量** を含める。
cross-cutting は常に全 UC に依存するため、差分ではなく全量を記録する。

## 更新フロー（5フェーズ）

### Phase 1: UC 差分イベント作成

1. 前段イベントの `_changes.md` を読み取り、影響 UC を特定する
2. `events/{event_id}/` に影響 UC のディレクトリのみ作成する
3. 各 UC の spec.md, tier-*.md, _api-summary.yaml, _model-summary.yaml を生成する
4. `_changes.md` に変更 UC 一覧を記録する

### Phase 2: latest に UC をマージ

1. events/{event_id}/ の UC ディレクトリを latest/ にマージする:
   - **追加**: latest/ に存在しない UC ディレクトリをコピー
   - **変更**: 同名 UC ディレクトリを上書き
   - **削除**: `_changes.md` に削除と記載された UC ディレクトリを latest/ から除去
2. マージ後、latest/ の全 UC が整合していることを確認する

### Phase 3: cross-cutting を latest 参照で再生成

latest/ の全 UC を入力として cross-cutting を再生成する:

1. `_cross-cutting/api/openapi.yaml` — 全 UC の `_api-summary.yaml` から統合
2. `_cross-cutting/api/asyncapi.yaml` — 全 UC の非同期イベントから統合
3. `_cross-cutting/datastore/rdb-schema.yaml` — 全 UC の `_model-summary.yaml` から統合
4. `_cross-cutting/datastore/kvs-schema.yaml` — KVS アクセスパターン統合
5. `_cross-cutting/ux-ui/common-components.md` — 全 UC の tier-frontend から共通パターン抽出
6. `_cross-cutting/traceability-matrix.md` — 網羅率再計算

生成結果を `events/{event_id}/_cross-cutting/` に書き出す。

### Phase 4: cross-cutting・decisions を latest にマージ

1. `events/{event_id}/_cross-cutting/` を `latest/_cross-cutting/` に上書きする
2. `events/{event_id}/decisions/` を `latest/decisions/` に**全置換**する（既存の latest/decisions/ を削除してからコピー）
3. `spec-event.yaml`, `spec-event.md`, `README.md` を events/{event_id}/ と latest/ の両方に配置する

### Phase 5: buc-spec.md を再生成

1. `_changes.md` の「影響 BUC」に記載された BUC の buc-spec.md を再生成する
2. latest/ の該当 BUC 配下の全 UC spec.md を参照して集約する
3. 生成結果を `events/{event_id}/{業務名}/{BUC名}/buc-spec.md` に書き出す
4. `latest/{業務名}/{BUC名}/buc-spec.md` に上書きする

## 初期構築時の扱い

`docs/specs/latest/` が空（または存在しない）場合は初期構築モードとなる:

1. 全 UC の Spec を `events/{event_id}/` に生成する
2. 全量を `latest/` にコピーする
3. cross-cutting を `latest/` の全 UC を参照して生成し、`events/{event_id}/_cross-cutting/` と `latest/_cross-cutting/` に配置する
4. buc-spec.md を生成し、`events/{event_id}/` と `latest/` に配置する
5. `decisions/` を `events/{event_id}/decisions/` と `latest/decisions/` に配置する
6. `spec-event.yaml`, `README.md` を `events/{event_id}/` と `latest/` に配置する
6. 初期構築イベントの `_changes.md` には全 UC を「追加」として記載する
7. 以後の更新は差分イベント方式で動作する

## ux-design.md / ui-design.md / data-visualization.md の扱い

全体横断 UX/UI 設計（ux-design.md, ui-design.md, data-visualization.md）は UC Spec に先行して確定する（SKILL.md Step2）。
これらは RDRA + design-event.yaml から決定でき、個別 UC に依存しないため:

- 初期構築時: events/{event_id}/ と latest/ に生成
- 差分更新時: 前段（RDRA/Design）に変更がある場合のみ再生成。なければ latest/ の既存を維持

## 注意事項

- events/ の UC ディレクトリは変更分のみ含む。latest/ は全 UC を保持する
- cross-cutting は常に latest/ の全 UC を参照して全量再生成する（差分マージではない）
- events/ の cross-cutting は「この時点で再生成した結果」の記録であり、latest/ の cross-cutting と同一内容になる
- latest/ のファイルを直接手動編集した場合、events/ との整合性が崩れる — その場合は手動編集もイベントとして記録する
- イベントは時系列順に適用すること（event_id のソートで時系列が保証される）
