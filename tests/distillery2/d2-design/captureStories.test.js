'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { parseStories, run, prunePngs } = require('../../../plugins/distillery2/skills/d2-design/scripts/captureStories');

test('parseStories は v7 の entries から story だけを id 昇順で返す', () => {
  const index = {
    v: 5,
    entries: {
      'button--primary': { id: 'button--primary', name: 'Primary', title: 'UI/Button', type: 'story' },
      'button--docs': { id: 'button--docs', name: 'Docs', title: 'UI/Button', type: 'docs' },
      'card--default': { id: 'card--default', name: 'Default', title: 'UI/Card', type: 'story' },
    },
  };
  const stories = parseStories(index);
  assert.deepEqual(stories.map((s) => s.id), ['button--primary', 'card--default']); // docs 除外・昇順
  assert.equal(stories[0].title, 'UI/Button');
});

test('parseStories は v6 の stories 形式も読む (type 省略は story 扱い)', () => {
  const index = { v: 3, stories: { 'a--x': { id: 'a--x', name: 'X', title: 'A' } } };
  assert.deepEqual(parseStories(index).map((s) => s.id), ['a--x']);
});

test('parseStories は空・不正入力でも落ちない', () => {
  assert.deepEqual(parseStories(null), []);
  assert.deepEqual(parseStories({}), []);
});

test('playwright が無ければ exit 2 (目視未実施) で、Story 一覧は解析済み', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  const buildDir = path.join(dir, 'static');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'index.json'), JSON.stringify({
    v: 5, entries: { 'ui-button--primary': { id: 'ui-button--primary', name: 'Primary', title: 'UI/Button', type: 'story' } },
  }));
  // cwd を tmp にして playwright を解決不能にする (このリポにも playwright は無い)
  const r = await run({ cwd: dir, buildDir });
  assert.equal(r.code, 2);
  assert.equal(r.reason, 'playwright_unavailable');
  assert.equal(r.stories.length, 1);
  // 撮影していないので png / index.md は書かれない
  assert.equal(fs.existsSync(path.join(dir, 'docs/design/screenshots')), false);
});

test('index.json が無ければ exit 2 (目視未実施)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  const buildDir = path.join(dir, 'static');
  fs.mkdirSync(buildDir, { recursive: true });
  const r = await run({ cwd: dir, buildDir });
  assert.equal(r.code, 2);
  assert.equal(r.reason, 'index_missing');
});

test('Story が 0 件なら exit 2 (目視未実施・撮影完了にしない)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  const buildDir = path.join(dir, 'static');
  fs.mkdirSync(buildDir, { recursive: true });
  // entries は空 (または docs だけで story が残らない)
  fs.writeFileSync(path.join(buildDir, 'index.json'), JSON.stringify({ v: 5, entries: {} }));
  const r = await run({ cwd: dir, buildDir });
  assert.equal(r.code, 2);
  assert.equal(r.reason, 'no_stories');
  assert.equal(fs.existsSync(path.join(dir, 'docs/design/screenshots')), false);
});

test('chromium の起動に失敗したら exit 2 (目視未実施・capture_failed)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  const buildDir = path.join(dir, 'static');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'index.json'), JSON.stringify({
    v: 5, entries: { 'ui-button--primary': { id: 'ui-button--primary', name: 'Primary', title: 'UI/Button', type: 'story' } },
  }));
  // playwright を解決させるが chromium.launch が投げる偽モジュールを PLAYWRIGHT で差し込む
  const fake = path.join(dir, 'fake-playwright.js');
  fs.writeFileSync(fake, 'module.exports = { chromium: { launch: async () => { throw new Error("no browser binary"); } } };');
  const prev = process.env.PLAYWRIGHT;
  process.env.PLAYWRIGHT = fake;
  try {
    const r = await run({ cwd: dir, buildDir });
    assert.equal(r.code, 2);
    assert.equal(r.reason, 'capture_failed');
    assert.equal(r.stories.length, 1);
  } finally {
    if (prev === undefined) delete process.env.PLAYWRIGHT; else process.env.PLAYWRIGHT = prev;
  }
});

