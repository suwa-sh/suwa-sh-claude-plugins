/**
 * cucumber.js — Cucumber 設定 (d2-foundation テンプレート → リポルートに置く)
 *
 * リポルートの package.json は "type": "module" なので、この設定も ESM (export default) で書く。
 * CJS の module.exports は ES module scope で「module is not defined」になるため使わない。
 *
 * paths: features/**\/*.feature。
 * import: TypeScript の on-the-fly トランスパイルは tsx で行う。
 *   先頭の ./tsx-register.js が tsx/esm/api の register() を呼び、以降の *.ts を読み込めるようにする
 *   (genTestSupport.js が tsx-register.js をリポルートへ展開し、genSkeleton.js が tsx を devDependencies に入れる)。
 * format は既定 summary。JSON レポートは CLI から `--format json:<path>` で足す
 * (runGates.js が uc_bdd / acceptance コマンドで付与する)。
 *
 * 参照 (Context7 /cucumber/cucumber-js): ESM プロジェクトは `import` オプションで support を読み、
 * TypeScript は tsx を `tsx/esm/api` の register() で登録して `--import ./tsx-register.js` 相当を設定に書く。
 */
// ESM では default export そのものが default profile (Context7 /cucumber/cucumber-js docs/profiles.md)。
// `export default { default: {...} }` と書くと paths / import が読まれない。
export default {
  paths: ['features/**/*.feature'],
  import: [
    './tsx-register.js',
    'features/support/**/*.ts',
    'features/step_definitions/**/*.ts',
  ],
  format: ['summary'],
  formatOptions: { snippetInterface: 'async-await' },
};

// scaffold の red baseline 確認用 (`cucumber-js -p dryrun --dry-run`)。
// support は integrate 段階までテスト用アプリを import できないため読まない。
export const dryrun = {
  paths: ['features/**/*.feature'],
  import: ['./tsx-register.js', 'features/step_definitions/**/*.ts'],
  format: ['summary'],
};
