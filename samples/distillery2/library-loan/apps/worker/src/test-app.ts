// distillery2 genSkeleton.js が置いた仮の composition root。実装 (d2-implement mode=tier / integrate) で置き換える。
// 契約テストと features/support/drivers/api.ts はここの createTestApp() を入口にする。
// 戻り値は never (常に投げる)。契約テストの request(app) と api ドライバのどちらにも型として渡せる。実装では実際の app 型に置き換える
export function createTestApp(): never {
  throw new Error('test-app は未結線 (d2-implement で createTestApp を実装する)');
}
