# 変更サマリ

- event_id: 20260902_204527_design_system
- trigger_event: rdra:20260902_130741_initial_build / arch:20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design
- feedback_request_id: 20260902_213000_impl_feedback_d0f57ea2
- work units: CR-d0f57ea2-006#1（loading-state-components）

## 追加

### コンポーネント定義のメタデータ

`components.ui[]` の全 14 件に、名前 → ファイル → export の解決情報を追加した。

| name | path | exports |
|------|------|---------|
| Button | `src/components/ui/Button.tsx` | Button |
| Badge | `src/components/ui/Badge.tsx` | Badge |
| Card | `src/components/ui/Card.tsx` | Card, CardHeader |
| Input | `src/components/ui/Input.tsx` | Input |
| ToggleGroup | `src/components/ui/ToggleGroup.tsx` | ToggleGroup |
| Table | `src/components/ui/Table.tsx` | Table |
| Alert | `src/components/ui/Feedback.tsx` | Alert |
| EmptyState | `src/components/ui/Feedback.tsx` | EmptyState |
| **Skeleton** | `src/components/ui/Feedback.tsx` | Skeleton, SkeletonTable, SkeletonCard, SkeletonDetail |
| **Spinner** | `src/components/ui/Feedback.tsx` | Spinner |
| Pagination | `src/components/ui/Pagination.tsx` | Pagination |
| Modal | `src/components/ui/Modal.tsx` | Modal |
| Icon | `src/components/ui/Icon.tsx` | Icon, iconNames |
| PortalShell | `src/components/ui/PortalShell.tsx` | PortalShell, staffNav, patronNav |

### 利用条件（usage）

- `Skeleton`: 「loading 中の領域形状プレースホルダ。画面から直接使わず common/LoadingState 経由で使う（kind=list/card/detail/line）」
- `Spinner`: 「loading 中の回転インジケータ。画面から直接使わず common/LoadingState 経由で使う（kind=action/page）」

### 決定記録

- `design-decision-008`: components.ui[] への path / exports 付与と、ファイル名に依存しない解決方針

### Storybook

- `Common/LoadingState` の docs に「取り込み先での参照（import 解決表）」を追加
  （`src/stories/feedback/LoadingState.stories.tsx`）

## 変更

- `common` の `LoadingState` の description に import 規約を追記
  （画面実装は LoadingState だけを import し、Skeleton / Spinner を直接 import しない。
  実体は `src/components/ui/Feedback.tsx` に同居する）

## 削除

- なし

## 対象外（この feedback 差分では触れていない）

- `Feedback.tsx` の分割（`Skeleton.tsx` / `Spinner.tsx` への切り出し）。
  取り込み済み `packages/ui` の import パスを壊さないため行わない（design-decision-008 参照）
- `components.domain[]` / `components.common[]` の path 補完。所有 work unit 外
- 画面（screens）・トークン・ルート表の変更。RDRA（`docs/rdra/latest/`）に無い画面・ルートは追加していない
- 既知の不整合「予約取消受付画面の portal（design=patron / spec=staff）」。所有 work unit 外のため未修正
- storybook build / dev server での画面確認。controller 指示により npm install を行わないため未実施
  （`docs/design/latest/storybook-app/node_modules` は未配置）。Step8 は静的検証で代替した

## イベント記録の注記

`feedback_request` envelope は本イベントの `design-event-diff.yaml` にのみ記録し、
`latest/design-event.yaml` へはマージしていない（スナップショットはイベント固有のメタデータを持たない）。
`storybook-app/` はハイブリッド方式に従い events/ には含めない（latest/ のみで管理）。
