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

/**
 * fixture の getBook (GET /books/{id}、ボディ無し) に 401 / 404 / 500 の応答と、operation の追記 (x-test-requests 等) を足した契約を作る。
 * opExtra は `      summary: 書籍を照会する\n` の直後に挿す YAML (6 桁字下げ)、docExtra は paths: の直前に挿す YAML。
 */
function contractsWithGetBookErrors({ opExtra = '', docExtra = '' } = {}) {
  const fresh = freshContracts();
  const oa = path.join(fresh.contractsDir, 'openapi', 'openapi.yaml');
  const problem = (status, name) => [
    `        '${status}':`, `          description: e${status}`, '          content:', '            application/problem+json:',
    '              schema:', "                $ref: '#/components/schemas/Problem'", '              examples:',
    `                ${name}:`, '                  value:', '                    code: CONFLICT', '',
  ].join('\n');
  let y = fs.readFileSync(oa, 'utf8');
  y = y.replace('                    title: Refactoring\n', '                    title: Refactoring\n'
    + problem(401, 'unauthorized') + problem(404, 'not_found') + problem(500, 'broken'));
  y = y.replace('      summary: 書籍を照会する\n', `      summary: 書籍を照会する\n${opExtra}`);
  y = y.replace('paths:\n', `${docExtra}paths:\n`);
  fs.writeFileSync(oa, y);
  return fresh;
}

module.exports = { FIXTURES, SCRIPTS, CONFIG, freshContracts, outRoot, contractsWithGetBookErrors };
