# 共通コンポーネント設計

## 概要

全 UC の tier-frontend.md を俯瞰し、複数 UC で共通して使われるコンポーネントパターンを抽出した。design-event.yaml の既存コンポーネント（UI + Domain）との関係を整理する。

## 共通レイアウトシェル

### UserPortalShell

利用者ポータルの共通レイアウト。ヘッダー + コンテンツ構成。

- **利用UC**: 書籍を検索する、書籍を貸出する、書籍を返却する、書籍を予約する、予約をキャンセルする、貸出履歴を確認する、予約状況を確認する
- **構成**: Logo (full) + プライマリナビ + ユーザーメニュー + コンテンツエリア + フッター
- **Props**:
  - activePage: string（現在のページ識別子）
  - userName: string（ログインユーザー名）

### AdminPortalShell

司書ポータルの共通レイアウト。サイドバー + ヘッダー + メイン構成。

- **利用UC**: 書籍を登録する、書籍情報を編集する、書籍を削除する、貸出状況を確認する、延滞を検出する、利用者を登録する、利用者情報を編集する、在庫状況を確認する、統計レポートを閲覧する
- **構成**: サイドバー（Logo icon + ナビ） + ヘッダー（パンくずリスト + ユーザーメニュー） + メインコンテンツ
- **Props**:
  - activePage: string
  - userName: string
  - sidebarCollapsed: boolean

## 共通フォームパターン

### EntityEditForm

入力 -> バリデーション -> 送信 -> 完了のフォームパターン。

- **利用UC**: 書籍を登録する、書籍情報を編集する、利用者を登録する、利用者情報を編集する
- **design-event.yaml コンポーネント**: Input, Button
- **構成**: フォームフィールド群 + 送信ボタン (Button default) + キャンセルボタン (Button outline)
- **Props**:
  - fields: FormField[]（フィールド定義配列）
  - initialData?: Record<string, any>（編集時の初期値）
  - onSubmit: (data) => Promise<void>
  - isLoading: boolean
- **状態**: formValues, errors, isSubmitting
- **バリデーション**: 必須チェック、パターンチェック（ISBN等）、サーバーエラーの各フィールドへのマッピング

### SearchFilterPanel

検索 + フィルター + ページネーションの一覧パターン。

- **利用UC**: 書籍を検索する、書籍を削除する（蔵書管理画面）
- **design-event.yaml コンポーネント**: BookSearchFilter, Input, Button
- **構成**: キーワード入力 + フィルター展開パネル + 検索ボタン
- **Props**:
  - onSearch: (query: SearchQuery) => void
  - genres: string[]
  - materialTypes: string[]

## 共通一覧パターン

### PaginatedList

テーブル + フィルター + ページネーションの組み合わせ。

- **利用UC**: 貸出状況を確認する、延滞を検出する、貸出履歴を確認する、予約状況を確認する
- **design-event.yaml コンポーネント**: Card, Badge
- **構成**: 一覧テーブル/カード + ページネーションコントロール
- **Props**:
  - items: T[]
  - total: number
  - page: number
  - perPage: number
  - onPageChange: (page: number) => void
  - renderItem: (item: T) => ReactNode
- **レスポンシブ**: Desktop はテーブル、Mobile はカード表示に自動切替

## 共通状態表示パターン

### LoadingSkeleton

データ取得中のスケルトン表示。

- **利用UC**: 全画面共通
- **構成**: テーブル行形状/カード形状のスケルトンアニメーション
- **Props**:
  - variant: "table-row" | "card" | "form"
  - count: number（表示行数）

### ErrorBanner

API エラー時のバナー表示。

- **利用UC**: 全画面共通
- **構成**: アラートバナー（RFC 7807 detail メッセージ表示） + 閉じるボタン
- **Props**:
  - error: ProblemDetails | null
  - onDismiss: () => void
- **design-event.yaml トークン**: var(--semantic-destructive-light) 背景、var(--semantic-destructive) テキスト

### EmptyState

データが0件の場合の空状態表示。

- **利用UC**: 貸出状況を確認する、貸出履歴を確認する、予約状況を確認する、書籍を検索する
- **構成**: アイコン + メッセージテキスト + アクションボタン（任意）
- **Props**:
  - message: string
  - actionLabel?: string
  - onAction?: () => void

### ConfirmActionModal

破壊的操作の確認ダイアログ。

- **利用UC**: 書籍を削除する、予約をキャンセルする
- **design-event.yaml コンポーネント**: Card, Button (destructive), Button (outline)
- **構成**: タイトル + メッセージ + 実行ボタン (destructive) + キャンセルボタン (outline)
- **Props**:
  - isOpen: boolean
  - title: string
  - message: string
  - confirmLabel: string
  - onConfirm: () => Promise<void>
  - onCancel: () => void
  - isLoading: boolean

### ProcessingState

送信中/処理中の状態表示。

- **利用UC**: 書籍を貸出する、書籍を返却する、書籍を予約する
- **構成**: Button disabled + Spinner アニメーション
- **適用方法**: Button の isLoading prop で制御
