// トークンの供給元の本番の実装 (oidc-client-ts。認可コード + PKCE のリダイレクト。ADR 0014 / 0015 / 0021 / 0019)。
// OIDC の設定 (VITE_OIDC_*) を読むのはこのファイルだけ。
// トークンは OIDC クライアントのメモリだけに持ち (ADR 0019)、このファイルの外へ保存もログ出力もしない。
import {
  InMemoryWebStorage,
  type User,
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from 'oidc-client-ts';
import { currentPath, type SessionTokenProvider } from './tokenProvider';

/** OIDC クライアントの設定 (環境変数 VITE_OIDC_* から読む) */
export interface OidcSettings {
  authority: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

/** 期限までの残りがこの秒数以下なら、使う前にリフレッシュトークンで更新する (ADR 0019) */
export const RENEW_BEFORE_SECONDS = 60;

/** 環境変数から OIDC の設定を読む。足りない変数があれば名前を挙げて止める */
export function readOidcSettings(env: Record<string, string | undefined>): OidcSettings {
  const names = [
    'VITE_OIDC_AUTHORITY',
    'VITE_OIDC_CLIENT_ID',
    'VITE_OIDC_REDIRECT_URI',
    'VITE_OIDC_SCOPE',
  ] as const;
  const missing = names.filter((n) => !env[n]);
  if (missing.length > 0) {
    throw new Error(`OIDC の設定が足りません: ${missing.join(', ')}`);
  }
  return {
    authority: env.VITE_OIDC_AUTHORITY as string,
    clientId: env.VITE_OIDC_CLIENT_ID as string,
    redirectUri: env.VITE_OIDC_REDIRECT_URI as string,
    scope: env.VITE_OIDC_SCOPE as string,
  };
}

/**
 * UserManager の設定 (ADR 0019)。
 * トークンはメモリだけ (userStore)、サインインの往復の state と PKCE は sessionStorage (stateStore)。
 * iframe での更新はしない (automaticSilentRenew を切り、silent_redirect_uri を設定しない)
 */
export function userManagerSettings(
  settings: OidcSettings,
  stateStorage: Storage,
): UserManagerSettings {
  return {
    authority: settings.authority,
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    scope: settings.scope,
    response_type: 'code',
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: stateStorage }),
    automaticSilentRenew: false,
  };
}

/** 供給元が使う OIDC クライアントの口 (単体テストで差し替える) */
export type OidcClient = Pick<
  UserManager,
  'getUser' | 'signinRedirect' | 'signinRedirectCallback' | 'signinSilent'
>;

/**
 * 期限の近いトークンか (残りが RENEW_BEFORE_SECONDS 以下か切れている。ADR 0019)。
 * 期限の分からないトークン (expires_in が undefined) は近くないとする (ADR 0020)。
 * 期限は OIDC クライアントの expires_in だけで判断し、アクセストークン (JWT) の中身は読まない (ADR 0020)
 */
function isExpiring(user: User): boolean {
  const left = user.expires_in;
  if (left === undefined) return false;
  return left <= RENEW_BEFORE_SECONDS;
}

/** oidc-client-ts の UserManager でサインインし、アクセストークンと表示名を返す */
export class OidcTokenProvider implements SessionTokenProvider {
  /**
   * 進行中のサインインへの送り出し (送り出しの間だけ重ねて送らない)。
   * 送り出しが終わったら成功・失敗のどちらでも外す: 認証基盤の画面からブラウザの「戻る」で
   * 同じページに戻ると、oidc-client-ts は pageshow で送り出しを成功で終えるので、残すと次のサインインが送られない
   */
  private redirecting: Promise<void> | undefined;
  /** 進行中のリフレッシュトークンでの更新 (同じリフレッシュトークンで重ねて更新しない) */
  private renewing: Promise<User | null> | undefined;

  constructor(private readonly client: OidcClient) {}

  async getAccessToken(): Promise<string | undefined> {
    const user = await this.client.getUser();
    // 読み込み直してメモリにトークンが無いときもサインインへ戻す (ADR 0019)
    if (!user) return this.signInInstead();
    if (!isExpiring(user)) return user.access_token;
    if (!user.refresh_token) return this.signInInstead();
    const renewed = await this.renew();
    if (!renewed) return this.signInInstead();
    // ADR 0015: Bearer に付けるのはアクセストークン。ID トークンは返さない
    return renewed.access_token;
  }

  signIn(returnPath?: string): Promise<void> {
    this.redirecting ??= this.client
      .signinRedirect({ state: returnPath ?? currentPath() })
      .finally(() => {
        this.redirecting = undefined;
      });
    return this.redirecting;
  }

  async completeSignIn(): Promise<string | undefined> {
    const user = await this.client.signinRedirectCallback();
    return typeof user.state === 'string' ? user.state : undefined;
  }

  async getDisplayName(): Promise<string | undefined> {
    const user = await this.client.getUser();
    if (!user || user.expired) return undefined;
    return user.profile.name;
  }

  /** リフレッシュトークンで更新する。失敗したら null (呼び出し元がサインインへ戻す) */
  private renew(): Promise<User | null> {
    this.renewing ??= this.client
      .signinSilent()
      .catch(() => null)
      .finally(() => {
        this.renewing = undefined;
      });
    return this.renewing;
  }

  /**
   * サインインへ戻し (今の画面の path を戻り先にする)、トークンは返さない。
   * 送り出しの終わりを待たずに返す: 呼び出し元の続き (最初の表示の signIn・401 の signIn) は
   * 送り出しの最中に呼ばれて同じ送り出しに乗る。待ってから返すと、ブラウザの「戻る」で送り出しが終わった後に
   * 続きが新しく送り出し、社員を認証基盤へ送り返してしまう。
   * 送り出しの失敗はここでは握りつぶす (呼び出し元の続きの signIn が送り直し、失敗をそこで返す)
   */
  private signInInstead(): Promise<undefined> {
    void this.signIn(currentPath()).catch(() => undefined);
    return Promise.resolve(undefined);
  }
}

let session: SessionTokenProvider | undefined;

/** 画面の土台が使う供給元 (最初に使うときに 1 つだけ作る。import しただけでは環境変数を読まない) */
export function sessionTokenProvider(): SessionTokenProvider {
  session ??= new OidcTokenProvider(
    new UserManager(userManagerSettings(readOidcSettings(import.meta.env), window.sessionStorage)),
  );
  return session;
}
