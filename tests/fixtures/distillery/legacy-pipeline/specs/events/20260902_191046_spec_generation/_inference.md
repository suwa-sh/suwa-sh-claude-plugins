design_available: true
event_id: 20260902_191046_spec_generation

# feedback 差分実行（20260902_184257_impl_feedback_d0f57ea2）

本イベントは初期生成イベント `20260902_152849_spec_generation` の**差分反映**である。
仕様全体の再生成は行わず、stage packet の work unit に対応する差分だけを反映した。

| work unit | direct owner | 本ステージの反映 | 主な変更先 |
|---|---|---|---|
| CR-d0f57ea2-001#1 | spec | 所有 operation と cross-UC 依存の分離（`endpoints:` / `consumes:`） | 全 UC の `_api-summary.yaml`、`_cross-cutting/api/uc-api-dependencies.md`（新規） |
| CR-d0f57ea2-002#1 | spec | AsyncAPI の全 component schema へ安定 `title` を付与 | `_cross-cutting/api/asyncapi.yaml` |
| CR-d0f57ea2-003#1 | spec | 日本語 enum へ `x-enum-varnames` を併記（openapi 16 / asyncapi 4） | `_cross-cutting/api/openapi.yaml`, `asyncapi.yaml` |
| CR-d0f57ea2-004#1 | spec | 利用者識別情報の送信方法・検証責務・401 の 3 コードを契約化 | `_cross-cutting/api/openapi.yaml`, 貸出を登録する `tier-backend-api.md` |
| CR-d0f57ea2-005#1 | spec | 予約状態遷移規則（同時更新列を含む）を単一の正本として定義 | `_cross-cutting/datastore/rdb-schema.yaml`, 予約状態を変える UC |
| CR-d0f57ea2-006#1 | design_system（applied 済） | loading 表現を共通 `LoadingState` へ一本化 | `_cross-cutting/ux-ui/common-components.md`, 全 `tier-frontend-*.md` |
| CR-d0f57ea2-007#1 | spec | 冪等キーの 6 ケース（リプレイ / in_progress / conflict ほか）を規定 | `_cross-cutting/datastore/kvs-schema.yaml`, `openapi.yaml`, 更新系 UC |
| CR-d0f57ea2-008#1 | spec | 日付・期限の表示規約（`あと{N}日` 等）を単一形式へ統一 | `_cross-cutting/ux-ui/ui-design.md`, 日付を扱う UC |
| CR-d0f57ea2-009#1 | spec | 完了結果の所有者・型・イベント名の受け渡し規約を定義 | `_cross-cutting/ux-ui/common-components.md`, 更新系 UC |
| CR-d0f57ea2-010#1 | design_system（applied 済） | `AppShell` / `appRoutes` / `useAppNavigation` の所有権境界とルート id 宣言 | `_cross-cutting/ux-ui/common-components.md`, 全 `tier-frontend-*.md` |
| CR-d0f57ea2-011#1 | spec | 受け入れ基準 ID `{仕様ID}#{n}` と UC 対応表（主担当 / 補助） | `_cross-cutting/traceability-matrix.md`, 全 `spec.md` |

設計判断は `decisions/spec-decision-006.yaml` 〜 `spec-decision-011.yaml` に記録した。

# Step1 モデル分析・Spec 方針決定

## 入力の正本

| 種別 | パス | 備考 |
|---|---|---|
| RDRA | `docs/rdra/latest/*.tsv`, `システム概要.json` | 41 UC / 7 業務 / 12 BUC |
| NFR | `docs/nfr/latest/_digest/index.md` → `category-A/B/E` | 可用性・性能・セキュリティ |
| Arch | `docs/arch/latest/_digest/index.md` → 全 section | tiers 9 / BC 7 |
| Design | `docs/design/latest/_digest/index.md` | portals 2 / screens 41 / components 34 |

trigger_event:
- rdra: `20260902_130741_initial_build`
- arch: `20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design`
- design: `20260902_185951_design_system`

