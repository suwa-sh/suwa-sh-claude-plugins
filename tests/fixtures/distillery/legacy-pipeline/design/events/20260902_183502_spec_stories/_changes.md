# 変更サマリ

- event_id: 20260902_183502_spec_stories
- trigger_event: spec:20260902_152849_spec_generation

## 追加

### 共通コンポーネント（10 件 + フック 3 件）

`_cross-cutting/ux-ui/common-components.md` の設計に従い、既存 UI/Domain コンポーネントの合成として実装。
新しい視覚表現・状態・トークンは追加していない。

- PortalPageLayout, AsyncSection, DataListSection, FilterPanel, EntityFormSection,
  ConfirmActionModal, SubmitActionButton, PiiMaskedText, NotificationLogSection, ReportSummarySection
- hooks: useListQueryState, useIdempotentMutation, useApiErrorPresenter

既存の `src/components/ui/PortalShell.tsx` を軽微に更新し、ブランド表記をハードコードの Icon+テキストから
`Logo` コンポーネント（`@/components/ui/Logo`、新規追加）参照に置き換えた（見た目の破壊的変更なし）。

### ページ Story（41 件、全 UC）

利用者ポータル 16 画面 / 司書ポータル 25 画面。5 つの並列サブエージェント（業務単位グループ）で生成し、
各画面 `PortalPageLayout` でラップ、BDD シナリオの状態（Default/Loading/Empty/ErrorState 等）をカバー。
配置は `src/stories/Pages/{ポータル名}/{画面名}.stories.tsx`（大文字 Pages 固定）。

## 変更

- `screens[]`（41 件）に `story`（Pages Story への参照）・`variants`（Story export 名一覧）を付与
- `storybook.categories` に `Common` / `Pages` を追加

## 既知の不一致（未修正・トラッキング済み）

- 「予約取消受付画面」: design-event.yaml の既存宣言は `portal: "patron"` だが、
  `tier-frontend-staff.md`（spec 側、より新しい正本）は「RDRA の BUC.tsv で本 UC のアクターが司書」として
  `portal: "staff"` で仕様化しており、todo 登録済みの既知のねじれと明記されている。
  本イベントでは spec の実装（staff）に合わせて Story を生成し、`screens[]` diff にコメント付きで記録した。
  design-event.yaml の `portal` フィールド自体（`patron`）は本イベントでは書き換えていない
  （所有範囲外の是正のため、別途 design ステージでの対応が必要）。

## 削除

- なし
