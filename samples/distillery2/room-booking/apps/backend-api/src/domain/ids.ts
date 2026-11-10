/** 会議室 ID の長さの上限 (契約 RoomId の maxLength) */
const ROOM_ID_MAX_LENGTH = 64;

/** 会議室 ID (値オブジェクト。ADR 0009: 生の文字列を業務の値として渡さない) */
export class RoomId {
  private constructor(readonly value: string) {}

  /** 永続化された会議室 ID から作る。形が契約に合わなければデータの不整合としてシステムのエラーにする */
  static of(value: string): RoomId {
    if (value.length < 1 || value.length > ROOM_ID_MAX_LENGTH) {
      throw new Error('会議室 ID の形が契約 (RoomId) に合わない');
    }
    return new RoomId(value);
  }

  equals(other: RoomId): boolean {
    return this.value === other.value;
  }
}

/** 予約 ID の形 (契約 ReservationId の format uuid) */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 予約 ID (値オブジェクト。採番は composition root が渡す採番の口が行う) */
export class ReservationId {
  private constructor(readonly value: string) {}

  /** 形が契約 (uuid) に合わなければ作れない。採番や永続化の誤りなのでシステムのエラーにする */
  static of(value: string): ReservationId {
    if (!UUID.test(value)) throw new Error('予約 ID の形が契約 (ReservationId) に合わない');
    return new ReservationId(value);
  }
}

/** 社員 ID (値オブジェクト。アクセストークンの sub から作る。ADR 0006・0015) */
export class EmployeeId {
  private constructor(readonly value: string) {}

  /** sub が空なら作れない (null を返す。呼ぶ側が 401 にする) */
  static fromSubject(sub: string | undefined | null): EmployeeId | null {
    if (typeof sub !== 'string' || sub.length === 0) return null;
    return new EmployeeId(sub);
  }
}
