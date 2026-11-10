import { describe, expect, it } from 'vitest';
import { RoomId } from './ids';
import { judgeAvailability, type ReservedSlot } from './roomAvailability';
import { TimeRange } from './timeRange';

const at = (iso: string) => new Date(iso);
const roomA = RoomId.of('room-1');
const roomB = RoomId.of('room-2');

function range10to11(): TimeRange {
  const result = TimeRange.create(at('2026-11-10T10:00:00+09:00'), at('2026-11-10T11:00:00+09:00'));
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

const reservationOf = (roomId: RoomId, status: ReservedSlot['status']): ReservedSlot => ({
  roomId,
  startAt: at('2026-11-10T10:00:00+09:00'),
  endAt: at('2026-11-10T11:00:00+09:00'),
  status,
});

describe('会議室の空き状況の判定', () => {
  it('重なる予約済みの予約がある場合_予約済みと判定すること', () => {
    // Arrange
    const reservations = [reservationOf(roomA, 'reserved')];

    // Act
    const availability = judgeAvailability(roomA, range10to11(), reservations);

    // Assert
    expect(availability).toBe('reserved');
  });

  it('重なる予約が別の会議室のものだけの場合_空きと判定すること', () => {
    // Arrange
    const reservations = [reservationOf(roomB, 'reserved')];

    // Act
    const availability = judgeAvailability(roomA, range10to11(), reservations);

    // Assert
    expect(availability).toBe('available');
  });

  it('重なる予約が取消済みだけの場合_空きと判定すること', () => {
    // Arrange
    const reservations = [reservationOf(roomA, 'cancelled')];

    // Act
    const availability = judgeAvailability(roomA, range10to11(), reservations);

    // Assert
    expect(availability).toBe('available');
  });
});
