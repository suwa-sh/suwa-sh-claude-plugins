/**
 * hooks.ts — Cucumber の Before / After (d2-foundation テンプレート)
 *
 * Before: scenario_id = `<uc_slug>#<scenario name>` を組み立て、ドライバを選び、トレース文脈を張る。
 * After: ドライバを後片付けする。
 *
 * scenario_id の uc_slug は feature のタグ @uc:<slug> から取る。無ければ feature ファイル名を使う。
 */
import { Before, After, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { enterScenario } from '@repo/test-support/tracer';
import type { D2World } from './world';

function ucSlug(pickle: ITestCaseHookParameter['pickle']): string {
  const tag = pickle.tags.map((t) => t.name).find((n) => n.startsWith('@uc:'));
  if (tag) return tag.slice('@uc:'.length);
  const uri = pickle.uri || 'unknown.feature';
  return uri.split('/').pop()!.replace(/\.feature$/, '');
}

Before(function (this: D2World, hook: ITestCaseHookParameter) {
  const tags = hook.pickle.tags.map((t) => t.name);
  this.scenarioId = `${ucSlug(hook.pickle)}#${hook.pickle.name}`;
  this.selectDriver(tags);
  enterScenario(this.scenarioId); // 以降の step 実行まで文脈が伝播する
});

After(async function (this: D2World) {
  if (this.driver) await this.driver.teardown();
});
