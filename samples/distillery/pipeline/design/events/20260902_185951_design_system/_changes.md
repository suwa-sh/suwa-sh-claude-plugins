# 変更サマリ

- event_id: 20260902_185951_design_system
- trigger_event: rdra:20260902_130741_initial_build / arch:20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design
- feedback_request_id: 20260902_184257_impl_feedback_d0f57ea2
- work units: CR-d0f57ea2-006#1（loading-state-components）/ CR-d0f57ea2-010#1（app-shell-routing-ownership）

## 追加

### UI コンポーネント

- `Spinner`（variants: inline / button / overlay、sizes: sm / md / lg）
- `Skeleton` の派生: `SkeletonCard` / `SkeletonDetail`

### 共通コンポーネント（4 件）

| 名前 | パス | 役割 |
|------|------|------|
| `LoadingState` | `src/components/common/LoadingState.tsx` | loading 表現の唯一の入口。kind で Skeleton / Spinner を出し分ける |
| `AppShell` | `src/components/common/AppShell.tsx` | エントリポイント兼シェル（`AppShell` / `AppShellByPath`） |
| `appRoutes` | `src/components/common/routes.ts` | URL の正本となるルート表 41 件 + `getRoute` / `buildPath` / `matchPath` / `routesOf` |
| `useAppNavigation` | `src/components/common/hooks/useAppNavigation.ts` | route id 指定の遷移 API |

### トークン

- component: `spinner.{track, indicator, thickness, thickness_lg, size_sm, size_md, size_lg, duration}`、`overlay.{backdrop, blur}`
- dark_overrides.component: `spinner_track`、`overlay_backdrop`

### NFR 決定（2 件）

- `B.2.1.1 / F.3.1.2`: loading 表現を LoadingState に集約する
- `E.5.3.1 / arch SP-004`: URL の正本を routes.ts に一元化し、AppShell がポータル外・未登録ルートを描画しない

### 決定記録

- `design-decision-006`: loading 表現の集約
- `design-decision-007`: アプリシェル・ルーティング所有権

### Storybook

- カテゴリ `Shell` を追加（`Shell/AppShell`。ルート表 41 件のカタログ Story を含む）
- `Common/LoadingState` Story を追加
- `UI/Feedback` に `Loading / Skeleton variants`、`Loading / Spinner` Story を追加
- `Design Tokens` MDX に spinner / loading overlay セクションを追加
- `Screen Mapping` MDX に「ルーティングの所有権」表を追加

## 変更

- `Skeleton` の variants に `card` / `detail` を追加
- `AsyncSection` の loading 分岐を `LoadingState` へ委譲（`skeleton` prop に `card` / `detail` を追加、`loadingDelayMs` を追加）
- `PortalPageLayout` に `onNavigate` を追加（サイドバー遷移を AppShell から注入するため）
- `storybook.categories.Common` の説明を 11 種へ更新

## 削除

- なし

## 対象外（この feedback 差分では触れていない）

- 画面（screens）の追加・削除。RDRA（`docs/rdra/latest/`）に無い画面・ルートは追加していない
- 既知の不整合「予約取消受付画面の portal（design=patron / spec=staff）」。所有 work unit 外のため未修正
- storybook build / dev server での画面確認。controller 指示により npm install を行わないため未実施
  （`docs/design/latest/storybook-app/node_modules` は削除済み）

## イベント記録の注記

`feedback_request` envelope は本イベントの `design-event-diff.yaml` にのみ記録し、
`latest/design-event.yaml` へはマージしていない（スナップショットはイベント固有のメタデータを持たない）。
