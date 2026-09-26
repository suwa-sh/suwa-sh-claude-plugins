/**
 * hooks.ts — Cucumber の Before / After (d2-foundation テンプレート)
 *
 * Before: scenario_id = `<uc_slug>#<scenario name>` を組み立て、この実行で初めて書くトレースファイルを作り直し、
 *         ドライバを選び、トレース文脈を張る。D2_TRACE_DIR が未設定なら `.distillery/runs/<slug>/traces/`。
 * After: ドライバを後片付けする。
 *
 * scenario_id の uc_slug は feature のタグ @uc:<slug> から取る。無ければ feature ファイル名を使う。
 */
import { Before, After, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { rmSync } from 'node:fs';
import * as path from 'node:path';
import { enterScenario, exitScenario, sanitizeScenarioId } from '@repo/test-support/tracer';
import type { D2World } from './world';

function ucSlug(pickle: ITestCaseHookParameter['pickle']): string {
  const tag = pickle.tags.map((t) => t.name).find((n) => n.startsWith('@uc:'));
  if (tag) return tag.slice('@uc:'.length);
  const uri = pickle.uri || 'unknown.feature';
  return (uri.split('/').pop() ?? uri).replace(/\.feature$/, '');
}

/** この実行で初めて書くトレースファイル。前回の実行分に追記すると図に経路が二重に載るため、初回だけ作り直す */
const resetTraceFiles = new Set<string>();

Before(function (this: D2World, hook: ITestCaseHookParameter) {
  const tags = hook.pickle.tags.map((t) => t.name);
  const slug = ucSlug(hook.pickle);
  this.scenarioId = `${slug}#${hook.pickle.name}`;
  if (!process.env.D2_TRACE_DIR) process.env.D2_TRACE_DIR = path.join('.distillery', 'runs', slug, 'traces');
  const traceFile = path.join(process.env.D2_TRACE_DIR, `${sanitizeScenarioId(this.scenarioId)}.jsonl`);
  if (!resetTraceFiles.has(traceFile)) {
    rmSync(traceFile, { force: true });
    resetTraceFiles.add(traceFile);
  }
  this.selectDriver(tags);
  enterScenario(this.scenarioId); // 以降の step 実行まで文脈が伝播する
});

After(async function (this: D2World) {
  if (this.driver) await this.driver.teardown();
  exitScenario();
});