test('prunePngs は現行 Story ID に無い PNG だけ消す (管理外は触らない)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  fs.writeFileSync(path.join(dir, 'a--x.png'), 'keep');    // 現行 → 残す
  fs.writeFileSync(path.join(dir, 'old--y.png'), 'stale'); // 現行に無い → 消す
  fs.writeFileSync(path.join(dir, 'index.md'), 'md');      // png 以外 → 触らない
  const removed = prunePngs(dir, ['a--x']);
  assert.deepEqual(removed, ['old--y.png']);
  assert.equal(fs.existsSync(path.join(dir, 'a--x.png')), true);
  assert.equal(fs.existsSync(path.join(dir, 'old--y.png')), false);
  assert.equal(fs.existsSync(path.join(dir, 'index.md')), true);
});

test('撮影はローカル http 配信の URL で行う (file:// では ES modules が読めず白紙になる。0.1.16)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  const buildDir = path.join(dir, 'static');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'index.json'), JSON.stringify({
    v: 5, entries: { 'ui-button--primary': { id: 'ui-button--primary', name: 'Primary', title: 'UI/Button', type: 'story' } },
  }));
  fs.writeFileSync(path.join(buildDir, 'iframe.html'), '<html><body>ok</body></html>');
  // 偽の playwright: goto の URL を記録し、http で本当に取りに行けることも確かめる
  const log = path.join(dir, 'goto.log');
  const fake = path.join(dir, 'fake-playwright.js');
  fs.writeFileSync(fake, `
    const fs = require('node:fs'); const http = require('node:http');
    module.exports = { chromium: { launch: async () => ({
      newPage: async () => ({
        goto: async (url) => new Promise((resolve, reject) => {
          fs.appendFileSync(${JSON.stringify(log)}, url + '\\n');
          http.get(url, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => { fs.appendFileSync(${JSON.stringify(log)}, 'status=' + res.statusCode + ' body=' + b + '\\n'); resolve(); }); }).on('error', reject);
        }),
        screenshot: async ({ path: p }) => fs.writeFileSync(p, ''),
      }),
      close: async () => {},
    }) } };`);
  const prev = process.env.PLAYWRIGHT;
  process.env.PLAYWRIGHT = fake;
  try {
    const r = await run({ cwd: dir, buildDir, outDir: path.join(dir, 'shots') });
    assert.equal(r.code, 0, JSON.stringify(r));
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.match(lines[0], /^http:\/\/127\.0\.0\.1:\d+\/iframe\.html\?id=ui-button--primary&viewMode=story$/, lines[0]);
    assert.equal(lines[1], 'status=200 body=<html><body>ok</body></html>', '配信サーバから静的ビルドが取れる');
    assert.ok(fs.existsSync(path.join(dir, 'shots/ui-button--primary.png')));
  } finally {
    if (prev === undefined) delete process.env.PLAYWRIGHT; else process.env.PLAYWRIGHT = prev;
  }
});

test('serveStatic は配信ルートの外 (隣のディレクトリ、シンボリックリンクの先) を返さない (Codex 0.1.16 指摘 1)', async () => {
  const http = require('node:http');
  const { serveStatic } = require('../../../plugins/distillery2/skills/d2-design/scripts/captureStories');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cap-'));
  const root = path.join(dir, 'static');
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'static2'));
  fs.writeFileSync(path.join(root, 'iframe.html'), 'ok');
  fs.writeFileSync(path.join(root, 'sub/index.html'), 'sub');
  fs.writeFileSync(path.join(dir, 'static2/secret.txt'), 'secret');
  fs.writeFileSync(path.join(dir, 'outside.txt'), 'outside');
  fs.symlinkSync(path.join(dir, 'outside.txt'), path.join(root, 'link.txt'));
  const { server, origin } = await serveStatic(root);
  const get = (p) => new Promise((resolve, reject) => http.get(origin + p, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b })); }).on('error', reject));
  try {
    assert.deepEqual(await get('/iframe.html'), { status: 200, body: 'ok' });
    assert.deepEqual(await get('/sub/'), { status: 200, body: 'sub' }, 'ディレクトリは index.html');
    assert.equal((await get('/%2e%2e%2fstatic2/secret.txt')).status, 404, '前方一致で通っていた隣のディレクトリ');
    assert.equal((await get('/../static2/secret.txt')).status, 404);
    assert.equal((await get('/link.txt')).status, 404, 'ルート外へのシンボリックリンク');
    assert.equal((await get('/nope.html')).status, 404);
  } finally {
    server.close();
  }
});
