# Design System: LibraShelf

## Overview

| 項目 | 内容 |
|------|------|
| Event ID | 20260412_164650_design_system |
| Created At | 2026-04-12T16:46:50 |
| Source | RDRA/NFR/Arch モデルからの初期デザインシステム生成 |
| Portals | 2 |
| Components | 11 |
| Screens | 16 |

## Brand

- **Name**: LibraShelf
- **Primary Color**: Library Blue (#1E40AF)
- **Secondary Color**: Slate (#334155)
- **Sans Font**: 'Noto Sans JP', 'Inter', system-ui, sans-serif
- **Mono Font**: 'JetBrains Mono', 'Fira Code', monospace
- **Type Scale**: xs, sm, base, lg, xl, "2xl", "3xl"
- **Tone**: 信頼・堅実
- **Principles**: 正確で分かりやすい情報提供, 落ち着いたトーンで安心感を与える, 専門用語を避け、誰にでも伝わる表現
- **Logo Variants**:
  - full: `assets/logo-full.svg`
  - icon: `assets/logo-icon.svg`
  - stacked: `assets/logo-stacked.svg`

## Portals

| ID | Name | Actor | Primary Color | Screen Count |
|-----|------|-------|:-------------:|:------------:|
| user | 利用者ポータル | 利用者 | #2563EB | 7 |
| admin | 司書ポータル | 司書 | #334155 | 9 |

## Design Tokens

### Primitive

- **Color Scales**: white, black, gray-50, gray-100, gray-200, gray-300, gray-400, gray-500, gray-600, gray-700, gray-800, gray-900, gray-950, blue-50, blue-100, blue-200, blue-300, blue-400, blue-500, blue-600, blue-700, blue-800, blue-900, slate-500, slate-600, slate-700, slate-800, green-50, green-500, green-600, green-700, red-50, red-500, red-600, red-700, orange-50, orange-500, orange-600, amber-400, amber-500, violet-50, violet-500, violet-600 (43 scales)
- **Spacing Scale**: px: 1px, "0.5": 0.125rem, "1": 0.25rem, "1.5": 0.375rem, "2": 0.5rem, "3": 0.75rem, "4": 1rem, "5": 1.25rem, "6": 1.5rem, "8": 2rem, "10": 2.5rem, "12": 3rem, "16": 4rem
- **Radius**: none, sm, md, lg, xl, full
- **Shadow**: sm, md, lg
- **Font Size**: xs, sm, base, lg, xl, "2xl", "3xl"
- **Duration**: fast, normal, slow

### Semantic

- **background**: var(--color-white)
- **foreground**: var(--color-gray-900)
- **border**: var(--color-gray-200)
- **muted**: var(--color-gray-100)
- **muted-foreground**: var(--color-gray-500)
- **primary**: var(--color-blue-600)
- **primary-foreground**: var(--color-white)
- **success**: var(--color-green-600)
- **success-light**: var(--color-green-50)
- **warning**: var(--color-orange-500)
- **warning-light**: var(--color-orange-50)
- **destructive**: var(--color-red-600)
- **destructive-light**: var(--color-red-50)
- **info**: var(--color-blue-500)
- **info-light**: var(--color-blue-50)
- **rating**: var(--color-amber-500)
- **virtual_accent**: var(--color-violet-500)

### Component

- **button**: height-sm, height-md, height-lg, padding-x-sm, padding-x-md, padding-x-lg, radius, font-size, font-weight
- **input**: height, padding-x, radius, border, focus-ring
- **card**: bg, border, shadow, padding, radius
- **badge**: height, padding-x, radius, font-size, font-weight
- **table**: header-bg, row-height, cell-padding
- **sidebar**: width, item-height

### Dark Mode Overrides

**Semantic overrides:**

- **background**: var(--color-gray-950)
- **foreground**: var(--color-gray-100)
- **border**: var(--color-gray-800)
- **muted**: var(--color-gray-900)
- **muted-foreground**: var(--color-gray-400)
- **primary**: var(--color-blue-500)
- **primary-foreground**: var(--color-white)
- **success**: var(--color-green-500)
- **success-light**: rgba(22, 163, 74, 0.15)
- **warning**: var(--color-orange-500)
- **warning-light**: rgba(249, 115, 22, 0.15)
- **destructive**: var(--color-red-500)
- **destructive-light**: rgba(220, 38, 38, 0.15)
- **info**: var(--color-blue-400)
- **info-light**: rgba(59, 130, 246, 0.15)

**Component overrides:**

- **card**: bg, border, shadow
- **table**: header-bg
- **hover-muted**: var(--color-gray-800)

## Components

### UI Components

| Name | Variants | Sizes |
|------|----------|-------|
| Button | default, secondary, outline, ghost, destructive | sm, md, lg |
| Badge | default, success, warning, destructive, info, outline | - |
| Card | default, hoverable | - |
| Input | default, error | - |
| Icon | - | - |

### Domain Components

| Name | Description | Screens |
|------|-------------|---------|
| BookCard | 書籍情報をカード形式で表示するコンポーネント。蔵書検索結果の一覧表示に使用 | 蔵書検索画面, 蔵書管理画面 |
| BookLoanStatusBadge | 書籍貸出状態を表すステータスバッジ。在庫あり/貸出中/延滞中の3状態 | 蔵書検索画面, 蔵書管理画面, 貸出状況一覧画面 |
| ReservationStatusBadge | 予約状態を表すステータスバッジ。予約受付中/予約確保済/予約キャンセルの3状態 | 予約管理画面, 予約状況画面 |
| LoanRecord | 貸出記録を一行表示するコンポーネント。貸出状況一覧や貸出履歴で使用 | 貸出状況一覧画面, 貸出履歴画面, 延滞管理画面 |
| BookSearchFilter | 蔵書検索のフィルターコンポーネント。キーワード検索+ジャンル/資料種別フィルター | 蔵書検索画面 |
| StatsSummaryCard | 統計情報をサマリー表示するカードコンポーネント | 統計レポート画面, 在庫状況画面 |

## Screen Mapping

### 利用者ポータル (user)

| Name | Route | Components |
|------|-------|------------|
| 蔵書検索画面 | /books/search | BookSearchFilter, BookCard, BookLoanStatusBadge |
| 貸出手続き画面 | /loans/new | BookCard, BookLoanStatusBadge, Button |
| 返却手続き画面 | /loans/return | LoanRecord, Button |
| 予約申請画面 | /reservations/new | BookCard, ReservationStatusBadge, Button |
| 予約管理画面 | /reservations | ReservationStatusBadge, BookCard, Button |
| 貸出履歴画面 | /mypage/loans | LoanRecord, BookLoanStatusBadge |
| 予約状況画面 | /mypage/reservations | ReservationStatusBadge, BookCard |

### 司書ポータル (admin)

| Name | Route | Components |
|------|-------|------------|
| 蔵書登録画面 | /admin/books/new | Input, Button |
| 蔵書編集画面 | /admin/books/:id/edit | Input, Button |
| 蔵書管理画面 | /admin/books | BookCard, BookLoanStatusBadge, BookSearchFilter, Button |
| 貸出状況一覧画面 | /admin/loans | LoanRecord, BookLoanStatusBadge |
| 延滞管理画面 | /admin/loans/overdue | LoanRecord, BookLoanStatusBadge, Button |
| 利用者登録画面 | /admin/users/new | Input, Button |
| 利用者編集画面 | /admin/users/:id/edit | Input, Button |
| 在庫状況画面 | /admin/inventory | StatsSummaryCard, BookCard, BookLoanStatusBadge |
| 統計レポート画面 | /admin/stats | StatsSummaryCard |

## State Mapping

### 書籍貸出状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 在庫あり | 在庫あり | green | user: 貸出申請, admin: 編集, 削除 |
| 貸出中 | 貸出中 | blue | user: 予約申請, 返却申請, admin: 確認 |
| 延滞中 | 延滞中 | red | user: 返却申請, admin: 督促通知送信 |

### 予約状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 予約受付中 | 予約受付中 | blue | user: キャンセル, admin: 確認 |
| 予約確保済 | 予約確保済 | green | user: 貸出手続き, admin: 確認 |
| 予約キャンセル | キャンセル済 | gray | - |

## NFR Design Decisions

| NFR | Decision |
|-----|----------|
| A.1.1.1 運用時間 Lv2 | 全画面にローディング状態とエラー状態を配置。サービス停止時間帯の告知バナーコンポーネントを用意 |
| B.1.1.1 同時アクセス Lv1 (~100) | 蔵書検索結果はページネーション（20件/ページ）。仮想スクロールは不要 |
| B.2.1.1 レスポンスタイム Lv2 (10秒以内) | 一覧画面に Skeleton UI を配置しパーシーブドパフォーマンスを改善 |
| E.5.1.1 認証方式 Lv2 (OAuth2/OIDC) | ログインは IdP Hosted UI に委譲。カスタムログイン画面は作成しない |
| E.5.2.1 認可方式 Lv2 (RBAC) | data-portal 属性によるポータル別ナビゲーション切替。利用者/司書で表示画面を分離 |
| E.1.2.1 PII保護 | 利用者情報（連絡先、メールアドレス）のマスク表示機能。司書ポータルでのみ閲覧可能 |
