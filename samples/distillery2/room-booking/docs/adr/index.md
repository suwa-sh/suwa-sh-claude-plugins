---
basis: requirements@64517f420b568ea1a4536b71b9dbbb357bd66460
---

# アーキテクチャ決定記録 (ADR) 一覧

決定から描いた C4 図: [architecture.md](architecture.md)

| 番号 | タイトル | ステータス | supersedes | superseded_by |
|------|---------|-----------|-----------|---------------|
| [0001](0001-tier-structure.md) | 画面の frontend と API の backend-api の 2 ティアにし、TypeScript と Express で作る | superseded | - | 0014 |
| [0002](0002-app-layers.md) | backend-api は 5 層、frontend は画面と API 呼び出しの 2 層にし、依存は内側へ向ける | superseded | - | 0013 |
| [0003](0003-datastore-and-migration.md) | データは PostgreSQL 互換の RDB 1 つに置き、二重予約は 30 分枠の一意制約で DB が防ぐ | accepted | - | - |
| [0004](0004-immutable-data.md) | 予約は「予約した」「取り消した」の事実を足していく形で持ち、今の状態は別の表に持つ | accepted | - | - |
| [0005](0005-messaging-not-needed.md) | メッセージングは使わない。処理は同期の要求と応答で完結させる | superseded | - | 0022 |
| [0006](0006-authn-authz.md) | 社員の認証は社内の既存アカウントに OIDC で任せ、認可は予約者本人かどうかを domain で判定する | accepted | - | - |
| [0007](0007-testing-strategy.md) | テストは受入・UC BDD・契約・単体の 4 段にし、受入は API で確かめる (ブラウザでは回さない) | accepted | - | - |
| [0008](0008-ui-components.md) | 画面は単一の React SPA とし、共通の画面部品を packages/ui に持つ | accepted | - | - |
| [0009](0009-ddd-tactical.md) | DDD は軽量に使う。予約を集約にし、時間帯を値オブジェクトにする | accepted | - | - |
| [0010](0010-error-handling.md) | 業務のエラーはコード付きの戻り値で返し、presentation で契約のエラー型と HTTP の status に変える | superseded | - | 0023 |
| [0011](0011-logging.md) | ログは JSON の 1 行で出し、業務のイベントは usecase が出す。domain はログを出さない | accepted | - | - |
| [0012](0012-machine-checks.md) | 機械チェックは既定の道具で 6 観点 (生成・整形・lint・ビルド・テスト・安全) を回す | accepted | - | - |
| [0013](0013-app-layers-complete-forbid.md) | backend-api の層の依存は許可する 6 方向だけにし、それ以外の 14 方向をすべてアーキテストで禁止する | accepted | 0002 | - |
| [0014](0014-tier-structure-frontend-oidc.md) | frontend は OIDC でトークンを得て、API 呼び出しの層の 1 か所で付ける | accepted | 0001 | - |
| [0015](0015-api-access-token-jwt.md) | API のトークンは認証基盤が発行する JWT とし、backend-api が検証して社員 ID を得る | accepted | - | - |
| [0016](0016-backup-point-in-time-recovery.md) | DB は障害の直前の時点まで戻せるようにバックアップし、復旧で成立済みの予約と占有を失わない | accepted | - | - |
| [0017](0017-time-range-within-business-date.md) | 時間帯は開始の日付 (日本時間) の中に収め、終了の 24:00 は翌日 0:00 で持つ | accepted | - | - |
| [0018](0018-frontend-api-origin-dev-proxy-signin-callback.md) | 画面と API は同じオリジンで配信し、画面は相対パス /api で呼ぶ。開発時は vite の中継で /api を backend-api へ送り、サインインの戻り先は /auth/callback の 1 画面で元の画面へ戻す | superseded | - | 0021 |
| [0019](0019-frontend-token-storage-and-renewal.md) | 画面はトークンをメモリだけに持ち、期限が近づいたら更新する。更新できなければサインインへ戻す | accepted | - | - |
| [0020](0020-frontend-token-unknown-expiry.md) | 期限の分からないトークンは期限が近くないものとしてそのまま使い、API が 401 を返したらサインインへ戻す | accepted | - | - |
| [0021](0021-frontend-screen-handoff-query.md) | 画面の間で選んだ値は、移る先の URL のクエリで渡す | accepted | 0018 | - |
| [0022](0022-messaging-not-needed-resend-returns-existing.md) | 冪等キーは入れず、同じ内容の送り直しには成立済みの予約を返す | accepted | 0005 | - |
| [0023](0023-error-handling-overlap-in-usecase.md) | 占有の一意制約の違反は repository が値で返し、usecase が重なりのエラーに変える | accepted | 0010 | - |
