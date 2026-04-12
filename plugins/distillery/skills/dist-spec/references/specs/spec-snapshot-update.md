# Spec スナップショット更新タスク

UC 差分イベントを latest/ にマージし、cross-cutting を再生成して配置する。

## 入力

- `docs/specs/events/{event_id}/` — 生成された差分イベント（変更 UC + _changes.md）
- `docs/specs/latest/` — 既存のスナップショット（初期構築時は空/未存在）

## 出力

- 更新された `docs/specs/latest/`（UC マージ + cross-cutting + README.md）
- `docs/specs/events/{event_id}/_cross-cutting/`（再生成結果の記録）

## 手順

### Phase 1: UC 差分を latest にマージ

1. `events/{event_id}/_changes.md` を読み取る
2. **追加 UC**: `events/{event_id}/{業務名}/{BUC名}/{UC名}/` を `latest/{業務名}/{BUC名}/{UC名}/` にコピー
3. **変更 UC**: `events/{event_id}/{業務名}/{BUC名}/{UC名}/` で `latest/{業務名}/{BUC名}/{UC名}/` を上書き
4. **削除 UC**: `_changes.md` に削除と記載された UC ディレクトリを `latest/` から除去
5. マージ後、latest/ の全 UC ディレクトリを確認する

### Phase 2: cross-cutting を latest 参照で再生成

`latest/` の全 UC を入力として cross-cutting を再生成する:

1. **API 統合**: 全 UC の `_api-summary.yaml` → `_cross-cutting/api/openapi.yaml`
2. **AsyncAPI**: 全 UC の非同期イベント → `_cross-cutting/api/asyncapi.yaml`（イベントがある場合のみ）
3. **RDB スキーマ**: 全 UC の `_model-summary.yaml` → `_cross-cutting/datastore/rdb-schema.yaml`
4. **KVS スキーマ**: KVS アクセスがある場合 → `_cross-cutting/datastore/kvs-schema.yaml`
5. **共通コンポーネント**: 全 UC の tier-frontend → `_cross-cutting/ux-ui/common-components.md`
6. **トレーサビリティ**: RDRA 全要素 vs 全 UC Spec → `_cross-cutting/traceability-matrix.md`

生成結果を `events/{event_id}/_cross-cutting/` に書き出す。

### Phase 3: cross-cutting を latest にマージ

1. `events/{event_id}/_cross-cutting/` を `latest/_cross-cutting/` に上書きする
2. `latest/_cross-cutting/ux-ui/ux-design.md` 等の UC 非依存ファイルは、前段変更がなければ既存を維持する

### Phase 4: buc-spec.md を再生成

1. `_changes.md` の「影響 BUC」に記載された BUC の buc-spec.md を再生成する
2. `latest/` の該当 BUC 配下の全 UC spec.md を参照して集約する
3. `events/{event_id}/{業務名}/{BUC名}/buc-spec.md` に書き出す
4. `latest/{業務名}/{BUC名}/buc-spec.md` に上書きする

### Phase 5: メタデータ + README.md 生成

1. `spec-event.yaml` を生成し、`events/{event_id}/` と `latest/` に配置する
2. `spec-event.md` を生成し、`events/{event_id}/` と `latest/` に配置する
3. README.md を生成し、`events/{event_id}/` と `latest/` に配置する

#### README.md 生成アルゴリズム

1. `latest/` 配下を再帰的に走査し、`spec.md` を含むディレクトリを UC として列挙する
2. パスから `{業務名}/{BUC名}/{UC名}` を抽出する
3. 各 UC について:
   - `_api-summary.yaml` から API エンドポイント数をカウントする
   - `_api-summary.yaml` の `async_events` の存在で非同期の有/無を判定する
4. `spec-event.yaml` から event_id, created_at を取得する
5. 業務名 → BUC名 → UC名の昇順でソートし、テーブルを生成する

**README.md フォーマット**:

```markdown
# Spec 一覧

## UC 仕様

| 業務 | BUC | UC名 | API数 | 非同期 | 最終更新イベント |
|------|-----|------|:-----:|:-----:|----------------|
| {業務名} | {BUC名} | [{UC名}]({業務名}/{BUC名}/{UC名}/spec.md) | {API数} | {有/無} | {event_id} |

## 全体横断仕様

- [UX デザイン仕様](_cross-cutting/ux-ui/ux-design.md)
- [UI デザイン仕様](_cross-cutting/ux-ui/ui-design.md)
- [データ可視化仕様](_cross-cutting/ux-ui/data-visualization.md)
- [OpenAPI](_cross-cutting/api/openapi.yaml)
- [RDB スキーマ](_cross-cutting/datastore/rdb-schema.yaml)
- [トレーサビリティ](_cross-cutting/traceability-matrix.md)

## メタデータ

- Event ID: {event_id}
- 生成日時: {created_at}
- UC 総数: {total_ucs}
- API 総数: {total_apis}
```

## 初期構築時

`docs/specs/latest/` が空（または存在しない）場合:

1. `events/{event_id}/` の全 UC を `latest/` にコピーする
2. Phase 2〜5 を実行する（cross-cutting 生成 → メタデータ生成）
