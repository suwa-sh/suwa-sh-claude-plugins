import { describe, expect, it } from 'vitest';
import { initialSlot } from './initialSlot';
import { toDateTime, toTimeRange } from './toTimeRange';

describe('時間帯の入力値から契約の時間帯への変換', () => {
  it('日付の中の時間帯の場合_日本時間の時差付きの日時にすること', () => {
    // Arrange
    const slot = { date: '2026-11-10', startTime: '10:00', endTime: '11:00' };

    // Act
    const range = toTimeRange(slot);

    // Assert
    expect(range).toEqual({
      startAt: '2026-11-10T10:00:00+09:00',
      endAt: '2026-11-10T11:00:00+09:00',
    });
  });

  it('24時以降の時刻の場合_翌日の日時にすること', () => {
    // Arrange
    const times = ['24:00', '25:00'];

    // Act
    const out = times.map((t) => toDateTime('2026-11-10', t));

    // Assert
    expect(out).toEqual(['2026-11-11T00:00:00+09:00', '2026-11-11T01:00:00+09:00']);
  });

  it('月末の24:00の場合_翌月1日の0:00にすること', () => {
    // Arrange
    const date = '2026-11-30';

    // Act
    const out = toDateTime(date, '24:00');

    // Assert
    expect(out).toBe('2026-12-01T00:00:00+09:00');
  });

  it('時の桁が1桁の場合_2桁にそろえること', () => {
    // Arrange
    const time = '9:30';

    // Act
    const out = toDateTime('2026-11-10', time);

    // Assert
    expect(out).toBe('2026-11-10T09:30:00+09:00');
  });

  it('30分刻みでない時刻の場合_そのまま送り判定をAPIに任せること', () => {
    // Arrange
    const time = '10:10';

    // Act
    const out = toDateTime('2026-11-10', time);

    // Assert
    expect(out).toBe('2026-11-10T10:10:00+09:00');
  });

  it('暦に無い日付の場合_別の日付に正規化せずそのまま送ること', () => {
    // Arrange
    const dates = ['2026-02-30', '2026-13-01', '2026-11-00', '2026-02-29'];

    // Act
    const out = dates.map((d) => toDateTime(d, '10:00'));

    // Assert
    expect(out).toEqual([
      '2026-02-30T10:00:00+09:00',
      '2026-13-01T10:00:00+09:00',
      '2026-11-00T10:00:00+09:00',
      '2026-02-29T10:00:00+09:00',
    ]);
  });

  it('暦に無い日付の24:00の場合_翌日へ進めずそのまま送ること', () => {
    // Arrange
    const date = '2026-02-30';

    // Act
    const out = toDateTime(date, '24:00');

    // Assert
    expect(out).toBe('2026-02-30T24:00:00+09:00');
  });

  it('閏年の2月29日の24:00の場合_3月1日の0:00にすること', () => {
    // Arrange
    const date = '2028-02-29';

    // Act
    const out = toDateTime(date, '24:00');

    // Assert
    expect(out).toBe('2028-03-01T00:00:00+09:00');
  });

  it('分が60以上か時が48以上の場合_別の日時に正規化せずそのまま送ること', () => {
    // Arrange
    const times = ['10:60', '48:00'];

    // Act
    const out = times.map((t) => toDateTime('2026-11-10', t));

    // Assert
    expect(out).toEqual(['2026-11-10T10:60:00+09:00', '2026-11-10T48:00:00+09:00']);
  });
});

describe('Asia/Tokyo の時差の規則での変換', () => {
  it('過去の夏時間の日の場合_その日の時差+10:00の日時にすること', () => {
    // Arrange
    const slot = { date: '1949-05-10', startTime: '10:00', endTime: '11:00' };

    // Act
    const range = toTimeRange(slot);

    // Assert
    expect(range).toEqual({
      startAt: '1949-05-10T10:00:00+10:00',
      endAt: '1949-05-10T11:00:00+10:00',
    });
  });

  it('夏時間の日の場合_送る日時が日本時間で選んだ時刻と同じ瞬間を指すこと', () => {
    // Arrange
    const tokyo = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    // Act
    const out = toDateTime('1949-05-10', '10:00');

    // Assert
    expect(tokyo.format(new Date(out))).toBe('10:00');
  });

  it('夏時間の最後の日の24:00の場合_翌日0:00の早い方の時刻にすること', () => {
    // Arrange
    const date = '1949-09-10'; // 翌日 1949-09-11 の 0:00〜0:59 は 2 回ある

    // Act
    const out = toDateTime(date, '24:00');

    // Assert
    expect(out).toBe('1949-09-11T00:00:00+10:00');
  });

  it('夏時間が始まる前日の24:00の場合_飛ばされた0:00を翌日1:00夏時間と同じ瞬間にすること', () => {
    // Arrange
    const date = '1949-04-02'; // 翌日 1949-04-03 の 0:00 は 1:00 (+10:00) へ飛ぶ

    // Act
    const out = toDateTime(date, '24:00');

    // Assert
    expect(out).toBe('1949-04-03T01:00:00+10:00');
    expect(new Date(out).toISOString()).toBe('1949-04-02T15:00:00.000Z');
  });

  it('時差が分で書けない1888年より前の日の場合_同じ瞬間をUTCで書くこと', () => {
    // Arrange
    const date = '1880-01-01'; // Asia/Tokyo は地方時 +09:18:59

    // Act
    const out = toDateTime(date, '10:00');

    // Assert
    expect(out).toBe('1880-01-01T00:41:01Z');
  });
});

describe('時間帯の初期値', () => {
  it('日本時間で日付が変わった後の場合_日本時間の今日の日付にすること', () => {
    // Arrange
    const now = new Date('2026-11-09T15:30:00Z'); // 日本時間 2026-11-10 00:30

    // Act
    const slot = initialSlot(now);

    // Assert
    expect(slot).toEqual({ date: '2026-11-10', startTime: '09:00', endTime: '10:00' });
  });

  it('夏時間の日に日本時間で日付が変わった後の場合_日本時間の翌日の日付にすること', () => {
    // Arrange
    const now = new Date('1949-05-10T14:30:00Z'); // 夏時間 (+10:00) で 1949-05-11 00:30

    // Act
    const slot = initialSlot(now);

    // Assert
    expect(slot.date).toBe('1949-05-11');
  });
});
