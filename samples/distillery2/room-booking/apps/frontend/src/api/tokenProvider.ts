// トークンの供給元 (ADR 0014 / 0015 / 0021)。
// トークンの取得・サインイン・サインインの完了・表示名は、この供給元の 1 か所にまとめる。
// 画面と画面の入口関数は供給元を引数で受け取り、OIDC クライアントを直接 import しない。

/** API の呼び出しに要るトークンの供給元。返すのは接頭辞の無いアクセストークン (テストでは test-employee-a など) */
export interface TokenProvider {
  /** API に付けるアクセストークン。サインインしていなければ undefined */
  getAccessToken(): Promise<string | undefined>;
  /**
   * 認証基盤のサインインへ送る (最初の表示と 401 のとき)。
   * returnPath はサインイン後に戻る画面の path (クエリを含む)。省略したら今の画面の path を使う
   */
  signIn(returnPath?: string): Promise<void>;
}

/** 画面の土台が使う供給元。サインインの完了と表示名も持つ */
export interface SessionTokenProvider extends TokenProvider {
  /** サインインのコールバックで呼ぶ。サインインへ送ったときに入れた戻り先の path (OIDC の state) を返す */
  completeSignIn(): Promise<string | undefined>;
  /** 画面に出す社員の表示名 (ID トークンの name クレーム)。サインインしていなければ undefined */
  getDisplayName(): Promise<string | undefined>;
}

/** サインインしていなければ (アクセストークンが無ければ)、returnPath を戻り先にしてサインインへ送る */
export async function ensureSignedIn(tokens: TokenProvider, returnPath?: string): Promise<void> {
  if (await tokens.getAccessToken()) return;
  await tokens.signIn(returnPath);
}

/** 今の画面の path (クエリを含む)。ブラウザの外 (UC BDD など) では undefined */
export function currentPath(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.pathname}${window.location.search}`;
}
