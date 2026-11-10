import { describe, expect, it } from 'vitest';
import { authorizedFetch } from './authorizedFetch';
import { ensureSignedIn, type TokenProvider } from './tokenProvider';

function recordingFetch(status: number) {
  const headers: Headers[] = [];
  const fn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    headers.push(new Headers(init?.headers));
    return { status, text: async () => '' } as unknown as Response;
  }) as typeof fetch;
  return { fn, headers };
}

function fakeTokens(token: string | undefined) {
  const signIns: (string | undefined)[] = [];
  const tokens: TokenProvider = {
    getAccessToken: async () => token,
    signIn: async (returnPath?: string) => {
      signIns.push(returnPath);
    },
  };
  return { tokens, signIns };
}

describe('API 呼び出しの認可ヘッダ', () => {
  it('トークンがある場合_Bearerを1回だけ付け元のヘッダを残すこと', async () => {
    // Arrange
    const api = recordingFetch(200);
    const { tokens } = fakeTokens('test-employee-a');

    // Act
    await authorizedFetch(tokens, api.fn)('/api/room-availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    // Assert
    expect(api.headers.map((h) => [h.get('authorization'), h.get('content-type')])).toEqual([
      ['Bearer test-employee-a', 'application/json'],
    ]);
  });

  it('トークンが無い場合_Authorizationヘッダを付けないこと', async () => {
    // Arrange
    const api = recordingFetch(200);
    const { tokens } = fakeTokens(undefined);

    // Act
    await authorizedFetch(tokens, api.fn)('/api/room-availability', { method: 'POST' });

    // Assert
    expect(api.headers.map((h) => h.has('authorization'))).toEqual([false]);
  });

  it('APIが401を返した場合_トークンの供給元のサインインを呼ぶこと', async () => {
    // Arrange
    window.history.replaceState(null, '', '/availability?x=1');
    const api = recordingFetch(401);
    const { tokens, signIns } = fakeTokens('expired');

    // Act
    const res = await authorizedFetch(tokens, api.fn)('/api/room-availability', {
      method: 'POST',
    });

    // Assert
    expect({ status: res.status, signIns }).toEqual({
      status: 401,
      signIns: ['/availability?x=1'],
    });
  });

  it('APIが200を返した場合_サインインを呼ばないこと', async () => {
    // Arrange
    const api = recordingFetch(200);
    const { tokens, signIns } = fakeTokens('test-employee-a');

    // Act
    await authorizedFetch(tokens, api.fn)('/api/room-availability', { method: 'POST' });

    // Assert
    expect(signIns).toEqual([]);
  });
});

describe('最初の表示のサインイン', () => {
  it('サインインしていない場合_戻り先の画面のpathを渡してサインインへ送ること', async () => {
    // Arrange
    const { tokens, signIns } = fakeTokens(undefined);

    // Act
    await ensureSignedIn(tokens, '/availability');

    // Assert
    expect(signIns).toEqual(['/availability']);
  });

  it('サインインしている場合_サインインへ送らないこと', async () => {
    // Arrange
    const { tokens, signIns } = fakeTokens('test-employee-a');

    // Act
    await ensureSignedIn(tokens, '/availability');

    // Assert
    expect(signIns).toEqual([]);
  });
});
