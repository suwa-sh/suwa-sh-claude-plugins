---
source: distillery-impl
uc_id: "19ec0182"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S3 contracts(bootstrap P4_contracts)"
related_ids: []
related_files:
  - "docs/specs/latest/_cross-cutting/api/asyncapi.yaml"
  - "docs/impl/latest/contracts.lock.yaml"
severity: improvement
---

# 変更要望: asyncapi の message payload に title が無く生成物が AnonymousSchema になる

## 現状の仕様

`docs/specs/latest/_cross-cutting/api/asyncapi.yaml` の `components.messages` は
`OverdueNotificationMessage`(66行)・`ReservationNotificationMessage`(108行)ともメッセージ本体には
`title`(「督促通知メッセージ」「予約通知メッセージ」)が付与されているが、その `payload:`(69行/111行)配下の
スキーマオブジェクト自体には `title` が設定されていない。

## 実装で判明した問題

`docs/impl/latest/contracts.lock.yaml`(P4_contracts, `packages/contracts/async-types` 生成時のnote)に
以下の記録がある:

```
note: AnonymousSchema_1/9 = payload に title 欠落。README.md に message 対応表を記録
```

asyncapi-cli(generator: `asyncapi-cli-models-typescript`)は payload スキーマに `title` が無いと
生成する TypeScript 型に意味のある名前を付けられず `AnonymousSchema_1` / `AnonymousSchema_9` という
機械的な連番名になる。本UC(書籍を貸出する)自体は `async_events: []`(`_api-summary.yaml`)のため
この生成物を直接利用しないが、督促通知(UC: 督促通知を送信する)・予約通知(UC: 予約通知を送信する)の
実装時に同じ問題が顕在化することが確実である。

## 提案する変更

`asyncapi.yaml` の `components.messages.*.payload` に `title`(例: `OverdueNotificationPayload` /
`ReservationNotificationPayload`)を追加し、契約再生成(S0 bootstrap / S3 contracts)で
`AnonymousSchema_*` を解消する。dist-spec の asyncapi 生成テンプレートに「payload には必ず title を
持たせる」ルールを追加することも検討されたい(openapi 側の `x-enum-varnames` 相当の予防策)。

## 影響範囲

- 影響UC: 督促通知を送信する(uc_id: 58c27b56)、予約通知を送信する(uc_id: c443f1dd)の
  tier-backend-api / tier-worker 実装時。
- 対象パイプライン: dist-spec(asyncapi.yaml)。
