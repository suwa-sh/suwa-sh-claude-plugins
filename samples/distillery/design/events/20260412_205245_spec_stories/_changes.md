# Spec Stories 変更一覧

## イベント ID: 20260412_205245_spec_stories

## 追加された共通コンポーネント (8件)

| コンポーネント | パス | 説明 |
|-------------|------|------|
| Logo | src/components/ui/Logo.tsx | ブランドロゴ (full/icon/stacked) |
| EmptyState | src/components/common/EmptyState.tsx | 空状態表示 |
| LoadingSkeleton | src/components/common/LoadingSkeleton.tsx | 読み込み中スケルトン |
| ErrorBanner | src/components/common/ErrorBanner.tsx | エラーバナー |
| ConfirmActionModal | src/components/common/ConfirmActionModal.tsx | 確認ダイアログ |
| PaginatedList | src/components/common/PaginatedList.tsx | ページネーション |
| UserPortalShell | src/components/common/UserPortalShell.tsx | 利用者ポータルレイアウト |
| AdminPortalShell | src/components/common/AdminPortalShell.tsx | 司書ポータルレイアウト |

## 追加された共通コンポーネント Story (7件)

| Story | パス |
|-------|------|
| Layout/UserPortalShell | src/stories/layout/UserPortalShell.stories.tsx |
| Layout/AdminPortalShell | src/stories/layout/AdminPortalShell.stories.tsx |
| Feedback/EmptyState | src/stories/feedback/EmptyState.stories.tsx |
| Feedback/LoadingSkeleton | src/stories/feedback/LoadingSkeleton.stories.tsx |
| Feedback/ErrorBanner | src/stories/feedback/ErrorBanner.stories.tsx |
| Modals/ConfirmActionModal | src/stories/modals/ConfirmActionModal.stories.tsx |
| Data/PaginatedList | src/stories/data/PaginatedList.stories.tsx |

## 追加されたページ Story (16件 = 全 UC)

### 利用者ポータル (7画面)

| 画面 | UC | Story パス |
|------|---|-----------|
| 蔵書検索画面 | 書籍を検索する | Pages/UserPortal/BookSearch.stories.tsx |
| 貸出手続き画面 | 書籍を貸出する | Pages/UserPortal/LoanCheckout.stories.tsx |
| 返却手続き画面 | 書籍を返却する | Pages/UserPortal/LoanReturn.stories.tsx |
| 予約申請画面 | 書籍を予約する | Pages/UserPortal/ReservationNew.stories.tsx |
| 予約管理画面 | 予約をキャンセルする | Pages/UserPortal/ReservationManage.stories.tsx |
| 貸出履歴画面 | 貸出履歴を確認する | Pages/UserPortal/LoanHistory.stories.tsx |
| 予約状況画面 | 予約状況を確認する | Pages/UserPortal/ReservationStatus.stories.tsx |

### 司書ポータル (9画面)

| 画面 | UC | Story パス |
|------|---|-----------|
| 蔵書登録画面 | 書籍を登録する | Pages/AdminPortal/BookRegister.stories.tsx |
| 蔵書編集画面 | 書籍情報を編集する | Pages/AdminPortal/BookEdit.stories.tsx |
| 蔵書管理画面 | 書籍を削除する | Pages/AdminPortal/BookManage.stories.tsx |
| 貸出状況一覧画面 | 貸出状況を確認する | Pages/AdminPortal/LoanStatus.stories.tsx |
| 延滞管理画面 | 延滞を検出する | Pages/AdminPortal/OverdueManage.stories.tsx |
| 利用者登録画面 | 利用者を登録する | Pages/AdminPortal/UserRegister.stories.tsx |
| 利用者編集画面 | 利用者情報を編集する | Pages/AdminPortal/UserEdit.stories.tsx |
| 在庫状況画面 | 在庫状況を確認する | Pages/AdminPortal/Inventory.stories.tsx |
| 統計レポート画面 | 統計レポートを閲覧する | Pages/AdminPortal/StatsReport.stories.tsx |