## システム概要

- system_name: 図書館蔵書管理システム（ブランド名 `Libra`）
- interface_kind: `gui` → design あり。CLI 系ティアは生成しない
- アクター: 司書（社内 / 提供者）、利用者（社外 / 受益者）

## UC ツリー（7 業務 / 12 BUC / 41 UC）

```
蔵書管理業務
  蔵書を管理するフロー
    蔵書一覧を照会する / 書籍を登録する / 書籍情報を編集する / 書籍を削除する
蔵書利用業務
  書籍を検索するフロー
    書籍を検索する / 書籍詳細と在庫状況を照会する / 司書向けに蔵書を検索する
  書籍を貸し出すフロー
    利用者番号で貸出対象利用者を特定する / 書籍の貸出可否を判定する / 貸出を登録する /
    自分の貸出内容と返却期限を照会する
  書籍を返却するフロー
    返却対象の貸出を照会する / 返却を登録する / 返却後の書籍状態を更新する /
    自分の返却済み貸出を照会する
予約管理業務
  書籍を予約するフロー
    予約を登録する / 予約を取り消す / 自分の予約順位を照会する
  予約者へ通知するフロー
    予約順1位の利用者を特定する / 取置き通知メールを送信する / 自分の取置き状況を照会する
貸出期限管理業務
  返却期限をリマインドするフロー
    返却期限接近の貸出を判定する / リマインドメールを送信する / 自分の返却期限を照会する
  延滞を督促するフロー
    期限超過の貸出を延滞にする / 延滞中の貸出を照会する / 督促メールを送信する /
    自分の延滞中の貸出を照会する
利用者管理業務
  利用者を管理するフロー
    利用者一覧を照会する / 利用者を登録する / 利用者情報を編集する / 利用者を削除する /
    自分の利用者情報を照会する
利用照会業務
  貸出履歴を確認するフロー
    自分の現在の貸出を照会する / 自分の貸出履歴を照会する
  予約状況を確認するフロー
    自分の予約状況を照会する / 自分の取置き中の予約を照会する
蔵書分析業務
  在庫状況を把握するフロー
    在庫状況を区分別に集計する / 在庫状況レポートを参照する
  貸出統計を把握するフロー
    期間別貸出統計を集計する / 貸出統計レポートを参照する
```

## ティア選定（`tier-selection-rules.md` 適用）

arch の tiers 9 件のうち、UC 単位 Spec の対象は 4 件のみ。残り 5 件は cross-cutting 責務。

| tier_id | name | kind | UC Spec 対象 |
|---|---|---|---|
| `tier-frontend-patron` | 利用者ポータル | presentation | ○（社外アクター = 利用者） |
| `tier-frontend-staff` | 司書ポータル | presentation | ○（社内アクター = 司書） |
| `tier-backend-api` | バックエンド API | api | ○（全 UC） |
| `tier-worker` | バックエンドワーカー | worker | ○（CronJob 判定 / レポート集計 / MQ 通知送信の 7 UC） |
| `tier-api-gateway` | API Gateway | — | × cross-cutting |
| `tier-idp` | IdP | — | × cross-cutting |
| `tier-messaging` | メッセージング | — | × cross-cutting |
| `tier-datastore` | データストア | — | × cross-cutting（`_cross-cutting/datastore/`） |
| `tier-external-gateway` | 外部連携 | — | × cross-cutting（ACL。tier-worker の spec から参照） |

### UC ↔ ティアマッピング

