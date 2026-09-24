# @repo/test-support

テスト基盤。d2-foundation が生成する。実装者 (d2-implement mode=integrate) が結線する部分をここに書く。

## 中身

| ファイル | 役割 |
|---|---|
| `src/tracer.ts` | シナリオ単位の計装。`withScenario` / `traceFetch` / `expressScenarioMiddleware` / `tracePg` / `tracePublisher` / `traced` |
| `src/pglite-harness.ts` | 埋め込み Postgres (pglite)。`PgHarness.start()` で migration 適用、`withRollback` でシナリオ隔離 |

## 実装者が結線するもの (d2-implement mode=integrate が読む)

1. **テスト用 composition root** を `apps/<backend>/src/test-app.ts` に置き、`export function createTestApp(deps)` で
   express アプリを返す。中で最初に `setTier('<tier id>')` を呼び、`expressScenarioMiddleware({ resolveOperationId })` を最初に use する
   (`resolveOperationId` は `createOperationIdResolver(require('contracts/generated/slices/<slug>/contract-slice.json'))`。
   contract-slice.json は `{ schema_version, uc, openapi: { paths }, asyncapi }` の形で、`createOperationIdResolver` は
   その `openapi.paths` を読む。slice 全体を渡してよい (openapi 部分だけ渡す `slice.openapi` の形も受け付ける)。
   as-built はこの operationId で API の経路を抽出する)。DB クライアントは `tracePg(client, 'LoanRepository')` のように
   発行元の名前を付けて包み、publisher は `tracePublisher(port, 'EventPublisher')`、usecase は `traced('RegisterLoan', obj)` で包む。
   トレースの `meta.tier` / `meta.component` が as-built のシーケンス図の送受信者になる。
2. **api ドライバ** (`features/support/drivers/api.ts`) は `createTestApp` を supertest で叩く。
3. **DB** はテスト起動時に `PgHarness.start()` で 1 度だけ用意し、`D2_DATASTORE_OWNER` で migration の所有ティアを指す。
4. トレースは `D2_TRACE_DIR` に出る。d2-run が `.distillery/runs/<slug>/traces/` を指す。

## 環境変数

| 変数 | 用途 |
|---|---|
| `D2_TRACE_DIR` | トレース JSONL の出力先。未設定ならトレースは無効 |
| `D2_DATASTORE_OWNER` | migration を持つティア (既定 backend-api) |
