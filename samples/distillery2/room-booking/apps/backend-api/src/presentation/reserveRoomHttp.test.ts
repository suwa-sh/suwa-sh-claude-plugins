import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ListRooms } from '../usecase/listRooms';
import type { ReserveRoom, ReserveRoomInput } from '../usecase/reserveRoom';
import type { ViewRoomAvailability } from '../usecase/viewRoomAvailability';
import { formatBusinessDateTime } from './businessDateTime';
import { type AppLogger, createHttpApp, type TokenVerifier } from './httpApp';
import { parseReserveRoomBody } from './reserveRoomRequest';

const PATH = '/api/reservations';
const BODY = {
  roomId: 'room-1',
  startAt: '2026-11-10T10:00:00+09:00',
  endAt: '2026-11-10T11:00:00+09:00',
};

const verifier: TokenVerifier = {
  async verify(token) {
    return token === 'good' ? 'employee-a' : null;
  },
};
const silent: AppLogger = { info: () => {}, warn: () => {}, error: () => {} };
const unusedView: ViewRoomAvailability = {
  async execute() {
    throw new Error('空き状況の usecase は呼ばれない想定');
  },
};
const rooms: ListRooms = {
  async execute() {
    return { rooms: [{ roomId: 'room-1', name: '会議室A' }] };
  },
};

function appWith(reserveRoom: ReserveRoom) {
  return createHttpApp({
    viewRoomAvailability: unusedView,
    reserveRoom,
    listRooms: rooms,
    tokenVerifier: verifier,
    logger: silent,
  });
}

function recordingReserveRoom(kind: 'created' | 'resent' = 'created') {
  const inputs: ReserveRoomInput[] = [];
  const usecase: ReserveRoom = {
    async execute(input) {
      inputs.push(input);
      return {
        ok: true,
        value: {
          kind,
          reservation: {
            reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
            roomId: 'room-1',
            roomName: '会議室A',
            startAt: new Date('2026-11-10T10:00:00+09:00'),
            endAt: new Date('2026-11-10T11:00:00+09:00'),
            reservedBy: 'employee-a',
            status: 'reserved',
          },
        },
      };
    },
  };
  return { usecase, inputs };
}

describe('予約の HTTP の入口', () => {
  it('予約が成立した場合_201で日本時間の時差付きの日時の予約を返すこと', async () => {
    // Arrange
    const app = appWith(recordingReserveRoom().usecase);

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect([res.status, res.body]).toEqual([
      201,
      {
        reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
        roomId: 'room-1',
        roomName: '会議室A',
        startAt: '2026-11-10T10:00:00+09:00',
        endAt: '2026-11-10T11:00:00+09:00',
        reservedBy: 'employee-a',
        status: 'reserved',
      },
    ]);
  });

  it('送り直しで成立済みの予約が返った場合_200で同じ形の予約を返すこと', async () => {
    // Arrange
    const app = appWith(recordingReserveRoom('resent').usecase);

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect([res.status, res.body]).toEqual([
      200,
      {
        reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
        roomId: 'room-1',
        roomName: '会議室A',
        startAt: '2026-11-10T10:00:00+09:00',
        endAt: '2026-11-10T11:00:00+09:00',
        reservedBy: 'employee-a',
        status: 'reserved',
      },
    ]);
  });

  it('予約の要求を受けた場合_予約者をトークンの社員にしてusecaseに渡すこと', async () => {
    // Arrange
    const { usecase, inputs } = recordingReserveRoom();
    const app = appWith(usecase);

    // Act
    await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect(inputs.map((i) => [i.roomId.value, i.employeeId.value])).toEqual([
      ['room-1', 'employee-a'],
    ]);
  });

  it.each([
    ['SLOT_OVERLAPS', 409, '時間帯が既存の予約と重なります'],
    ['ROOM_NOT_FOUND', 404, '会議室が見つかりません'],
    ['PAST_TIME_SLOT', 422, '過去の時間帯は予約できません'],
  ] as const)(
    'usecaseが%sを返した場合_%iの契約のProblemで返すこと',
    async (code, status, title) => {
      // Arrange
      const app = appWith({
        async execute() {
          return { ok: false, error: { code } };
        },
      });

      // Act
      const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

      // Assert
      expect([res.status, res.body.code, res.body.title, typeof res.body.detail]).toEqual([
        status,
        code,
        title,
        'string',
      ]);
    },
  );

  it('会議室の一覧を求めた場合_200で会議室IDと会議室名を返すこと', async () => {
    // Arrange
    const app = appWith(recordingReserveRoom().usecase);

    // Act
    const res = await request(app).get('/api/rooms').set('Authorization', 'Bearer good');

    // Assert
    expect([res.status, res.body]).toEqual([
      200,
      { rooms: [{ roomId: 'room-1', name: '会議室A' }] },
    ]);
  });
});

describe('予約の要求の本文の形', () => {
  it.each([
    ['終了の日時が無い', { roomId: 'room-1', startAt: BODY.startAt }],
    ['会議室IDが空', { ...BODY, roomId: '' }],
    ['会議室IDが65文字', { ...BODY, roomId: 'r'.repeat(65) }],
    ['会議室IDが文字列でない', { ...BODY, roomId: 1 }],
    ['予約者を本文で渡す', { ...BODY, reservedBy: 'employee-b' }],
    ['日時に時差が無い', { ...BODY, startAt: '2026-11-10T10:00:00' }],
    ['本文が配列', [BODY]],
  ])('%sの場合_nullを返すこと', (_label, body) => {
    // Arrange
    // (本文は表の値)

    // Act
    const parsed = parseReserveRoomBody(body);

    // Assert
    expect(parsed).toBeNull();
  });

  it('会議室IDが64文字の場合_読めること', () => {
    // Arrange
    const body = { ...BODY, roomId: 'r'.repeat(64) };

    // Act
    const parsed = parseReserveRoomBody(body);

    // Assert
    expect(parsed?.roomId.value).toBe('r'.repeat(64));
  });
});

describe('応答の日時の表記', () => {
  it('UTCの日時の場合_日本時間の時差付きのRFC3339で書くこと', () => {
    // Arrange
    const value = new Date('2026-11-10T15:00:00Z');

    // Act
    const text = formatBusinessDateTime(value);

    // Assert
    expect(text).toBe('2026-11-11T00:00:00+09:00');
  });

  it('日本時間に夏時間があった日時の場合_そのときの時差で書くこと', () => {
    // Arrange
    const value = new Date('1950-07-01T00:00:00Z');

    // Act
    const text = formatBusinessDateTime(value);

    // Assert
    expect(text).toBe('1950-07-01T10:00:00+10:00');
  });
});
