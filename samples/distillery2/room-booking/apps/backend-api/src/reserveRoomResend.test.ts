// 自分の有効な予約と同じ内容の送り直し (SPEC-002-03・ADR 0022・契約 reserveRoom の (4a))。
// 送り直しの判定の置き場所 (usecase・repository の口) は tier の段で決めるので、ここでは
// テスト用の composition root (createTestApp) を HTTP で呼び、契約どおりの応答と表の行数だけを確かめる。
import type { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RESERVATION_EVENTS_COLUMNS as E,
  RESERVATION_EVENTS_TABLE,
  RESERVATIONS_COLUMNS as R,
  RESERVATIONS_TABLE,
  ROOM_SLOT_OCCUPANCIES_COLUMNS as O,
  ROOM_SLOT_OCCUPANCIES_TABLE,
} from '../../../packages/contracts/db/tables';
import { createMigratedDb, createTestApp } from './test-app';

const PATH = '/api/reservations';
const EXISTING_ID = '00000000-0000-4000-8000-0000000000aa';
const START = '2026-11-10T10:00:00+09:00';
const END = '2026-11-10T11:00:00+09:00';
const BODY = { roomId: 'room-1', startAt: START, endAt: END };

/** 成立済みの社員A の予約 (契約の Reservation の形) */
const EXISTING = {
  reservationId: EXISTING_ID,
  roomId: 'room-1',
  roomName: '会議室A',
  startAt: START,
  endAt: END,
  reservedBy: 'employee-a',
  status: 'reserved',
};

let db: PGlite;

beforeEach(async () => {
  db = await createMigratedDb();
  // 会議室A の 2026-11-10 10:00-11:00 に社員A の予約済みの予約 (今の状態・「予約した」イベント・30 分枠の占有 2 件)
  await db.query(
    `INSERT INTO ${RESERVATIONS_TABLE}
       (${R.reservation_id}, ${R.room_id}, ${R.start_at}, ${R.end_at}, ${R.reserved_by}, ${R.status})
     VALUES ($1, 'room-1', $2, $3, 'employee-a', 'reserved')`,
    [EXISTING_ID, START, END],
  );
  await db.query(
    `INSERT INTO ${RESERVATION_EVENTS_TABLE}
       (${E.event_id}, ${E.reservation_id}, ${E.event_type}, ${E.occurred_at}, ${E.actor_employee_id})
     VALUES ('00000000-0000-4000-8000-0000000000e9', $1, 'reserved', '2026-11-09T12:00:00+09:00', 'employee-a')`,
    [EXISTING_ID],
  );
  for (const slot of [START, '2026-11-10T10:30:00+09:00']) {
    await db.query(
      `INSERT INTO ${ROOM_SLOT_OCCUPANCIES_TABLE} (${O.room_id}, ${O.slot_start_at}, ${O.reservation_id})
       VALUES ('room-1', $1, $2)`,
      [slot, EXISTING_ID],
    );
  }
});

afterEach(async () => {
  await db.close();
});

async function countRows(): Promise<number[]> {
  const tables = [RESERVATIONS_TABLE, RESERVATION_EVENTS_TABLE, ROOM_SLOT_OCCUPANCIES_TABLE];
  const counts: number[] = [];
  for (const table of tables) {
    const res = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    counts.push(res.rows[0]?.n ?? 0);
  }
  return counts;
}

async function postAs(token: string, nowIso: string) {
  const app = await createTestApp({ db, clock: { now: () => new Date(nowIso) } });
  return request(app).post(PATH).set('Authorization', `Bearer ${token}`).send(BODY);
}

describe('予約の送り直し', () => {
  it('自分の有効な予約と同じ内容を開始前に送り直した場合_200で成立済みの予約を返し何も記録しないこと', async () => {
    // Arrange
    const before = await countRows();

    // Act
    const res = await postAs('test-employee-a', '2026-11-09T12:00:00+09:00');

    // Assert
    expect([res.status, res.body, await countRows()]).toEqual([200, EXISTING, before]);
  });

  it('自分の有効な予約と同じ内容を開始時刻の後に送り直した場合_過去の時間帯より先に送り直しと判定し200で成立済みの予約を返すこと', async () => {
    // Arrange
    const before = await countRows();

    // Act
    const res = await postAs('test-employee-a', '2026-11-10T10:30:00+09:00');

    // Assert
    expect([res.status, res.body, await countRows()]).toEqual([200, EXISTING, before]);
  });

  it('自分の有効な予約と同じ内容を終了時刻の後に送り直した場合_過去の時間帯として断らず200で成立済みの予約を返すこと', async () => {
    // Arrange
    const before = await countRows();

    // Act
    const res = await postAs('test-employee-a', '2026-11-10T12:00:00+09:00');

    // Assert
    expect([res.status, res.body, await countRows()]).toEqual([200, EXISTING, before]);
  });

  it('他の社員の予約とまったく同じ内容を送った場合_送り直しとして扱わず409のSLOT_OVERLAPSを返すこと', async () => {
    // Arrange
    const before = await countRows();

    // Act
    const res = await postAs('test-employee-b', '2026-11-09T12:00:00+09:00');

    // Assert
    expect([res.status, res.body.code, await countRows()]).toEqual([409, 'SLOT_OVERLAPS', before]);
  });
});
