# learning: impl-config.yaml で確定したフレームワーク依存が、write-set分離により追加できない

## 何が起きたか

`impl-config.yaml` は `backend_framework: express`(ユーザー確定済み)としていたが、
attempt-1 の時点でワークスペースに `express` / `@types/express` がインストールされておらず、
tier-backend-api の Implementer(S4)はこれを追加できなかった。やむを得ず Node.js標準の
`node:http` で HTTP サーバーを暫定実装し、attempt-2 でオーケストレータが依存追加を行ってから
express の Router ベースへ置き換えた。

## なぜ(根本原因)

- npm workspaces は単一の共有ロックファイル(リポルート `package-lock.json`)を使うため、
  `express` を追加するには `npm install` でこの共有ファイルを更新する必要がある。
- 本 Implementer(tier-backend-api)の write-set は `backend-api/` 配下 + 指定の done/issues
  パスに限定されており、リポルートの `package-lock.json` は対象外(意図的な隔離)。
- さらに同一セッション内で tier-frontend の S4 Implementer が並走しており、共有ロックファイルへの
  同時書き込みは競合・破損リスクがある。つまり「tier ごとに write-set を隔離する」設計と
  「新規依存はロックファイルという単一の共有リソースを更新する必要がある」設計が正面から衝突する。

## どう回避したか

attempt-1: `node:http` でルーティング粒度を単一エンドポイントに絞った暫定実装にし、
ハンドラ本体(`loansController.ts`)は express 非依存の形で薄い層に分離しておいた。
attempt-2: オーケストレータが tier barrier 後の単一 writer として `backend-api/package.json` に
`express`/`@types/express` を追加し `npm install` を実行、その後 Implementer が `server.ts` を
express の `Router` ベースへ置き換えた(ハンドラ本体は無変更で流用できたため置き換えコストは小さかった)。

## 次回どうすべきか

`impl-config.yaml` で確定した各tierのフレームワーク依存(`backend_framework` 等)は、
S0 bootstrap または S3(共有セットアップ)の時点で、全tierの依存を一括で `package.json` に追加し
`npm install` まで完了させておく。tier並走のS4に依存追加を委ねると、write-set分離との衝突で
毎回同じ回避策(標準ライブラリでの暫定実装→後から置き換え)が必要になる。
