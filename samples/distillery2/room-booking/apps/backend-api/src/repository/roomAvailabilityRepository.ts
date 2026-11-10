// 空き状況の照会で読む表 (rooms・reservations)。表と列の名前は DB 契約の生成物の定数を使う。
import {
  RESERVATIONS_COLUMNS as R,
  RESERVATIONS_TABLE,
  ROOMS_COLUMNS as M,
  ROOMS_TABLE,
} from '../../../../packages/contracts/db/tables';
import type { ReservationStatus } from '../domain/roomAvailability';
import type { SqlClient } from './sqlClient';

/** 会議室の行 (表示順) */
export interface RoomRow {
  roomId: string;
  name: string;
}

/** 予約の今の状態の行 (予約者の列は読まない。ADR 0006: 空き状況に予約者を含めない) */
export interface ReservationSlotRow {
  roomId: string;
  startAt: Date;
  endAt: Date;
  status: ReservationStatus;
}

type DbTimestamp = Date | string;

export function createRoomAvailabilityRepository(db: SqlClient) {
  return {
    async listRooms(): Promise<RoomRow[]> {
      const res = await db.query<{ room_id: string; room_name: string }>(
        `SELECT ${M.room_id}, ${M.room_name} FROM ${ROOMS_TABLE} ORDER BY ${M.display_order}, ${M.room_id}`,
      );
      return res.rows.map((row) => ({ roomId: row.room_id, name: row.room_name }));
    },

    /**
     * 開始が指定の期間 (業務の日付の 0:00 から翌日 0:00) にある予約を、取消済みも含めて返す。
     * 重なりと取消の判定は domain が行う (ここで重なりの条件を書かない。ADR 0009)
     */
    async listReservations(range: { startAt: Date; endAt: Date }): Promise<ReservationSlotRow[]> {
      const res = await db.query<{
        room_id: string;
        start_at: DbTimestamp;
        end_at: DbTimestamp;
        status: ReservationStatus;
      }>(
        `SELECT ${R.room_id}, ${R.start_at}, ${R.end_at}, ${R.status} FROM ${RESERVATIONS_TABLE}
         WHERE ${R.start_at} >= $1 AND ${R.start_at} < $2`,
        [range.startAt.toISOString(), range.endAt.toISOString()],
      );
      return res.rows.map((row) => ({
        roomId: row.room_id,
        startAt: toDate(row.start_at),
        endAt: toDate(row.end_at),
        status: row.status,
      }));
    },
  };
}

/** timestamptz の値を Date にする (ドライバにより Date か文字列で返る) */
function toDate(value: DbTimestamp): Date {
  return value instanceof Date ? value : new Date(value);
}
