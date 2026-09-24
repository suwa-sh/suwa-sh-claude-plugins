/**
 * hooks.ts — Cucumber の Before / After (d2-foundation テンプレート)
 *
 * Before: scenario_id = `<uc_slug>#<scenario name>` を組み立て、シナリオ隔離 DB と計装済みアプリを用意し、
 *         ドライバを選び、トレース文脈を張る。
 * After: ドライバを後片付けし、シナリオのトランザクションを rollback する。
 *
 * scenario_id の uc_slug は feature のタグ @uc:<slug> から取る。無ければ feature ファイル名を使う。
 *
 * integrate で追加:
 * - D2_TRACE_DIR が未設定なら `.distillery/runs/<uc_slug>/traces/` に出す (as-built が読む場所)
 * - `.distillery/config.yaml` の capabilities.browser が true でなければ @browser シナリオは skipped にする
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { After, AfterAll, Before, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { enterScenario, sanitizeScenarioId } from '@repo/test-support/tracer';
import { ScenarioContext, stopSharedHarness } from './scenario-db';
import type { D2World } from './world';

function ucSlug(pickle: ITestCaseHookParameter['pickle']): string {
  const tag = pickle.tags.map((t) => t.name).find((n) => n.startsWith('@uc:'));
  if (tag) return tag.slice('@uc:'.length);
  const uri = pickle.uri || 'unknown.feature';
  return uri.split('/').pop()!.replace(/\.feature$/, '');
}

function browserEnabled(): boolean {
  const file = '.distillery/config.yaml';
  if (!existsSync(file)) return false;
  const text = readFileSync(file, 'utf8');
  const block = /^capabilities:\s*\n((?:[ \t]+.*\n?)*)/m.exec(text);
  return !!block && /^\s+browser:\s*true\b/m.test(block[1]);
}

const BROWSER_ENABLED = browserEnabled();
const resetTraceFiles = new Set<string>();

Before(async function (this: D2World, hook: ITestCaseHookParameter) {
  const tags = hook.pickle.tags.map((t) => t.name);
  const slug = ucSlug(hook.pickle);
  this.scenarioId = `${slug}#${hook.pickle.name}`;
  // capabilities.browser: false のとき @browser シナリオは実行しない (受入の browser ジョブも走らない)
  if (tags.includes('@browser') && !BROWSER_ENABLED) return 'skipped';

  if (!process.env.D2_TRACE_DIR) process.env.D2_TRACE_DIR = path.join('.distillery', 'runs', slug, 'traces');
  // 前回の実行のトレースに追記しないよう、この実行で初めて書くファイルだけ作り直す
  // (同じ実行内でファイル名が衝突したシナリオのトレースは消さずに追記する)
  const traceFile = path.join(process.env.D2_TRACE_DIR, `${sanitizeScenarioId(this.scenarioId)}.jsonl`);
  if (!resetTraceFiles.has(traceFile)) {
    rmSync(traceFile, { force: true });
    resetTraceFiles.add(traceFile);
  }

  enterScenario(this.scenarioId); // 以降の step 実行まで文脈が伝播する
  this.scenario = await ScenarioContext.open(slug);
  this.selectDriver(tags);
  return undefined;
});

After(async function (this: D2World) {
  if (this.driver) await this.driver.teardown();
  if (this.scenario) await this.scenario.close();
});

AfterAll(async function () {
  await stopSharedHarness();
});
