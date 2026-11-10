// 会議室を一覧する (契約 listRooms。予約の画面で会議室を選ぶために使う)。状態を変えない読み取りだけ。
import type { RoomRecord } from './viewRoomAvailability';

/** usecase が受け取る読み取りの口 (repository が満たす) */
export interface RoomListRepository {
  /** 全会議室を表示順で返す */
  listRooms(): Promise<RoomRecord[]>;
}

export interface ListRooms {
  execute(): Promise<{ rooms: RoomRecord[] }>;
}

export function createListRooms(deps: { repository: RoomListRepository }): ListRooms {
  return {
    async execute() {
      return { rooms: await deps.repository.listRooms() };
    },
  };
}
