// 手書きの DB 契約テスト (生成物ではない)。distillery2 の不具合の回避:
// 生成される db-schema.test.ts は列・型・NULL 可否・主キーの定義を比べるだけで、一意制約が 2 件目を弾くことを確かめない。
// 開発ルール (docs/rules/testing.md の ADR 0007) は「DB の一意制約が 2 件目を弾くことを契約 (DB) のテストで確かめる」と決めている。
// 生成器がこの確認を出すようになったら、このファイルは消す。
// 正: contracts/db/domains/room_reservation.yaml の room_slot_occupancies (主キー room_id, slot_start_at = 二重予約の防止)。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = ['0001_schema.sql', '0002_seed_rooms.sql'].map((name) =>
  readFileSync(join(here, '..', '..', 'migrations', name), 'utf8'),
);

const UNIQUE_VIOLATION = '23505';
const RES_1 = '00000000-0000-4000-8000-000000000001';
const RES_2 = '00000000-0000-4000-8000-000000000002';
const SLOT = '2026-11-10T10:00:00+09:00';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  for (const sql of migrations) await db.exec(sql);
  // 同じ枠を指す 2 件の予約 (占有の外部キーを満たすため)
  for (const id of [RES_1, RES_2]) {
    await db.query(
      `INSERT INTO reservations (reservation_id, room_id, start_at, end_at, reserved_by, status)
       VALUES ($1, 'room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T10:30:00+09:00', 'employee-a', 'reserved')`,
      [id],
    );
  }
});
afterAll(async () => {
  await db.close();
});

const occupy = (reservationId: string) =>
  db.query(
    'INSERT INTO room_slot_occupancies (room_id, slot_start_at, reservation_id) VALUES ($1, $2, $3)',
    ['room-1', SLOT, reservationId],
  );

describe('db unique constraints contract (hand-written)', () => {
  it('room_slot_occupancies rejects a second occupancy of the same (room_id, slot_start_at)', async () => {
    await expect(occupy(RES_1)).resolves.toBeDefined();
    await expect(occupy(RES_2)).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
    const rows = await db.query<{ reservation_id: string }>(
      'SELECT reservation_id FROM room_slot_occupancies WHERE room_id = $1 AND slot_start_at = $2',
      ['room-1', SLOT],
    );
    expect(rows.rows.map((r) => r.reservation_id)).toEqual([RES_1]);
  });
});
