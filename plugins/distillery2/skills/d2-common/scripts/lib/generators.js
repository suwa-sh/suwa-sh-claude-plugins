'use strict';
/**
 * generators.js — 作り直せる生成物の表 (正本。0.3.0)
 *
 * 正本 (入力) から決定論で作り直せる生成物と、その作り直しのコマンド・鮮度の検査 (--check) を 1 か所に持つ。
 * 使う側:
 *   - resumeAfterUpstream.js (写し直し): 統合で衝突した生成物は main の側を採り、機能が変えていた生成物を作り直す (outputs と gen)
 *   - genCheck.js が作る一括チェック scripts/check.mjs の generate: 鮮度を確かめる (check)。hook モードは入力 (inputs) か出力がコミットに入る項目だけ
 * 契約の分割ファイル (contracts/openapi/** など) は正本なので outputs に入れない。
 * コマンドの '<skills>' はスキル群のディレクトリに置き換える。cwd はリポのルート。順に回す (README は最後)
 */

const GENERATORS = [
  {
    id: 'contracts',
    outputs: [/^contracts\/generated\//, /^apps\/[^/]+\/test\/contract\//, /^packages\/contracts\/[^/]+\/stubs\//, /^packages\/contracts\/[^/]+\/validators\.ts$/],
    inputs: [/^contracts\/(?!generated\/)/, /^\.distillery\/config\.yaml$/],
    needs: 'contracts/contracts.json',
    gen: [
      ['<skills>/d2-contract/scripts/compileContracts.js', 'contracts'],
      ['<skills>/d2-contract/scripts/compileRdbSchema.js', 'contracts'],
      ['<skills>/d2-contract/scripts/genContractTests.js', 'contracts', '--config', '.distillery/config.yaml', '--out-root', '.'],
    ],
    check: [
      ['<skills>/d2-contract/scripts/compileContracts.js', 'contracts', '--check'],
      ['<skills>/d2-contract/scripts/compileRdbSchema.js', 'contracts', '--check'],
      ['<skills>/d2-contract/scripts/genContractTests.js', 'contracts', '--config', '.distillery/config.yaml', '--out-root', '.', '--check'],
    ],
  },
  {
    id: 'rules',
    outputs: [/^docs\/rules\//],
    inputs: [/^docs\/adr\/\d[^/]*\.md$/],
    needs: 'docs/adr',
    gen: [['<skills>/d2-foundation/scripts/genRules.js', '--adr', 'docs/adr', '--out', 'docs/rules', '--cwd', '.']],
    check: [['<skills>/d2-foundation/scripts/genRules.js', '--adr', 'docs/adr', '--out', 'docs/rules', '--cwd', '.', '--check']],
  },
  {
    id: 'arch-tests',
    outputs: [/^\.dependency-cruiser\.cjs$/],
    inputs: [/^docs\/adr\/\d[^/]*\.md$/],
    needs: 'docs/adr',
    gen: [['<skills>/d2-foundation/scripts/genArchTests.js', '--adr', 'docs/adr', '--out', '.dependency-cruiser.cjs', '--cwd', '.']],
    check: [['<skills>/d2-foundation/scripts/genArchTests.js', '--adr', 'docs/adr', '--out', '.dependency-cruiser.cjs', '--cwd', '.', '--check']],
  },
  {
    id: 'adr-index',
    outputs: [/^docs\/adr\/index\.md$/],
    inputs: [/^docs\/adr\/\d[^/]*\.md$/],
    needs: 'docs/adr',
    gen: [['<skills>/d2-decide/scripts/genAdrIndex.js', 'docs/adr', 'docs/adr/index.md', 'requirements=docs/requirements']],
    check: [['<skills>/d2-decide/scripts/genAdrIndex.js', 'docs/adr', 'docs/adr/index.md', 'requirements=docs/requirements', '--check']],
  },
  {
    id: 'check-script',
    required: true, // config が無ければ一括チェックの鮮度を確かめられない (飛ばさずに落とす)
    outputs: [/^scripts\/check\.mjs$/, /^\.githooks\/commit-msg$/],
    inputs: [/^\.distillery\/config\.yaml$/],
    needs: '.distillery/config.yaml',
    gen: [['<skills>/d2-foundation/scripts/genCheck.js', '--cwd', '.']],
    check: [['<skills>/d2-foundation/scripts/genCheck.js', '--cwd', '.', '--check']],
  },
  {
    id: 'docs-readme',
    outputs: [/^docs\/README\.md$/, /^docs\/feedback\/README\.md$/],
    // 入口の README は要求・決定・契約・シナリオ・as-built・課題の一覧から作る
    inputs: [/^docs\//, /^features\//, /^contracts\/(contracts\.json|uc-index\.yaml)$/, /^\.distillery\/config\.yaml$/],
    needs: 'docs',
    gen: [['<skills>/d2-common/scripts/genDocsReadme.js', '--cwd', '.']],
    check: [['<skills>/d2-common/scripts/genDocsReadme.js', '--cwd', '.', '--check']],
  },
];

const matches = (res, p) => res.some((re) => re.test(p));
const isOutput = (p, table = GENERATORS) => table.some((e) => matches(e.outputs, p));
/** パスの一覧のどれかが入力か出力に当たる項目 (hook モードの範囲・写し直しの作り直しの範囲) */
function touched(paths, table = GENERATORS) {
  return table.filter((e) => paths.some((p) => matches(e.outputs, p) || matches(e.inputs, p)));
}
const resolveCmd = (cmd, skillsRoot) => cmd.map((a) => a.replace('<skills>', skillsRoot));

module.exports = { GENERATORS, isOutput, touched, resolveCmd, matches };
