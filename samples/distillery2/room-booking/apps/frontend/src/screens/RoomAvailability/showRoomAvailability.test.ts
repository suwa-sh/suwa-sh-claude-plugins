import { describe, expect, it } from 'vitest';
import type { TokenProvider } from '../../api/tokenProvider';
import { showRoomAvailability } from './showRoomAvailability';

interface Captured {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: unknown;
}

/** 生成クライアントに渡す fetch の代わり。要求を記録し、決めた応答を返す */
function fakeFetch(status: number, body: unknown) {
  const calls: Captured[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    calls.push({
      url: String(input),
      method: init?.method,
      headers,
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

describe('空き状況の画面の入口関数', () => {
  it('日付と時間帯を指定した場合_時差付きの日時でトークンを付けて照会し会議室ごとの空き状況を返すこと', async () => {
    // Arrange
    const api = fakeFetch(200, {
      rooms: [
        { roomId: 'room-1', name: '会議室A', availability: 'reserved' },
        { roomId: 'room-2', name: '会議室B', availability: 'available' },
      ],
    });

    // Act
    const state = await showRoomAvailability(
      { date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(api.calls.map((c) => ({ ...c, headers: c.headers.authorization }))).toEqual([
      {
        url: '/api/room-availability',
        method: 'POST',
        headers: 'Bearer test-employee-a',
        body: { startAt: '2026-11-10T10:00:00+09:00', endAt: '2026-11-10T11:00:00+09:00' },
      },
    ]);
    expect(state).toEqual({
      kind: 'loaded',
      rooms: [
        { roomId: 'room-1', roomName: '会議室A', availability: 'reserved' },
        { roomId: 'room-2', roomName: '会議室B', availability: 'available' },
      ],
    });
  });

  it('APIが表示順に並べた会議室を返した場合_並べ替えずにその順のまま返すこと', async () => {
    // Arrange (並べ替えは backend-api の責務。名前の順と表示順を変えて、画面が順を変えないことを確かめる)
    const api = fakeFetch(200, {
      rooms: [
        { roomId: 'room-3', name: '会議室C', availability: 'available' },
        { roomId: 'room-1', name: '会議室A', availability: 'available' },
        { roomId: 'room-2', name: '会議室B', availability: 'reserved' },
      ],
    });

    // Act
    const state = await showRoomAvailability(
      { date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(state.kind === 'loaded' ? state.rooms.map((r) => r.roomName) : state).toEqual([
      '会議室C',
      '会議室A',
      '会議室B',
    ]);
  });

  it('終了時刻が24:00の場合_終了を翌日0:00の日時で照会すること', async () => {
    // Arrange
    const api = fakeFetch(200, { rooms: [] });

    // Act
    await showRoomAvailability(
      { date: '2026-11-10', startTime: '23:30', endTime: '24:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(api.calls.map((c) => c.body)).toEqual([
      { startAt: '2026-11-10T23:30:00+09:00', endAt: '2026-11-11T00:00:00+09:00' },
    ]);
  });

  it('APIが422のINVALID_TIME_RANGEを返した場合_空き状況を出さずエラーのコードを返すこと', async () => {
    // Arrange
    const api = fakeFetch(422, {
      type: 'about:blank',
      title: '時間帯が正しくありません',
      status: 422,
      code: 'INVALID_TIME_RANGE',
    });

    // Act
    const state = await showRoomAvailability(
      { date: '2026-11-10', startTime: '11:00', endTime: '10:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'INVALID_TIME_RANGE' });
  });

  it('APIがcodeの無いエラーを返した場合_INTERNAL_ERRORを返すこと', async () => {
    // Arrange
    const api = fakeFetch(500, undefined);

    // Act
    const state = await showRoomAvailability(
      { date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'INTERNAL_ERROR' });
  });

  it('応答を受け取れなかった場合_INTERNAL_ERRORを返すこと', async () => {
    // Arrange
    const failing = (async () => {
      throw new TypeError('network');
    }) as typeof fetch;

    // Act
    const state = await showRoomAvailability(
      { date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: failing },
    );

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'INTERNAL_ERROR' });
  });

  it('30分刻みでない時刻の場合_画面で止めずにそのまま照会しAPIのコードを返すこと', async () => {
    // Arrange
    const api = fakeFetch(422, {
      type: 'about:blank',
      title: '時刻は 30 分刻みで指定してください',
      status: 422,
      code: 'NOT_ON_30_MINUTES',
    });

    // Act
    const state = await showRoomAvailability(
      { date: '2026-11-10', startTime: '10:10', endTime: '11:00' },
      { tokens: tokensOf('test-employee-a'), fetch: api.fn },
    );

    // Assert
    expect({ body: api.calls.map((c) => c.body), state }).toEqual({
      body: [{ startAt: '2026-11-10T10:10:00+09:00', endAt: '2026-11-10T11:00:00+09:00' }],
      state: { kind: 'error', code: 'NOT_ON_30_MINUTES' },
    });
  });
});
