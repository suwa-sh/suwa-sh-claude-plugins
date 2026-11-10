import { User, UserManager } from 'oidc-client-ts';
import { afterEach, describe, expect, it } from 'vitest';
import { type OidcClient, OidcTokenProvider, userManagerSettings } from './oidcTokenProvider';
import { ensureSignedIn } from './tokenProvider';

const settings = {
  authority: 'https://idp.example.test',
  clientId: 'rooms',
  redirectUri: 'https://rooms.example.test/auth/callback',
  scope: 'openid profile offline_access',
};

interface FakeUser {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expired?: boolean;
  profile: { name?: string };
}

/** OIDC クライアントの差し替え。呼ばれた操作を記録する */
function fakeClient(opts: {
  user?: FakeUser | null;
  renewed?: FakeUser | null;
  renewFails?: boolean;
  redirectFails?: boolean;
  /** 送り出しを保留し、テストが返す関数を呼ぶまで終えない (本物はページの移動中は終わらない) */
  holdRedirect?: boolean;
}) {
  const calls = { redirects: [] as (string | undefined)[], renews: 0 };
  const pending: (() => void)[] = [];
  const client = {
    getUser: async () => (opts.user ?? null) as User | null,
    signinRedirect: async (args?: { state?: unknown }) => {
      calls.redirects.push(args?.state as string | undefined);
      if (opts.redirectFails) throw new Error('redirect failed');
      if (opts.holdRedirect) await new Promise<void>((resolve) => pending.push(resolve));
    },
    signinRedirectCallback: async () => ({ state: '/availability' }) as unknown as User,
    signinSilent: async () => {
      calls.renews += 1;
      if (opts.renewFails) throw new Error('renew failed');
      return (opts.renewed ?? null) as User | null;
    },
  } as unknown as OidcClient;
  /** 保留中の送り出しをすべて終える (ブラウザの「戻る」で pageshow が来たのと同じ) */
  const finishRedirects = () => {
    for (const resolve of pending.splice(0)) resolve();
  };
  return { client, calls, finishRedirects };
}

/** 保留中の Promise の続きを進める */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('トークンの供給元のアクセストークン', () => {
  it('期限が60秒より長く残っている場合_更新せずBearerの無いアクセストークンを返すこと', async () => {
    // Arrange
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 61, profile: {} },
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, calls }).toEqual({ token: 'at-1', calls: { redirects: [], renews: 0 } });
  });

  it('期限が60秒以下でリフレッシュトークンがある場合_更新してから新しいアクセストークンを返すこと', async () => {
    // Arrange
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 60, profile: {} },
      renewed: { access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600, profile: {} },
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, calls }).toEqual({ token: 'at-2', calls: { redirects: [], renews: 1 } });
  });

  it('期限が切れていてリフレッシュトークンが無い場合_更新せず今の画面のpathでサインインへ戻すこと', async () => {
    // Arrange
    window.history.replaceState(null, '', '/availability?d=2026-11-10');
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', expires_in: -5, profile: {} },
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, calls }).toEqual({
      token: undefined,
      calls: { redirects: ['/availability?d=2026-11-10'], renews: 0 },
    });
  });

  it('更新に失敗した場合_サインインへ戻しトークンを返さないこと', async () => {
    // Arrange
    window.history.replaceState(null, '', '/availability');
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 10, profile: {} },
      renewFails: true,
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, calls }).toEqual({
      token: undefined,
      calls: { redirects: ['/availability'], renews: 1 },
    });
  });

  it('更新がユーザーを返さなかった場合_サインインへ戻すこと', async () => {
    // Arrange
    window.history.replaceState(null, '', '/availability');
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 10, profile: {} },
      renewed: null,
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, redirects: calls.redirects }).toEqual({
      token: undefined,
      redirects: ['/availability'],
    });
  });

  it('メモリにトークンが無い場合_サインインへ戻すこと', async () => {
    // Arrange
    window.history.replaceState(null, '', '/availability');
    const { client, calls } = fakeClient({ user: null });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, redirects: calls.redirects }).toEqual({
      token: undefined,
      redirects: ['/availability'],
    });
  });

  it('期限が無くリフレッシュトークンがある場合_更新もサインインもせずそのまま返すこと', async () => {
    // Arrange (ADR 0020: 認証基盤が expires_in を返さないと OIDC クライアントの expires_in は undefined)
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', refresh_token: 'rt-1', profile: {} },
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, calls }).toEqual({ token: 'at-1', calls: { redirects: [], renews: 0 } });
  });

  it('期限が無くリフレッシュトークンも無い場合_更新もサインインもせずそのまま返すこと', async () => {
    // Arrange (ADR 0020)
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', profile: {} },
    });

    // Act
    const token = await new OidcTokenProvider(client).getAccessToken();

    // Assert
    expect({ token, calls }).toEqual({ token: 'at-1', calls: { redirects: [], renews: 0 } });
  });

  it('期限の近いときに同時に呼んだ場合_更新は1回だけにすること', async () => {
    // Arrange
    const { client, calls } = fakeClient({
      user: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 10, profile: {} },
      renewed: { access_token: 'at-2', expires_in: 3600, profile: {} },
    });
    const provider = new OidcTokenProvider(client);

    // Act
    const tokens = await Promise.all([provider.getAccessToken(), provider.getAccessToken()]);

    // Assert
    expect({ tokens, renews: calls.renews }).toEqual({ tokens: ['at-2', 'at-2'], renews: 1 });
  });
});

