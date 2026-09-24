<!-- distillery2:begin -->
<!-- この間は distillery2 (genDocsReadme.js) が生成する。手で書くものはこのブロックの外に置く -->

# 図書館蔵書管理システム

> 紙台帳と表計算ファイルに分散している図書館の蔵書と利用者の情報を一元管理し、書籍の登録・検索、Web 画面からの貸出・返却・予約を行うシステム。返却期限の自動設定と期限前リマインド・延滞督促メールの自動送信、予約者への取置通知により司書の手作業を減らす。利用者は自分の貸出履歴と予約状況を Web 画面で確認でき、司書は在庫状況・人気書籍ランキング・期間別貸出統計をレポートで把握できる。将来の電子書籍対応に備えて書籍に媒体種別を持たせる。

## どこに何があるか

| 段階 | 決めること | 人が読む | 機械が読む (正本) |
|---|---|---|---|
| 入力 | 初期要望 | [初期要望.txt](input/%E5%88%9D%E6%9C%9F%E8%A6%81%E6%9C%9B.txt) | - |
| ① 要求 | 要求・仕様・受入基準、業務と UC | [要求仕様書 (USDM)](requirements/requirements.md)<br>[RDRA の図解](requirements/rdra/views/README.md)<br>[確認材料](requirements/_review-summary.md) | [requirements.yaml](requirements/requirements.yaml)<br>[use-cases.yaml](requirements/use-cases.yaml)<br>[rdra/](requirements/rdra) |
| ② 決定 | 非機能グレード、ADR、C4 図 | [非機能グレード表](nfr/nfr-grade.md)<br>[ADR 一覧](adr/index.md)<br>[C4 図](adr/architecture.md)<br>[確認材料](adr/_review-summary.md) | [nfr-grade.yaml](nfr/nfr-grade.yaml)<br>[adr/*.md の front matter](adr) |
| ③ 基盤 | 開発ルール、契約、テスト基盤、画面部品 | [開発ルール](rules/index.md)<br>[画面の確認材料](design/_review-summary.md) | [contracts/](../contracts/contracts.json)<br>[.distillery/config.yaml](../.distillery/config.yaml)<br>[screens.yaml](design/screens.yaml) |
| ④ UC | シナリオ、契約差分、実装、as-built | [as-built 一覧](as-built/_system/index.md) | [features/](../features)<br>[追跡表](as-built/_system/traceability-index.json) |

## 業務と UC (上流から下流へ)

UC 32 件 (実装済み 1、要求待ち 6)。1 行で要求 → シナリオ → 契約 → 画面 → 実装の記録まで辿れる。
要求の列の SPEC は [要求仕様書](requirements/requirements.md) の行。

| 業務 | UC | 状態 | 要求 | シナリオ | 契約 | 画面 | 実装の記録 |
|---|---|---|---|---|---|---|---|
| 利用者管理業務 | ログインする | 未着手 | SPEC-002-03, SPEC-004-01 | - | - | Login | - |
|  | 利用者を削除する | 未着手 | SPEC-001-02 | - | - | PatronDeleteConfirm | - |
|  | 利用者を登録する | 未着手 | SPEC-001-02 | - | - | PatronRegister | - |
|  | 利用者情報を変更する | 未着手 | SPEC-001-02 | - | - | PatronEdit | - |
| 蔵書分析業務 | 人気書籍ランキングを表示する | 未着手 | SPEC-005-02 | - | - | PopularBooksRanking | - |
|  | 在庫状況レポートを表示する | 未着手 | SPEC-005-01 | - | - | InventoryReport | - |
|  | 貸出統計を集計する | 未着手 | SPEC-005-03 | - | - | LoanStatistics | - |
| 蔵書管理業務 | 所蔵書籍を検索する | 未着手 | SPEC-001-03 | - | - | HoldingsSearch | - |
|  | 書籍を検索する | 未着手 | SPEC-001-03, SPEC-006-01 | - | - | BookSearch | - |
|  | 書籍を削除する | 未着手 | SPEC-001-01 | - | - | BookDeleteConfirm | - |
|  | 書籍を登録する | 未着手 | SPEC-001-01, SPEC-006-01 | - | - | BookRegister | - |
|  | 書籍情報を変更する | 未着手 | SPEC-001-01 | - | - | BookEdit | - |
|  | 書籍詳細を表示する | 未着手 | SPEC-001-03 | - | - | BookDetail | - |
| 貸出業務 | 予約を取り消す | 要求待ち | なし | - | - | ReservationCancel | - |
|  | 予約を登録する | 未着手 | SPEC-002-03 | - | - | ReservationApply | - |
|  | 取置期限切れの予約を取り消す | 要求待ち | なし | - | - | - | - |
|  | 書籍の予約状況を照会する | 要求待ち | なし | - | - | ReservationQueue | - |
|  | 予約状況を照会する | 未着手 | SPEC-004-02 | - | - | MyReservations | - |
|  | 利用者の利用状況を照会する | 要求待ち | なし | - | - | PatronUsage | - |
|  | 貸出履歴を照会する | 未着手 | SPEC-004-01 | - | - | MyLoanHistory | - |
|  | 延滞中の貸出を確認する | 未着手 | SPEC-004-01 | - | - | MyOverdueLoans | - |
|  | 延滞貸出を判定する | 未着手 | SPEC-003-03 | - | - | - | - |
|  | 延滞貸出一覧を照会する | 要求待ち | なし | - | - | OverdueLoanList | - |
|  | 督促を送信する | 未着手 | SPEC-003-03 | - | - | - | - |
|  | 貸出を登録する | 実装済み | SPEC-002-01, SPEC-003-01 | [register-loan.feature](../features/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99/register-loan.feature) (10 本) | [createLoan / テーブル 7](../contracts/generated/slices/register-loan/contract-slice.json) | LoanCheckout | [index.md](as-built/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99/%E8%B2%B8%E5%87%BA%E3%82%92%E7%99%BB%E9%8C%B2%E3%81%99%E3%82%8B/index.md) |
|  | 貸出内容を照会する | 未着手 | SPEC-004-01 | - | - | MyCurrentLoans | - |
|  | 取置を登録する | 未着手 | SPEC-002-02, SPEC-002-04 | - | - | HoldRegister | - |
|  | 取置を通知する | 未着手 | SPEC-002-04 | - | - | - | - |
|  | 返却を登録する | 未着手 | SPEC-002-02 | - | - | LoanReturn | - |
|  | 返却期限リマインドを送信する | 未着手 | SPEC-003-02 | - | - | - | - |
|  | 返却期限間近の貸出を抽出する | 未着手 | SPEC-003-02 | - | - | - | - |
|  | 通知送信状況を照会する | 要求待ち | なし | - | - | NotificationStatus | - |

<details>
<summary>要求待ちの理由 (6)</summary>

- 予約を取り消す: 予約の取消（取消済みへの遷移と後続予約順の繰り上げ）を定める仕様・受入基準が要求に無い。予約の仕様は登録のみを扱う
- 取置期限切れの予約を取り消す: 取置期限と、期限切れ時の予約取消・次の予約者への取置を定める仕様・受入基準が要求に無い
- 書籍の予約状況を照会する: 司書が書籍ごとの予約者・予約順・予約状態を確認する仕様・受入基準が要求に無い。予約状況の確認は利用者本人向けの仕様だけがある
- 利用者の利用状況を照会する: 司書が利用者番号を指定して他の利用者の貸出・予約状況を確認する仕様・受入基準が要求に無い。利用状況の確認は利用者本人向けの仕様だけがある
- 延滞貸出一覧を照会する: 司書が延滞中の貸出と督促の送信状況を一覧で確認する仕様・受入基準が要求に無い。延滞の仕様は延滞判定と督促メールの自動送信のみを扱う
- 通知送信状況を照会する: 司書が通知（リマインド・督促・取置）の送信状況を確認する仕様・受入基準が要求に無い。通知の仕様は自動送信のみを扱う

</details>

## 決めたこと

| ADR | 決定 | 状態 |
|---|---|---|
| [0001](adr/0001-tier-structure.md) | ティア構成は利用者向けフロント・司書向けフロント・backend-api・worker の 4 ティアとする | accepted |
| [0002](adr/0002-language-and-framework.md) | 全ティアを TypeScript で実装し、フロントは SPA とする (サーバ側の HTTP フレームワークは未定) | accepted |
| [0003](adr/0003-app-layers.md) | backend-api は 5 層、フロントは 2 層とし、依存は内側 (domain) に向ける | accepted |
| [0004](adr/0004-datastore-and-migration.md) | データは単一の RDB に置き、状態を持つ情報はイベントとスナップショットで記録する | accepted |
| [0005](adr/0005-messaging.md) | メッセージブローカーは置かず、通知は DB の送信待ちレコードを worker が送る (AsyncAPI は作らない) | accepted |
| [0006](adr/0006-authn-authz.md) | 認証は OIDC 準拠の外部 IdP に委ね、認可はロールと本人確認を backend-api の usecase 層で行う | accepted |
| [0007](adr/0007-testing-strategy.md) | テストは受入・UC BDD・契約・単体の 4 段とし、画面の受入はブラウザでも確かめる | accepted |
| [0008](adr/0008-ui-components.md) | フロントは利用者向けと司書向けに分け、共通 UI 部品を packages/ui に持つ | accepted |

- 非機能: [非機能グレード表](nfr/nfr-grade.md) (モデルシステム model2、重要項目 44 / 97)。性能テストの閾値の出典
- 構成: [C4 図](adr/architecture.md) (決めたもの)。実態は [依存グラフ](as-built/_system/dependency-graph.md)
- 開発ルール: [目次](rules/index.md)。実装時は common + 自ティア + testing だけ読む (生成物。直したい変更は ADR へ)

## 契約

| 契約 | 種類 | 提供 | 利用 | 正本 |
|---|---|---|---|---|
| api | openapi | backend-api | frontend-patron, frontend-staff | [openapi/openapi.yaml](../contracts/openapi/openapi.yaml) |
| db | rdb-schema | backend-api | worker | [db/rdb-schema.yaml](../contracts/db/rdb-schema.yaml) |

生成物 (bundle、UC ごとの slice、契約テスト) は [contracts/generated/](../contracts/generated)。API の一覧は [api-inventory.md](as-built/_system/api-inventory.md)。

## 横断して見る

- [as-built 一覧](as-built/_system/index.md)
- [API インベントリ](as-built/_system/api-inventory.md)
- [データフロー (UC × テーブル)](as-built/_system/data-flow.md)
- [依存グラフ (実態)](as-built/_system/dependency-graph.md)
- [追跡表 (機械向け)](as-built/_system/traceability-index.json)

<!-- distillery2:end -->
