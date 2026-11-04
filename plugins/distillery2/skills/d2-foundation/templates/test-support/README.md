# @repo/test-support

テスト基盤。d2-foundation が生成する。実装者 (d2-implement mode=integrate) が結線する部分をここに書く。

## 中身

| ファイル | 役割 |
|---|---|
| `src/tracer.ts` | シナリオ単位の計装。`span` / `traced` / `tracedFn` / `tracePg` / `tracePublisher` / `tracedFetch` / `expressScenarioMiddleware` |
| `src/pglite-harness.ts` | 埋め込み Postgres (pglite)。`PgHarness.fresh()` でシナリオごとに migration 済みの DB を作る。`withRollback` は単体・リポジトリのテスト用 |
| `src/clock.ts` | 時計。`Clock` (now() が Date を返す)、本番用の `systemClock`、テスト用の `FixedClock` (set / advance) |

## トレースの形

1 行 = `{ts, ts_end, seq, parent, scenario, kind, name, meta}`。`ts` は開始、`ts_end` は完了、`seq` は開始順、
`parent` は呼び出し元 span の seq。as-built はこの親子関係から「画面 → API → ユースケース → リポジトリ → DB」の
シーケンス図とデータフロー図を描く。**計装していない部品は図に出ない**ので、下の結線は UC が通る全ティア・全レイヤに行う。

## 実装者が結線するもの (d2-implement mode=integrate が読む)

1. **提供側 (backend) のテスト用 composition root** `apps/<backend>/src/test-app.ts` の `createTestApp(deps)`:
   - `deps` は api ドライバが渡す `{ db, clock }` を受け取る (`features/support/drivers/api.ts` の `TestAppDeps`)。
     `db` はシナリオごとの pglite (migration 済み。RDB が無ければ undefined)、`clock` は固定の時計。
     引数は省略できるようにする (契約テストは `createTestApp()` か `createTestApp({ fixture })` で呼ぶ)。省略された `db` と `clock` は
     テスト用の既定 (migration 済みの新しい pglite と `systemClock`) で埋める
     usecase と repository には、この `db` と `clock` を渡す (本番の composition root は実際の DB と `systemClock` を渡す)。
     時計の型はティアが自分で置く (`now(): Date` を持つ口。本番のコードから `@repo/test-support` を import しない。`FixedClock` はこの形に合う)。
     現在時刻は必ず `clock.now()` から取る (`new Date()` を実装に直接書かない。受入基準の「現在が … のとき」を確かめられなくなる)
   - 最初に `expressScenarioMiddleware({ resolveOperationId, placement: { tier: '<tier id>', layer: 'presentation' } })` を use する
     (`resolveOperationId` は `createOperationIdResolver(contract-slice.json)`。contract-slice.json は
     `{ schema_version, uc, openapi: { paths }, asyncapi }` の形で、resolver はその `openapi.paths` を読む。
     as-built はこの operationId で API を抽出する。basePath を付けて配信するときは、解決前に接頭辞を外す)
   - **レイヤの境界オブジェクトを全部 `traced()` で包む**: usecase → `traced('RegisterLoan', uc, { tier, layer: 'usecase' })`、
     repository → `traced('LoanRepository', repo, { tier, layer: 'repository' })`、外部ゲートウェイ → `traced('MailGateway', gw, { tier, layer: 'gateway' })`。
     推奨の形: `createTestApp` が `decorate?: (name, obj, layer) => obj` を受け取り、各レイヤのオブジェクトをそれに通す
     (ティア実装は tracer を知らず、integrate が `decorate: (n, o, l) => traced(n, o, { tier, layer: l })` を渡す)
   - DB クライアントは `tracePg(client, 'LoanRepository', { tier, layer: 'repository' })`、publisher は `tracePublisher(port, 'EventPublisher', { tier, layer: 'gateway' })`
   - 純粋関数だけの層 (domain) は包まなくてよい (I/O も呼び出し境界も無いので図に出す価値が無い)
2. **消費側 (frontend) の画面ロジック**: step は API を直接叩かず、**画面の入口関数** (例: `submitLoanCheckout`) を呼ぶ。
   画面ロジックは `tracedFn('貸出受付画面', 'submit', fn, { tier: 'frontend-staff', layer: 'screen' })` で包み、
   生成クライアントには `this.api.asFetch({ tier: 'frontend-staff', layer: 'api-client' })` を `options.fetch` に渡す。
   frontend が無い UC (worker 起点・API 直呼びの UC) だけ、`this.driver.request()` を直接使う
3. **api ドライバ** (`features/support/drivers/api.ts`) は `createTestApp({ db, clock })` を supertest で叩き、契約の `x-test-headers`
   (`packages/contracts/<id>/test-headers.json`)・`scenarioHeaders()`・呼び出し元の headers の順に付ける (値を空文字にしたヘッダは送らない)
4. **DB** は hooks.ts の Before がシナリオごとに `PgHarness.fresh()` で用意し (migration のディレクトリがあるときだけ)、After で閉じる。
   `D2_DATASTORE_OWNER` で migration の所有ティアを指す。migration の初期データ (マスタ) は毎回入り、前のシナリオの書込は残らない
5. **前提のデータと現在時刻** は step から World の `this.db` (pglite に SQL で入れる) と `this.setNow('<ISO 8601>')` で決める。
   前提のデータを usecase や API を経由して作らない (その UC の振る舞いと前提が混ざる)。表の名前と列は `packages/contracts/<id>/tables.ts` の定数を使う
6. トレースは `D2_TRACE_DIR` に出る。d2-run が `.distillery/runs/<slug>/traces/` を指す

結線の確認: 1 シナリオのトレースに、UC の全ティア (`use-cases.yaml` の tiers) の `meta.tier` が現れること。
as-built は現れないティアを「計装なし」と明示する。

## 環境変数

| 変数 | 用途 |
|---|---|
| `D2_TRACE_DIR` | トレース JSONL の出力先。未設定ならトレースは無効 |
| `D2_TIER` | プロセス既定のティア (`setTier` と同じ)。部品ごとの placement が優先 |
| `D2_DATASTORE_OWNER` | migration を持つティア。未設定なら `.distillery/config.yaml` の `datastore_owner`、それも無ければ backend-api |
