// 会議室の空き状況を照会する (UC view-room-availability)。
// 時間帯の検証と空きの判定は domain が持ち、ここは読み取りの順番と業務のログだけを受け持つ (ADR 0009・0011)。
import type {
  BusinessError,
  TimeRangeErrorCode,
  TimeRangeErrorReason,
} from '../domain/businessError';
import { RoomId } from '../domain/ids';
import { judgeAvailability, type ReservedSlot } from '../domain/roomAvailability';
import { err, ok, type Result } from '../domain/result';
import { type InstantInput, TimeRange } from '../domain/timeRange';

/** 会議室 (表示順に並べて返す) */
export interface RoomRecord {
  roomId: string;
  name: string;
}

/** 予約 (今の状態の表の 1 行。予約者は持たせない) */
export interface ReservationRecord {
  roomId: string;
  startAt: Date;
  endAt: Date;
  status: 'reserved' | 'cancelled';
}

/** usecase が受け取る読み取りの口 (repository が満たす) */
export interface RoomAvailabilityRepository {
  /** 全会議室を表示順で返す */
  listRooms(): Promise<RoomRecord[]>;
  /** 指定した時間帯の判定に使う予約の候補を返す (取消済みを含みうる。重なりの判定は domain で行う) */
  listReservations(range: { startAt: Date; endAt: Date }): Promise<ReservationRecord[]>;
}

/** 業務のログの口 (ADR 0011。presentation の構造化ログを渡す) */
export interface BusinessLogger {
  info(fields: Record<string, unknown>, message: string): void;
}

/** 要求ごとの文脈 (ログの相関 ID・ハンドラの名前・社員 ID) */
export interface RequestContext {
  correlationId?: string;
  handler?: string;
  employeeId?: string;
}

export interface ViewRoomAvailabilityInput {
  /** 開始。1 ミリ秒未満まで持つ時点も受ける (時間帯の検証は全精度で行う) */
  startAt: InstantInput;
  endAt: InstantInput;
}

export interface RoomAvailabilityView {
  roomId: string;
  name: string;
  availability: 'available' | 'reserved';
}

export type ViewRoomAvailabilityResult = Result<
  { rooms: RoomAvailabilityView[] },
  BusinessError<TimeRangeErrorCode, TimeRangeErrorReason>
>;

export interface ViewRoomAvailability {
  execute(
    input: ViewRoomAvailabilityInput,
    context?: RequestContext,
  ): Promise<ViewRoomAvailabilityResult>;
}

const silentLogger: BusinessLogger = { info: () => {} };

export function createViewRoomAvailability(deps: {
  repository: RoomAvailabilityRepository;
  logger?: BusinessLogger;
}): ViewRoomAvailability {
  const logger = deps.logger ?? silentLogger;
  return {
    async execute(input, context = {}) {
      const range = TimeRange.create(input.startAt, input.endAt);
      if (!range.ok) {
        logger.info(
          { ...context, code: range.error.code, reason: range.error.reason },
          '時間帯が正しくないため空き状況を照会できなかった',
        );
        return err(range.error);
      }
      // 業務の日付の予約だけを候補にする (時間帯は業務の日付に収まるので、重なりうる予約はこの中にある)
      const [rooms, reservations] = await Promise.all([
        deps.repository.listRooms(),
        deps.repository.listReservations(range.value.businessDay()),
      ]);
      const slots: ReservedSlot[] = reservations.map((r) => ({
        roomId: RoomId.of(r.roomId),
        startAt: r.startAt,
        endAt: r.endAt,
        status: r.status,
      }));
      return ok({
        rooms: rooms.map((room) => ({
          roomId: room.roomId,
          name: room.name,
          availability: judgeAvailability(RoomId.of(room.roomId), range.value, slots),
        })),
      });
    },
  };
}
