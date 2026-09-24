---
basis: requirements@ca8f7fb28b2dc8ef6b6abfcee29c0898fa879a12
---

# アーキテクチャ決定記録 (ADR) 一覧

| 番号 | タイトル | ステータス | supersedes | superseded_by |
|------|---------|-----------|-----------|---------------|
| [0001](0001-tier-structure.md) | ティア構成は利用者向けフロント・司書向けフロント・backend-api・worker の 4 ティアとする | accepted | - | - |
| [0002](0002-language-and-framework.md) | 全ティアを TypeScript で実装し、フロントは SPA とする (サーバ側の HTTP フレームワークは未定) | accepted | - | - |
| [0003](0003-app-layers.md) | backend-api は 5 層、フロントは 2 層とし、依存は内側 (domain) に向ける | accepted | - | - |
| [0004](0004-datastore-and-migration.md) | データは単一の RDB に置き、状態を持つ情報はイベントとスナップショットで記録する | accepted | - | - |
| [0005](0005-messaging.md) | メッセージブローカーは置かず、通知は DB の送信待ちレコードを worker が送る (AsyncAPI は作らない) | accepted | - | - |
| [0006](0006-authn-authz.md) | 認証は OIDC 準拠の外部 IdP に委ね、認可はロールと本人確認を backend-api の usecase 層で行う | accepted | - | - |
| [0007](0007-testing-strategy.md) | テストは受入・UC BDD・契約・単体の 4 段とし、画面の受入はブラウザでも確かめる | accepted | - | - |
| [0008](0008-ui-components.md) | フロントは利用者向けと司書向けに分け、共通 UI 部品を packages/ui に持つ | accepted | - | - |
