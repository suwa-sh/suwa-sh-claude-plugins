# mode=tier: ティア実装 (固定指示)

1 ティア分を単体 TDD で実装し、静的・単体ゲートを通す。仕様に無くて自分で決めたことは AssumptionRecord に書く。
ティア並列で動くので、自ティアの write-set から出ない。

## 読むもの (read-set。これ以外は読まない)

| 種類 | パス |
|---|---|
| ルール | `docs/rules/common.md`、`docs/rules/tier-<kind>.md`、`docs/rules/testing.md` (`index.md` から辿る) |
| シナリオ | `features/<業務>/<slug>.feature` (自ティアが担う step を知る) |
| 契約 | `contracts/generated/slices/<slug>/contract-slice.json`、`rdb-slice.yaml`。生成物 `packages/contracts/<id>/` のうち自ティアが provider / consumer の契約 |
| 契約型・クライアント | **consumer (frontend 等)** は `packages/contracts/<id>/client.ts` (operationId ごとの型付き fetch 関数) を import して API を呼ぶ (URL・型を手書きしない)。**provider (backend)** は `packages/contracts/<id>/types.ts` (リクエスト/レスポンス型) と `server.ts` (operationId ↔ method/path 表) を import して経路と型を突き合わせる。いずれも genApiClient の生成物で、手で直さない |
| 要求 | `docs/requirements/use-cases.yaml` の該当行、`requirements.yaml` の spec_ids、RDRA の `条件.tsv` / `状態.tsv` の該当行 |
| 画面 (frontend) | `docs/design/screens.yaml` の該当画面、`packages/ui/` の部品と story |
| 足場 | 自ティアの test ファイル、`packages/test-support/README.md` |
| 指摘 (再実行時) | 引数で渡された `findings.<tier>.yaml` の blocker |

設計書・個別仕様書は存在しない。他ティアのコード、関与しない契約、契約 source の全量は読まない。

## 書くもの (write-set)

- `apps/<tier>/src/**` (実装とテスト)。frontend は `packages/ui` の部品だけを使う (自作しない)
- `.distillery/runs/<slug>/attempt-<n>/assumptions.<tier>.yaml` (0 件でも必ず)
- `.distillery/runs/<slug>/issues/<ts>_<slug>.md` (仕様と両立しない事実。front matter `kind: rule | contract | requirement`、`title` は 40 字以内 (as-built の課題の表に載る)。詳細は本文)
- backend の datastore_owner ティアは `apps/<tier>/migrations/` の追加 migration (契約の DB 変更に追随するときだけ。DDL 生成物は書き換えない)

## 進め方

1. 契約の生成型を起点に、ハンドラ / ユースケース / ドメイン / アダプタを `docs/rules/tier-<kind>.md` のレイヤ規約どおりに刻む。
   red → green → refactor。単体テストは振る舞い単位、I/O 実体はアダプタ層のテストだけ (pglite は test-support が起動する)
2. 提供側なら `apps/<tier>/src/test-app.ts` に `createTestApp()` を用意し、契約テストと UC BDD の API ドライバが同じ入口を使えるようにする
   (計装の結線は integrate 段階が行う。ここでは export だけ)。usecase / repository / gateway は **注入で差し替えられるオブジェクト**にする
   (integrate が `traced()` で包んで図の参加者にする)
3. frontend なら、画面の操作を **ブラウザ無しで呼べる入口関数** (例: `submitLoanCheckout(api, input)`) として export し、
   API 呼び出しは生成クライアントの `options.fetch` で差し替えられる形にする (UC BDD が in-process で画面 → API を通すため)
4. ゲートは自ティアに限定して check-only で回す: `format_check` / `lint` / `typecheck` / `unit` (`.distillery/config.yaml` の commands)。
   書き換えを伴う formatter は使わない (並列ティアの write-set を侵すため)
5. 自分で決めた判断を AssumptionRecord に書く (`references/assumption-record.md`)。書いたら
   `validateAssumptions.js record` を実行し ok を確認する
6. 契約テスト (`test/contract/`) は生成物。落ちるなら実装を直す。契約の側が間違っていると思うなら `issues/` に `kind: contract` で起票し、
   実装は契約どおりにする (「動くように契約と違うことをする」を禁止)

## 禁止

- `packages/contracts/` の生成物を手で直す
- 要求・シナリオ・契約と矛盾する実装で通す
- 他ティアのディレクトリ、features/、docs/、contracts/ への書き込み
- git 操作

## 報告

ゲート結果 (4 つ)、AssumptionRecord の件数と sha256、起票した issue、同じ失敗が 3 回続いた場合はその内容 (仕様疑義として)。
