# 契約 codegen 正本(distillery-impl)

契約駆動の入口。`_cross-cutting/api/openapi.yaml`(+ 条件付きで `asyncapi.yaml`)から型・クライアント・
スタブを生成し、`packages/contracts/` に置く。実装は生成物を起点に書く(直接編集禁止)。

## 検証済みの実行方法(スパイク 2026-07-29)

### openapi(必須入力)

```bash
npx -y @openapitools/openapi-generator-cli generate \
  -i {specs_root}/specs/latest/_cross-cutting/api/openapi.yaml \
  -g {generator} -o packages/contracts/{出力先}
```

- **検証済み**: samples の openapi.yaml(OpenAPI 3.1)で typescript-fetch 生成成功。
  日本語 description は JSDoc コメントとして生存する
- **前提**: Java ランタイム必須(openapi-generator は Java 製。スパイク環境は OpenJDK 25 で確認)。
  bootstrap の preflight で `java -version` を確認し、無ければ縮退モードへ
- **既知の問題**: openapi.yaml の enum 値にキー欠落があると、生成 TS(DefaultApi.ts /
  Create・UpdateBookRequest / Create・UpdateUserRequest 等)が構文エラーになり barrel import が
  全滅する(両 tier が独立検出)。回避策は models/ 個別 import + 迂回クライアント。根本対応は
  dist-spec への変更要求(x-enum-varnames の付与)

generator 選択表(impl-config の tier lang から解決):

| 用途 | typescript | python | java/kotlin |
|---|---|---|---|
| api-types + api-client(frontend) | typescript-fetch | python | java(webclient) |
| server-stubs(backend) | typescript-node(または使用 FW 用) | python-fastapi | spring |

## asyncapi(has_asyncapi の場合のみ)

```bash
npx -y @asyncapi/cli generate models {lang} \
  {specs_root}/specs/latest/_cross-cutting/api/asyncapi.yaml \
  -o packages/contracts/async-types
```

- **検証済み**: 生成は成功する。ただし既知の問題 2 点:
  1. **npx キャッシュ破損で MODULE_NOT_FOUND になることがある** → `~/.npm/_npx/` の該当ハッシュを削除して再実行(スパイクで再現・解消を確認)
  2. **payload スキーマに title が無いと `AnonymousSchema_N` という無名モデルになる**(message レベルの
     name/title は使われない)。サンプル仕様がこの状態 → dist-spec への変更要求(payload title 付与)を起票し、
     当面は生成後に message 名との対応表を README コメントで補うか、縮退モードを使う

## 縮退モード(generator が使えない場合)

Java 不在・generator 失敗・無名スキーマ問題が実用に耐えない場合は、**機械可読で最も堅い
`_api-summary.yaml` / `_model-summary.yaml`(JSON Schema 検証済み)から型定義を手書き生成**する:

- `_api-summary.yaml` の `endpoints[]`(method/path/request_schema/response_schema)と `schemas[]` → 型 + 薄いクライアント
- `async_events[]` → イベント型(asyncapi 縮退)
- 縮退モードで生成したファイルには `// degraded-codegen: from _api-summary.yaml` ヘッダを付け、
  contracts.lock.yaml の generator 欄に `degraded` と記録する

## contracts.lock.yaml の運用

1. 生成前に入力(openapi.yaml / asyncapi.yaml)の sha256 を取る
2. 生成後、`inputs` + `generated`(出力 dir・generator 名・日時)を lock に記録
3. S3 では lock の sha256 と現物を照合。一致 → skip / 不一致 → 再生成して lock 更新
4. `packages/contracts/` は S4(tier 並走)中 read-only。Implementer が書き換えたら write-set 違反として失敗させる
