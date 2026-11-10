import { describe, expect, it } from 'vitest';
import { EmployeeId, RoomId } from '../domain/ids';
import type { Reservation, RoomReserved } from '../domain/reservation';
import { createReserveRoom, type ReservedView, type ReserveRoomRepository } from './reserveRoom';

const at = (iso: string) => new Date(iso);

const RESERVATION_ID = '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42';

/** 社員A の会議室A 2026-11-10 10:00-11:00 の予約済みの予約 (送り直しの検索で見つかるもの) */
const EXISTING: ReservedView = {
  reservationId: '00000000-0000-4000-8000-0000000000aa',
  roomId: 'room-1',
  roomName: '会議室A',
  startAt: at('2026-11-10T10:00:00+09:00'),
  endAt: at('2026-11-10T11:00:00+09:00'),
  reservedBy: 'employee-a',
  status: 'reserved',
};

/**
 * 会議室A (room-1) だけがある記録先。overlaps を true にすると枠が既に占められている扱いにする。
 * existing を渡すと、予約者・会議室・開始・終了がすべて同じときだけ送り直しの検索で返す
 */
function repositoryWith(options: { overlaps?: boolean; existing?: ReservedView } = {}) {
  const saved: { reservation: Reservation; event: RoomReserved }[] = [];
  const lookedUp: string[] = [];
  const repository: ReserveRoomRepository = {
    async findOwnReservedSame(employeeId, roomId, timeRange) {
      const e = options.existing;
      if (!e) return null;
      const same =
        e.reservedBy === employeeId.value &&
        e.roomId === roomId.value &&
        e.startAt.getTime() === timeRange.startAt.getTime() &&
        e.endAt.getTime() === timeRange.endAt.getTime();
      return same ? e : null;
    },
    async findRoom(roomId) {
      lookedUp.push(roomId.value);
      return roomId.value === 'room-1' ? { roomId: 'room-1', name: '会議室A' } : null;
    },
    async save(reservation, event) {
      if (options.overlaps) return 'overlaps';
      saved.push({ reservation, event });
      return 'saved';
    },
  };
  return { repository, saved, lookedUp };
}

const clockAt = (iso: string) => ({ now: () => at(iso) });

const employeeA = EmployeeId.fromSubject('employee-a') as EmployeeId;

function useCase(repository: ReserveRoomRepository, nowIso: string) {
  return createReserveRoom({
    repository,
    clock: clockAt(nowIso),
    newReservationId: () => RESERVATION_ID,
  });
}

const input = (roomId: string, startIso: string, endIso: string) => ({
  roomId: RoomId.of(roomId),
  startAt: at(startIso),
  endAt: at(endIso),
  employeeId: employeeA,
});

