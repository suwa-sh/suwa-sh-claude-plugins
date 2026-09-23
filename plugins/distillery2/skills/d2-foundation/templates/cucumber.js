/**
 * cucumber.js — Cucumber 設定 (d2-foundation テンプレート → リポルートに置く)
 *
 * paths: features/**\/*.feature、support と step_definitions を require、TS は ts-node/register。
 * format は既定 summary。JSON レポートは CLI から `--format json:<path>` で足す
 * (runGates.js が uc_bdd / acceptance コマンドで付与する)。
 *
 * 参照 (Context7 /cucumber/cucumber-js v13.2.1): module.exports の default プロファイル。
 */
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['ts-node/register'],
    require: ['features/support/**/*.ts', 'features/step_definitions/**/*.ts'],
    format: ['summary'],
    formatOptions: { snippetInterface: 'async-await' },
  },
};
