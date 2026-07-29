# impl-config.yaml の backend_framework: express が未インストールで write-set 外

## 仕様の記載

`docs/impl/latest/impl-config.yaml` の `tiers[].commands` / トップレベル `backend_framework: express`
(コメント「ユーザー確定 2026-07-29(arch は TS/Next.js のみ指定、API 層は Express)」)。

## 実装で判明した事実

- ワークスペース(リポルート `package-lock.json` / `node_modules`)に `express` / `@types/express` は
  未インストール(`npm ls express` は空)。
- npm workspaces は単一の共有ロックファイル(リポルート `package-lock.json`)を使うため、
  `express` を追加するには `npm install` でこのロックファイルを更新する必要がある。
- 本 Implementer(tier-backend-api)の write-set は `backend-api/` 配下 + 指定の
  done/issues パスに限定されており、リポルートの `package-lock.json` は対象外。
- さらに本セッションでは tier-frontend の S4 Implementer(`s4-frontend-a1`)が並走しており、
  共有ロックファイルへの同時書き込みは競合・破損リスクがある。

## 対応

express パッケージへの依存を避け、Node.js 標準の `node:http` モジュールで HTTP サーバーを実装した
(`backend-api/src/http/server.ts`)。ルーティング粒度を単一エンドポイントに絞り、リクエスト解析/
ハンドラ選択/レスポンス整形を薄い層に分離してあるため、express 導入時の置き換えコストは小さい。

## 提案

- オーケストレータ側で tier barrier 後に単一 writer として `express` / `@types/express` を
  `backend-api/package.json` の dependency として追加し、`npm install` を実行する
  (もしくは S0/S3 相当の共有セットアップ工程で先に全 tier の依存を確定させる)。
- 追加後、`backend-api/src/http/server.ts` を express の `Router` ベースに置き換える
  (`loansController.ts` のハンドラ本体はそのまま流用可能)。

## 解消(attempt-2)

オーケストレータが `backend-api/package.json` に `express`(dependencies)/ `@types/express`
(devDependencies)を追加し、ワークスペース共有 `node_modules` にインストール済みであることを確認した。
`backend-api/src/http/server.ts` を `node:http` から express の `Router` ベースへ置き換え済み
(`loansController.ts` のハンドラ本体は無変更で流用)。本 issue はクローズ扱いとする。
