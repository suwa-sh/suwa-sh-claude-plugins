import { describe, expect, it } from 'vitest';
import { TimeRange } from './timeRange';

const at = (iso: string) => new Date(iso);

function created(startIso: string, endIso: string): TimeRange {
  const result = TimeRange.create(at(startIso), at(endIso));
  if (!result.ok) throw new Error(`時間帯を作れない: ${result.error.code}`);
  return result.value;
}

/** 1 ミリ秒未満まで持つ時点 (切り捨てたミリ秒の ISO と、ミリ秒の後に続く数字) */
const precise = (msIso: string, subMillisecondDigits: string) => ({
  epochMs: Date.parse(msIso),
  subMillisecondDigits,
});

describe('時間帯の生成 (1ミリ秒未満まで持つ時点)', () => {
  it('開始と終了が同じミリ秒の中で開始が前の場合_順の検査を通りNOT_ON_30_MINUTESを返すこと', () => {
    // Arrange
    const startAt = precise('2026-11-10T10:00:00.000+09:00', '1');
    const endAt = precise('2026-11-10T10:00:00.000+09:00', '5');

    // Act
    const result = TimeRange.create(startAt, endAt);

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });

  it('開始が1ミリ秒未満を持ち終了が次のミリ秒ちょうどの場合_NOT_ON_30_MINUTESを返すこと', () => {
    // Arrange
    const startAt = precise('2026-11-10T10:00:00.000+09:00', '1');
    const endAt = precise('2026-11-10T10:00:00.001+09:00', '');

    // Act
    const result = TimeRange.create(startAt, endAt);

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });

  it('開始が同じミリ秒の中で終了より後の場合_INVALID_TIME_RANGEを返すこと', () => {
    // Arrange
    const startAt = precise('2026-11-10T10:00:00.000+09:00', '5');
    const endAt = precise('2026-11-10T10:00:00.000+09:00', '1');

    // Act
    const result = TimeRange.create(startAt, endAt);

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' },
    });
  });

  it('桁数が違うだけで同じ時点の場合_INVALID_TIME_RANGEを返すこと', () => {
    // Arrange
    const startAt = precise('2026-11-10T10:00:00.000+09:00', '10');
    const endAt = precise('2026-11-10T10:00:00.000+09:00', '1');

    // Act
    const result = TimeRange.create(startAt, endAt);

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' },
    });
  });

  it('1ミリ秒未満の数字がすべて0で30分刻みの場合_時間帯を作ること', () => {
    // Arrange
    const startAt = precise('2026-11-10T10:00:00.000+09:00', '000');
    const endAt = precise('2026-11-10T11:00:00.000+09:00', '0');

    // Act
    const result = TimeRange.create(startAt, endAt);

    // Assert
    expect(result.ok).toBe(true);
  });
});

describe('時間帯の生成', () => {
  it('開始と終了が同じ時刻の場合_INVALID_TIME_RANGEを返すこと', () => {
    // Arrange
    const startAt = at('2026-11-10T10:00:00+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-10T10:00:00+09:00'));

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' },
    });
  });

  it('開始が終了より後で30分刻みでもない場合_開始と終了の順の検査が先に効きINVALID_TIME_RANGEを返すこと', () => {
    // Arrange
    const startAt = at('2026-11-10T11:10:00+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-10T10:00:00+09:00'));

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' },
    });
  });

  it('終了が30分刻みでない場合_NOT_ON_30_MINUTESを返すこと', () => {
    // Arrange
    const startAt = at('2026-11-10T10:00:00+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-10T10:45:00+09:00'));

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });

  it('秒を含む時刻の場合_NOT_ON_30_MINUTESを返すこと', () => {
    // Arrange
    const startAt = at('2026-11-10T10:00:30+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-10T11:00:00+09:00'));

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });

  it('日をまたぎ30分刻みでもない場合_30分刻みの検査が先に効きNOT_ON_30_MINUTESを返すこと', () => {
    // Arrange
    const startAt = at('2026-11-10T23:00:00+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-11T01:10:00+09:00'));

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });

  it('終了が翌日0時の場合_時間帯を作れること', () => {
    // Arrange
    const startAt = at('2026-11-10T23:30:00+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-11T00:00:00+09:00'));

    // Assert
    expect(result.ok).toBe(true);
  });

  it('日をまたぐ時間帯の場合_INVALID_TIME_RANGEを返すこと', () => {
    // Arrange
    const startAt = at('2026-11-10T23:30:00+09:00');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-11T00:30:00+09:00'));

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'OUTSIDE_BUSINESS_DAY' },
    });
  });

  it('UTCの表記で日本時間の日付に収まる時間帯の場合_時間帯を作れること', () => {
    // Arrange (2026-11-10 08:00-09:00 JST を UTC で表す。UTC では前日の日付)
    const startAt = at('2026-11-09T23:00:00Z');

    // Act
    const result = TimeRange.create(startAt, at('2026-11-10T00:00:00Z'));

    // Assert
    expect(result.ok).toBe(true);
  });
});

