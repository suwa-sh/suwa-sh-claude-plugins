import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmployeeId, ReservationId, RoomId } from '../domain/ids';
import { Reservation } from '../domain/reservation';
import { TimeRange } from '../domain/timeRange';
import { createMigratedDb } from '../test-app';
import { createReservationRepository } from './reservationRepository';

let db: PGlite;

beforeEach(async () => {
  db = await createMigratedDb();
});

afterEach(async () => {
  await db.close();
});

const at = (iso: string) => new Date(iso);

let eventSeq = 0;
const newEventId = () => {
  eventSeq += 1;
  return `00000000-0000-4000-8000-${String(eventSeq).padStart(12, '0')}`;
};

function reserved(
  reservationId: string,
  roomId: string,
  employee: string,
  startIso: string,
  endIso: string,
) {
  const range = TimeRange.create(at(startIso), at(endIso));
  if (!range.ok) throw new Error(range.error.code);
  const result = Reservation.reserve({
    reservationId: ReservationId.of(reservationId),
    roomId: RoomId.of(roomId),
    timeRange: range.value,
    reservedBy: EmployeeId.fromSubject(employee) as EmployeeId,
    now: at('2026-11-09T12:00:00+09:00'),
  });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';

async function countRows(table: string): Promise<number> {
  const res = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return res.rows[0]?.n ?? 0;
}

describe('予約で読み書きする表', () => {
  it('ある会議室を探す場合_会議室IDと会議室名を返すこと', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });

    // Act
    const room = await repository.findRoom(RoomId.of('room-1'));

    // Assert
    expect(room).toEqual({ roomId: 'room-1', name: '会議室A' });
  });

  it('無い会議室を探す場合_nullを返すこと', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });

    // Act
    const room = await repository.findRoom(RoomId.of('no-such-room'));

    // Assert
    expect(room).toBeNull();
  });

  it('空いている枠に予約を記録する場合_今の状態とイベントと占有の2枠をそろえて書くこと', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });
    const { reservation, event } = reserved(
      ID_1,
      'room-1',
      'employee-a',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );

    // Act
    const outcome = await repository.save(reservation, event);

    // Assert
    const reservations = await db.query(
      'SELECT reservation_id, room_id, start_at, end_at, reserved_by, status FROM reservations',
    );
    const events = await db.query(
      'SELECT reservation_id, event_type, occurred_at, actor_employee_id, recorded_at IS NOT NULL AS recorded FROM reservation_events',
    );
    const slots = await db.query(
      'SELECT room_id, slot_start_at, reservation_id FROM room_slot_occupancies ORDER BY slot_start_at',
    );
    expect({
      outcome,
      reservations: reservations.rows,
      events: events.rows,
      slots: slots.rows,
    }).toEqual({
      outcome: 'saved',
      reservations: [
        {
          reservation_id: ID_1,
          room_id: 'room-1',
          start_at: at('2026-11-10T10:00:00+09:00'),
          end_at: at('2026-11-10T11:00:00+09:00'),
          reserved_by: 'employee-a',
          status: 'reserved',
        },
      ],
      events: [
        {
          reservation_id: ID_1,
          event_type: 'reserved',
          occurred_at: at('2026-11-09T12:00:00+09:00'),
          actor_employee_id: 'employee-a',
          recorded: true,
        },
      ],
      slots: [
        {
          room_id: 'room-1',
          slot_start_at: at('2026-11-10T10:00:00+09:00'),
          reservation_id: ID_1,
        },
        {
          room_id: 'room-1',
          slot_start_at: at('2026-11-10T10:30:00+09:00'),
          reservation_id: ID_1,
        },
      ],
    });
  });

  it('同じ会議室の枠が既に占められている場合_overlapsを返し何も書かないこと', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });
    const first = reserved(
      ID_1,
      'room-1',
      'employee-a',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );
    await repository.save(first.reservation, first.event);
    const second = reserved(
      ID_2,
      'room-1',
      'employee-b',
      '2026-11-10T10:30:00+09:00',
      '2026-11-10T11:30:00+09:00',
    );

    // Act
    const outcome = await repository.save(second.reservation, second.event);

    // Assert
    expect({
      outcome,
      reservations: await countRows('reservations'),
      events: await countRows('reservation_events'),
      slots: await countRows('room_slot_occupancies'),
    }).toEqual({ outcome: 'overlaps', reservations: 1, events: 1, slots: 2 });
  });

  it('別の会議室の同じ枠の場合_予約を記録すること', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });
    const first = reserved(
      ID_1,
      'room-1',
      'employee-a',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );
    await repository.save(first.reservation, first.event);
    const second = reserved(
      ID_2,
      'room-2',
      'employee-b',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );

    // Act
    const outcome = await repository.save(second.reservation, second.event);

    // Assert
    expect(outcome).toBe('saved');
  });

  it('同じ枠への予約を同時に記録する場合_成立は1件だけでもう一方はoverlapsになること', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });
    const a = reserved(
      ID_1,
      'room-1',
      'employee-a',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );
    const b = reserved(
      ID_2,
      'room-1',
      'employee-b',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );

    // Act
    const outcomes = await Promise.all([
      repository.save(a.reservation, a.event),
      repository.save(b.reservation, b.event),
    ]);

    // Assert
    expect({
      outcomes: [...outcomes].sort(),
      reservations: await countRows('reservations'),
    }).toEqual({ outcomes: ['overlaps', 'saved'], reservations: 1 });
  });

  it('予約IDが既にある場合_overlapsにせずシステムのエラーとして投げること', async () => {
    // Arrange
    const repository = createReservationRepository(db, { newEventId });
    const first = reserved(
      ID_1,
      'room-1',
      'employee-a',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );
    await repository.save(first.reservation, first.event);
    const sameId = reserved(
      ID_1,
      'room-2',
      'employee-b',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );

    // Act
    const saving = repository.save(sameId.reservation, sameId.event);

    // Assert
    await expect(saving).rejects.toThrow();
  });
});

