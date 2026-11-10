// 予約の画面で会議室の選択肢を読む入口関数 (ブラウザ無しで呼べる)
import type { ErrorCode, Room } from '@repo/ui';
import { fetchRooms } from '../../api/reservationApi';
import type { ApiDeps } from '../../api/roomAvailabilityApi';
import { errorCodeOf, FALLBACK_ERROR } from '../errorCodeOf';

/** 会議室の選択肢の状態 */
export type RoomOptionsState =
  | { kind: 'loaded'; rooms: Room[] }
  | { kind: 'error'; code: ErrorCode };

/** 全会議室を取得する。並び (表示順) は API が決め、画面は応答の順のまま写す */
export async function loadRooms(deps: ApiDeps): Promise<RoomOptionsState> {
  try {
    const res = await fetchRooms(deps);
    if (res.status !== 200) return { kind: 'error', code: errorCodeOf(res.data) };
    return {
      kind: 'loaded',
      rooms: res.data.rooms.map((r) => ({ roomId: r.roomId, name: r.name })),
    };
  } catch {
    return { kind: 'error', code: FALLBACK_ERROR };
  }
}
