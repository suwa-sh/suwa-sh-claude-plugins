import {
  type ListRoomsResult,
  listRooms,
  type ReserveRoomResult,
  reserveRoom,
} from '../../../../packages/contracts/api/client';
import type { ReserveRoomRequest } from '../../../../packages/contracts/api/types';
import { authorizedFetch } from './authorizedFetch';
import type { ApiDeps } from './roomAvailabilityApi';

/** 会議室と時間帯を指定して予約する (operationId reserveRoom)。baseUrl は指定しない (ADR 0021: 同一オリジンの /api) */
export function postReservation(
  body: ReserveRoomRequest,
  deps: ApiDeps,
): Promise<ReserveRoomResult> {
  return reserveRoom({ body }, { fetch: authorizedFetch(deps.tokens, deps.fetch ?? fetch) });
}

/** 全会議室を表示順で取得する (operationId listRooms)。予約の画面で会議室を選ぶために使う */
export function fetchRooms(deps: ApiDeps): Promise<ListRoomsResult> {
  return listRooms({ fetch: authorizedFetch(deps.tokens, deps.fetch ?? fetch) });
}
