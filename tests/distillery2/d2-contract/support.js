'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIXTURES = path.resolve(__dirname, 'fixtures');
const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-contract/scripts');
const CONFIG = path.join(FIXTURES, 'config.yaml');

/** fixtures/contracts を一時ディレクトリへ複製し、そのパスを返す。 */
function freshContracts() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-contract-'));
  fs.cpSync(path.join(FIXTURES, 'contracts'), path.join(work, 'contracts'), { recursive: true });
  return { work, contractsDir: path.join(work, 'contracts') };
}

function outRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-out-')); }

module.exports = { FIXTURES, SCRIPTS, CONFIG, freshContracts, outRoot };
