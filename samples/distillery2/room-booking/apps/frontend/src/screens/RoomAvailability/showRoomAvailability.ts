// 空き状況の画面の入口関数 (ブラウザ無しで呼べる。UC BDD はこれを API ドライバの fetch で呼ぶ)。
// 実行時に読むのは API 呼び出しの層と変換だけ (画面部品は型だけ使う)。
import type { ErrorCode, RoomAvailabilityItem, TimeSlotValue } from '@repo/ui';
import { type ApiDeps, fetchRoomAvailability } from '../../api/roomAvailabilityApi';
import { errorCodeOf, FALLBACK_ERROR } from '../errorCodeOf';
import { toTimeRange } from './toTimeRange';

/** 画面の入口関数に渡すもの。fetch は生成クライアントの options.fetch に渡す (テストで差し替える) */
export type ShowRoomAvailabilityDeps = ApiDeps;

/** 空き状況の画面の状態 */
export type RoomAvailabilityState =
  | { kind: 'idle' }
  | { kind: 'loaded'; rooms: RoomAvailabilityItem[] }
  | { kind: 'error'; code: ErrorCode };

/**
 * 日付と時間帯 (HH:mm。終了の 24:00 を含む) を指定して、全会議室の空き状況を取得する。
 * 時間帯の正しさは API が判定する (画面では検証しない)。照会を受け付けなかったら、契約のエラー型の code を返す。
 */
export async function showRoomAvailability(
  slot: TimeSlotValue,
  deps: ShowRoomAvailabilityDeps,
): Promise<RoomAvailabilityState> {
  try {
    const res = await fetchRoomAvailability(toTimeRange(slot), deps);
    if (res.status !== 200) return { kind: 'error', code: errorCodeOf(res.data) };
    // 会議室の並び (表示順の昇順) は API が決める。画面は並べ替えずに応答の順のまま写す
    return {
      kind: 'loaded',
      rooms: res.data.rooms.map((r) => ({
        roomId: r.roomId,
        roomName: r.name,
        availability: r.availability,
      })),
    };
  } catch {
    return { kind: 'error', code: FALLBACK_ERROR };
  }
}