| 業務 | UC | 対象ティア (kind) |
|---|---|---|
| 蔵書管理業務 | 蔵書一覧を照会する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書管理業務 | 書籍を登録する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書管理業務 | 書籍情報を編集する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書管理業務 | 書籍を削除する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 書籍を検索する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 書籍詳細と在庫状況を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 司書向けに蔵書を検索する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 利用者番号で貸出対象利用者を特定する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 書籍の貸出可否を判定する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 貸出を登録する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 自分の貸出内容と返却期限を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 返却対象の貸出を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 返却を登録する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 返却後の書籍状態を更新する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書利用業務 | 自分の返却済み貸出を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 予約管理業務 | 予約を登録する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 予約管理業務 | 予約を取り消す | tier-frontend-staff (presentation), tier-backend-api (api) |
| 予約管理業務 | 自分の予約順位を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 予約管理業務 | 予約順1位の利用者を特定する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 予約管理業務 | 取置き通知メールを送信する | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 予約管理業務 | 自分の取置き状況を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 貸出期限管理業務 | 返却期限接近の貸出を判定する | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 貸出期限管理業務 | リマインドメールを送信する | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 貸出期限管理業務 | 自分の返却期限を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 貸出期限管理業務 | 期限超過の貸出を延滞にする | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 貸出期限管理業務 | 延滞中の貸出を照会する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 貸出期限管理業務 | 督促メールを送信する | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 貸出期限管理業務 | 自分の延滞中の貸出を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 利用者管理業務 | 利用者一覧を照会する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者管理業務 | 利用者を登録する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者管理業務 | 利用者情報を編集する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者管理業務 | 利用者を削除する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者管理業務 | 自分の利用者情報を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 利用照会業務 | 自分の現在の貸出を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 利用照会業務 | 自分の貸出履歴を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 利用照会業務 | 自分の予約状況を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 利用照会業務 | 自分の取置き中の予約を照会する | tier-frontend-patron (presentation), tier-backend-api (api) |
| 蔵書分析業務 | 在庫状況を区分別に集計する | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 蔵書分析業務 | 在庫状況レポートを参照する | tier-frontend-staff (presentation), tier-backend-api (api) |
| 蔵書分析業務 | 期間別貸出統計を集計する | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 蔵書分析業務 | 貸出統計レポートを参照する | tier-frontend-staff (presentation), tier-backend-api (api) |

worker を付与した 7 UC の根拠（`app_architecture.tier_layers` の `tier-worker`「CronJob ハンドラ（日次判定・レポート集計）と MQ コンシューマハンドラ（通知送信）」）:

- CronJob 日次判定: 返却期限接近の貸出を判定する / 期限超過の貸出を延滞にする
- CronJob レポート集計: 在庫状況を区分別に集計する / 期間別貸出統計を集計する
- MQ 通知送信: 取置き通知メールを送信する / リマインドメールを送信する / 督促メールを送信する
- 取置き通知の起点: 取置き通知メールを送信する（`予約順1位の利用者を特定する` は同期判定のため worker を付与しない）

## 全体横断設計方針

- **UX**: 2 ポータル（patron = 社外利用者 / staff = 社内司書）でナビゲーションを分離。IA は RDRA の業務単位。
  利用者フローは「探す → 予約 → 受け取る → 返す」、司書フローは「受け入れる → 貸す → 返す → 督促する → 分析する」。
- **UI**: design-event.yaml の 3 層トークン（primitive → semantic → component）と 34 コンポーネントを正本とする。
  ポータル別 primary（patron `#1D4ED8` / staff `#0F766E`）で識別性を確保。JIS X 8341-3:2016 AA 目標。
- **データ可視化**: 蔵書分析業務の 2 レポート画面（在庫状況 / 貸出統計）と、督促・リマインドの件数サマリが対象。
- **API**: OpenAPI 3.1 単一ファイルに全 UC 統合。非同期はメール送信の 1 系統 → AsyncAPI を生成する。
- **データストア**: RDB 主体（7 エンティティ）。KVS はセッション/レート制限/レポートキャッシュ。Object Storage はレポート成果物。

## 検出した RDRA / Design 不整合

| # | 対象 | RDRA | Design | 本 Spec の扱い |
|---|---|---|---|---|
| 1 | UC「予約を取り消す」 | 画面「予約取消受付画面」/ アクター **司書** | portal **patron** `/reservations/:reservationId/cancel` | RDRA を優先し `tier-frontend-staff` で生成。todo.md に登録 |
