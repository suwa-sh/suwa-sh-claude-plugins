import { END_OF_DAY, type ReservationView } from '@repo/ui';
import type { Reservation } from '../../../../packages/contracts/api/types';
import { businessWallClock, formatDate, type WallClock } from './businessTimeZone';

const pad2 = (n: number) => String(n).padStart(2, '0');
const timeOf = (w: WallClock) => `${pad2(w.hour)}:${pad2(w.minute)}`;

/**
 * 契約の予約 (時差付きの日時) を、画面部品に渡す表示用の予約 (日付・HH:mm) にする。
 * 日付と時刻は業務のタイムゾーン Asia/Tokyo の暦で読む。
 * 終了が開始の翌日の 0:00 なら終了時刻は 24:00 と書く (ADR 0017: 終了の 24:00 は翌日 0:00 の日時で持つ。入力の選択肢と同じ書き方)
 */
export function toReservationView(r: Reservation): ReservationView {
  const start = businessWallClock(Date.parse(r.startAt));
  const end = businessWallClock(Date.parse(r.endAt));
  const date = formatDate(start);
  const endsAtNextMidnight =
    formatDate(end) !== date && end.hour === 0 && end.minute === 0 && end.second === 0;
  return {
    reservationId: r.reservationId,
    roomName: r.roomName,
    date,
    startTime: timeOf(start),
    endTime: endsAtNextMidnight ? END_OF_DAY : timeOf(end),
    status: r.status,
  };
}
