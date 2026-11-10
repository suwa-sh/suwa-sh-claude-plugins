// 予約で読み書きする表 (rooms・reservations・reservation_events・room_slot_occupancies)。表と列の名前は DB 契約の生成物の定数を使う。
import {
  RESERVATION_EVENTS_COLUMNS as E,
  RESERVATION_EVENTS_TABLE,
  RESERVATIONS_COLUMNS as R,
  RESERVATIONS_TABLE,
  ROOM_SLOT_OCCUPANCIES_COLUMNS as O,
  ROOM_SLOT_OCCUPANCIES_TABLE,
  ROOMS_COLUMNS as M,
  ROOMS_TABLE,
} from '../../../../packages/contracts/db/tables';
import type { EmployeeId, RoomId } from '../domain/ids';
import type { Reservation, RoomReserved } from '../domain/reservation';
import type { TimeRange } from '../domain/timeRange';
import type { SqlClient } from './sqlClient';

/** 予約の今の状態の 1 行 (会議室名付き) */
export interface ReservationRow {
  reservationId: string;
  roomId: string;
  roomName: string;
  startAt: Date;
  endAt: Date;
  reservedBy: string;
  status: 'reserved' | 'cancelled';
}

/**
 * 30 分枠の占有の主キー (会議室 ID, 枠の開始時刻) の制約の名前。DDL の生成物 (migrations/0001_schema.sql) は
 * PRIMARY KEY に名前を付けないので、PostgreSQL の既定の名前 (<表>_pkey) になる
 */
const OCCUPANCY_PRIMARY_KEY = `${ROOM_SLOT_OCCUPANCIES_TABLE}_pkey`;
/** PostgreSQL の一意制約の違反のエラーコード (SQLSTATE unique_violation) */
const UNIQUE_VIOLATION = '23505';

export function createReservationRepository(db: SqlClient, deps: { newEventId: () => string }) {
  return {
    async findRoom(roomId: RoomId): Promise<{ roomId: string; name: string } | null> {
      const res = await db.query<{ room_id: string; room_name: string }>(
        `SELECT ${M.room_id}, ${M.room_name} FROM ${ROOMS_TABLE} WHERE ${M.room_id} = $1`,
        [roomId.value],
      );
      const row = res.rows[0];
      return row ? { roomId: row.room_id, name: row.room_name } : null;
    },

    /**
     * 送り直しの検索 (SPEC-002-03・ADR 0022)。予約者・会議室・開始・終了がすべて同じ予約済みの予約を、会議室名と合わせて返す。
     * 取消済みの予約は対象にしない。冪等キーは使わず、予約の内容だけで探す
     */
    async findOwnReservedSame(
      employeeId: EmployeeId,
      roomId: RoomId,
      timeRange: TimeRange,
    ): Promise<ReservationRow | null> {
      const res = await db.query<{
        reservation_id: string;
        room_id: string;
        room_name: string;
        start_at: Date | string;
        end_at: Date | string;
        reserved_by: string;
      }>(
        `SELECT r.${R.reservation_id}, r.${R.room_id}, m.${M.room_name}, r.${R.start_at}, r.${R.end_at}, r.${R.reserved_by}
         FROM ${RESERVATIONS_TABLE} r
         JOIN ${ROOMS_TABLE} m ON m.${M.room_id} = r.${R.room_id}
         WHERE r.${R.reserved_by} = $1::text
           AND r.${R.room_id} = $2::text
           AND r.${R.start_at} = $3::timestamptz
           AND r.${R.end_at} = $4::timestamptz
           AND r.${R.status} = 'reserved'
         LIMIT 1`,
        [
          employeeId.value,
          roomId.value,
          timeRange.startAt.toISOString(),
          timeRange.endAt.toISOString(),
        ],
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        reservationId: row.reservation_id,
        roomId: row.room_id,
        roomName: row.room_name,
        startAt: new Date(row.start_at),
        endAt: new Date(row.end_at),
        reservedBy: row.reserved_by,
        status: 'reserved',
      };
    },

    /**
     * 予約の今の状態 (予約済み)・「予約した」イベント・30 分枠の占有を 1 つの SQL の文で書く。
     * 1 つの文は 1 つのトランザクションとして全部書けるか何も書かないかになる (ADR 0003・0004: 予約の成立と同じトランザクション)。
     * 枠が既に占められていれば占有の主キーの違反で文ごと取り消され、'overlaps' を返す (ADR 0010: 一意制約の違反を業務のエラーに変える)。
     * 記録した時刻 (recorded_at) は DB の既定値 now() で付ける (migrations/0003)
     */
    async save(reservation: Reservation, event: RoomReserved): Promise<'saved' | 'overlaps'> {
      const slots = reservation.occupiedSlotStarts();
      const slotPlaceholders = slots.map((_, i) => `($${i + 9}::timestamptz)`).join(', ');
      const params: unknown[] = [
        reservation.reservationId.value,
        reservation.roomId.value,
        reservation.timeRange.startAt.toISOString(),
        reservation.timeRange.endAt.toISOString(),
        reservation.reservedBy.value,
        deps.newEventId(),
        event.occurredAt.toISOString(),
        event.actor.value,
        ...slots.map((s) => s.toISOString()),
      ];
      try {
        await db.query(
          `WITH inserted AS (
             INSERT INTO ${RESERVATIONS_TABLE}
               (${R.reservation_id}, ${R.room_id}, ${R.start_at}, ${R.end_at}, ${R.reserved_by}, ${R.status})
             VALUES ($1::uuid, $2::text, $3::timestamptz, $4::timestamptz, $5::text, 'reserved')
             RETURNING ${R.reservation_id}
           ), event AS (
             INSERT INTO ${RESERVATION_EVENTS_TABLE}
               (${E.event_id}, ${E.reservation_id}, ${E.event_type}, ${E.occurred_at}, ${E.actor_employee_id})
             SELECT $6::uuid, ${R.reservation_id}, 'reserved', $7::timestamptz, $8::text FROM inserted
           )
           INSERT INTO ${ROOM_SLOT_OCCUPANCIES_TABLE} (${O.room_id}, ${O.slot_start_at}, ${O.reservation_id})
           SELECT $2::text, slot.start_at, inserted.${R.reservation_id}
           FROM inserted, (VALUES ${slotPlaceholders}) AS slot(start_at)`,
          params,
        );
        return 'saved';
      } catch (error) {
        if (isOccupancyConflict(error)) return 'overlaps';
        throw error;
      }
    },
  };
}

/** 30 分枠の占有の主キーの違反か (それ以外の失敗はシステムのエラーのまま投げ直す) */
function isOccupancyConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && constraint === OCCUPANCY_PRIMARY_KEY;
}
