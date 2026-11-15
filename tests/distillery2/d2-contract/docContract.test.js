'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-contract');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const mdFiles = walk(SKILL_DIR).filter(f => f.endsWith('.md'));

test('SKILL.md の name は d2-contract (Agent Skills 仕様: ディレクトリ名と同じ)', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name:\s*d2-contract\s*$/m);
});

test('SKILL.md は 500 行以下 (Agent Skills 仕様の目安)', () => {
  const lines = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8').split('\n').length;
  assert.ok(lines <= 500, `SKILL.md は ${lines} 行`);
});

test('md は廃止概念 (_api-summary / legacy / specs/latest / events/ / arch-design.yaml) を含まない', () => {
  const forbidden = ['_api-summary', 'legacy', 'specs/latest', 'events/', 'arch-design.yaml'];
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const bad of forbidden) assert.ok(!text.includes(bad), `${path.relative(SKILL_DIR, f)} が "${bad}" を含む`);
  }
});

test('md の相対リンクはすべて実在する', () => {
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).filter(l => !/^(https?:|#|\$\{)/.test(l));
    for (const link of links) {
      const target = path.resolve(path.dirname(f), link.split('#')[0]);
      assert.ok(fs.existsSync(target), `${path.relative(SKILL_DIR, f)} のリンク先が無い: ${link}`);
    }
  }
});

// --- 実地確認で報告された不明点の決まりを、文面で固定する ---
const readSkill = rel => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8');
const PLUGIN_SKILLS = path.resolve(SKILL_DIR, '..');

test('契約テストの文書: query・一時 DB の後始末・一意制約の弾きの書き方がある', () => {
  const t = readSkill('references/contract-tests.md');
  assert.match(t, /`query` は、引数名 → 値で書く/);
  assert.match(t, /値に知らない項目 \(`path` \/ `query` \/ `headers` \/ `fixture` \/ `expect` 以外\)/);
  assert.match(t, /例の後 \(`afterEach`\) に `src\/test-app\.ts` の `closeTestApps\(\)` を呼ぶ/);
  assert.match(t, /2 件目が `23505` \(unique_violation\) で失敗/);
});

test('契約テストの文書: 同じ status の例が 3 つ以上のときの expect の決まりが、検査の動き (例の組ごと) と同じ', () => {
  const t = readSkill('references/contract-tests.md');
  assert.match(t, /検査は例の組ごとに見る。中身の違う相手のうち、`code` で見分けられない相手が 1 つでもある例に、`expect` を書く/);
  assert.match(t, /409 の例が 3 つあり、2 つが同じ `code`/);
  assert.doesNotMatch(t, /エラー応答で例ごとに `code` が違えば要らない/);
});

test('契約テストの文書: テスト用データの宣言の置き場と、時計を固定するテスト用データの決まりがある', () => {
  const t = readSkill('references/contract-tests.md');
  assert.match(t, /テスト用データは、それを使う operation の `x-test-fixtures` に宣言する/);
  assert.match(t, /文書直下の `x-test-fixtures` と `x-test-headers` は、全 UC の slice の `openapi` にそのまま入る/);
  assert.match(t, /現在時刻で応答が決まる例 .*は、テスト用データで時計を固定する/);
  assert.match(t, /`x-test-fixtures` の説明に、固定する現在時刻を書く/);
});

test('SKILL.md: basis の行を直す担当と直し方がある (分割ファイルはこのスキル、生成した .ts は生成器)', () => {
  const t = readSkill('SKILL.md');
  const i = t.indexOf('\n## basis の行\n');
  assert.ok(i >= 0, '「basis の行」の節が無い');
  const sec = t.slice(i, t.indexOf('\n## スクリプト\n'));
  assert.match(sec, /`uc-index\.yaml` の先頭の `# basis:` \| このスキル \|/);
  assert.match(sec, /生成した `\.ts` の `\/\/ basis:` \| 生成器 \| 手で直さない/);
  assert.match(sec, /basis\.js stamp requirements=docs\/requirements adr=docs\/adr/);
  assert.match(sec, /\| mode=uc \| 手順 5 の先頭 \|/);
  assert.match(sec, /写し直し .*の後の呼び出しが、これにあたる/);
});

test('文書に任意の手順 (「してもよい」「必要に応じて」) を足していない: basis の行の節と、契約テストの文書の足した決まり', () => {
  const skill = readSkill('SKILL.md');
  const sec = skill.slice(skill.indexOf('\n## basis の行\n'), skill.indexOf('\n## スクリプト\n'));
  assert.doesNotMatch(sec, /してもよい|必要に応じて|任意/);
  const t = readSkill('references/contract-tests.md');
  for (const head of ['**一時 DB の後始末**', '**テスト用データの宣言の置き場**', '**現在時刻で決まる例**', '**同じ status の返し分け**', '**一意制約の弾き**']) {
    const start = t.indexOf(head);
    assert.ok(start >= 0, `${head} が無い`);
    const next = t.indexOf('\n- **', start + head.length);
    const block = t.slice(start, next >= 0 ? next : t.indexOf('\n## ', start));
    assert.doesNotMatch(block, /してもよい|必要に応じて|任意/, head);
  }
});

test('結線の契約: 基盤の test-support の README と、ティア実装の手順が、生成された契約テストの呼ぶ closeTestApps を求める', () => {
  const readme = fs.readFileSync(path.join(PLUGIN_SKILLS, 'd2-foundation/templates/test-support/README.md'), 'utf8');
  const tier = fs.readFileSync(path.join(PLUGIN_SKILLS, 'd2-implement/references/tier-impl.md'), 'utf8');
  for (const [name, t] of [['README.md', readme], ['tier-impl.md', tier]]) {
    assert.match(t, /同じファイルから `closeTestApps\(\): Promise<void>` も export する/, name);
    assert.match(t, /渡された `db` は閉じない/, name);
    assert.match(t, /省略された `clock` を、?その時刻の固定の時計で埋める/, name);
  }
  // 生成器が出す名前と同じ
  const gen = fs.readFileSync(path.join(SKILL_DIR, 'scripts/genContractTests.js'), 'utf8');
  assert.match(gen, /await closeTestApps\(\);/);
});
