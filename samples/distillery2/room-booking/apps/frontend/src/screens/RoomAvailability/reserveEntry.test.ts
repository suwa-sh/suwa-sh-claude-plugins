import { describe, expect, it } from 'vitest';
import { isPastSlot, reserveRoomPath } from './reserveEntry';

const slot = { date: '2026-11-10', startTime: '10:00', endTime: '11:00' };

describe('照会した時間帯が過去か', () => {
  it('開始が現在より前の場合_過去とすること', () => {
    // Arrange
    const now = new Date('2026-11-10T10:00:01+09:00');

    // Act
    const past = isPastSlot(slot, now);

    // Assert
    expect(past).toBe(true);
  });

  it('開始が現在と同じ場合_過去としないこと', () => {
    // Arrange
    const now = new Date('2026-11-10T10:00:00+09:00');

    // Act
    const past = isPastSlot(slot, now);

    // Assert
    expect(past).toBe(false);
  });

  it('日時に読めない時間帯の場合_過去としないこと', () => {
    // Arrange
    const now = new Date('2026-11-10T12:00:00+09:00');

    // Act
    const past = isPastSlot({ date: '', startTime: '', endTime: '' }, now);

    // Assert
    expect(past).toBe(false);
  });
});

describe('予約の画面へ移る先', () => {
  it('会議室と時間帯を選んだ場合_クエリで会議室と日付と時刻を渡すこと', () => {
    // Arrange
    const target = { date: '2026-11-10', startTime: '23:30', endTime: '24:00' };

    // Act
    const path = reserveRoomPath('room-1', target);

    // Assert
    const url = new URL(path, 'http://localhost');
    expect({ pathname: url.pathname, query: Object.fromEntries(url.searchParams) }).toEqual({
      pathname: '/reservations/new',
      query: { roomId: 'room-1', date: '2026-11-10', startTime: '23:30', endTime: '24:00' },
    });
  });
});
