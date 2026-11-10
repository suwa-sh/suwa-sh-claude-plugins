import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedDb } from '../test-app';
import { createRoomAvailabilityRepository } from './roomAvailabilityRepository';

let db: PGlite;

beforeEach(async () => {
  db = await createMigratedDb();
});

afterEach(async () => {
  await db.close();
});

async function insertReservation(
  id: string,
  startIso: string,
  endIso: string,
  status: 'reserved' | 'cancelled',
) {
  await db.query(
    `INSERT INTO reservations (reservation_id, room_id, start_at, end_at, reserved_by, status)
     VALUES ($1, 'room-1', $2, $3, 'employee-a', $4)`,
    [id, startIso, endIso, status],
  );
}

describe('空き状況の照会で読む表', () => {
  it('会議室を読む場合_初期データの5部屋を表示順で返すこと', async () => {
    // Arrange
    const repository = createRoomAvailabilityRepository(db);

    // Act
    const rooms = await repository.listRooms();

    // Assert
    expect(rooms).toEqual([
      { roomId: 'room-1', name: '会議室A' },
      { roomId: 'room-2', name: '会議室B' },
      { roomId: 'room-3', name: '会議室C' },
      { roomId: 'room-4', name: '会議室D' },
      { roomId: 'room-5', name: '会議室E' },
    ]);
  });

  it('予約を読む場合_開始が期間内の予約を取消済みも含めて返し期間外は返さないこと', async () => {
    // Arrange
    await insertReservation(
      '00000000-0000-4000-8000-000000000001',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
      'reserved',
    );
    await insertReservation(
      '00000000-0000-4000-8000-000000000002',
      '2026-11-10T23:30:00+09:00',
      '2026-11-11T00:00:00+09:00',
      'cancelled',
    );
    await insertReservation(
      '00000000-0000-4000-8000-000000000003',
      '2026-11-11T00:00:00+09:00',
      '2026-11-11T01:00:00+09:00',
      'reserved',
    );
    const repository = createRoomAvailabilityRepository(db);

    // Act
    const reservations = await repository.listReservations({
      startAt: new Date('2026-11-10T00:00:00+09:00'),
      endAt: new Date('2026-11-11T00:00:00+09:00'),
    });

    // Assert
    expect(reservations).toEqual([
      {
        roomId: 'room-1',
        startAt: new Date('2026-11-10T10:00:00+09:00'),
        endAt: new Date('2026-11-10T11:00:00+09:00'),
        status: 'reserved',
      },
      {
        roomId: 'room-1',
        startAt: new Date('2026-11-10T23:30:00+09:00'),
        endAt: new Date('2026-11-11T00:00:00+09:00'),
        status: 'cancelled',
      },
    ]);
  });
});
