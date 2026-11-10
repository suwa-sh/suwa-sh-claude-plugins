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
| [0012](0012-machine-checks.md) | 機械チェックは既定の道具 (biome・qlty・tsc・vitest・依存の監査・SAST・秘密の検出) で 6 観点を回す | accepted | - | - |
| [0013](0013-app-layers-complete-forbid.md) | backend-api の層の依存は許可する 6 方向だけにし、それ以外の 14 方向をすべてアーキテストで禁止する | accepted | 0002 | - |
| [0014](0014-tier-structure-frontend-oidc.md) | 2 ティア構成を引き継ぎ、frontend は OIDC クライアントでトークンを得て API 呼び出しの層の 1 か所で付ける | accepted | 0001 | - |
| [0015](0015-api-access-token-jwt.md) | API に送るトークンは認証基盤が JWT で発行するアクセストークンとし、backend-api は署名と発行者・宛先・期限を検証して sub を社員 ID にする | accepted | - | - |
| [0016](0016-backup-point-in-time-recovery.md) | DB は障害の直前の時点まで戻せるようにバックアップし、復旧で成立済みの予約と占有を失わない | accepted | - | - |
| [0017](0017-time-range-within-business-date.md) | 時間帯は開始の日付 (日本時間) の中に収める。収まらない時間帯は INVALID_TIME_RANGE にし、終了の 24:00 は翌日 0:00 の日時で持つ | accepted | - | - |
| [0018](0018-frontend-api-origin-dev-proxy-signin-callback.md) | 画面と API は同じオリジンで配信し、画面は相対パス /api で呼ぶ。開発時は vite の中継で /api を backend-api へ送り、サインインの戻り先は /auth/callback の 1 画面で元の画面へ戻す | superseded | - | 0021 |
| [0019](0019-frontend-token-storage-and-renewal.md) | 画面はトークンをメモリだけに持ち、期限が近づいたらリフレッシュトークンで更新する。iframe での更新はせず、更新できなければサインインへ戻す | accepted | - | - |
| [0020](0020-frontend-token-unknown-expiry.md) | 期限の分からないトークンは期限が近くないものとしてそのまま使い、API が 401 を返したらサインインへ戻す | accepted | - | - |
| [0021](0021-frontend-screen-handoff-query.md) | ADR 0018 (同じオリジンの配信・開発時の中継・サインインの戻り先・画面の照合) を引き継ぎ、画面の間で選んだ値は移る先の URL のクエリで渡す。App.tsx が読んで Route の element に 2 つ目の引数で渡し、受け取った画面は初期値としてだけ使う | accepted | 0018 | - |
| [0022](0022-messaging-not-needed-resend-returns-existing.md) | ADR 0005 (メッセージングを使わず同期で完結・冪等キーを入れない) を引き継ぎ、冪等キーを入れない理由を「同じ内容の送り直しは成立済みの予約を返し、それ以外の重複は重なりで弾く」に直す | accepted | 0005 | - |
| [0023](0023-error-handling-overlap-in-usecase.md) | ADR 0010 (業務のエラーはコード付きの戻り値で返す) を引き継ぎ、占有の表の一意制約の違反は repository が重なりとして値で返し、usecase が SLOT_OVERLAPS の業務のエラーに変える | accepted | 0010 | - |
