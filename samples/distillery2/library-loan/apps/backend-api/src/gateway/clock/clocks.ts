/**
 * 時計の実装。domain の Clock を構造的に満たす (gateway は domain に依存しない: ADR 0003)。
 */

/** 業務日付を決めるタイムゾーン (AssumptionRecord A-006)。 */
const BUSINESS_TIME_ZONE = 'Asia/Tokyo';

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export class SystemClock {
  today(): string {
    return businessDateFormat.format(new Date());
  }

  now(): Date {
    return new Date();
  }
}

/** テスト用の固定時計。業務日付を差し替えて期限の日付を再現する (ADR 0007)。 */
export class FixedClock {
  constructor(private date: string) {}

  set(date: string): void {
    this.date = date;
  }

  today(): string {
    return this.date;
  }

  now(): Date {
    return new Date(`${this.date}T09:00:00+09:00`);
  }
}
