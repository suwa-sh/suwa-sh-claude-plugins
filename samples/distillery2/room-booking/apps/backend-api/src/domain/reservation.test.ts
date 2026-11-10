import { describe, expect, it } from 'vitest';
import { EmployeeId, ReservationId, RoomId } from './ids';
import { Reservation } from './reservation';
import { TimeRange } from './timeRange';

const at = (iso: string) => new Date(iso);

function range(startIso: string, endIso: string): TimeRange {
  const result = TimeRange.create(at(startIso), at(endIso));
  if (!result.ok) throw new Error(`時間帯を作れない: ${result.error.code}`);
  return result.value;
}

const reservationId = ReservationId.of('3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42');
const roomA = RoomId.of('room-1');
const employeeA = EmployeeId.fromSubject('employee-a') as EmployeeId;

function reserveAt(nowIso: string, startIso: string, endIso: string) {
  return Reservation.reserve({
    reservationId,
    roomId: roomA,
    timeRange: range(startIso, endIso),
    reservedBy: employeeA,
    now: at(nowIso),
  });
}

describe('予約の作成', () => {
  it('開始が現在より後の場合_予約済みの予約と予約したという事実を返すこと', () => {
    // Arrange
    const now = '2026-11-09T12:00:00+09:00';

    // Act
    const result = reserveAt(now, '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00');

    // Assert
    if (!result.ok) throw new Error(result.error.code);
    expect({
      status: result.value.reservation.status,
      reservedBy: result.value.reservation.reservedBy.value,
      event: {
        type: result.value.event.type,
        reservationId: result.value.event.reservationId.value,
        occurredAt: result.value.event.occurredAt,
        actor: result.value.event.actor.value,
      },
    }).toEqual({
      status: 'reserved',
      reservedBy: 'employee-a',
      event: {
        type: 'reserved',
        reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
        occurredAt: at(now),
        actor: 'employee-a',
      },
    });
  });

  it('開始が現在と同じ場合_予約できること', () => {
    // Arrange
    const now = '2026-11-10T10:00:00+09:00';

    // Act
    const result = reserveAt(now, '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00');

    // Assert
    expect(result.ok).toBe(true);
  });

  it('開始が現在より前の場合_PAST_TIME_SLOTの業務のエラーを返すこと', () => {
    // Arrange
    const now = '2026-11-10T12:00:00+09:00';

    // Act
    const result = reserveAt(now, '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00');

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'PAST_TIME_SLOT' } });
  });

  it('開始が現在の1ミリ秒前の場合_PAST_TIME_SLOTの業務のエラーを返すこと', () => {
    // Arrange
    const now = '2026-11-10T10:00:00.001+09:00';

    // Act
    const result = reserveAt(now, '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00');

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'PAST_TIME_SLOT' } });
  });
});

describe('予約が占める30分枠', () => {
  it('1時間の予約の場合_開始と30分後の2枠を返すこと', () => {
    // Arrange
    const result = reserveAt(
      '2026-11-09T12:00:00+09:00',
      '2026-11-10T10:00:00+09:00',
      '2026-11-10T11:00:00+09:00',
    );
    if (!result.ok) throw new Error(result.error.code);

    // Act
    const slots = result.value.reservation.occupiedSlotStarts();

    // Assert
    expect(slots).toEqual([at('2026-11-10T10:00:00+09:00'), at('2026-11-10T10:30:00+09:00')]);
  });

  it('終了が翌日0時の30分の予約の場合_23時30分の1枠を返すこと', () => {
    // Arrange
    const result = reserveAt(
      '2026-11-09T12:00:00+09:00',
      '2026-11-10T23:30:00+09:00',
      '2026-11-11T00:00:00+09:00',
    );
    if (!result.ok) throw new Error(result.error.code);

    // Act
    const slots = result.value.reservation.occupiedSlotStarts();

    // Assert
    expect(slots).toEqual([at('2026-11-10T23:30:00+09:00')]);
  });
});
