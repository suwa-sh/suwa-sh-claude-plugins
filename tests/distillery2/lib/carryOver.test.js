'use strict';
// carryOver.js (0.1.30 L10): 要求の差分で残った作業を use-cases.yaml の UC 行の carry_over に書き、配送で次の UC へ持ち越す。
// 宛先は常に「先頭から status が done でなく、from / skip でない最初の UC」(自動選択 3 の 6 と同じ規則)。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/carryOver.js');
const { parseYaml, stringifyYaml } = require('../../../plugins/distillery2/skills/d2-common/scripts/lib/yaml');
const { pickTarget } = require(SCRIPT);

function makeRepo(ucs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-carry-'));
  const file = path.join(root, 'docs/requirements/use-cases.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const doc = { version: '1.0', system_name: 'lib', use_cases: ucs.map((u) => ({ uc_id: u.slug.slice(0, 8).padEnd(8, '0'), business: 'b', buc: 'f', uc: u.slug, spec_ids: ['SPEC-001-01'], spec_ids_rejected: [], actors: ['a'], tiers_hint: ['backend'], ...u })) };
  fs.writeFileSync(file, `${stringifyYaml(doc)}\n`);
  const run = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args, '--cwd', root], { encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout.trim()); } catch { /* 出力なし */ }
    return { code: r.status, json, stderr: r.stderr };
  };
  const read = () => parseYaml(fs.readFileSync(file, 'utf8'));
  const row = (slug) => read().use_cases.find((u) => u.slug === slug);
  return { root, run, read, row };
}

const UCS = [
  { slug: 'register-book', status: 'planned' },
  { slug: 'edit-book', status: 'planned' },
  { slug: 'register-loan', status: 'done' },
  { slug: 'register-return', status: 'done' },
];

test('pickTarget: 先頭から done でない最初の UC。from と skip は飛ばす。無ければ null', () => {
  const ucs = UCS.map((u) => ({ ...u }));
  assert.equal(pickTarget(ucs), 'register-book');
  assert.equal(pickTarget(ucs, { skip: ['register-book'] }), 'edit-book');
  assert.equal(pickTarget(ucs, { from: 'register-book', skip: ['edit-book'] }), null);
  assert.equal(pickTarget(ucs.filter((u) => u.status === 'done')), null);
});

test('next: 宛先だけを返す (確認ページの「見込みの宛先」)', () => {
  const r = makeRepo(UCS);
  assert.deepEqual(r.run('next').json, { target: 'register-book' });
  assert.deepEqual(r.run('next', '--skip', 'register-book,edit-book').json, { target: null });
});

test('add: 宛先の行に追記し、重複は足さない。JSON 配列とファイルの両方を受ける', () => {
  const r = makeRepo(UCS);
  const a = r.run('add', '--items', JSON.stringify(['画面の見本 stories を直す', '受入タグを足す']));
  assert.equal(a.code, 0, JSON.stringify(a.json));
  assert.equal(a.json.target, 'register-book');
  assert.deepEqual(r.row('register-book').carry_over, ['画面の見本 stories を直す', '受入タグを足す']);
  const f = path.join(r.root, 'items.txt');
  fs.writeFileSync(f, '受入タグを足す\n\nDDL を見直す\n');
  const b = r.run('add', '--items', f);
  assert.deepEqual(b.json.items, ['DDL を見直す']);
  assert.deepEqual(b.json.skipped_duplicates, ['受入タグを足す']);
  assert.deepEqual(r.row('register-book').carry_over, ['画面の見本 stories を直す', '受入タグを足す', 'DDL を見直す']);
  assert.ok(!('carry_over' in r.row('edit-book')), '他の行には足さない');
  assert.equal(r.run('add', '--items', '[]').code, 2, '空は引数エラー');
  const bad = r.run('add', '--items', '["ok", {"bad": 1}, ""]');
  assert.equal(bad.code, 2, '文字列以外・空文字の要素は引数エラー (差分レビュー 1 ラウンド目の指摘 1)');
  assert.match(bad.json.error, /要素は空でない文字列/);
  assert.deepEqual(r.row('register-book').carry_over, ['画面の見本 stories を直す', '受入タグを足す', 'DDL を見直す'], 'エラーのときは書き換えない');
});

test('add --skip: 要求で止まった UC (feature が残る) を飛ばして次へ。宛先が無ければ no_target で書き換えない', () => {
  const r = makeRepo(UCS);
  const a = r.run('add', '--items', '["x"]', '--skip', 'register-book');
  assert.equal(a.json.target, 'edit-book');
  const before = fs.readFileSync(path.join(r.root, 'docs/requirements/use-cases.yaml'), 'utf8');
  const n = r.run('add', '--items', '["y"]', '--skip', 'register-book,edit-book');
  assert.deepEqual(n.json, { added: false, reason: 'no_target', target: null, items: ['y'], changed: false });
  assert.equal(fs.readFileSync(path.join(r.root, 'docs/requirements/use-cases.yaml'), 'utf8'), before, '宛先が無ければファイルを変えない');
});

