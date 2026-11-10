// 予約の要求の本文 (契約 ReserveRoomRequest) の形の検証。形の誤りは 400 VALIDATION_ERROR にし、業務のエラーと混ぜない (ADR 0010)。
// 業務の規則 (順・30 分刻み・日付に収まる・過去でない・会議室がある・重ならない) はここで見ない (usecase と domain が見る)。
import { RoomId } from '../domain/ids';
import type { PreciseInstant } from '../domain/timeRange';
import { parseDateTime } from './timeRangeRequest';

/** 会議室 ID の長さ (契約 RoomId の minLength・maxLength) */
const ROOM_ID_MIN_LENGTH = 1;
const ROOM_ID_MAX_LENGTH = 64;

const RESERVE_ROOM_KEYS = ['roomId', 'startAt', 'endAt'] as const;

export interface ReserveRoomBody {
  roomId: RoomId;
  startAt: PreciseInstant;
  endAt: PreciseInstant;
}

/** 本文を会議室と時間帯の開始と終了に読む。契約の形に合わなければ null */
export function parseReserveRoomBody(body: unknown): ReserveRoomBody | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  // additionalProperties: false (予約者は本文で受けない。ADR 0006)
  if (Object.keys(record).some((k) => !(RESERVE_ROOM_KEYS as readonly string[]).includes(k))) {
    return null;
  }
  const { roomId } = record;
  if (
    typeof roomId !== 'string' ||
    roomId.length < ROOM_ID_MIN_LENGTH ||
    roomId.length > ROOM_ID_MAX_LENGTH
  ) {
    return null;
  }
  const startAt = parseDateTime(record.startAt);
  const endAt = parseDateTime(record.endAt);
  if (!startAt || !endAt) return null;
  return { roomId: RoomId.of(roomId), startAt, endAt };
}
