// テスト用の composition root。契約テストと UC BDD の API ドライバが同じ入口 createTestApp を使う
// (packages/test-support/README.md の結線の契約)。本番の入口は src/app.ts の createProductionApp。
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { buildApp, type Decorate, systemClock } from './app';
import { createTestTokenVerifier } from './gateway/testTokenVerifier';
import type { AppLogger } from './presentation/httpApp';
import type { SqlClient } from './repository/sqlClient';
import type { Clock } from './usecase/reserveRoom';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** migration (名前の昇順) を当てた新しい pglite を返す。使い終えたら close する */
export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.waitReady;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  return db;
}

/** 会議室A (room-1) に社員A (employee-a) の予約済みの予約を 1 件、今の状態・「予約した」イベント (reservedAt に起きた)・30 分枠の占有をそろえて入れる */
async function seedReservationOfEmployeeAInRoomA(
  db: SqlClient,
  ids: { reservationId: string; eventId: string },
  range: { startAt: string; endAt: string; reservedAt: string },
  slotStarts: string[],
): Promise<void> {
  await db.query(
    `INSERT INTO reservations (reservation_id, room_id, start_at, end_at, reserved_by, status)
     VALUES ($1, 'room-1', $2, $3, 'employee-a', 'reserved')`,
    [ids.reservationId, range.startAt, range.endAt],
  );
  await db.query(
    `INSERT INTO reservation_events
       (event_id, reservation_id, event_type, occurred_at, actor_employee_id)
     VALUES ($1, $2, 'reserved', $3, 'employee-a')`,
    [ids.eventId, ids.reservationId, range.reservedAt],
  );
  for (const slot of slotStarts) {
    await db.query(
      `INSERT INTO room_slot_occupancies (room_id, slot_start_at, reservation_id)
       VALUES ('room-1', $1, $2)`,
      [slot, ids.reservationId],
    );
  }
}

/**
 * 契約の slice (contracts/generated/slices/<UC>/contract-slice.json) の fixtures を用意する
 * (view-room-availability と reserve-room の分)。
 * 予約の今の状態に加え、同じ予約の「予約した」イベントと 30 分枠の占有も入れ、表どうしを食い違わせない (ADR 0003・0004)
 */
const FIXTURES: Record<string, (db: SqlClient) => Promise<void>> = {
  // 会議室A (room-1) の 2099-11-10 10:00-11:00 に社員A (employee-a) の予約済みの予約が 1 件ある (時計を固定しない契約テスト用に先の日時)
  'room-a-reserved-in-2099-by-employee-a': (db) =>
    seedReservationOfEmployeeAInRoomA(
      db,
      {
        reservationId: '00000000-0000-4000-8000-00000000000b',
        eventId: '00000000-0000-4000-8000-0000000000e2',
      },
      {
        startAt: '2099-11-10T10:00:00+09:00',
        endAt: '2099-11-10T11:00:00+09:00',
        reservedAt: '2026-11-05T09:00:00+09:00',
      },
      ['2099-11-10T10:00:00+09:00', '2099-11-10T10:30:00+09:00'],
    ),
  // 会議室A (room-1) の 2020-01-10 10:00-11:00 に社員A (employee-a) の予約済みの予約が 1 件ある
  // (時計を固定しない契約テストで、開始も終了も過ぎた後の送り直しを表す。予約した時刻は開始より前にする)
  'room-a-reserved-in-2020-by-employee-a': (db) =>
    seedReservationOfEmployeeAInRoomA(
      db,
      {
        reservationId: '00000000-0000-4000-8000-00000000000c',
        eventId: '00000000-0000-4000-8000-0000000000e3',
      },
      {
        startAt: '2020-01-10T10:00:00+09:00',
        endAt: '2020-01-10T11:00:00+09:00',
        reservedAt: '2020-01-09T09:00:00+09:00',
      },
      ['2020-01-10T10:00:00+09:00', '2020-01-10T10:30:00+09:00'],
    ),
  // 会議室A (room-1) の 2026-11-10 10:00-11:00 に社員A (employee-a) の予約済みの予約が 1 件ある
  'room-a-reserved-by-employee-a': async (db) => {
    const reservationId = '00000000-0000-4000-8000-00000000000a';
    await db.query(
      `INSERT INTO reservations (reservation_id, room_id, start_at, end_at, reserved_by, status)
       VALUES ($1, 'room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00', 'employee-a', 'reserved')`,
      [reservationId],
    );
    await db.query(
      `INSERT INTO reservation_events
         (event_id, reservation_id, event_type, occurred_at, actor_employee_id, recorded_at)
       VALUES ('00000000-0000-4000-8000-0000000000e1', $1, 'reserved',
               '2026-11-05T09:00:00+09:00', 'employee-a', '2026-11-05T09:00:00+09:00')`,
      [reservationId],
    );
    for (const slot of ['2026-11-10T10:00:00+09:00', '2026-11-10T10:30:00+09:00']) {
      await db.query(
        `INSERT INTO room_slot_occupancies (room_id, slot_start_at, reservation_id)
         VALUES ('room-1', $1, $2)`,
        [slot, reservationId],
      );
    }
  },
};

const silentLogger: AppLogger = { info: () => {}, warn: () => {}, error: () => {} };

/** テスト用の composition root に渡すもの。すべて省略できる */
export interface CreateTestAppOptions {
  /** シナリオごとの DB (migration 済み)。省略時は migration 済みの新しい pglite を作る */
  db?: SqlClient;
  /** 固定の時計 (now(): Date を持つ口)。省略時は systemClock (実行時の現在時刻) */
  clock?: Clock;
  /** 契約テストが例ごとに渡すテスト用データの名前 (契約の slice の fixtures) */
  fixture?: string;
  /** 各層の境界オブジェクトを包む (integrate が traced() を渡す) */
  decorate?: Decorate;
  /** 構造化ログ (省略時は出さない) */
  logger?: AppLogger;
}

export async function createTestApp(options: CreateTestAppOptions = {}) {
  const db = options.db ?? (await createMigratedDb());
  if (options.fixture !== undefined) {
    const seed = FIXTURES[options.fixture];
    if (!seed) throw new Error(`テスト用データ ${options.fixture} は用意していない`);
    await seed(db);
  }
  return buildApp({
    db,
    tokenVerifier: createTestTokenVerifier(),
    logger: options.logger ?? silentLogger,
    clock: options.clock ?? systemClock,
    decorate: options.decorate,
  });
}
