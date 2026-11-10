/**
 * 業務のエラーのコード (ADR 0023)。presentation が契約の Problem (type・title・detail・code) と HTTP の status に変える。
 * 時間帯の検証で起きるのはこの 2 つ (予約の集約の作成のエラーは ReservationErrorCode)。
 */
export type TimeRangeErrorCode = 'INVALID_TIME_RANGE' | 'NOT_ON_30_MINUTES';

/**
 * INVALID_TIME_RANGE が起きた理由 (ADR 0017 の検証 (1) と (3))。1 つのコードに 2 つの理由があるので、
 * presentation が利用者の直し方 (Problem の detail) を書き分けられるように戻り値に持たせる。
 * - START_NOT_BEFORE_END: 開始が終了より前でない
 * - OUTSIDE_BUSINESS_DAY: 業務の日付の 0:00 から翌日 0:00 までに収まらない (日をまたぐ)
 */
export type TimeRangeErrorReason = 'START_NOT_BEFORE_END' | 'OUTSIDE_BUSINESS_DAY';

/** 予約の集約の作成で起きる業務のエラー (ADR 0017: 過去の時間帯の検査は予約の作成のメソッドだけに置く) */
export type ReservationErrorCode = 'PAST_TIME_SLOT';

export interface BusinessError<C extends string = string, R extends string = string> {
  code: C;
  /** 同じコードの中で発生の理由を分けるときだけ持つ */
  reason?: R;
}

export const businessError = <C extends string, R extends string = never>(
  code: C,
  reason?: R,
): BusinessError<C, R> => (reason === undefined ? { code } : { code, reason });
