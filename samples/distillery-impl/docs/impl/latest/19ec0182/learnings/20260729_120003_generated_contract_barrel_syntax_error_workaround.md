# learning: 契約生成物(barrel)の構文エラーは「無編集で個別モデルを直接import」で複数tierが独立に回避できる

## 何が起きたか

`packages/contracts/{api-types,api-client}/apis/DefaultApi.ts` は `SearchBooksGenreEnum` の
生成コードが構文エラー(プロパティ名が空: `: '文学',`)を含んでおり、これをre-exportする
barrel(`apis/index.ts` → `packages/contracts/{api-types,api-client}/index.ts`)を import する
経路は、genreと無関係な `getBook`/`createLoan` を使う場合でも全て失敗する
(esbuildで `ERROR: Expected identifier but found ":"` を実測確認)。
backend-api(`booksController.ts`)・frontend(`loanConfirmationApiClient.ts`)の両方が、
異なるタイミング(backend-apiはattempt-3、frontendはattempt-1)でこの問題を独立に発見し、
それぞれ独立に同じ回避策にたどり着いた。

## なぜ(根本原因)

openapi.yaml の genre/material_type enumが数値キー+日本語ラベル(非ASCII)で定義されており、
openapi-generatorのenum変数名サニタイズが1件目のみ空文字列になる(2件目以降はフォールバックで
数値キーが振られる)。barrelは1ファイル単位でパースされるため、無関係な機能を使うだけでも
巻き添えで失敗する。

## どう回避したか

`docs/dev-rules/coding-rules.md` rule 1「契約型の直接編集禁止」に従い `packages/contracts/`
配下は一切編集せず、barrelを経由しない `runtime.ts` と `models/*.ts` の個別ファイルを直接import
することでコンパイルを回避した(`runtime.ts`・`models/*.ts` は個別ファイルとして独立にパース可能
なことを実測で確認済み)。fetch/axiosの直書きはせず、契約が定義するリクエスト内容
(path・method・header・body変換)を手書きで再現する迂回クライアント(`LoanConfirmationApiClient`、
`booksController.ts`)を実装した。

## 次回どうすべきか

- 契約生成物(openapi/asyncapi 由来)がbarrel単位で構文エラーを起こす場合、「無編集で個別
  モデルファイルを直接import」は複数tier・複数attemptで再現性のある有効な回避パターンである。
  同種の問題(barrel全体が壊れているが個別ファイルは壊れていない)に遭遇したら、まず
  個別ファイルのパース可否を実測確認してから回避方針を決めるとよい。
- ただし迂回クライアントは契約変更時に手動追従が必要な保守負債になる(S5 verifyでもminor
  findingとして継続記録された)。根本修正(openapi-generatorのenumPropertyNaming設定調整、
  またはopenapi.yamlへの`x-enum-varnames`追加)をS0/S3の契約再生成で行うことが望ましい
  (別途 change-request として起票済み)。
