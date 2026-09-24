/** ドライバ契約 (d2-foundation テンプレート)。api ドライバとブラウザドライバが実装する。 */
export interface Driver {
  /** HTTP リクエストを送る。api は supertest、browser は Playwright のページ操作に落とす。 */
  request(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: unknown }>;
  teardown(): Promise<void>;
}
