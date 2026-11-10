import { describe, expect, it } from 'vitest';
import { toReservationView } from './toReservationView';

const base = {
  reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
  roomId: 'room-1',
  roomName: '会議室A',
  reservedBy: 'employee-a',
  status: 'reserved' as const,
};

describe('表示用の予約への変換', () => {
  it('終了が開始の翌日の0:00の場合_終了時刻を24:00にすること', () => {
    // Arrange
    const r = { ...base, startAt: '2026-11-10T23:30:00+09:00', endAt: '2026-11-11T00:00:00+09:00' };

    // Act
    const view = toReservationView(r);

    // Assert
    expect(view).toEqual({
      reservationId: base.reservationId,
      roomName: '会議室A',
      date: '2026-11-10',
      startTime: '23:30',
      endTime: '24:00',
      status: 'reserved',
    });
  });

  it('UTCで書かれた日時の場合_日本時間の日付と時刻で表すこと', () => {
    // Arrange
    const r = { ...base, startAt: '2026-11-09T15:00:00Z', endAt: '2026-11-09T16:00:00Z' };

    // Act
    const view = toReservationView(r);

    // Assert
    expect([view.date, view.startTime, view.endTime]).toEqual(['2026-11-10', '00:00', '01:00']);
  });
});
