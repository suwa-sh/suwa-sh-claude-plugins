/** 現在時刻のポート (ADR 0003: domain と usecase はシステム時刻を直接読まない)。 */
export interface Clock {
  /** 現在日時 (ISO 8601) */
  now(): string;
  /** 図書館の業務日付としての今日 ('YYYY-MM-DD') */
  today(): string;
}

/** 識別子の採番ポート。 */
export interface IdGenerator {
  newId(): string;
}
