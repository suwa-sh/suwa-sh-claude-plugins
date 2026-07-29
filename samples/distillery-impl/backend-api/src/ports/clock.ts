export interface Clock {
  /** 日付のみ(UTC 0:00)を返す。loans.loan_date / due_date が date 型のため時刻成分は持たない */
  today(): Date;
}

export class SystemClock implements Clock {
  today(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
}

export class FixedClock implements Clock {
  constructor(private readonly fixedDate: Date) {}

  today(): Date {
    return new Date(this.fixedDate);
  }
}
