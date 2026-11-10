import { describe, expect, it } from 'vitest';
import { initialReservationValue, keepKnownRoom } from './initialReservationValue';

describe('予約の入力の初期値', () => {
  it('クエリが入力の形に合う場合_そのまま初期値にすること', () => {
    // Arrange
    const query = { roomId: 'room-1', date: '2026-11-10', startTime: '23:30', endTime: '24:00' };

    // Act
    const value = initialReservationValue(query);

    // Assert
    expect(value).toEqual(query);
  });

  it('クエリの日付と時刻が形に合わない場合_その項目を空にすること', () => {
    // Arrange
    const query = { roomId: 'room-1', date: '2026-02-30', startTime: '10:10', endTime: '25:00' };

    // Act
    const value = initialReservationValue(query);

    // Assert
    expect(value).toEqual({ roomId: 'room-1', date: '', startTime: '', endTime: '' });
  });

  it('クエリが無い場合_すべて空にすること', () => {
    // Arrange
    const query = {};

    // Act
    const value = initialReservationValue(query);

    // Assert
    expect(value).toEqual({ roomId: '', date: '', startTime: '', endTime: '' });
  });

  it('開始時刻に24:00が来た場合_開始の選択肢に無いので空にすること', () => {
    // Arrange
    const query = { startTime: '24:00', endTime: '00:00' };

    // Act
    const value = initialReservationValue(query);

    // Assert
    expect([value.startTime, value.endTime]).toEqual(['', '']);
  });
});

describe('会議室の選択肢に無い会議室', () => {
  const rooms = [{ roomId: 'room-1', name: '会議室A' }];

  it('選択肢に無い会議室IDの場合_会議室を空にすること', () => {
    // Arrange
    const value = {
      roomId: 'no-such-room',
      date: '2026-11-10',
      startTime: '10:00',
      endTime: '11:00',
    };

    // Act
    const kept = keepKnownRoom(value, rooms);

    // Assert
    expect(kept).toEqual({ ...value, roomId: '' });
  });

  it('選択肢にある会議室IDの場合_そのままにすること', () => {
    // Arrange
    const value = { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '11:00' };

    // Act
    const kept = keepKnownRoom(value, rooms);

    // Assert
    expect(kept).toBe(value);
  });
});