describe('送り直しの検索', () => {
  const START = '2026-11-10T10:00:00+09:00';
  const END = '2026-11-10T11:00:00+09:00';

  function rangeOf(startIso: string, endIso: string): TimeRange {
    const range = TimeRange.create(at(startIso), at(endIso));
    if (!range.ok) throw new Error(range.error.code);
    return range.value;
  }

  const employee = (sub: string) => EmployeeId.fromSubject(sub) as EmployeeId;

  /** 社員A の会議室A 10:00-11:00 の予約を記録した repository を返す */
  async function withReservationOfEmployeeA() {
    const repository = createReservationRepository(db, { newEventId });
    const first = reserved(ID_1, 'room-1', 'employee-a', START, END);
    await repository.save(first.reservation, first.event);
    return repository;
  }

  it('予約者と会議室と開始と終了がすべて同じ予約済みの予約がある場合_会議室名付きで返すこと', async () => {
    // Arrange
    const repository = await withReservationOfEmployeeA();

    // Act
    const found = await repository.findOwnReservedSame(
      employee('employee-a'),
      RoomId.of('room-1'),
      rangeOf(START, END),
    );

    // Assert
    expect(found).toEqual({
      reservationId: ID_1,
      roomId: 'room-1',
      roomName: '会議室A',
      startAt: at(START),
      endAt: at(END),
      reservedBy: 'employee-a',
      status: 'reserved',
    });
  });

  it.each([
    ['他の社員', 'employee-b', 'room-1', START, END],
    ['別の会議室', 'employee-a', 'room-2', START, END],
    ['一部だけ重なる時間帯', 'employee-a', 'room-1', '2026-11-10T10:30:00+09:00', END],
    ['終了だけ違う時間帯', 'employee-a', 'room-1', START, '2026-11-10T11:30:00+09:00'],
  ])('%sの場合_nullを返すこと', async (_label, sub, roomId, startIso, endIso) => {
    // Arrange
    const repository = await withReservationOfEmployeeA();

    // Act
    const found = await repository.findOwnReservedSame(
      employee(sub),
      RoomId.of(roomId),
      rangeOf(startIso, endIso),
    );

    // Assert
    expect(found).toBeNull();
  });

  it('同じ内容の自分の予約が取消済みの場合_nullを返すこと', async () => {
    // Arrange
    const repository = await withReservationOfEmployeeA();
    await db.query(`UPDATE reservations SET status = 'cancelled' WHERE reservation_id = $1`, [
      ID_1,
    ]);

    // Act
    const found = await repository.findOwnReservedSame(
      employee('employee-a'),
      RoomId.of('room-1'),
      rangeOf(START, END),
    );

    // Assert
    expect(found).toBeNull();
  });
});
