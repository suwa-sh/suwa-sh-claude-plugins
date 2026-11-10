import type { TimeSlotPickerProps } from './TimeSlotPicker';
import type { ErrorCode } from './types';

/** 時間帯の誤りを表すエラーのコード (開始・終了の時刻を選び直せば直るもの) */
export const timeErrorCodes: readonly ErrorCode[] = [
  'INVALID_TIME_RANGE',
  'NOT_ON_30_MINUTES',
  'PAST_TIME_SLOT',
];

/** 時刻の項目の下に出す文。理由の文はエラーの通知 (BusinessErrorAlert) が出すので、ここは次の操作だけを示す */
export const timeFieldErrorText = '時刻を選び直してください';

/**
 * エラーのコードから、時間帯の入力 (TimeSlotPicker) の項目の文を決める。
 * 時間帯を入力する部品 (AvailabilitySearchForm / ReservationForm) はこの 1 か所で決める。
 * 時間帯の誤りでなければ undefined を返す。
 */
export function timeFieldErrors(errorCode?: ErrorCode): TimeSlotPickerProps['errors'] {
  if (!errorCode || !timeErrorCodes.includes(errorCode)) return undefined;
  return { startTime: timeFieldErrorText };
}