describe('トークンの供給元のサインイン', () => {
  it('最初の表示のサインインが重ねて呼ばれた場合_認証基盤へ送るのは1回だけにすること', async () => {
    // Arrange (StrictMode で effect が 2 回走る場合と同じ)
    window.history.replaceState(null, '', '/availability');
    const { client, calls, finishRedirects } = fakeClient({ user: null, holdRedirect: true });
    const provider = new OidcTokenProvider(client);

    // Act
    const both = Promise.all([
      ensureSignedIn(provider, '/availability'),
      ensureSignedIn(provider, '/availability'),
    ]);
    await flush();
    finishRedirects();
    await both;

    // Assert
    expect(calls.redirects).toEqual(['/availability']);
  });

  it('ブラウザの戻るで送り出しが終わった場合_待っていた最初の表示のサインインは送り直さないこと', async () => {
    // Arrange (oidc-client-ts は履歴から戻ったページの pageshow で送り出しを成功で終える)
    window.history.replaceState(null, '', '/availability');
    const { client, calls, finishRedirects } = fakeClient({ user: null, holdRedirect: true });
    const provider = new OidcTokenProvider(client);
    const waiting = ensureSignedIn(provider, '/availability');
    await flush();

    // Act
    finishRedirects();
    await waiting;
    await flush();

    // Assert
    expect(calls.redirects).toEqual(['/availability']);
  });

  it('ブラウザの戻るで送り出しが終わった後に操作した場合_次のサインインで認証基盤へ送り直すこと', async () => {
    // Arrange
    window.history.replaceState(null, '', '/availability');
    const { client, calls, finishRedirects } = fakeClient({ user: null, holdRedirect: true });
    const provider = new OidcTokenProvider(client);
    const first = ensureSignedIn(provider, '/availability');
    await flush();
    finishRedirects();
    await first;

    // Act
    const second = ensureSignedIn(provider, '/availability');
    await flush();
    finishRedirects();
    await second;

    // Assert
    expect(calls.redirects).toEqual(['/availability', '/availability']);
  });

  it('送り出しに失敗した場合_次の呼び出しで送り直すこと', async () => {
    // Arrange
    const { client, calls } = fakeClient({ user: null, redirectFails: true });
    const provider = new OidcTokenProvider(client);

    // Act
    const first = await provider.signIn('/availability').catch(() => 'failed');
    const second = await provider.signIn('/availability').catch(() => 'failed');

    // Assert
    expect({ first, second, redirects: calls.redirects }).toEqual({
      first: 'failed',
      second: 'failed',
      redirects: ['/availability', '/availability'],
    });
  });

  it('サインインが完了した場合_送るときに入れた戻り先のpathを返すこと', async () => {
    // Arrange
    const { client } = fakeClient({});

    // Act
    const state = await new OidcTokenProvider(client).completeSignIn();

    // Assert
    expect(state).toBe('/availability');
  });
});

describe('OIDC クライアントの設定', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('設定を作った場合_iframeでの更新を切り更新用の戻り先を持たないこと', () => {
    // Act
    const s = userManagerSettings(settings, window.sessionStorage);

    // Assert
    expect({
      automaticSilentRenew: s.automaticSilentRenew,
      silent_redirect_uri: s.silent_redirect_uri,
      response_type: s.response_type,
    }).toEqual({
      automaticSilentRenew: false,
      silent_redirect_uri: undefined,
      response_type: 'code',
    });
  });

  it('トークンを保存した場合_localStorageにもsessionStorageにも書かずメモリから読めること', async () => {
    // Arrange
    const manager = new UserManager(userManagerSettings(settings, window.sessionStorage));
    const user = new User({
      access_token: 'secret-access',
      refresh_token: 'secret-refresh',
      id_token: 'secret-id',
      token_type: 'Bearer',
      profile: { sub: 'e-1', iss: settings.authority, aud: settings.clientId, exp: 0, iat: 0 },
    });

    // Act
    await manager.storeUser(user);
    const stored = await manager.getUser();

    // Assert
    const written = [window.localStorage, window.sessionStorage]
      .flatMap((s) => Object.keys(s).map((k) => s.getItem(k) ?? ''))
      .join('\n');
    expect({ leaked: written.includes('secret-'), read: stored?.access_token }).toEqual({
      leaked: false,
      read: 'secret-access',
    });
  });

  it('サインインの往復のstateを保存する場合_sessionStorageに書きlocalStorageに書かないこと', async () => {
    // Arrange
    const s = userManagerSettings(settings, window.sessionStorage);

    // Act
    await s.stateStore?.set('probe', 'state-value');

    // Assert
    expect({
      session: Object.keys(window.sessionStorage).some((k) => k.endsWith('probe')),
      local: Object.keys(window.localStorage).length,
    }).toEqual({ session: true, local: 0 });
  });
});
