import { describe, expect, it } from 'vitest';
import { addDays, toCalendarDate } from './calendar-date';

describe('addDays', () => {
  it('うるう年の 2 月末をまたぐ場合、2 月 29 日を数えること', () => {
    // Arrange
    const date = '2028-02-20';

    // Act
    const result = addDays(date, 14);

    // Assert
    expect(result).toBe('2028-03-05');
  });

  it('存在しない暦日の場合、RangeError を投げること', () => {
    // Arrange
    const date = '2026-02-30';

    // Act
    const act = () => addDays(date, 1);

    // Assert
    expect(act).toThrow(RangeError);
  });

  it('日数が整数でない場合、RangeError を投げること', () => {
    // Arrange
    const days = 1.5;

    // Act
    const act = () => addDays('2026-10-01', days);

    // Assert
    expect(act).toThrow(RangeError);
  });
});

describe('toCalendarDate', () => {
  it('UTC では前日でも Asia/Tokyo では翌日になる時点の場合、Asia/Tokyo の暦日を返すこと', () => {
    // Arrange
    const instant = new Date('2026-09-30T15:30:00Z');

    // Act
    const result = toCalendarDate(instant, 'Asia/Tokyo');

    // Assert
    expect(result).toBe('2026-10-01');
  });
});
