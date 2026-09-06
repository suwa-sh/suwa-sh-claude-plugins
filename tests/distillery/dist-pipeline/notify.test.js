'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  buildAppleScript,
  buildPowerShellScript,
  commandsFor,
  notify,
  sanitize,
} = require('../../../plugins/distillery/skills/dist-pipeline/scripts/notify');

const SCRIPT = path.join(__dirname, '../../../plugins/distillery/skills/dist-pipeline', 'scripts', 'notify.js');

test('sanitize collapses control characters', () => {
  assert.equal(sanitize('a\nb\tc'), 'a b c');
  assert.equal(sanitize('  trimmed  '), 'trimmed');
});

test('buildAppleScript quotes title and body safely', () => {
  const script = buildAppleScript('ti"tle', 'bo\\dy');
  assert.equal(
    script,
    'display notification "bo\\\\dy" with title "ti\\"tle" sound name "Glass"'
  );
});

test('buildPowerShellScript escapes single quotes', () => {
  const script = buildPowerShellScript("it's", 'body');
  assert.match(script, /ShowBalloonTip\(5000, 'it''s', 'body',/);
  assert.match(script, /SystemSounds/);
});

test('commandsFor darwin uses osascript', () => {
  const cmds = commandsFor('darwin', 't', 'b');
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].cmd, 'osascript');
  assert.equal(cmds[0].args[0], '-e');
});

test('commandsFor win32 uses powershell', () => {
  const cmds = commandsFor('win32', 't', 'b');
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].cmd, 'powershell');
  assert.deepEqual(cmds[0].args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
});

test('commandsFor linux uses notify-send and paplay', () => {
  const cmds = commandsFor('linux', 't', 'b');
  assert.deepEqual(
    cmds.map((c) => c.cmd),
    ['notify-send', 'paplay']
  );
  assert.deepEqual(cmds[0].args, ['t', 'b']);
});

test('commandsFor unknown platform returns no commands', () => {
  assert.deepEqual(commandsFor('sunos', 't', 'b'), []);
});

test('notify is a no-op on unsupported platforms', () => {
  let called = false;
  const sent = notify('t', 'b', 'sunos', () => {
    called = true;
  });
  assert.equal(sent, false);
  assert.equal(called, false);
});

test('notify keeps going when one command fails (linux)', () => {
  const calls = [];
  const sent = notify('t', 'b', 'linux', (cmd) => {
    calls.push(cmd);
    if (cmd === 'notify-send') throw new Error('not installed');
  });
  assert.equal(sent, true); // paplay は成功扱い
  assert.deepEqual(calls, ['notify-send', 'paplay']);
});

test('notify invokes osascript on darwin', () => {
  const calls = [];
  const sent = notify('t', 'b', 'darwin', (cmd, args) => {
    calls.push([cmd, args]);
  });
  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'osascript');
});

test('CLI always exits 0 even when notification fails', () => {
  const result = spawnSync(process.execPath, [SCRIPT, 'title', 'body'], {
    env: { ...process.env, PATH: '/nonexistent' },
  });
  assert.equal(result.status, 0);
});
