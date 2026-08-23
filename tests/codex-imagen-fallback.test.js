'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, 'plugins/toolbox/skills/codex-imagen/scripts');
const codexImagen = path.join(scriptsDir, 'codex-imagen.sh');
const grokImagen = path.join(scriptsDir, 'grok-imagen.sh');

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
