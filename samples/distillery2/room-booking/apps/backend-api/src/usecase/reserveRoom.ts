// 会議室を予約する (UC reserve-room)。
// 時間帯の検証と過去の検査は domain (時間帯の値オブジェクト・予約の集約) が持ち、ここは契約の検証の順番と業務のログを受け持つ (ADR 0009・0011)。
// 検証の順: 時間帯 (順・30 分刻み・業務の日付に収まる) → 送り直し (自分の予約済みの予約と会議室・開始・終了がすべて同じなら成立済みの予約を返す)
// → 開始が現在より前でない → 会議室がある → 時間帯が重ならない (契約 reserveRoom の説明・ADR 0022)
import {
  type BusinessError,
  businessError,
  type TimeRangeErrorReason,
} from '../domain/businessError';
import { type EmployeeId, ReservationId, type RoomId } from '../domain/ids';
import { Reservation, type RoomReserved } from '../domain/reservation';
import { err, ok, type Result } from '../domain/result';
import { type InstantInput, TimeRange } from '../domain/timeRange';
import type { BusinessLogger, RequestContext } from './viewRoomAvailability';

/** 予約で起きる業務のエラーのコード (契約の reserveRoom の 404 / 409 / 422) */
export type ReserveRoomErrorCode =
  | 'INVALID_TIME_RANGE'
  | 'NOT_ON_30_MINUTES'
  | 'PAST_TIME_SLOT'
  | 'ROOM_NOT_FOUND'
  | 'SLOT_OVERLAPS';

/** 時計 (現在時刻は必ずここから取る。composition root が実装を渡す) */
export interface Clock {
  now(): Date;
}

/** usecase が受け取る読み書きの口 (repository が満たす) */
export interface ReserveRoomRepository {
  /** 会議室を探す。無ければ null */
  findRoom(roomId: RoomId): Promise<{ roomId: string; name: string } | null>;
  /**
   * 送り直しの検索 (SPEC-002-03・ADR 0022)。予約者・会議室・開始・終了がすべて同じ予約済みの予約を探す。
   * 取消済みの予約は対象にしない。無ければ null
   */
  findOwnReservedSame(
    employeeId: EmployeeId,
    roomId: RoomId,
    timeRange: TimeRange,
  ): Promise<ReservedView | null>;
  /**
   * 予約の今の状態・「予約した」イベント・30 分枠の占有をまとめて記録する。
   * 同じ会議室の枠を予約済みの予約が占めていれば何も記録せず 'overlaps' を返す (DB の一意制約で判定する。ADR 0003)
   */
  save(reservation: Reservation, event: RoomReserved): Promise<'saved' | 'overlaps'>;
}

export interface ReserveRoomInput {
  roomId: RoomId;
  /** 開始。1 ミリ秒未満まで持つ時点も受ける (時間帯の検証は全精度で行う) */
  startAt: InstantInput;
  endAt: InstantInput;
  /** 予約者 (トークンの sub) */
  employeeId: EmployeeId;
}

/** 成立した予約 */
export interface ReservedView {
  reservationId: string;
  roomId: string;
  roomName: string;
  startAt: Date;
  endAt: Date;
  reservedBy: string;
  status: 'reserved' | 'cancelled';
}

export type ReserveRoomError = BusinessError<ReserveRoomErrorCode, TimeRangeErrorReason>;

/**
 * 予約が成立した結果。created = 新しい予約が成立した (201) / resent = 送り直しで成立済みの予約を返した (200)。
 * どちらも予約の形は同じ
 */
export interface ReserveRoomOutcome {
  kind: 'created' | 'resent';
  reservation: ReservedView;
}

export type ReserveRoomResult = Result<ReserveRoomOutcome, ReserveRoomError>;

export interface ReserveRoom {
  execute(input: ReserveRoomInput, context?: RequestContext): Promise<ReserveRoomResult>;
}

const silentLogger: BusinessLogger = { info: () => {} };

export function createReserveRoom(deps: {
  repository: ReserveRoomRepository;
  clock: Clock;
  /** 予約 ID の採番 (uuid。composition root が渡す) */
  newReservationId: () => string;
  logger?: BusinessLogger;
}): ReserveRoom {
  const logger = deps.logger ?? silentLogger;

  const rejected = (
    context: RequestContext,
    input: ReserveRoomInput,
    error: ReserveRoomError,
  ): ReserveRoomResult => {
    logger.info(
      { ...context, roomId: input.roomId.value, code: error.code, reason: error.reason },
      '業務の規則に合わないため予約が成立しなかった',
    );
    return err(error);
  };

  return {
    async execute(input, context = {}) {
      const range = TimeRange.create(input.startAt, input.endAt);
      if (!range.ok) return rejected(context, input, range.error);

      // 送り直しは過去の時間帯の検査 (予約の集約の作成) より先に判定する (ADR 0022)
      const existing = await deps.repository.findOwnReservedSame(
        input.employeeId,
        input.roomId,
        range.value,
      );
      if (existing) {
        logger.info(
          {
            ...context,
            reservationId: existing.reservationId,
            roomId: existing.roomId,
            startAt: existing.startAt.toISOString(),
            endAt: existing.endAt.toISOString(),
          },
          '送り直しのため成立済みの予約を返した',
        );
        return ok({ kind: 'resent', reservation: existing });
      }

      const reserved = Reservation.reserve({
        reservationId: ReservationId.of(deps.newReservationId()),
        roomId: input.roomId,
        timeRange: range.value,
        reservedBy: input.employeeId,
        now: deps.clock.now(),
      });
      if (!reserved.ok) return rejected(context, input, reserved.error);

      const room = await deps.repository.findRoom(input.roomId);
      if (!room) return rejected(context, input, businessError('ROOM_NOT_FOUND'));

      const { reservation, event } = reserved.value;
      const saved = await deps.repository.save(reservation, event);
      if (saved === 'overlaps') return rejected(context, input, businessError('SLOT_OVERLAPS'));

      logger.info(
        {
          ...context,
          reservationId: reservation.reservationId.value,
          roomId: reservation.roomId.value,
          startAt: reservation.timeRange.startAt.toISOString(),
          endAt: reservation.timeRange.endAt.toISOString(),
        },
        '予約した',
      );
      return ok({
        kind: 'created',
        reservation: {
          reservationId: reservation.reservationId.value,
          roomId: room.roomId,
          roomName: room.name,
          startAt: reservation.timeRange.startAt,
          endAt: reservation.timeRange.endAt,
          reservedBy: reservation.reservedBy.value,
          status: reservation.status,
        },
      });
    },
  };
}
