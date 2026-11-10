/**
 * clock.ts — テスト用の固定の時計 (d2-foundation テンプレート)
 *
 * 実装は時計を `Clock` (now() が Date を返す) として受け取り、本番の composition root は実際の時計を、
 * テスト用の composition root (`createTestApp({ clock })`) はこの FixedClock を渡す。
 * UC BDD と受入の step は World の `setNow('2026-11-05T12:00:00+09:00')` で現在時刻を決める。
 */
export interface Clock {
  now(): Date;
}

/** 実際の時計 (本番の composition root で使う) */
export const systemClock: Clock = { now: () => new Date() };

/** 設定できる固定の時計。作った時点の時刻で止まり、set / advance でだけ進む */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: string | Date = new Date()) {
    this.current = FixedClock.parse(initial);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  /** 現在時刻を決める。タイムゾーン付きの ISO 8601 (例 2026-11-05T12:00:00+09:00) を渡す */
  set(at: string | Date): void {
    this.current = FixedClock.parse(at);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  private static parse(at: string | Date): Date {
    const d = at instanceof Date ? new Date(at.getTime()) : new Date(at);
    if (Number.isNaN(d.getTime())) throw new Error(`FixedClock: 時刻として読めない: ${String(at)}`);
    return d;
  }
}
