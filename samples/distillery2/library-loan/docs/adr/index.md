---
basis: requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518
---

# アーキテクチャ決定記録 (ADR) 一覧

決定から描いた C4 図: [architecture.md](architecture.md)

| 番号 | タイトル | ステータス | supersedes | superseded_by |
|------|---------|-----------|-----------|---------------|
| [0001](0001-tier-structure.md) | frontend・backend-api・worker の 3 ティア構成とし、backend-api を業務モジュールで分けたモジュラモノリスにする | accepted | - | - |
| [0002](0002-language-and-framework.md) | 全ティアを TypeScript で書き、HTTP サーバーの具体的なフレームワークは段階③で契約生成との相性から選ぶ | accepted | - | - |
| [0003](0003-layering.md) | backend-api は 5 層、frontend は 3 層、worker は 2 層とし、内側へ向かう依存だけを許す | accepted | - | - |
| [0004](0004-datastore-and-migration.md) | データは単一の RDB に置き、状態を持つ書籍・貸出・予約は追記型のイベントとスナップショットで保持する | accepted | - | - |
| [0005](0005-messaging.md) | メッセージブローカーと AsyncAPI は使わず、通知は RDB の送信待ち記録 (outbox) と worker の定期起動で送る | accepted | - | - |
| [0006](0006-authn-authz.md) | 認証は OIDC 準拠の IdP に委ね、認可は司書・利用者のロールと本人確認 (所有者チェック) を backend-api の usecase で判定する | accepted | - | - |
| [0007](0007-testing-strategy.md) | 受入・UC BDD・契約・単体の 4 段でテストし、受入は API ドライバで実行する (ブラウザドライバは使わない) | accepted | - | - |
| [0008](0008-ui-components.md) | 単一の React SPA とし、共通 UI 部品を packages/ui に集約する。ブランドは RDRA から推論した落ち着いた青と緑を仮置きする | accepted | - | - |
