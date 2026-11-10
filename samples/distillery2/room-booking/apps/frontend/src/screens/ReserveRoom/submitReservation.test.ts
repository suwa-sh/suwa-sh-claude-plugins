import { describe, expect, it } from 'vitest';
import type { TokenProvider } from '../../api/tokenProvider';
import { submitReservation } from './submitReservation';

interface Captured {
  url: string;
  method?: string;
  authorization?: string;
  body: unknown;
}

/** 生成クライアントに渡す fetch の代わり。要求を記録し、決めた応答を返す */
function fakeFetch(status: number, body: unknown) {
  const calls: Captured[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      authorization: new Headers(init?.headers).get('authorization') ?? undefined,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return {
      status,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as typeof fetch;
  return { fn, calls };
}

const tokensOf = (token: string): TokenProvider => ({
  getAccessToken: async () => token,
  signIn: async () => {},
});

describe('予約の画面の入口関数', () => {
  it('会議室と時間帯を指定して予約が成立した場合_時差付きの日時でトークンを付けて予約し予約済みの予約を返すこと', async () => {
    // Arrange
    const api = fakeFetch(201, {
      reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
      roomId: 'room-1',
      roomName: '会議室A',
      startAt: '2026-11-10T10:00:00+09:00',
      endAt: '2026-11-10T11:00:00+09:00',
      reservedBy: 'employee-a',
      status: 'reserved',
    });

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect({ calls: api.calls, state }).toEqual({
      calls: [
        {
          url: '/api/reservations',
          method: 'POST',
          authorization: 'Bearer test-employee-a',
          body: {
            roomId: 'room-1',
            startAt: '2026-11-10T10:00:00+09:00',
            endAt: '2026-11-10T11:00:00+09:00',
          },
        },
      ],
      state: {
        kind: 'completed',
        reservation: {
          reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
          roomName: '会議室A',
          date: '2026-11-10',
          startTime: '10:00',
          endTime: '11:00',
          status: 'reserved',
        },
      },
    });
  });

  it('終了時刻が24:00の場合_終了を翌日0:00の日時で予約すること', async () => {
    // Arrange
    const api = fakeFetch(201, {
      reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
      roomId: 'room-1',
      roomName: '会議室A',
      startAt: '2026-11-10T23:30:00+09:00',
      endAt: '2026-11-11T00:00:00+09:00',
      reservedBy: 'employee-a',
      status: 'reserved',
    });

    // Act
    await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '23:30', endTime: '24:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(api.calls.map((c) => c.body)).toEqual([
      {
        roomId: 'room-1',
        startAt: '2026-11-10T23:30:00+09:00',
        endAt: '2026-11-11T00:00:00+09:00',
      },
    ]);
  });

  it('APIが409のSLOT_OVERLAPSを返した場合_予約の結果を出さずエラーのコードを返すこと', async () => {
    // Arrange
    const api = fakeFetch(409, {
      type: 'about:blank',
      title: '時間帯が既存の予約と重なります',
      status: 409,
      code: 'SLOT_OVERLAPS',
    });

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '10:30', endTime: '11:30' },
      { tokens: tokensOf('test-employee-b'), fetch: api.fn },
    );

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'SLOT_OVERLAPS' });
  });

  it('APIが422のPAST_TIME_SLOTを返した場合_エラーのコードを返すこと', async () => {
    // Arrange
    const api = fakeFetch(422, {
      type: 'about:blank',
      title: '過去の時間帯は予約できません',
      status: 422,
      code: 'PAST_TIME_SLOT',
    });

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'PAST_TIME_SLOT' });
  });

  it('送り直しでAPIが200で成立済みの予約を返した場合_予約が成立した状態としてその予約を返すこと', async () => {
    // Arrange (SPEC-002-03・ADR 0022: 送り直しは 200 で成立済みの予約が返る。画面は通常の成立と同じに示す)
    const api = fakeFetch(200, {
      reservationId: '00000000-0000-4000-8000-00000000000a',
      roomId: 'room-1',
      roomName: '会議室A',
      startAt: '2026-11-10T10:00:00+09:00',
      endAt: '2026-11-10T11:00:00+09:00',
      reservedBy: 'employee-a',
      status: 'reserved',
    });

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(state).toEqual({
      kind: 'completed',
      reservation: {
        reservationId: '00000000-0000-4000-8000-00000000000a',
        roomName: '会議室A',
        date: '2026-11-10',
        startTime: '10:00',
        endTime: '11:00',
        status: 'reserved',
      },
    });
  });

  it('応答を受け取れなかった場合_INTERNAL_ERRORを返すこと', async () => {
    // Arrange
    const failing = (async () => {
      throw new TypeError('network');
    }) as typeof fetch;

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: failing },
    );

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'INTERNAL_ERROR' });
  });
});
