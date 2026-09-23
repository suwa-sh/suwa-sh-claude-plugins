# 決定候補カタログ: メッセージング

同期 / 非同期、outbox、冪等性を決める。ADR の `scope: [app]` または `[system]`。
AsyncAPI が要るプロダクトのときだけ ADR を書く (プランの条件付き必須)。

---

## 同期 vs 非同期

- **選択肢**: sync (request/reply) / async (メッセージ駆動)
- **async が必要**: BUC に「バッチ / 一括 / 通知 / 非同期 / 集計」。ピーク時に遅延を許容できる (Queue-Based Load Leveling)。複数業務が同一イベントを消費する (Publisher-Subscriber)。処理時間が長く即時応答が要る (Asynchronous Request-Reply: 202 Accepted + ポーリング)。
- **sync 維持**: 同期応答が必須で遅延許容できない。subscriber が常に 1 つ (Point-to-Point で十分)。
- **派生するルール例**:
  ```yaml
  - scope: tier:worker
    text: "通知・集計は非同期メッセージで処理し、リクエスト経路をブロックしない"
  ```

## outbox / 配信保証

- **向く条件**: DB 更新とメッセージ発行を確実に一致させたい (二重発行・欠落を防ぐ)。
- **方針**: 送信予定を同一トランザクションで outbox テーブルに書き、別プロセスが発行する。
- **派生するルール例**:
  ```yaml
  - scope: tier:backend
    text: "外部へのイベント発行は outbox テーブル経由とし、業務更新と同一トランザクションで記録する"
  ```

## 冪等性

- **発火条件** (2 つ以上で high、1 つで medium): 金銭取引の状態遷移 / 外部が決済機関 / 社外アクター (リトライ重複リスク) / BUC に予約・申請等の更新系。
- **層別の対処**:
  - frontend: X-Idempotency-Key (UUID) + ダブルクリック防止。
  - backend-api: KVS で重複検知し前回レスポンスを返す。
  - RDB: UNIQUE 制約 + UPSERT。
  - worker / MQ: MessageId / ジョブ実行 ID。
- **派生するルール例**:
  ```yaml
  - scope: common
    text: "更新系 API は Idempotency-Key を受け取り、同一キーの再送で副作用を重複させない"
  ```

## Saga (分散トランザクション)

- **向く条件**: 外部システムをまたぐ状態遷移 (精算 → 決済等) + NFR A.4.1 (RPO/RTO)。
- **必須**: 補償トランザクション (Compensating Transaction)。補償未実装はアンチパターン。補償不能ステップは最後に置く。
- **向かない**: 単一サービスで ACID 完結する場合。
