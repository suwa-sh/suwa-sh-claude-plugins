<!-- distillery2:begin -->
<!-- この間は distillery2 (genDocsReadme.js) が生成する。手で書くものはこのブロックの外に置く -->

# 図書館蔵書管理システム

> 紙台帳と表計算ファイルに分散していた蔵書と利用者の情報を一元管理し、書籍の検索、Web 画面からの貸出・返却・予約、返却期限の自動設定とリマインド・督促メールの自動送信、利用者による貸出履歴・予約状況の確認、司書向けの在庫状況・人気書籍ランキング・期間別貸出統計のレポートを提供する。利用者は図書館の利用者と司書の 2 種類で、まずは 1 館での運用を想定し、将来の電子書籍対応に備えて媒体種別を扱える構造とする。

## どこに何があるか

| 段階 | 決めること | 人が読む | 機械が読む (正本) |
|---|---|---|---|
| 入力 | 初期要望 | [初期要望.txt](input/%E5%88%9D%E6%9C%9F%E8%A6%81%E6%9C%9B.txt) | - |
| ① 要求 | 要求・仕様・受入基準、業務と UC | [要求仕様書 (USDM)](requirements/requirements.md)<br>[RDRA の図解](requirements/rdra/views/README.md)<br>[確認材料](requirements/_review-summary.md) | [requirements.yaml](requirements/requirements.yaml)<br>[use-cases.yaml](requirements/use-cases.yaml)<br>[rdra/](requirements/rdra) |
| ② 決定 | 非機能グレード、ADR、C4 図 | [非機能グレード表](nfr/nfr-grade.md)<br>[ADR 一覧](adr/index.md)<br>[C4 図](adr/architecture.md)<br>[確認材料](adr/_review-summary.md) | [nfr-grade.yaml](nfr/nfr-grade.yaml)<br>[adr/*.md の front matter](adr) |
| ③ 基盤 | 開発ルール、契約、テスト基盤、画面部品 | [開発ルール](rules/index.md)<br>[画面の確認材料](design/_review-summary.md) | [contracts/](../contracts/contracts.json)<br>[.distillery/config.yaml](../.distillery/config.yaml)<br>[screens.yaml](design/screens.yaml) |
| ④ UC | シナリオ、契約差分、実装、as-built | [as-built 一覧](as-built/_system/index.md) | [features/](../features)<br>[追跡表](as-built/_system/traceability-index.json) |

## 業務と UC (上流から下流へ)

UC 27 件 (実装済み 1、要求待ち 4)。1 行で要求 → シナリオ → 契約 → 画面 → 実装の記録まで辿れる。
要求の列の SPEC は [要求仕様書](requirements/requirements.md) の行。

| 業務 | UC | 状態 | 要求 | シナリオ | 契約 | 画面 | 実装の記録 |
|---|---|---|---|---|---|---|---|
| 予約業務 | 予約を取り消す | 要求待ち | なし | - | - | ReservationCancel | - |
|  | 予約一覧を確認する | 要求待ち | なし | - | - | ReservationStatusList | - |
|  | 書籍を予約する | 未着手 | SPEC-004-01 | - | - | ReservationApply | - |
| 利用者管理業務 | 予約状況を照会する | 未着手 | SPEC-006-02 | - | - | MyReservations | - |
|  | 貸出履歴を照会する | 未着手 | SPEC-006-01 | - | - | MyLoanHistory | - |
|  | 利用者を削除する | 未着手 | SPEC-002-01 | - | - | PatronDeleteConfirm | - |
|  | 利用者を登録する | 未着手 | SPEC-002-01 | - | - | PatronRegister | - |
|  | 利用者情報を編集する | 未着手 | SPEC-002-01 | - | - | PatronEdit | - |
| 蔵書分析業務 | 人気書籍ランキングを確認する | 未着手 | SPEC-007-02 | - | - | PopularBooksRanking | - |
|  | 在庫状況レポートを確認する | 未着手 | SPEC-007-01 | - | - | InventoryDashboard | - |
|  | 貸出統計を集計する | 未着手 | SPEC-007-03 | - | - | LoanStatistics | - |
| 蔵書管理業務 | 書籍の詳細を参照する | 未着手 | SPEC-008-01 | - | - | BookDetail | - |
|  | 書籍を検索する | 未着手 | SPEC-001-02 | - | - | BookSearch | - |
|  | 蔵書を検索する | 未着手 | SPEC-001-02 | - | - | CollectionSearch | - |
|  | 書籍を削除する | 未着手 | SPEC-001-01 | - | - | BookDeleteConfirm | - |
|  | 書籍を登録する | 未着手 | SPEC-001-01, SPEC-008-01 | - | - | BookRegister | - |
|  | 書籍情報を編集する | 未着手 | SPEC-001-01 | - | - | BookEdit | - |
|  | 蔵書一覧を確認する | 未着手 | SPEC-001-01, SPEC-008-01 | - | - | BookList | - |
| 貸出業務 | 延滞の督促を送信する | 未着手 | SPEC-005-03 | - | - | - | - |
|  | 延滞中の貸出を確認する | 要求待ち | なし | - | - | OverdueLoanList | - |
|  | 返却期限のリマインドを送信する | 未着手 | SPEC-005-02 | - | - | - | - |
|  | 利用者を特定する | 未着手 | SPEC-003-01 | - | - | PatronLookup | - |
|  | 貸出を登録する | 実装済み | SPEC-003-01, SPEC-005-01 | [register-loan.feature](../features/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99/register-loan.feature) (6 本) | [registerLoan / テーブル 8](../contracts/generated/slices/register-loan/contract-slice.json) | LoanRegister | [index.md](as-built/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99/%E8%B2%B8%E5%87%BA%E3%82%92%E7%99%BB%E9%8C%B2%E3%81%99%E3%82%8B/index.md) |
|  | 貸出可否を確認する | 未着手 | SPEC-003-01 | - | - | LoanEligibilityCheck | - |
|  | 予約待ちの書籍を確認する | 要求待ち | なし | - | - | HoldShelfList | - |
|  | 返却を登録する | 未着手 | SPEC-003-02 | - | - | ReturnRegister | - |
|  | 返却通知を送信する | 未着手 | SPEC-004-02 | - | - | - | - |

<details>
<summary>要求待ちの理由 (4)</summary>

- 予約を取り消す: 要望と仕様に予約の取消の記述が無く、取消の可否や予約順位の繰り上げを定める仕様が無い
- 予約一覧を確認する: 要望と仕様に司書が書籍ごとの予約と予約順位を一覧で確認する操作の記述が無く、実現する仕様が無い
- 延滞中の貸出を確認する: 要望と仕様は延滞者への通知の自動化だけを求めており、司書が延滞中の貸出と送信記録を一覧で確認する操作を実現する仕様が無い
- 予約待ちの書籍を確認する: 要望と仕様に、返却後に予約待ちとなった書籍を司書が一覧で確認して取り置く操作の記述が無く、実現する仕様が無い

</details>

## 決めたこと

| ADR | 決定 | 状態 |
|---|---|---|
| [0001](adr/0001-tier-structure.md) | frontend・backend-api・worker の 3 ティア構成とし、backend-api を業務モジュールで分けたモジュラモノリスにする | accepted |
| [0002](adr/0002-language-and-framework.md) | 全ティアを TypeScript で書き、HTTP サーバーの具体的なフレームワークは段階③で契約生成との相性から選ぶ | accepted |
| [0003](adr/0003-layering.md) | backend-api は 5 層、frontend は 3 層、worker は 2 層とし、内側へ向かう依存だけを許す | accepted |
| [0004](adr/0004-datastore-and-migration.md) | データは単一の RDB に置き、状態を持つ書籍・貸出・予約は追記型のイベントとスナップショットで保持する | accepted |
| [0005](adr/0005-messaging.md) | メッセージブローカーと AsyncAPI は使わず、通知は RDB の送信待ち記録 (outbox) と worker の定期起動で送る | accepted |
| [0006](adr/0006-authn-authz.md) | 認証は OIDC 準拠の IdP に委ね、認可は司書・利用者のロールと本人確認 (所有者チェック) を backend-api の usecase で判定する | accepted |
| [0007](adr/0007-testing-strategy.md) | 受入・UC BDD・契約・単体の 4 段でテストし、受入は API ドライバで実行する (ブラウザドライバは使わない) | accepted |
| [0008](adr/0008-ui-components.md) | 単一の React SPA とし、共通 UI 部品を packages/ui に集約する。ブランドは RDRA から推論した落ち着いた青と緑を仮置きする | accepted |

- 非機能: [非機能グレード表](nfr/nfr-grade.md) (モデルシステム model1、重要項目 44 / 97)。性能テストの閾値の出典
- 構成: [C4 図](adr/architecture.md) (決めたもの)。実態は [依存グラフ](as-built/_system/dependency-graph.md)
- 開発ルール: [目次](rules/index.md)。実装時は common + 自ティア + testing だけ読む (生成物。直したい変更は ADR へ)

## 契約

| 契約 | 種類 | 提供 | 利用 | 正本 |
|---|---|---|---|---|
| library-api | openapi | backend-api | frontend, worker | [openapi/openapi.yaml](../contracts/openapi/openapi.yaml) |
| library-db | rdb-schema | backend-api | - | [db/rdb-schema.yaml](../contracts/db/rdb-schema.yaml) |

生成物 (bundle、UC ごとの slice、契約テスト) は [contracts/generated/](../contracts/generated)。API の一覧は [api-inventory.md](as-built/_system/api-inventory.md)。

## 横断して見る

- [as-built 一覧](as-built/_system/index.md)
- [API インベントリ](as-built/_system/api-inventory.md)
- [データフロー (UC × テーブル)](as-built/_system/data-flow.md)
- [依存グラフ (実態)](as-built/_system/dependency-graph.md)
- [追跡表 (機械向け)](as-built/_system/traceability-index.json)

<!-- distillery2:end -->
