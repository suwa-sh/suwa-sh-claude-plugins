/**
 * cucumber.js — Cucumber 設定 (d2-foundation テンプレート → リポルートに置く)
 *
 * リポルートの package.json は "type": "module" なので、この設定も ESM (export default) で書く。
 * CJS の module.exports は ES module scope で「module is not defined」になるため使わない。
 *
 * ESM の設定形 (Context7 /cucumber/cucumber-js v13):
 *   - default export が **既定プロファイルそのもの**。`export default { paths, import, ... }` と書く。
 *     `export default { default: {...} }` のように包むと、`default` という名のキーが余計に増えて誤り。
 *   - 追加プロファイルは **名前付き export**。`export const dryrun = {...}` を `cucumber-js -p dryrun` で使う。
 *
 * paths: features/**\/*.feature。
 * import: TypeScript の on-the-fly トランスパイルは tsx で行う。
 *   先頭の ./tsx-register.js が tsx/esm/api の register() を呼び、以降の *.ts を読み込めるようにする
 *   (genTestSupport.js が tsx-register.js をリポルートへ展開し、genSkeleton.js が tsx を devDependencies に入れる)。
 * format は既定 summary。JSON レポートは CLI から `--format json:<path>` で足す
 * (runGates.js が uc_bdd / acceptance コマンドで付与する)。
 */
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

/**
 * dryrun プロファイル — 実装アプリが未生成でも `cucumber-js --dry-run -p dryrun` が通るようにする。
 *
 * world.ts は api ドライバ (drivers/api.ts) 経由で `apps/<backend>/src/test-app` を import するため、
 * アプリが無い段階で読み込むと解決に失敗する。dryrun は **アプリを読まない** support (hooks.ts) と
 * step_definitions だけを import する。dry-run は step との結線を検査するだけで step 本体は実行しないので、
 * World コンストラクタ (world.ts) を読み込まなくても検査できる。
 */
export const dryrun = {
  paths: ['features/**/*.feature'],
  import: [
    './tsx-register.js',
    'features/support/hooks.ts',
    'features/step_definitions/**/*.ts',
  ],
  format: ['summary'],
  formatOptions: { snippetInterface: 'async-await' },
};
