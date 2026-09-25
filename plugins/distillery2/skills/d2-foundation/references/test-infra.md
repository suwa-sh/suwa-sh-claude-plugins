# テスト基盤で使うライブラリ (検証済みバージョンと API)

F3 のテンプレートと F5 の生成 `package.json` が依存するライブラリ。API は Context7 で公式ドキュメントを確認した
(2026-09-23 時点)。生成 `package.json` は caret 範囲で入れる。

| ライブラリ | 検証バージョン | Context7 で確認したこと |
|---|---|---|
| `@cucumber/cucumber` | 13.2.1 | `setWorldConstructor(World 継承クラス)`、`Before/After(hook => …)`、ESM プロジェクト (`"type":"module"`) では `cucumber.js` の default export が **既定プロファイルそのもの** (`export default { paths, import, ... }`。`{ default: {...} }` で包まない)、名前付き export が追加プロファイル (`export const dryrun = {...}` を `-p dryrun` で使う)、TypeScript は `import` オプション + `tsx` で読む (`requireModule: ts-node/register` は使わない)、CLI `--format json:<path>` |
| `@biomejs/biome` | 2.2.x (系) | formatter / linter。ルート `biome.json` (`formatter.enabled` / `linter.rules.recommended`)。`biome format .` (差分を検査)、`biome lint .`、`biome format --write .` (整形)。各 app と root の `format:check` / `lint` script はこれを呼ぶ |
| `@redocly/cli` | 2.4.x (系) | OpenAPI の bundle / lint (d2-contract compileContracts が使う)。root devDependencies に必須 (無いと最初の compileContracts が exit 1) |
| `@apidevtools/json-schema-ref-parser` | 15.1.x (系) | 契約 codegen で `$ref` を解決して 1 枚のスキーマに束ねる |
| `tsx` | 4.20.x (系) | Cucumber の ESM TypeScript ローダ。`tsx-register.js` が `import { register } from 'tsx/esm/api'; register()` を呼び、`cucumber.js` の `import: ['./tsx-register.js', 'features/**/*.ts']` で登録する |
| `@electric-sql/pglite` | 0.5.8 | `new PGlite()` → `await pg.waitReady`、`pg.exec(multiStatementSql)` (migration 向け)、`pg.query(text, params)`、`pg.transaction(fn)` (例外で rollback)、`pg.close()` |
| `dependency-cruiser` | 18.4.0 | `.cjs` は `module.exports = { forbidden, allowed?, options }`。forbidden[].{name, severity, from:{path 正規表現}, to:{path|circular|orphan}}。`options.doNotFollow.path`、`options.tsConfig.fileName` |
| `vitest` | 3.2.x (系) | 単体テストランナ。`--run --reporter=json --outputFile=<path>` で JSON レポート |
| `supertest` | 7.3.0 | `request(app).<method>(path).set().send()` で composition root を叩く |
| `@playwright/test` | 1.63.0 | @browser 受入用。ライブラリとして `chromium.launch()` (現版はスタブ) |
| `ajv` + `ajv-formats` | 8.20.0 / 3.0.1 | 契約テスト (F4, d2-contract) の JSON Schema 検証。2020-12 |
| `typescript` | 5.9.x (系) | tsconfig.base.json は `module: ESNext` / `moduleResolution: bundler`。各 app の `tsconfig.json` は base を継承し (`typecheck` = `tsc --noEmit -p .`)、frontend は `jsx: react-jsx` |
| `react` / `react-dom` / `@types/react` | 19.2.x (系) | frontend ティアがある時だけ root devDependencies に追加。TSX と jsdom 上の単体テストで使う |

## 生成される依存とスクリプト (genSkeleton)

- **root `package.json` devDependencies** (常時): `@biomejs/biome` / `@cucumber/cucumber` / `@electric-sql/pglite` / `@redocly/cli` / `@apidevtools/json-schema-ref-parser` / `dependency-cruiser` / `vitest` / `supertest` / `@types/supertest` / `@playwright/test` / `ajv` / `ajv-formats` / `tsx` / `typescript`。frontend ティアがあれば `react` / `react-dom` / `@types/react` / `@types/react-dom` を追加。
- **各 app `package.json` scripts** (実コマンド。echo プレースホルダは廃止): `test` = `vitest run` / `typecheck` = `tsc --noEmit -p .` / `lint` = `biome lint .` / `format:check` = `biome format .` / `test:contract` = `vitest run test/contract`。
- **各 app に生成**: `tsconfig.json` (base 継承、frontend は jsx 有効) と最小 `vitest.config.ts` (frontend は `environment: jsdom` + 自動 JSX)。
- **root に生成**: `biome.json` (formatter / linter 有効)。

## 決めたこと

- **DB 隔離はトランザクション rollback** (pglite-harness.ts)。スキーマ再作成より速く migration の再適用が要らない。
  pglite は単一プロセスの埋め込み DB なのでテストは直列。並列が必要になったらインスタンス分離 + schema 隔離へ。
- **トレースは in-process のみ** (supertest 経由)。out-of-process の AsyncAPI トレースは未対応。
- **ブラウザは opt-in**。`capabilities.browser: false` の間は BrowserDriver はスタブ。別ディレクトリの e2e spec は作らない。

## v1 から落としたもの (理由 1 行)

- **ティア BDD (第 3 段)**: 契約から生成する契約テストに置換 (`{tier_dir}/features/` を作らない)。
- **events/ + latest/ + status/lease/NEXT**: 履歴は Git、実行状態は `.distillery/runs/`、下流は `basis:` ヘッダ。
- **impl-config の specs_root / repo_root 分離**: docs と実装コードを同一リポに置く。
- **qlty の焼き込み** (0.1.11〜): `genSkeleton.js` が `.qlty/qlty.toml` を生成する (plugins: biome / radarlint-js / actionlint / zizmor / trufflehog / osv-scanner。
  生成物・vendored は `exclude_patterns`、コードスメルは `[[triage]]` で low)。ゲートは `.distillery/config.yaml` の `commands.quality` =
  `qlty check --all --no-fix --no-progress --no-upgrade-check --no-formatters --fail-level medium` で、static ゲートと CI がリポ全体で 1 回回す。
  各ティアの `format:check` / `lint` (biome) は実装者の手元の速い検査として残す。**`qlty check --fix` は使わない** (formatter がリポ全体に
  適用され、修正候補の位置ずれで識別子が壊れる実績)。整形は `qlty fmt --all`。ルール単位の無視は `[[ignore]]` / `[[triage]]` で書き、
  `[[exclude]]` に `rules` は書かない (そのパスでプラグイン全体が外れる)。qlty CLI は対象マシンに要インストール (公式の install script。CI は `qltysh/qlty-action/install`)。
  仕様の正本は https://docs.qlty.sh/cli/qlty-toml (要約に頼らず使い捨てコピーで実測する)。
- **DOM snapshot / capture_review / ui_review capability**: 受入の `@browser` シナリオに集約。
