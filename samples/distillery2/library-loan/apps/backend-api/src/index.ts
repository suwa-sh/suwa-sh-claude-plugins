/** backend-api の公開入口。本番の起動処理 (HTTP サーバーの listen・DB 接続・OIDC 検証器) は結線する UC で追加する */
export { type AppDeps, createApp, type Decorate, type Layer } from './app';
