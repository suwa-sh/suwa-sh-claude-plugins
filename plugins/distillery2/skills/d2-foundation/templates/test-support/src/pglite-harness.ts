/**
 * pglite-harness.ts — 埋め込み Postgres (pglite) のテストハーネス (d2-foundation テンプレート)
 *
 * - テスト実行ごとに 1 つの埋め込み Postgres を起動する (docker 不要)。
 * - migration は `apps/<DATASTORE_OWNER>/migrations/*.sql` を名前昇順で当てる。
 * - シナリオ単位の隔離は **トランザクション rollback** を使う (理由は下記)。
 *
 * 隔離方式の選択 (rollback を採用した理由):
 *   スキーマ再作成より、各シナリオを 1 トランザクションで包んで最後に rollback する方が速く、
 *   migration の再適用が要らない。pglite は単一プロセス内の埋め込み DB なので、
 *   テストは直列に走らせ、rollback で前シナリオの書込を確実に消す。
 *   (並列が必要になったらシナリオごとに別 PGlite インスタンス + schema 隔離へ切り替える。)
 *
 * 参照 (Context7 /electric-sql/pglite v0.5.8): new PGlite(); await pg.waitReady;
 *   pg.exec(multiStatementSql); pg.query(text, params); pg.transaction(fn); pg.close().
 */
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface HarnessOptions {
  /** migrations ディレクトリ (既定 apps/<owner>/migrations)。省略時は migrationsDirFor を使う。 */
  migrationsDir?: string;
  datastoreOwner?: string;
  repoRoot?: string;
}

export function migrationsDirFor(owner: string, repoRoot = process.cwd()): string {
  return path.join(repoRoot, 'apps', owner, 'migrations');
}

function loadMigrations(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}

export class PgHarness {
  readonly pg: PGlite;
  private readonly migrationsDir: string;
  private migrated = false;

  constructor(opts: HarnessOptions = {}) {
    this.pg = new PGlite();
    const owner = opts.datastoreOwner || process.env.D2_DATASTORE_OWNER || 'backend-api';
    this.migrationsDir = opts.migrationsDir || migrationsDirFor(owner, opts.repoRoot);
  }

  /** 起動を待ち、migration を 1 回だけ当てる。 */
  async start(): Promise<void> {
    await this.pg.waitReady;
    if (this.migrated) return;
    for (const sql of loadMigrations(this.migrationsDir)) await this.pg.exec(sql);
    this.migrated = true;
  }

  /**
   * 1 シナリオを rollback 隔離で実行する。fn の中の書込はコミットされない。
   * pglite の transaction は例外で自動 rollback するので、末尾で必ず throw して巻き戻す。
   */
  async withRollback<T>(fn: (pg: PGlite) => Promise<T>): Promise<T> {
    const sentinel = Symbol('rollback');
    let result!: T;
    try {
      await this.pg.transaction(async () => {
        result = await fn(this.pg);
        throw sentinel;
      });
    } catch (e) {
      if (e !== sentinel) throw e;
    }
    return result;
  }

  async stop(): Promise<void> {
    await this.pg.close();
  }
}
