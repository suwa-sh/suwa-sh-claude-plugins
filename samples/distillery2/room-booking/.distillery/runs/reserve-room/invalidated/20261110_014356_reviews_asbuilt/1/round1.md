| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|---|---|---|---|
| P1 | 実装との縦の整合 | CONCERN | 指摘 1 | 409 のシーケンスを repository・usecase・画面の戻り値と照合した |
| P2 | 要求との整合 | PASS | なし | SPEC-002-01/02、受入基準、決定事項と課題欄を照合した |
| P3 | システム全体との横の整合 | CONCERN | 指摘 2 | UC の訂正注記とシステム全体のデータフローを照合した |

### 指摘 1
- **perspective**: P1
- **対象**: [sequence.md](<repo>/docs/as-built/会議室予約/会議室を予約する/sequence.md:138)
- **severity**: medium
- **claim**: 予約が重なって 409 となる経路で、保存処理・usecase・画面への戻りをいずれも `ok` と記録している。拒否時の戻り値を示す記録として実装と合わない。
- **evidence**: 同図の 138–143 行は `save → ok → ok → 409 → ok`。実装では占有の競合時に repository が `overlaps` を返し、usecase が `SLOT_OVERLAPS` のエラーを返し、画面の入口関数はエラー状態を返す（[reservationRepository.ts](<repo>/apps/backend-api/src/repository/reservationRepository.ts:74)、[reserveRoom.ts](<repo>/apps/backend-api/src/usecase/reserveRoom.ts:109)、[submitReservation.ts](<repo>/apps/frontend/src/screens/ReserveRoom/submitReservation.ts:41)）。
- **why_raised**: 競合時の処理を図から追う実装者や調査担当者が、どの層で拒否が確定したかを誤認するため。
- **suggested_fix**: 409 経路の戻りを `overlaps`、`SLOT_OVERLAPS`、画面のエラー状態として表す。

### 指摘 2
- **perspective**: P3
- **対象**: [data-flow.md](<repo>/docs/as-built/_system/data-flow.md:7)、[traceability-index.json](<repo>/docs/as-built/_system/traceability-index.json:502)
- **severity**: high
- **claim**: システム全体の記録は、予約時に書き込む 3 表をすべて Read とし、SQL の CTE 名 `inserted` を表として載せている。UC 記録自身の訂正注記と食い違う。
- **evidence**: [UC の index.md](<repo>/docs/as-built/会議室予約/会議室を予約する/index.md:177) は「実際は 3 表への Write」「inserted は表でなく WITH 句の名前」と明記する。一方、システムのデータフローは `reservation_events`、`reservations`、`room_slot_occupancies` を R とし、`inserted` も表として表示する。実際の SQL は 3 表へ INSERT する（[reservationRepository.ts](<repo>/apps/backend-api/src/repository/reservationRepository.ts:56)）。
- **why_raised**: 横断資料を使って表の更新元や影響範囲を調べる人が、予約 UC の書き込みを見落とし、存在しない表を追跡するため。
- **suggested_fix**: 記録済みの抽出不具合を修正して横断資料を再生成し、3 表を W、`inserted` を表一覧から除外する。

### below-threshold

- P2 low 「未決の課題 1 件」という結果欄と、後段の課題要約 4 行は件数の読み方が分かりにくい。

Codex session ID: 01a1c309-4380-74e2-9130-5f54fee72142
Resume in Codex: codex resume 01a1c309-4380-74e2-9130-5f54fee72142
