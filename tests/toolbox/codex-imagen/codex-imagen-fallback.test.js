'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const scriptsDir = path.join(root, 'plugins/toolbox/skills/codex-imagen/scripts');
const codexImagen = path.join(scriptsDir, 'codex-imagen.sh');
const grokImagen = path.join(scriptsDir, 'grok-imagen.sh');

// codex-imagen.sh は生成前に `codex ... mcp list --json` で MCP サーバーを列挙する。
// 偽 codex はこの呼び出しに FAKE_MCP_LIST (既定は空配列) を返し、生成側のログには残さない。
const MCP_LIST_HANDLER = [
  'case " $* " in',
  '  *" mcp list "*)',
  '    if [ -n "${FAKE_MCP_SLEEP:-}" ]; then sleep "$FAKE_MCP_SLEEP"; fi',
  '    printf "%s\\n" "${FAKE_MCP_LIST:-[]}"; exit 0 ;;',
  'esac',
].join('\n');

function writeExecutable(file, body) {
  fs.writeFileSync(file, `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-imagen-test-'));
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  const grokHome = path.join(dir, 'grok-home');
  fs.mkdirSync(grokHome);
  const orderLog = path.join(dir, 'order.log');
  const argsLog = path.join(dir, 'grok-args.log');
  const output = path.join(dir, 'result.png');
  const fakeCodex = path.join(dir, 'fake-codex');
  const fakeGrok = path.join(dir, 'fake-grok');
  const fakeAgy = path.join(dir, 'fake-agy');

  writeExecutable(fakeCodex, [
    MCP_LIST_HANDLER,
    'printf "codex\\n" >> "$ORDER_LOG"',
    'printf "%s\\n" "You have hit your usage limit" >&2',
    'exit 1',
  ].join('\n'));
  writeExecutable(fakeGrok, [
    'printf "grok\\n" >> "$ORDER_LOG"',
    ': > "$GROK_ARGS_LOG"',
    'session_id=""',
    'previous=""',
    'for arg in "$@"; do',
    '  printf "%s\\n" "$arg" >> "$GROK_ARGS_LOG"',
    '  if [ "$previous" = "--session-id" ]; then session_id="$arg"; fi',
    '  previous="$arg"',
    'done',
    'if [ "${FAKE_GROK_FAIL:-0}" = 1 ]; then',
    '  printf "%s\\n" "quota exceeded" >&2',
    '  exit 1',
    'fi',
    'image_dir="$GROK_HOME/sessions/fake-workspace/$session_id/images"',
    'mkdir -p "$image_dir"',
    'printf "first image" > "$image_dir/1.png"',
    'printf "later image" > "$image_dir/2.png"',
  ].join('\n'));
  writeExecutable(fakeAgy, [
    'printf "agy\\n" >> "$ORDER_LOG"',
    'printf "fake png" > "$FAKE_OUTPUT"',
  ].join('\n'));

  const env = {
    ...process.env,
    HOME: home,
    GROK_HOME: grokHome,
    ORDER_LOG: orderLog,
    GROK_ARGS_LOG: argsLog,
    FAKE_OUTPUT: output,
    CODEX_IMAGEN_CODEX_WRAPPER: fakeCodex,
    CODEX_IMAGEN_MAX_ATTEMPTS: '1',
    CODEX_IMAGEN_TIMEOUT: '2',
    GROK_IMAGEN_BIN: fakeGrok,
    GROK_IMAGEN_MAX_ATTEMPTS: '1',
    GROK_IMAGEN_TIMEOUT: '2',
    AGY_IMAGEN_BIN: fakeAgy,
    AGY_IMAGEN_MAX_ATTEMPTS: '1',
    AGY_IMAGEN_TIMEOUT: '2',
  };

  delete env.CODEX_IMAGEN_FALLBACK;
  delete env.CODEX_IMAGEN_FALLBACKS;
  return { dir, env, orderLog, argsLog, output };
}

function run(script, args, env) {
  return spawnSync('bash', [script, ...args], {
    cwd: env.HOME,
    env,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function imagenResult(stderr) {
  const line = stderr.split(/\r?\n/).find(value => value.includes('IMAGEN_RESULT '));
  assert.ok(line, `IMAGEN_RESULT not found in stderr:\n${stderr}`);
  return JSON.parse(line.slice(line.indexOf('IMAGEN_RESULT ') + 'IMAGEN_RESULT '.length));
}

function argsFromLog(file) {
  return fs.readFileSync(file, 'utf8').trimEnd().split('\n');
}

test('default fallback stops at Grok when Grok succeeds', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));

  const result = run(codexImagen, [f.output, '青い円を描く'], f.env);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), f.output);
  assert.deepEqual(fs.readFileSync(f.orderLog, 'utf8').trim().split('\n'), ['codex', 'grok']);
  assert.equal(fs.existsSync(f.output), true);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'first image');
  const summary = imagenResult(result.stderr);
  assert.equal(summary.status, 'ok');
  assert.deepEqual(summary.providers.map(provider => provider.name), ['codex', 'grok']);
  assert.deepEqual(summary.providers.map(provider => provider.status), ['failed', 'ok']);
});

test('default fallback reaches AGY only after Codex and Grok fail', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  f.env.FAKE_GROK_FAIL = '1';

  const result = run(codexImagen, [f.output, '青い円を描く'], f.env);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(f.orderLog, 'utf8').trim().split('\n'), ['codex', 'grok', 'agy']);
  const summary = imagenResult(result.stderr);
  assert.equal(summary.status, 'ok');
  assert.deepEqual(summary.providers.map(provider => provider.name), ['codex', 'grok', 'agy']);
  assert.deepEqual(summary.providers.map(provider => provider.status), ['failed', 'failed', 'ok']);
  assert.equal(summary.providers[1].reason, 'quota_exhausted');
});

test('Grok generation exposes only image_gen', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));

  const result = run(grokImagen, [f.output, '青い円を描く'], f.env);

  assert.equal(result.status, 0, result.stderr);
  const args = argsFromLog(f.argsLog);
  const toolsIndex = args.indexOf('--tools');
  const singleIndex = args.indexOf('--single');
  assert.notEqual(toolsIndex, -1);
  assert.equal(args[toolsIndex + 1], 'image_gen');
  assert.match(args[singleIndex + 1], /image_gen/);
  assert.doesNotMatch(args[singleIndex + 1], /image_edit/);
});

test('Grok editing exposes only image_edit and passes the input image path', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const input = path.join(f.dir, 'input.png');
  fs.writeFileSync(input, 'fake input');

  const result = run(grokImagen, [f.output, '円を赤くする', input], f.env);

  assert.equal(result.status, 0, result.stderr);
  const args = argsFromLog(f.argsLog);
  const toolsIndex = args.indexOf('--tools');
  const singleIndex = args.indexOf('--single');
  assert.notEqual(toolsIndex, -1);
  assert.equal(args[toolsIndex + 1], 'image_edit');
  assert.match(args[singleIndex + 1], /image_edit/);
  assert.match(args[singleIndex + 1], /image_gen.*使わない/);
  assert.match(args[singleIndex + 1], new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

function useSucceedingCodex(f) {
  const codexArgsLog = path.join(f.dir, 'codex-args.log');
  const fakeCodex = path.join(f.dir, 'fake-codex-ok');
  writeExecutable(fakeCodex, [
    MCP_LIST_HANDLER,
    ': > "$CODEX_ARGS_LOG"',
    'for arg in "$@"; do printf "%s\\n" "$arg" >> "$CODEX_ARGS_LOG"; done',
    'image_dir="$HOME/.codex/generated_images/thread-fake"',
    'mkdir -p "$image_dir"',
    'printf "codex image" > "$image_dir/exec-fake.png"',
    'printf "%s\\n" \'{"type":"thread.started","thread_id":"thread-fake"}\'',
  ].join('\n'));
  f.env.CODEX_IMAGEN_CODEX_WRAPPER = fakeCodex;
  f.env.CODEX_ARGS_LOG = codexArgsLog;
  return codexArgsLog;
}

// 2026-10-04: 旧文言「imagenスキルで」を Codex が Google Imagen と読み違え、gemini-image スキルで
// Chrome を画面操作した。スキル名の固定と、プラグイン (画面操作・ブラウザの道具) の無効化を回帰で守る。
for (const mode of ['generate', 'edit']) {
  test(`Codex ${mode} pins the built-in imagegen skill and disables plugins`, t => {
    const f = fixture();
    t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
    const codexArgsLog = useSucceedingCodex(f);
    const args = [f.output, '青い円を描く'];
    if (mode === 'edit') {
      const input = path.join(f.dir, 'input.png');
      fs.writeFileSync(input, 'fake input');
      args.push(input);
    }

    const result = run(codexImagen, args, f.env);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(f.output, 'utf8'), 'codex image');
    const codexArgs = argsFromLog(codexArgsLog);
    const configIndex = codexArgs.indexOf('-c');
    assert.notEqual(configIndex, -1, codexArgs.join(' '));
    assert.equal(codexArgs[configIndex + 1], 'features.plugins=false');
    const prompt = codexArgs[codexArgs.length - 1];
    assert.match(prompt, /組み込みの imagegen スキル/);
    assert.match(prompt, /gemini-image など他の画像スキル、ブラウザ操作、画面操作は使わない/);
    assert.doesNotMatch(prompt, /imagenスキル/);
  });
}

test('Codex disables every enabled config-defined MCP server', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const codexArgsLog = useSucceedingCodex(f);
  f.env.FAKE_MCP_LIST = JSON.stringify([
    { name: 'node_repl', enabled: true },
    { name: 'Context7', enabled: true },
    { name: 'computer-use', enabled: false },
    // 無効なサーバーは名前が -c で指定できなくても問題にしない
    { name: 'off.server', enabled: false },
  ]);

  const result = run(codexImagen, [f.output, '青い円を描く'], f.env);

  assert.equal(result.status, 0, result.stderr);
  const codexArgs = argsFromLog(codexArgsLog);
  const configs = codexArgs.filter((_, i) => codexArgs[i - 1] === '-c');
  assert.deepEqual(configs, [
    'features.plugins=false',
    'mcp_servers.node_repl.enabled=false',
    'mcp_servers.Context7.enabled=false',
  ]);
});

// 止める MCP を確定できないときは Codex を動かさず (fail-closed)、フォールバックへ回す
for (const [label, mcpList, extraEnv = {}] of [
  ['the MCP server list is not JSON', 'not json'],
  ['an enabled MCP server name cannot be disabled via -c', JSON.stringify([{ name: 'bad.name', enabled: true }])],
  ['listing the MCP servers times out', '[]', { FAKE_MCP_SLEEP: '5', CODEX_IMAGEN_MCP_LIST_TIMEOUT: '1' }],
]) {
  test(`Codex path is skipped when ${label}`, t => {
    const f = fixture();
    t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
    const codexArgsLog = useSucceedingCodex(f);
    f.env.FAKE_MCP_LIST = mcpList;
    Object.assign(f.env, extraEnv);

    const result = run(codexImagen, [f.output, '青い円を描く'], f.env);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /skipping codex path/);
    assert.equal(fs.existsSync(codexArgsLog), false, 'codex exec must not run');
    assert.deepEqual(fs.readFileSync(f.orderLog, 'utf8').trim().split('\n'), ['grok']);
    const summary = imagenResult(result.stderr);
    assert.equal(summary.status, 'ok');
    assert.deepEqual(summary.providers.map(p => [p.name, p.status, p.reason]).slice(0, 1), [['codex', 'skipped', 'mcp_unverified']]);
    assert.equal(summary.providers[1].name, 'grok');
  });
}

test('Codex edit prompt keeps the edit verb and the input image path', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const codexArgsLog = useSucceedingCodex(f);
  const input = path.join(f.dir, 'input.png');
  fs.writeFileSync(input, 'fake input');

  const result = run(codexImagen, [f.output, '円を赤くする', input], f.env);

  assert.equal(result.status, 0, result.stderr);
  const prompt = argsFromLog(codexArgsLog).at(-1);
  assert.match(prompt, /画像を編集します/);
  assert.ok(prompt.includes(`入力画像: ${input}`), prompt);
});
