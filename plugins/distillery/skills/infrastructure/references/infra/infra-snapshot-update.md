# infra スナップショット更新

infra イベントの内容を `docs/infra/latest/` に反映する。

## 手順

1. `docs/infra/latest/` が存在する場合は中身を削除する（全量上書きのため）
2. `docs/infra/events/{event_id}/` の内容を `docs/infra/latest/` にコピーする

```bash
rm -rf docs/infra/latest/
cp -r docs/infra/events/{event_id}/ docs/infra/latest/
```

latest にはイベントの全ファイル（infra-event.yaml, infra-event.md, _inference.md, source.txt）と MCL 出力（specs/, docs/, infra/）がそのまま入る。

## 注意事項

- latest は常に最新イベントの内容と完全に一致すること
- 部分マージは行わない（全量上書き）
- infra-event.yaml の `arch_feedback` セクションは Step3 完了後に更新される可能性がある。その場合は再度 latest を更新する
