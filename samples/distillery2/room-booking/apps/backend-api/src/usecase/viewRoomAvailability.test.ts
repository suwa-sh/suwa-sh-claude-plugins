import { describe, expect, it } from 'vitest';
import {
  createViewRoomAvailability,
  type ReservationRecord,
  type RoomAvailabilityRepository,
  type RoomRecord,
} from './viewRoomAvailability';

const rooms: RoomRecord[] = [
  { roomId: 'room-1', name: '会議室A' },
  { roomId: 'room-2', name: '会議室B' },
];

function repositoryWith(reservations: ReservationRecord[]): RoomAvailabilityRepository {
  return {
    async listRooms() {
      return rooms;
    },
    async listReservations() {
      return reservations;
    },
  };
}

const at = (iso: string) => new Date(iso);

describe('会議室の空き状況を照会する', () => {
  it('時間帯の一部に予約済みの予約が重なる会議室の場合_予約済みを返し他は空きを返すこと', async () => {
    // Arrange
    const uc = createViewRoomAvailability({
      repository: repositoryWith([
        {
          roomId: 'room-1',
          startAt: at('2026-11-10T10:00:00+09:00'),
          endAt: at('2026-11-10T11:00:00+09:00'),
          status: 'reserved',
        },
      ]),
    });

    // Act
    const result = await uc.execute({
      startAt: at('2026-11-10T10:30:00+09:00'),
      endAt: at('2026-11-10T11:30:00+09:00'),
    });

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        rooms: [
          { roomId: 'room-1', name: '会議室A', availability: 'reserved' },
          { roomId: 'room-2', name: '会議室B', availability: 'available' },
        ],
      },
    });
  });

  it('予約の終了時刻から始まる時間帯の場合_空きを返すこと', async () => {
    // Arrange
    const uc = createViewRoomAvailability({
      repository: repositoryWith([
        {
          roomId: 'room-1',
          startAt: at('2026-11-10T10:00:00+09:00'),
          endAt: at('2026-11-10T11:00:00+09:00'),
          status: 'reserved',
        },
      ]),
    });

    // Act
    const result = await uc.execute({
      startAt: at('2026-11-10T11:00:00+09:00'),
      endAt: at('2026-11-10T12:00:00+09:00'),
    });

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        rooms: [
          { roomId: 'room-1', name: '会議室A', availability: 'available' },
          { roomId: 'room-2', name: '会議室B', availability: 'available' },
        ],
      },
    });
  });

  it('重なる予約が取り消されている場合_空きを返すこと', async () => {
    // Arrange
    const uc = createViewRoomAvailability({
      repository: repositoryWith([
        {
          roomId: 'room-1',
          startAt: at('2026-11-10T10:00:00+09:00'),
          endAt: at('2026-11-10T11:00:00+09:00'),
          status: 'cancelled',
        },
      ]),
    });

    // Act
    const result = await uc.execute({
      startAt: at('2026-11-10T10:00:00+09:00'),
      endAt: at('2026-11-10T11:00:00+09:00'),
    });

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        rooms: [
          { roomId: 'room-1', name: '会議室A', availability: 'available' },
          { roomId: 'room-2', name: '会議室B', availability: 'available' },
        ],
      },
    });
  });

  it('開始時刻が終了時刻より後の場合_INVALID_TIME_RANGEの業務のエラーを返すこと', async () => {
    // Arrange
    const uc = createViewRoomAvailability({ repository: repositoryWith([]) });

    // Act
    const result = await uc.execute({
      startAt: at('2026-11-10T11:00:00+09:00'),
      endAt: at('2026-11-10T10:00:00+09:00'),
    });

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' },
    });
  });

  it('30分刻みでない時刻の場合_NOT_ON_30_MINUTESの業務のエラーを返すこと', async () => {
    // Arrange
    const uc = createViewRoomAvailability({ repository: repositoryWith([]) });

    // Act
    const result = await uc.execute({
      startAt: at('2026-11-10T10:10:00+09:00'),
      endAt: at('2026-11-10T11:00:00+09:00'),
    });

    // Assert
    expect(result).toEqual({ ok: false, error: { code: 'NOT_ON_30_MINUTES' } });
  });

  it('日をまたぐ時間帯の場合_INVALID_TIME_RANGEの業務のエラーを返すこと', async () => {
    // Arrange
    const uc = createViewRoomAvailability({ repository: repositoryWith([]) });

    // Act
    const result = await uc.execute({
      startAt: at('2026-11-10T23:00:00+09:00'),
      endAt: at('2026-11-11T01:00:00+09:00'),
    });

    // Assert
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_TIME_RANGE', reason: 'OUTSIDE_BUSINESS_DAY' },
    });
  });
});
