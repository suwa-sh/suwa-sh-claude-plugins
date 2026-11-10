// 予約の画面の入口関数 (ブラウザ無しで呼べる。UC BDD はこれを API ドライバの fetch で呼ぶ)。
// 実行時に読むのは API 呼び出しの層と変換と、画面部品の未入力の判定 (missingReservationFields) だけ。
import {
  type ErrorCode,
  missingReservationFields,
  type ReservationFormField,
  type ReservationFormValue,
  type ReservationView,
} from '@repo/ui';
import { postReservation } from '../../api/reservationApi';
import type { ApiDeps } from '../../api/roomAvailabilityApi';
import { errorCodeOf, FALLBACK_ERROR } from '../errorCodeOf';
import { toDateTime } from '../RoomAvailability/toTimeRange';
import { toReservationView } from '../toReservationView';

/** 画面の入口関数に渡すもの。fetch は生成クライアントの options.fetch に渡す (テストで差し替える) */
export type SubmitReservationDeps = ApiDeps;

/** 予約の画面の状態 */
export type ReserveRoomState =
  | { kind: 'idle' }
  | { kind: 'missing'; fields: ReservationFormField[] }
  | { kind: 'completed'; reservation: ReservationView }
  | { kind: 'error'; code: ErrorCode };

/**
 * 会議室・日付・時間帯 (HH:mm。終了の 24:00 を含む) を指定して予約する。
 * 会議室・日付・開始時刻・終了時刻のどれかが未入力なら、予約を送らずに未入力の項目を項目の順に返す (SPEC-002-01)。
 * 時間帯は開始と終了の時差付きの日時だけで送り、日付を別の項目で送らない (ADR 0017)。
 * 時間帯の正しさ・過去かどうか・重なりは API が判定する (画面では検証しない)。
 * 同じ内容の送り直しで成立済みの予約が返ったときも、予約の成立として返す。
 * 予約を受け付けなかったら、契約のエラー型の code を返す。予約者はトークンから決まるので送らない。
 */
export async function submitReservation(
  value: ReservationFormValue,
  deps: SubmitReservationDeps,
): Promise<ReserveRoomState> {
  const missing = missingReservationFields(value);
  if (missing.length > 0) return { kind: 'missing', fields: missing };
  try {
    const res = await postReservation(
      {
        roomId: value.roomId,
        startAt: toDateTime(value.date, value.startTime),
        endAt: toDateTime(value.date, value.endTime),
      },
      deps,
    );
    // 201 は新しく成立、200 は送り直しで成立済みの予約が返った (SPEC-002-03・ADR 0022)。
    // どちらも本文は同じ形の予約なので、画面は区別せず成立として示す
    if (res.status === 200 || res.status === 201) {
      return { kind: 'completed', reservation: toReservationView(res.data) };
    }
    return { kind: 'error', code: errorCodeOf(res.data) };
  } catch {
    return { kind: 'error', code: FALLBACK_ERROR };
  }
}
