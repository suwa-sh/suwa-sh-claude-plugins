<!-- distillery2:begin -->
<!-- この間は distillery2 (genDocsReadme.js) が生成する。手で書くものはこのブロックの外に置く -->

# 図書館蔵書管理システム

> 1 館の図書館で、紙台帳と表計算ファイルに分散していた蔵書と利用者の情報を一元管理する Web システム。司書は書籍・利用者の登録・編集・削除、貸出・返却の登録、在庫状況・人気書籍ランキング・期間別貸出統計のレポート確認を行う。利用者は書籍の検索、貸出中書籍の予約、自分の貸出履歴と予約状況の確認を Web 画面で行う。貸出時に返却期限を自動設定し、期限前のリマインド、延滞時の督促、返却時の予約順 1 位の利用者への受取可能通知をメールで自動送信する。将来の電子書籍対応に備え、書籍に媒体種別を持たせる。

## どこに何があるか

| 段階 | 決めること | 人が読む | 機械が読む (正本) |
|---|---|---|---|
| 入力 | 初期要望 | [初期要望.txt](input/%E5%88%9D%E6%9C%9F%E8%A6%81%E6%9C%9B.txt) | - |
| ① 要求 | 要求・仕様・受入基準、業務と UC | [要求仕様書 (USDM)](requirements/requirements.md)<br>[RDRA の図解](requirements/rdra/views/README.md)<br>[確認材料](requirements/_review-summary.md) | [requirements.yaml](requirements/requirements.yaml)<br>[use-cases.yaml](requirements/use-cases.yaml)<br>[rdra/](requirements/rdra) |
| ② 決定 | 非機能グレード、ADR、C4 図 | [非機能グレード表](nfr/nfr-grade.md)<br>[ADR 一覧](adr/index.md)<br>[C4 図](adr/architecture.md)<br>[確認材料](adr/_review-summary.md) | [nfr-grade.yaml](nfr/nfr-grade.yaml)<br>[adr/*.md の front matter](adr) |
| ③ 基盤 | 開発ルール、契約、テスト基盤、画面部品 | [開発ルール](rules/index.md)<br>[画面の確認材料](design/_review-summary.md) | [contracts/](../contracts/contracts.json)<br>[.distillery/config.yaml](../.distillery/config.yaml)<br>[screens.yaml](design/screens.yaml) |
| ④ UC | シナリオ、契約差分、実装、as-built | [as-built 一覧](as-built/_system/index.md) | [features/](../features)<br>[追跡表](as-built/_system/traceability-index.json) |

## 業務と UC (上流から下流へ)

UC 22 件 (実装済み 1、要求待ち 0)。1 行で要求 → シナリオ → 契約 → 画面 → 実装の記録まで辿れる。
要求の列の SPEC は [要求仕様書](requirements/requirements.md) の行。

| 業務 | UC | 状態 | 要求 | シナリオ | 契約 | 画面 | 実装の記録 |
|---|---|---|---|---|---|---|---|
| 予約業務 | 受取可能を通知する | 未着手 | SPEC-005-03 | - | - | - | - |
|  | 予約を取り消す | 未着手 | SPEC-005-02 | - | - | ReservationCancel | - |
|  | 書籍を予約する | 未着手 | SPEC-005-01 | - | - | BookReservation | - |
| 利用者サービス業務 | 予約状況を照会する | 未着手 | SPEC-007-02 | - | - | MyReservations | - |
|  | 利用者がログインする | 未着手 | SPEC-010-01 | - | - | PatronLogin | - |
|  | 貸出状況を照会する | 未着手 | SPEC-007-01 | - | - | MyLoans | - |
| 利用者管理業務 | 利用者を削除する | 未着手 | SPEC-002-03 | - | - | PatronWithdrawal | - |
|  | 利用者を登録する | 未着手 | SPEC-002-01 | - | - | PatronRegistration | - |
|  | 利用者情報を編集する | 未着手 | SPEC-002-02 | - | - | PatronEdit | - |
| 蔵書分析業務 | 人気書籍ランキングを確認する | 未着手 | SPEC-008-02 | - | - | PopularBooksRanking | - |
|  | 在庫状況レポートを確認する | 未着手 | SPEC-008-01 | - | - | InventoryReport | - |
|  | 貸出統計を確認する | 未着手 | SPEC-008-03 | - | - | LoanStatistics | - |
| 蔵書管理業務 | 書籍の所在を検索する | 未着手 | SPEC-003-01 | - | - | BookLocationSearch | - |
|  | 書籍を検索する | 未着手 | SPEC-003-01 | - | - | BookSearch | - |
|  | 司書がログインする | 未着手 | SPEC-010-01 | - | - | LibrarianLogin | - |
|  | 書籍を削除する | 未着手 | SPEC-001-03 | - | - | BookRemoval | - |
|  | 書籍を登録する | 未着手 | SPEC-001-01, SPEC-009-01 | - | - | BookRegistration | - |
|  | 書籍情報を編集する | 未着手 | SPEC-001-02 | - | - | BookEdit | - |
| 貸出期限管理業務 | 延滞を督促する | 未着手 | SPEC-006-03 | - | - | - | - |
|  | 返却期限をリマインドする | 未着手 | SPEC-006-02 | - | - | - | - |
| 貸出業務 | 返却を登録する | 未着手 | SPEC-004-02 | - | - | LoanReturn | - |
|  | 貸出を登録する | 実装済み | SPEC-004-01, SPEC-006-01 | [register-loan.feature](../features/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99/register-loan.feature) (6 本) | [createLoan / テーブル 10](../contracts/generated/slices/register-loan/contract-slice.json) | LoanCheckout | [index.md](as-built/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99/%E8%B2%B8%E5%87%BA%E3%82%92%E7%99%BB%E9%8C%B2%E3%81%99%E3%82%8B/index.md) |

## 決めたこと

| ADR | 決定 | 状態 |
|---|---|---|
| [0001](adr/0001-tier-structure.md) | frontend・backend-api・worker の 3 ティア構成とし、backend-api をモジュラモノリスにする | accepted |
| [0002](adr/0002-language-and-frameworks.md) | 全ティアを TypeScript で書き、frontend は React の SPA にする (backend の HTTP フレームワークは未定) | accepted |
| [0003](adr/0003-application-layers.md) | backend-api は 5 層、frontend は 3 層、worker は 2 層にし、依存方向を内向きに固定する | accepted |
| [0004](adr/0004-datastore-and-migration.md) | 単一の RDB に置き、状態を持つ情報は追記型の履歴とスナップショットで保持する | accepted |
| [0005](adr/0005-messaging-and-notification.md) | メッセージキューと AsyncAPI は置かず、通知は DB の送信待ちレコードを worker が定期的に送る | accepted |
| [0006](adr/0006-authentication-and-authorization.md) | 認証は OIDC で外部の認証基盤に委ね、認可はロールと本人所有の判定を backend-api で行う | accepted |
| [0007](adr/0007-testing-strategy.md) | 受入・UC BDD・契約・単体の 4 段でテストし、受入は API ドライバで実行する | accepted |
| [0008](adr/0008-ui-components.md) | 単一の SPA に共有 UI 部品ライブラリとデザインシステムを持たせる | accepted |
| [0009](adr/0009-business-module-boundaries.md) | backend-api を蔵書・利用者・貸出予約・通知・蔵書分析の 5 つの業務モジュールに分ける | accepted |

- 非機能: [非機能グレード表](nfr/nfr-grade.md) (モデルシステム model1、重要項目 44 / 97)。性能テストの閾値の出典
- 構成: [C4 図](adr/architecture.md) (決めたもの)。実態は [依存グラフ](as-built/_system/dependency-graph.md)
- 開発ルール: [目次](rules/index.md)。実装時は common + 自ティア + testing だけ読む (生成物。直したい変更は ADR へ)

## 契約

| 契約 | 種類 | 提供 | 利用 | 正本 |
|---|---|---|---|---|
| api | openapi | backend-api | frontend, worker | [openapi/openapi.yaml](../contracts/openapi/openapi.yaml) |
| db | rdb-schema | backend-api | - | [db/rdb-schema.yaml](../contracts/db/rdb-schema.yaml) |

生成物 (bundle、UC ごとの slice、契約テスト) は [contracts/generated/](../contracts/generated)。API の一覧は [api-inventory.md](as-built/_system/api-inventory.md)。

## 横断して見る

- [as-built 一覧](as-built/_system/index.md)
- [API インベントリ](as-built/_system/api-inventory.md)
- [データフロー (UC × テーブル)](as-built/_system/data-flow.md)
- [依存グラフ (実態)](as-built/_system/dependency-graph.md)
- [追跡表 (機械向け)](as-built/_system/traceability-index.json)

<!-- distillery2:end -->
