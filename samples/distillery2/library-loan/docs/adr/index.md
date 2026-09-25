---
basis: requirements@4422a431dd381e737d643e7055432ad4b2330c9d
---

# アーキテクチャ決定記録 (ADR) 一覧

決定から描いた C4 図: [architecture.md](architecture.md)

| 番号 | タイトル | ステータス | supersedes | superseded_by |
|------|---------|-----------|-----------|---------------|
| [0001](0001-tier-structure.md) | frontend・backend-api・worker の 3 ティア構成とし、backend-api をモジュラモノリスにする | accepted | - | - |
| [0002](0002-language-and-frameworks.md) | 全ティアを TypeScript で書き、frontend は React の SPA にする (backend の HTTP フレームワークは未定) | accepted | - | - |
| [0003](0003-application-layers.md) | backend-api は 5 層、frontend は 3 層、worker は 2 層にし、依存方向を内向きに固定する | accepted | - | - |
| [0004](0004-datastore-and-migration.md) | 単一の RDB に置き、状態を持つ情報は追記型の履歴とスナップショットで保持する | accepted | - | - |
| [0005](0005-messaging-and-notification.md) | メッセージキューと AsyncAPI は置かず、通知は DB の送信待ちレコードを worker が定期的に送る | accepted | - | - |
| [0006](0006-authentication-and-authorization.md) | 認証は OIDC で外部の認証基盤に委ね、認可はロールと本人所有の判定を backend-api で行う | accepted | - | - |
| [0007](0007-testing-strategy.md) | 受入・UC BDD・契約・単体の 4 段でテストし、受入は API ドライバで実行する | accepted | - | - |
| [0008](0008-ui-components.md) | 単一の SPA に共有 UI 部品ライブラリとデザインシステムを持たせる | accepted | - | - |
| [0009](0009-business-module-boundaries.md) | backend-api を蔵書・利用者・貸出予約・通知・蔵書分析の 5 つの業務モジュールに分ける | accepted | - | - |
