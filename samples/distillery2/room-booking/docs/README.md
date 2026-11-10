<!-- distillery2:begin -->
<!-- この間は distillery2 (genDocsReadme.js) が生成する。手で書くものはこのブロックの外に置く -->

# 会議室予約システム

> 社員が Web 画面で、日付と時間帯を指定して会議室ごとの空き状況を確認し、空いている会議室を予約できるシステム。同じ会議室の同じ時間帯への二重予約を防ぎ (同時に予約されても成立は 1 件だけ)、予約した本人は開始時刻より前であれば自分の予約を取り消せる。取り消した予約は空き状況と重なりの判定から外れる。共有の表計算ファイルで起きていた二重予約や取り消しの未反映を解消する

## どこに何があるか

| 段階 | 決めること | 人が読む | 機械が読む (正本) |
|---|---|---|---|
| 入力 | 初期要望 | [要望-20261104.md](input/%E8%A6%81%E6%9C%9B-20261104.md) | - |
| ① 要求 | 要求・仕様・受入基準、業務と UC | [要求仕様書 (USDM)](requirements/requirements.md)<br>[RDRA の図解](requirements/rdra/views/README.md)<br>[確認材料](requirements/_review-summary.md) | [requirements.yaml](requirements/requirements.yaml)<br>[use-cases.yaml](requirements/use-cases.yaml)<br>[rdra/](requirements/rdra) |
| ② 決定 | 非機能グレード、ADR、C4 図 | [非機能グレード表](nfr/nfr-grade.md)<br>[ADR 一覧](adr/index.md)<br>[C4 図](adr/architecture.md)<br>[確認材料](adr/_review-summary.md) | [nfr-grade.yaml](nfr/nfr-grade.yaml)<br>[adr/*.md の front matter](adr) |
| ③ 基盤 | 開発ルール、契約、テスト基盤、画面部品 | [開発ルール](rules/index.md)<br>[画面の確認材料](design/_review-summary.md) | [contracts/](../contracts/contracts.json)<br>[.distillery/config.yaml](../.distillery/config.yaml)<br>[screens.yaml](design/screens.yaml) |
| ④ UC | シナリオ、契約差分、実装、as-built | [as-built 一覧](as-built/_system/index.md) | [features/](../features)<br>[追跡表](as-built/_system/traceability-index.json) |

## 業務と UC (上流から下流へ)

UC 4 件 (main マージ済み 2、main マージ待ち 0、要求待ち 0)。1 行で要求 → シナリオ → 契約 → 画面 → 実装の記録まで辿れる。
要求の列の SPEC は [要求仕様書](requirements/requirements.md) の行。

| 業務 | UC | 状態 | 要求 | シナリオ | 契約 | 画面 | 実装の記録 |
|---|---|---|---|---|---|---|---|
| 会議室予約 | 予約を取り消す | 未着手 | SPEC-003-02 | - | - | CancelReservation | - |
|  | 自分の予約一覧を確認する | 未着手 | SPEC-003-01 | - | - | MyReservations | - |
|  | 会議室の空き状況を照会する | main マージ済み | SPEC-001-01 | [view-room-availability.feature](../features/%E4%BC%9A%E8%AD%B0%E5%AE%A4%E4%BA%88%E7%B4%84/view-room-availability.feature) (14 本) | [viewRoomAvailability / テーブル 2](../contracts/generated/slices/view-room-availability/contract-slice.json) | RoomAvailability | [index.md](as-built/%E4%BC%9A%E8%AD%B0%E5%AE%A4%E4%BA%88%E7%B4%84/%E4%BC%9A%E8%AD%B0%E5%AE%A4%E3%81%AE%E7%A9%BA%E3%81%8D%E7%8A%B6%E6%B3%81%E3%82%92%E7%85%A7%E4%BC%9A%E3%81%99%E3%82%8B/index.md) |
|  | 会議室を予約する | main マージ済み | SPEC-002-01, SPEC-002-02, SPEC-002-03 | [reserve-room.feature](../features/%E4%BC%9A%E8%AD%B0%E5%AE%A4%E4%BA%88%E7%B4%84/reserve-room.feature) (28 本) | [reserveRoom, listRooms / テーブル 4](../contracts/generated/slices/reserve-room/contract-slice.json) | RoomAvailability<br>ReserveRoom | [index.md](as-built/%E4%BC%9A%E8%AD%B0%E5%AE%A4%E4%BA%88%E7%B4%84/%E4%BC%9A%E8%AD%B0%E5%AE%A4%E3%82%92%E4%BA%88%E7%B4%84%E3%81%99%E3%82%8B/index.md) |

## 未処理の課題

8 件 (プラグイン 8)。一覧: [feedback/README.md](feedback/README.md)

## 決めたこと

| ADR | 決定 | 状態 |
|---|---|---|
| [0001](adr/0001-tier-structure.md) | 画面の frontend と API の backend-api の 2 ティアにし、TypeScript と Express で作る | superseded |
| [0002](adr/0002-app-layers.md) | backend-api は 5 層、frontend は画面と API 呼び出しの 2 層にし、依存は内側へ向ける | superseded |
| [0003](adr/0003-datastore-and-migration.md) | データは PostgreSQL 互換の RDB 1 つに置き、二重予約は 30 分枠の一意制約で DB が防ぐ | accepted |
| [0004](adr/0004-immutable-data.md) | 予約は「予約した」「取り消した」の事実を足していく形で持ち、今の状態は別の表に持つ | accepted |
| [0005](adr/0005-messaging-not-needed.md) | メッセージングは使わない。処理は同期の要求と応答で完結させる | superseded |
| [0006](adr/0006-authn-authz.md) | 社員の認証は社内の既存アカウントに OIDC で任せ、認可は予約者本人かどうかを domain で判定する | accepted |
| [0007](adr/0007-testing-strategy.md) | テストは受入・UC BDD・契約・単体の 4 段にし、受入は API で確かめる (ブラウザでは回さない) | accepted |
| [0008](adr/0008-ui-components.md) | 画面は単一の React SPA とし、共通の画面部品を packages/ui に持つ | accepted |
| [0009](adr/0009-ddd-tactical.md) | DDD は軽量に使う。予約を集約にし、時間帯を値オブジェクトにする | accepted |
| [0010](adr/0010-error-handling.md) | 業務のエラーはコード付きの戻り値で返し、presentation で契約のエラー型と HTTP の status に変える | superseded |
| [0011](adr/0011-logging.md) | ログは JSON の 1 行で出し、業務のイベントは usecase が出す。domain はログを出さない | accepted |
| [0012](adr/0012-machine-checks.md) | 機械チェックは既定の道具 (biome・qlty・tsc・vitest・依存の監査・SAST・秘密の検出) で 6 観点を回す | accepted |
| [0013](adr/0013-app-layers-complete-forbid.md) | backend-api の層の依存は許可する 6 方向だけにし、それ以外の 14 方向をすべてアーキテストで禁止する | accepted |
| [0014](adr/0014-tier-structure-frontend-oidc.md) | 2 ティア構成を引き継ぎ、frontend は OIDC クライアントでトークンを得て API 呼び出しの層の 1 か所で付ける | accepted |
| [0015](adr/0015-api-access-token-jwt.md) | API に送るトークンは認証基盤が JWT で発行するアクセストークンとし、backend-api は署名と発行者・宛先・期限を検証して sub を社員 ID にする | accepted |
| [0016](adr/0016-backup-point-in-time-recovery.md) | DB は障害の直前の時点まで戻せるようにバックアップし、復旧で成立済みの予約と占有を失わない | accepted |
| [0017](adr/0017-time-range-within-business-date.md) | 時間帯は開始の日付 (日本時間) の中に収める。収まらない時間帯は INVALID_TIME_RANGE にし、終了の 24:00 は翌日 0:00 の日時で持つ | accepted |
| [0018](adr/0018-frontend-api-origin-dev-proxy-signin-callback.md) | 画面と API は同じオリジンで配信し、画面は相対パス /api で呼ぶ。開発時は vite の中継で /api を backend-api へ送り、サインインの戻り先は /auth/callback の 1 画面で元の画面へ戻す | superseded |
| [0019](adr/0019-frontend-token-storage-and-renewal.md) | 画面はトークンをメモリだけに持ち、期限が近づいたらリフレッシュトークンで更新する。iframe での更新はせず、更新できなければサインインへ戻す | accepted |
| [0020](adr/0020-frontend-token-unknown-expiry.md) | 期限の分からないトークンは期限が近くないものとしてそのまま使い、API が 401 を返したらサインインへ戻す | accepted |
| [0021](adr/0021-frontend-screen-handoff-query.md) | ADR 0018 (同じオリジンの配信・開発時の中継・サインインの戻り先・画面の照合) を引き継ぎ、画面の間で選んだ値は移る先の URL のクエリで渡す。App.tsx が読んで Route の element に 2 つ目の引数で渡し、受け取った画面は初期値としてだけ使う | accepted |
| [0022](adr/0022-messaging-not-needed-resend-returns-existing.md) | ADR 0005 (メッセージングを使わず同期で完結・冪等キーを入れない) を引き継ぎ、冪等キーを入れない理由を「同じ内容の送り直しは成立済みの予約を返し、それ以外の重複は重なりで弾く」に直す | accepted |
| [0023](adr/0023-error-handling-overlap-in-usecase.md) | ADR 0010 (業務のエラーはコード付きの戻り値で返す) を引き継ぎ、占有の表の一意制約の違反は repository が重なりとして値で返し、usecase が SLOT_OVERLAPS の業務のエラーに変える | accepted |

- 非機能: [非機能グレード表](nfr/nfr-grade.md) (モデルシステム model1、重要項目 44 / 97)。性能テストの閾値の出典
- 構成: [C4 図](adr/architecture.md) (決めたもの)。実態は [依存グラフ](as-built/_system/dependency-graph.md)
- 開発ルール: [目次](rules/index.md)。実装時は common + 自ティア + testing だけ読む (生成物。直したい変更は ADR へ)

## 契約

| 契約 | 種類 | 提供 | 利用 | 正本 |
|---|---|---|---|---|
| api | openapi | backend-api | frontend | [openapi/openapi.yaml](../contracts/openapi/openapi.yaml) |
| db | rdb-schema | backend-api | - | [db/rdb-schema.yaml](../contracts/db/rdb-schema.yaml) |

生成物 (bundle、UC ごとの slice、契約テスト) は [contracts/generated/](../contracts/generated)。API の一覧は [api-inventory.md](as-built/_system/api-inventory.md)。

## 横断して見る

- [as-built 一覧](as-built/_system/index.md)
- [API インベントリ](as-built/_system/api-inventory.md)
- [データフロー (UC × テーブル)](as-built/_system/data-flow.md)
- [依存グラフ (実態)](as-built/_system/dependency-graph.md)
- [追跡表 (機械向け)](as-built/_system/traceability-index.json)

## distillery2 以外の文書

distillery2 が生成しない文書。ここには名前だけを載せる (内容は要約しない。消さない)。

distillery2 のディレクトリにある、上で参照していない文書:

- [design/screenshots/index.md](design/screenshots/index.md)
- [design/storybook-app/src/assets/icons/index.md](design/storybook-app/src/assets/icons/index.md)

<!-- distillery2:end -->
