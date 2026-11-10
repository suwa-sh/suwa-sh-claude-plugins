import { type BusinessError, businessError, type ReservationErrorCode } from './businessError';
import type { EmployeeId, ReservationId, RoomId } from './ids';
import { err, ok, type Result } from './result';
import type { ReservationStatus } from './roomAvailability';
import type { TimeRange } from './timeRange';

/** 予約したという事実 (ADR 0004・0009: 集約のメソッドが返し、repository がイベントの表に追記する) */
export interface RoomReserved {
  readonly type: 'reserved';
  readonly reservationId: ReservationId;
  /** 起きた時刻 (usecase が Clock から得た業務の時刻) */
  readonly occurredAt: Date;
  /** 行為者 (予約した社員) */
  readonly actor: EmployeeId;
}

export interface ReserveParams {
  reservationId: ReservationId;
  roomId: RoomId;
  timeRange: TimeRange;
  /** 予約者 (トークンの sub の社員) */
  reservedBy: EmployeeId;
  /** 現在時刻 (usecase が Clock から得て渡す。ADR 0009) */
  now: Date;
}

/**
 * 予約 (集約。ADR 0009)。会議室は ID で参照する。
 * 時間帯の妥当性 (順・30 分刻み・業務の日付に収まる) は時間帯の値オブジェクトが生成のときに守り、
 * 開始が現在より前でないこと (PAST_TIME_SLOT) は予約の作成のメソッドだけが守る (ADR 0017)
 */
export class Reservation {
  private constructor(
    readonly reservationId: ReservationId,
    readonly roomId: RoomId,
    readonly timeRange: TimeRange,
    readonly reservedBy: EmployeeId,
    readonly status: ReservationStatus,
  ) {
    Object.freeze(this);
  }

  /**
   * 予約する。開始が現在より前なら PAST_TIME_SLOT (開始が現在と同じなら予約できる)。
   * 成立したら予約済みの予約と「予約した」事実を返す
   */
  static reserve(
    params: ReserveParams,
  ): Result<
    { reservation: Reservation; event: RoomReserved },
    BusinessError<ReservationErrorCode, never>
  > {
    if (params.timeRange.startAt.getTime() < params.now.getTime()) {
      return err(businessError('PAST_TIME_SLOT'));
    }
    const reservation = new Reservation(
      params.reservationId,
      params.roomId,
      params.timeRange,
      params.reservedBy,
      'reserved',
    );
    const event: RoomReserved = {
      type: 'reserved',
      reservationId: params.reservationId,
      occurredAt: params.now,
      actor: params.reservedBy,
    };
    return ok({ reservation, event });
  }

  /** この予約が占める会議室の 30 分枠の開始時刻 (ADR 0003 の占有の表の元) */
  occupiedSlotStarts(): Date[] {
    return this.timeRange.slotStartTimes();
  }
}