test('move: 元の行の carry_over を消し、持ち越す項目を先頭の未完了 UC へ。元の行自身は宛先にしない', () => {
  const r = makeRepo([{ slug: 'register-book', status: 'planned', carry_over: ['a', 'b'] }, { slug: 'edit-book', status: 'planned' }, { slug: 'register-loan', status: 'done' }]);
  // register-book を配送する: a は対応済みで消え、b を持ち越す
  const m = r.run('move', '--from', 'register-book', '--items', '["b"]');
  assert.equal(m.code, 0, JSON.stringify(m.json));
  assert.deepEqual(m.json, { moved: true, target: 'edit-book', items: ['b'], cleared: ['a', 'b'], skipped_duplicates: [], changed: true });
  assert.ok(!('carry_over' in r.row('register-book')));
  assert.deepEqual(r.row('edit-book').carry_over, ['b']);
});

test('move: 配送の順が入れ替わっても (後方の UC から) 宛先は先頭の未完了 UC (外部レビュー 2 ラウンド目の指摘 1)', () => {
  const r = makeRepo([{ slug: 'register-book', status: 'planned' }, { slug: 'edit-book', status: 'planned' }, { slug: 'search-books', status: 'planned', carry_over: ['x'] }]);
  const m = r.run('move', '--from', 'search-books', '--items', '["x"]');
  assert.equal(m.json.target, 'register-book');
  assert.deepEqual(r.row('register-book').carry_over, ['x']);
  assert.ok(!('carry_over' in r.row('search-books')));
});

test('move: 宛先が無ければ no_target (元の行は消す。完了報告に載せる)。items が空なら clear と同じ', () => {
  const r = makeRepo([{ slug: 'register-loan', status: 'planned', carry_over: ['x'] }, { slug: 'register-return', status: 'done' }]);
  const m = r.run('move', '--from', 'register-loan', '--items', '["x"]');
  assert.deepEqual(m.json, { moved: false, reason: 'no_target', target: null, items: ['x'], cleared: ['x'], changed: true });
  assert.ok(!('carry_over' in r.row('register-loan')));
  const r2 = makeRepo([{ slug: 'register-loan', status: 'planned', carry_over: ['x'] }, { slug: 'edit-book', status: 'planned' }]);
  const e = r2.run('move', '--from', 'register-loan', '--items', '[]');
  assert.deepEqual(e.json, { moved: false, reason: 'no_items', target: null, cleared: ['x'], changed: true });
  assert.ok(!('carry_over' in r2.row('edit-book')));
});

test('clear: 行の carry_over を消す。知らない slug は exit 2', () => {
  const r = makeRepo([{ slug: 'register-book', status: 'planned', carry_over: ['x'] }]);
  assert.deepEqual(r.run('clear', '--from', 'register-book').json, { cleared: ['x'], changed: true });
  assert.ok(!('carry_over' in r.row('register-book')));
  assert.equal(r.run('clear', '--from', 'nope').code, 2);
});

test('書き戻した use-cases.yaml は他の欄 (slug・spec_ids・tiers) を保つ', () => {
  const r = makeRepo([{ slug: 'register-book', status: 'planned', tiers: ['frontend', 'backend-api'] }]);
  r.run('add', '--items', '["x"]');
  const u = r.row('register-book');
  assert.deepEqual(u.tiers, ['frontend', 'backend-api']);
  assert.deepEqual(u.spec_ids, ['SPEC-001-01']);
  assert.equal(r.read().system_name, 'lib');
});

test('0.1.31 N4: 内容が変わらないときはファイルを書かない (changed: false)。clear で消すものが無い・add で全部重複・move で元に無いとき', () => {
  const r = makeRepo([{ slug: 'register-book', status: 'planned', carry_over: ['x'] }, { slug: 'edit-book', status: 'planned' }]);
  const file = path.join(r.root, 'docs/requirements/use-cases.yaml');
  // 手書きの形 (全値に引用符) にしておき、変化が無いときは触らないことを見る
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('slug: register-book', 'slug: "register-book"'));
  const before = fs.readFileSync(file, 'utf8');
  const c = r.run('clear', '--from', 'edit-book');
  assert.deepEqual(c.json, { cleared: [], changed: false });
  assert.equal(fs.readFileSync(file, 'utf8'), before, '書かない');
  const a = r.run('add', '--items', '["x"]');
  assert.equal(a.json.changed, false);
  assert.deepEqual(a.json.skipped_duplicates, ['x']);
  assert.equal(fs.readFileSync(file, 'utf8'), before, '全部重複なら書かない');
  const m = r.run('move', '--from', 'edit-book', '--items', '[]');
  assert.deepEqual(m.json, { moved: false, reason: 'no_items', target: null, cleared: [], changed: false });
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  // 変わるときは書く (引用符の形は stringifyYaml の規則に揃う)
  const m2 = r.run('move', '--from', 'register-book', '--items', '["x"]');
  assert.equal(m2.json.changed, true);
  assert.notEqual(fs.readFileSync(file, 'utf8'), before);
  assert.deepEqual(r.row('edit-book').carry_over, ['x']);
});
