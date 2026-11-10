import { describe, expect, it } from 'vitest';
import type { TokenProvider } from '../../api/tokenProvider';
import { loadRooms } from './loadRooms';

const tokens: TokenProvider = {
  getAccessToken: async () => 'test-employee-a',
  signIn: async () => {},
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; method?: string; authorization: string | null }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      authorization: new Headers(init?.headers).get('authorization'),
    });
    return { status, text: async () => JSON.stringify(body) } as unknown as Response;
  }) as typeof fetch;
  return { fn, calls };
}

describe('会議室の選択肢を読む入口関数', () => {
  it('APIが会議室を返した場合_トークンを付けて一覧し応答の順のまま会議室を返すこと', async () => {
    // Arrange
    const api = fakeFetch(200, {
      rooms: [
        { roomId: 'room-2', name: '会議室B' },
        { roomId: 'room-1', name: '会議室A' },
      ],
    });

    // Act
    const state = await loadRooms({ tokens, fetch: api.fn });

    // Assert
    expect({ calls: api.calls, state }).toEqual({
      calls: [{ url: '/api/rooms', method: 'GET', authorization: 'Bearer test-employee-a' }],
      state: {
        kind: 'loaded',
        rooms: [
          { roomId: 'room-2', name: '会議室B' },
          { roomId: 'room-1', name: '会議室A' },
        ],
      },
    });
  });

  it('APIが500を返した場合_エラーのコードを返すこと', async () => {
    // Arrange
    const api = fakeFetch(500, {
      type: 'about:blank',
      title: 'システムのエラー',
      status: 500,
      code: 'INTERNAL_ERROR',
    });

    // Act
    const state = await loadRooms({ tokens, fetch: api.fn });

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'INTERNAL_ERROR' });
  });

  it('応答を受け取れなかった場合_INTERNAL_ERRORを返すこと', async () => {
    // Arrange
    const failing = (async () => {
      throw new TypeError('network');
    }) as typeof fetch;

    // Act
    const state = await loadRooms({ tokens, fetch: failing });

    // Assert
    expect(state).toEqual({ kind: 'error', code: 'INTERNAL_ERROR' });
  });
});