describe('時間帯の重なり', () => {
  it('一部が重なる場合_重なると判定すること', () => {
    // Arrange
    const range = created('2026-11-10T10:30:00+09:00', '2026-11-10T11:30:00+09:00');

    // Act
    const overlaps = range.overlaps({
      startAt: at('2026-11-10T10:00:00+09:00'),
      endAt: at('2026-11-10T11:00:00+09:00'),
    });

    // Assert
    expect(overlaps).toBe(true);
  });

  it('相手の終了と自分の開始が同じ場合_重ならないと判定すること', () => {
    // Arrange
    const range = created('2026-11-10T11:00:00+09:00', '2026-11-10T12:00:00+09:00');

    // Act
    const overlaps = range.overlaps({
      startAt: at('2026-11-10T10:00:00+09:00'),
      endAt: at('2026-11-10T11:00:00+09:00'),
    });

    // Assert
    expect(overlaps).toBe(false);
  });

  it('自分の終了と相手の開始が同じ場合_重ならないと判定すること', () => {
    // Arrange
    const range = created('2026-11-10T09:00:00+09:00', '2026-11-10T10:00:00+09:00');

    // Act
    const overlaps = range.overlaps({
      startAt: at('2026-11-10T10:00:00+09:00'),
      endAt: at('2026-11-10T11:00:00+09:00'),
    });

    // Assert
    expect(overlaps).toBe(false);
  });
});

describe('時間帯の不変', () => {
  it('取得した開始と終了の日時を変更した場合_時間帯の日時と重なりの判定が変わらないこと', () => {
    // Arrange
    const range = created('2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00');
    const other = {
      startAt: at('2026-11-10T13:00:00+09:00'),
      endAt: at('2026-11-10T14:00:00+09:00'),
    };

    // Act
    range.startAt.setTime(at('2026-11-10T12:00:00+09:00').getTime());
    range.endAt.setTime(at('2026-11-10T15:00:00+09:00').getTime());

    // Assert
    expect(range.startAt).toEqual(at('2026-11-10T10:00:00+09:00'));
    expect(range.endAt).toEqual(at('2026-11-10T11:00:00+09:00'));
    expect(range.overlaps(other)).toBe(false);
  });

  it('生成に渡した日時を後から変更した場合_時間帯の日時が変わらないこと', () => {
    // Arrange
    const startAt = at('2026-11-10T10:00:00+09:00');
    const endAt = at('2026-11-10T11:00:00+09:00');
    const result = TimeRange.create(startAt, endAt);
    if (!result.ok) throw new Error('時間帯を作れない');

    // Act
    startAt.setTime(at('2026-11-10T23:00:00+09:00').getTime());
    endAt.setTime(at('2026-11-11T05:00:00+09:00').getTime());

    // Assert
    expect(result.value.startAt).toEqual(at('2026-11-10T10:00:00+09:00'));
    expect(result.value.endAt).toEqual(at('2026-11-10T11:00:00+09:00'));
  });
});

describe('夏時間があった日付の時間帯 (Asia/Tokyo は 1948〜1951 年に +10:00 の夏時間があった)', () => {
  it('夏時間の日の0時から始まる時間帯の場合_日付に収まる時間帯として作れること', () => {
    // Arrange (固定の +09:00 では前日の 23:00 になる時点)
    const startAt = at('1949-05-10T00:00:00+10:00');

    // Act
    const result = TimeRange.create(startAt, at('1949-05-10T00:30:00+10:00'));

    // Assert
    expect(result.ok).toBe(true);
  });

  it('夏時間の日の翌日0時に終わる時間帯の場合_時間帯を作れること', () => {
    // Arrange
    const startAt = at('1949-05-10T23:30:00+10:00');

    // Act
    const result = TimeRange.create(startAt, at('1949-05-11T00:00:00+10:00'));

    // Assert
    expect(result.ok).toBe(true);
  });

  it('夏時間の日の翌日0時を越える時間帯の場合_INVALID_TIME_RANGEを返すこと', () => {
    // Arrange
    const startAt = at('1949-05-10T23:30:00+10:00');

    // Act
    const result = TimeRange.create(startAt, at('1949-05-11T00:30:00+10:00'));

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'OUTSIDE_BUSINESS_DAY' },
    });
  });

  it('夏時間の始まりの日の場合_0時が無いので1時から翌日0時までの23時間を返すこと', () => {
    // Arrange (1949-04-03 は 0:00 (+09:00) が 1:00 (+10:00) に進んだ日)
    const range = created('1949-04-03T10:00:00+10:00', '1949-04-03T11:00:00+10:00');

    // Act
    const day = range.businessDay();

    // Assert
    expect(day).toEqual({
      startAt: at('1949-04-03T01:00:00+10:00'),
      endAt: at('1949-04-04T00:00:00+10:00'),
    });
  });

  it('夏時間の終わりの日の場合_1回目の0時から翌日0時までの25時間を返すこと', () => {
    // Arrange (1949-09-11 は 1:00 (+10:00) が 0:00 (+09:00) に戻った日)
    const range = created('1949-09-11T10:00:00+09:00', '1949-09-11T11:00:00+09:00');

    // Act
    const day = range.businessDay();

    // Assert
    expect(day).toEqual({
      startAt: at('1949-09-11T00:00:00+10:00'),
      endAt: at('1949-09-12T00:00:00+09:00'),
    });
  });
});

describe('時間帯の業務の日付', () => {
  it('終了が翌日0時の時間帯の場合_開始の日本時間の日付の0時から翌日0時までを返すこと', () => {
    // Arrange
    const range = created('2026-11-10T23:30:00+09:00', '2026-11-11T00:00:00+09:00');

    // Act
    const day = range.businessDay();

    // Assert
    expect(day).toEqual({
      startAt: at('2026-11-10T00:00:00+09:00'),
      endAt: at('2026-11-11T00:00:00+09:00'),
    });
  });
});
