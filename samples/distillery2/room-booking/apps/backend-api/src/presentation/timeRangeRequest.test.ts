import { describe, expect, it } from 'vitest';
import { TimeRange } from '../domain/timeRange';
import { parseTimeRangeBody } from './timeRangeRequest';

describe('時間帯の本文の形の検証', () => {
  it('時差付きの開始と終了がある場合_日時に読むこと', () => {
    // Arrange
    const body = { startAt: '2026-11-10T23:30:00+09:00', endAt: '2026-11-11T00:00:00+09:00' };

    // Act
    const parsed = parseTimeRangeBody(body);

    // Assert
    expect(parsed).toEqual({
      startAt: { epochMs: Date.parse('2026-11-10T14:30:00Z'), subMillisecondDigits: '' },
      endAt: { epochMs: Date.parse('2026-11-10T15:00:00Z'), subMillisecondDigits: '' },
    });
  });

  it('1ミリ秒未満に0でない数字がある場合_切り捨てたミリ秒と1ミリ秒未満の数字に分けて読むこと', () => {
    // Arrange
    const body = {
      startAt: '2026-11-10T10:00:00.0001+09:00',
      endAt: '2026-11-10T11:00:00+09:00',
    };

    // Act
    const parsed = parseTimeRangeBody(body);

    // Assert
    expect(parsed?.startAt).toEqual({
      epochMs: Date.parse('2026-11-10T01:00:00.000Z'),
      subMillisecondDigits: '1',
    });
  });

  it.each([
    ['開始', { startAt: '2026-11-10T10:00:00.0001+09:00', endAt: '2026-11-10T11:00:00+09:00' }],
    ['終了', { startAt: '2026-11-10T10:00:00+09:00', endAt: '2026-11-10T10:59:59.9999+09:00' }],
    [
      '開始と終了が同じミリ秒の中で開始が前',
      { startAt: '2026-11-10T10:00:00.0001+09:00', endAt: '2026-11-10T10:00:00.0005+09:00' },
    ],
    [
      '開始が1ミリ秒未満を持ち終了が次のミリ秒ちょうど',
      { startAt: '2026-11-10T10:00:00.0001+09:00', endAt: '2026-11-10T10:00:00.001+09:00' },
    ],
  ])(
    '%sの1ミリ秒未満に0でない数字がある場合_時間帯の検査でNOT_ON_30_MINUTESになること',
    (_label, body) => {
      // Arrange
      const parsed = parseTimeRangeBody(body);
      if (!parsed) throw new Error('形の誤りとして読まれた');

      // Act
      const result = TimeRange.create(parsed.startAt, parsed.endAt);

      // Assert
      expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
    },
  );

  it.each([
    [
      '開始が同じミリ秒の中で終了より後',
      { startAt: '2026-11-10T10:00:00.0005+09:00', endAt: '2026-11-10T10:00:00.0001+09:00' },
    ],
    [
      '開始と終了が桁数の違う同じ時点',
      { startAt: '2026-11-10T10:00:00.00010+09:00', endAt: '2026-11-10T10:00:00.0001+09:00' },
    ],
  ])('%sの場合_時間帯の検査でINVALID_TIME_RANGEになること', (_label, body) => {
    // Arrange
    const parsed = parseTimeRangeBody(body);
    if (!parsed) throw new Error('形の誤りとして読まれた');

    // Act
    const result = TimeRange.create(parsed.startAt, parsed.endAt);

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' },
    });
  });

  it('1ミリ秒未満の数字がすべて0の場合_時間帯の検査を通ること', () => {
    // Arrange
    const parsed = parseTimeRangeBody({
      startAt: '2026-11-10T10:00:00.000000+09:00',
      endAt: '2026-11-10T11:00:00.0000+09:00',
    });
    if (!parsed) throw new Error('形の誤りとして読まれた');

    // Act
    const result = TimeRange.create(parsed.startAt, parsed.endAt);

    // Assert
    expect(result.ok).toBe(true);
  });

  it('小数の秒が3桁以下の場合_1ミリ秒未満の数字を持たずに読むこと', () => {
    // Arrange
    const body = {
      startAt: '2026-11-10T10:00:00.000000+09:00',
      endAt: '2026-11-10T11:00:00.5+09:00',
    };

    // Act
    const parsed = parseTimeRangeBody(body);

    // Assert
    expect(parsed).toEqual({
      startAt: { epochMs: Date.parse('2026-11-10T01:00:00Z'), subMillisecondDigits: '000' },
      endAt: { epochMs: Date.parse('2026-11-10T02:00:00.500Z'), subMillisecondDigits: '' },
    });
  });

  it.each([
    ['終了が無い', { startAt: '2026-11-10T10:00:00+09:00' }],
    ['時差が無い', { startAt: '2026-11-10T10:00:00', endAt: '2026-11-10T11:00:00' }],
    ['24:00の表記', { startAt: '2026-11-10T23:30:00+09:00', endAt: '2026-11-10T24:00:00+09:00' }],
    ['暦に無い日付', { startAt: '2026-02-30T10:00:00+09:00', endAt: '2026-02-30T11:00:00+09:00' }],
    ['日付だけ', { startAt: '2026-11-10', endAt: '2026-11-10' }],
    ['うるう秒の秒60', { startAt: '2026-12-31T23:59:60Z', endAt: '2027-01-01T00:30:00Z' }],
    ['文字列でない', { startAt: 1, endAt: 2 }],
    [
      '契約に無い項目がある',
      { startAt: '2026-11-10T10:00:00+09:00', endAt: '2026-11-10T11:00:00+09:00', date: 'x' },
    ],
    ['配列', []],
    ['null', null],
  ])('%sの場合_形の誤りとしてnullを返すこと', (_label, body) => {
    // Arrange (it.each の引数)

    // Act
    const parsed = parseTimeRangeBody(body);

    // Assert
    expect(parsed).toBeNull();
  });
});