describe('会議室を予約する', () => {
  it('空いている会議室と時間帯の場合_予約済みの予約を予約者付きで返すこと', async () => {
    // Arrange
    const { repository } = repositoryWith();
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'created',
        reservation: {
          reservationId: RESERVATION_ID,
          roomId: 'room-1',
          roomName: '会議室A',
          startAt: at('2026-11-10T10:00:00+09:00'),
          endAt: at('2026-11-10T11:00:00+09:00'),
          reservedBy: 'employee-a',
          status: 'reserved',
        },
      },
    });
  });

  it('空いている会議室と時間帯の場合_予約したという事実を現在時刻と予約者付きで記録すること', async () => {
    // Arrange
    const { repository, saved } = repositoryWith();
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    await uc.execute(input('room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'));

    // Assert
    expect(
      saved.map(({ reservation, event }) => ({
        roomId: reservation.roomId.value,
        slots: reservation.occupiedSlotStarts(),
        event: { type: event.type, occurredAt: event.occurredAt, actor: event.actor.value },
      })),
    ).toEqual([
      {
        roomId: 'room-1',
        slots: [at('2026-11-10T10:00:00+09:00'), at('2026-11-10T10:30:00+09:00')],
        event: {
          type: 'reserved',
          occurredAt: at('2026-11-09T12:00:00+09:00'),
          actor: 'employee-a',
        },
      },
    ]);
  });

  it('開始時刻が終了時刻より後の場合_INVALID_TIME_RANGEの業務のエラーを返し記録しないこと', async () => {
    // Arrange
    const { repository, saved } = repositoryWith();
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T11:00:00+09:00', '2026-11-10T10:00:00+09:00'),
    );

    // Assert
    expect({ result, saved }).toEqual({
      result: { ok: false, error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' } },
      saved: [],
    });
  });

  it('開始時刻が現在より前の場合_PAST_TIME_SLOTの業務のエラーを返し記録しないこと', async () => {
    // Arrange
    const { repository, saved } = repositoryWith();
    const uc = useCase(repository, '2026-11-10T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect({ result, saved }).toEqual({
      result: { ok: false, error: { code: 'PAST_TIME_SLOT' } },
      saved: [],
    });
  });

  it('過去の時間帯で会議室も無い場合_会議室より先に過去を検査してPAST_TIME_SLOTを返すこと', async () => {
    // Arrange
    const { repository, lookedUp } = repositoryWith();
    const uc = useCase(repository, '2026-11-10T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('no-such-room', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect({ result, lookedUp }).toEqual({
      result: { ok: false, error: { code: 'PAST_TIME_SLOT' } },
      lookedUp: [],
    });
  });

  it('会議室が無い場合_ROOM_NOT_FOUNDの業務のエラーを返し記録しないこと', async () => {
    // Arrange
    const { repository, saved } = repositoryWith();
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('no-such-room', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect({ result, saved }).toEqual({
      result: { ok: false, error: { code: 'ROOM_NOT_FOUND' } },
      saved: [],
    });
  });

  it('同じ会議室で時間帯が重なる予約済みの予約がある場合_SLOT_OVERLAPSの業務のエラーを返すこと', async () => {
    // Arrange
    const { repository } = repositoryWith({ overlaps: true });
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:30:00+09:00', '2026-11-10T11:30:00+09:00'),
    );

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'SLOT_OVERLAPS' } });
  });
});

describe('会議室を予約する_送り直し', () => {
  it('自分の予約済みの予約と同じ内容の場合_成立済みの予約を送り直しとして返し記録しないこと', async () => {
    // Arrange
    const { repository, saved } = repositoryWith({ existing: EXISTING });
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect({ result, saved }).toEqual({
      result: { ok: true, value: { kind: 'resent', reservation: EXISTING } },
      saved: [],
    });
  });

  it('終了時刻を過ぎてから同じ内容を送り直した場合_過去の時間帯より先に送り直しと判定すること', async () => {
    // Arrange
    const { repository, saved, lookedUp } = repositoryWith({ existing: EXISTING });
    const uc = useCase(repository, '2026-11-10T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:00:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect({ result, saved, lookedUp }).toEqual({
      result: { ok: true, value: { kind: 'resent', reservation: EXISTING } },
      saved: [],
      lookedUp: [],
    });
  });

  it('自分の予約と一部だけ重なる場合_送り直しにせずSLOT_OVERLAPSを返すこと', async () => {
    // Arrange
    const { repository } = repositoryWith({ existing: EXISTING, overlaps: true });
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:30:00+09:00', '2026-11-10T11:30:00+09:00'),
    );

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'SLOT_OVERLAPS' } });
  });

  it('時間帯が30分刻みでない場合_送り直しを探す前にNOT_ON_30_MINUTESを返すこと', async () => {
    // Arrange
    const { repository } = repositoryWith({ existing: EXISTING });
    const uc = useCase(repository, '2026-11-09T12:00:00+09:00');

    // Act
    const result = await uc.execute(
      input('room-1', '2026-11-10T10:10:00+09:00', '2026-11-10T11:00:00+09:00'),
    );

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });
});
