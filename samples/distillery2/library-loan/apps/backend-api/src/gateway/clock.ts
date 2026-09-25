/**
 * Clock / IdGenerator の実装 (ADR 0003: 現在時刻は Clock ポート経由)。
 */
import type { Clock, IdGenerator } from '../domain/shared/clock';

/** 図書館の業務日付を決めるタイムゾーン */
export const LIBRARY_TIME_ZONE = 'Asia/Tokyo';

function calendarDateIn(timeZone: string, at: Date): string {
  // en-CA ロケールは YYYY-MM-DD 形式で日付を返す
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export class SystemClock implements Clock {
  constructor(private readonly timeZone = LIBRARY_TIME_ZONE) {}

  now(): string {
    return new Date().toISOString();
  }

  today(): string {
    return calendarDateIn(this.timeZone, new Date());
  }
}

/** テストで時刻を固定する Clock (ADR 0007: 時刻に依存するシナリオは Clock を固定する)。 */
export class FixedClock implements Clock {
  private instant: Date;

  constructor(
    instant: string | Date,
    private readonly timeZone = LIBRARY_TIME_ZONE,
  ) {
    this.instant = new Date(instant);
  }

  /** 業務日付を指定して固定する (その日の正午、図書館のタイムゾーン) */
  static onDate(date: string): FixedClock {
    return new FixedClock(`${date}T12:00:00+09:00`);
  }

  setDate(date: string): void {
    this.instant = new Date(`${date}T12:00:00+09:00`);
  }

  now(): string {
    return this.instant.toISOString();
  }

  today(): string {
    return calendarDateIn(this.timeZone, this.instant);
  }
}

export class RandomUuidGenerator implements IdGenerator {
  newId(): string {
    return globalThis.crypto.randomUUID();
  }
}
