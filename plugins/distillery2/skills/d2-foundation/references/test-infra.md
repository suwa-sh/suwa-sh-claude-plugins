# テスト基盤で使うライブラリ (検証済みバージョンと API)

F3 のテンプレートと F5 の生成 `package.json` が依存するライブラリ。API は Context7 で公式ドキュメントを確認した
(2026-09-23 時点)。生成 `package.json` は caret 範囲で入れる。

| ライブラリ | 検証バージョン | Context7 で確認したこと |
|---|---|---|
| `@cucumber/cucumber` | 13.2.1 | `setWorldConstructor(World 継承クラス)`、`Before/After(hook => …)`、`cucumber.js` の default プロファイル (`paths` / `require` / `requireModule` / `format`)、CLI `--format json:<path>` |
| `@electric-sql/pglite` | 0.5.8 | `new PGlite()` → `await pg.waitReady`、`pg.exec(multiStatementSql)` (migration 向け)、`pg.query(text, params)`、`pg.transaction(fn)` (例外で rollback)、`pg.close()` |
| `dependency-cruiser` | 18.4.0 | `.cjs` は `module.exports = { forbidden, allowed?, options }`。forbidden[].{name, severity, from:{path 正規表現}, to:{path|circular|orphan}}。`options.doNotFollow.path`、`options.tsConfig.fileName` |
| `vitest` | 3.2.x (系) | 単体テストランナ。`--run --reporter=json --outputFile=<path>` で JSON レポート |
| `supertest` | 7.3.0 | `request(app).<method>(path).set().send()` で composition root を叩く |
| `@playwright/test` | 1.63.0 | @browser 受入用。ライブラリとして `chromium.launch()` (イテレーション 1 はスタブ) |
| `ajv` + `ajv-formats` | 8.20.0 / 3.0.1 | 契約テスト (F4, d2-contract) の JSON Schema 検証。2020-12 |
| `typescript` | 5.9.x (系) | tsconfig.base.json は `module: ESNext` / `moduleResolution: bundler` |

## 決めたこと

- **DB 隔離はトランザクション rollback** (pglite-harness.ts)。スキーマ再作成より速く migration の再適用が要らない。
  pglite は単一プロセスの埋め込み DB なのでテストは直列。並列が必要になったらインスタンス分離 + schema 隔離へ。
- **トレースは in-process のみ** (supertest 経由)。out-of-process の AsyncAPI トレースは次イテレーション。
- **ブラウザは opt-in**。`capabilities.browser: false` の間は BrowserDriver はスタブ。別ディレクトリの e2e spec は作らない。

## v1 から落としたもの (理由 1 行)

- **ティア BDD (第 3 段)**: 契約から生成する契約テストに置換 (`{tier_dir}/features/` を作らない)。
- **events/ + latest/ + status/lease/NEXT**: 履歴は Git、実行状態は `.distillery/runs/`、下流は `basis:` ヘッダ。
- **impl-config の specs_root / repo_root 分離**: docs と実装コードを同一リポに置く。
- **qlty / biome の焼き込み**: 生成は formatter / linter をプロジェクト側の npm scripts に委ね、config は最小。
- **DOM snapshot / capture_review / ui_review capability**: 受入の `@browser` シナリオに集約。
