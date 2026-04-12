# UI デザイン仕様

## レイアウトパターン

### 利用者ポータル

- **レイアウト構成**: ヘッダー + コンテンツ（サイドバーなし）
- **ヘッダー**: 固定。ロゴ（Logo full variant）、プライマリナビ（蔵書検索、貸出、返却、予約、マイページ）、ユーザーメニュー
- **サイドバー**: なし（利用者向けはシンプルな構成でサイドバー不要）
- **コンテンツエリア**: 最大幅 1280px、中央寄せ、padding 16-24px
- **フッター**: サービス情報、利用規約リンク

### 司書ポータル

- **レイアウト構成**: サイドバー + ヘッダー + メイン
- **ヘッダー**: 固定。ロゴ（Logo icon variant）、パンくずリスト、ユーザーメニュー
- **サイドバー**: 左固定 16rem（design-event.yaml sidebar.width）。折りたたみ可能。プライマリナビ（蔵書管理、貸出管理、利用者管理、統計）+ セカンダリナビ
- **コンテンツエリア**: フル幅（サイドバー除く）、padding 24px
- **フッター**: なし（管理画面のため省略）

### 共通レイアウト要素

| 要素 | デザインシステムコンポーネント | 配置 |
|------|------------------------------|------|
| ロゴ | Logo（full / icon variant） | ヘッダー左 |
| ナビゲーション | Button (ghost variant) | ヘッダー / サイドバー |
| ステータスバッジ | BookLoanStatusBadge, ReservationStatusBadge | コンテンツ内 |
| アクションボタン | Button (default / destructive variant) | コンテンツ内 |
| 入力フォーム | Input (default / error variant) | コンテンツ内 |
| カード | Card (default / hoverable variant) | コンテンツ内 |
| 検索フィルター | BookSearchFilter | コンテンツ上部 |
| 統計サマリー | StatsSummaryCard | コンテンツ上部 |
| サービス停止告知 | Badge (warning variant) | ヘッダー直下（必要時のみ） |

## レスポンシブ戦略

### ブレイクポイント

| 名称 | 幅 | レイアウト変更 |
|------|---|-------------|
| Mobile | < 640px | 単一カラム。ハンバーガーメニュー。テーブルはカード表示に切替。フォームはスタック |
| Tablet | 640px - 1024px | 司書ポータルのサイドバーを折りたたみ（アイコンのみ）。2カラムグリッド |
| Desktop | > 1024px | フルレイアウト。司書ポータルのサイドバー展開。3-4カラムグリッド |

### モバイル対応方針

- **ナビゲーション**: 利用者ポータルはハンバーガーメニュー + ボトムナビ（蔵書検索、マイページの2項目）。司書ポータルはハンバーガーメニューのみ
- **テーブル**: 横スクロール + カード表示切替トグル。貸出状況一覧・延滞管理は Mobile 時にカード形式で表示
- **フォーム**: 全入力要素をスタック表示。ラベルは入力欄の上に配置。タッチターゲット 44x44px 以上

## デザインシステムコンポーネント利用ガイドライン

### コンポーネント選定ルール

| 用途 | 推奨コンポーネント | 非推奨 | 理由 |
|------|-----------------|--------|------|
| 主要アクション（貸出申請、登録等） | Button (default, size: md) | Button (ghost) | 主要操作は視覚的に目立たせる |
| 破壊的操作（削除、キャンセル） | Button (destructive) | Button (default) | 危険操作の視覚的区別 |
| 書籍情報表示 | BookCard (compact / detailed) | Card (default) + 手動レイアウト | ドメイン特化コンポーネントの統一的使用 |
| 在庫状態表示 | BookLoanStatusBadge | Badge (default) + 手動色設定 | 状態 → 色マッピングが一元管理される |
| 予約状態表示 | ReservationStatusBadge | Badge (default) + 手動色設定 | 状態 → 色マッピングが一元管理される |
| 貸出記録表示 | LoanRecord (default / overdue) | 手動テーブル行 | 延滞ハイライトが自動適用される |
| 統計サマリー | StatsSummaryCard | Card + 手動レイアウト | KPI 表示の統一感を確保 |
| テキスト入力 | Input (default) | カスタム input | デザイントークンの自動適用 |
| 検索・フィルター | BookSearchFilter | 手動フォーム構築 | ジャンル/資料種別のフィルター統合済み |

### 状態表示パターン

| 状態モデル | 状態 | 表示方法 | コンポーネント | カラートークン |
|-----------|------|---------|-------------|-------------|
| 書籍貸出状態 | 在庫あり | Badge | BookLoanStatusBadge (available) | success (#22C55E) |
| 書籍貸出状態 | 貸出中 | Badge | BookLoanStatusBadge (on_loan) | info (#3B82F6) |
| 書籍貸出状態 | 延滞中 | Badge | BookLoanStatusBadge (overdue) | destructive (#EF4444) |
| 予約状態 | 予約受付中 | Badge | ReservationStatusBadge (pending) | info (#3B82F6) |
| 予約状態 | 予約確保済 | Badge | ReservationStatusBadge (reserved) | success (#22C55E) |
| 予約状態 | 予約キャンセル | Badge | ReservationStatusBadge (cancelled) | muted-foreground (#64748B) |

## ダークモード対応方針

- **切替方式**: システム設定連動（prefers-color-scheme）+ 手動切替トグル（ヘッダーのユーザーメニュー内）
- **トークン戦略**: design-event.yaml の dark_overrides.semantic / dark_overrides.component を参照。カード背景は gray-900、テーブルヘッダーは gray-900、ホバー時は gray-800
- **注意事項**: 
  - BookLoanStatusBadge / ReservationStatusBadge のカラーはダークモードでも視認性を確保（背景とのコントラスト比 4.5:1 以上）
  - StatsSummaryCard のチャート色はダークモード用パレットを別途定義（暗い背景での視認性確保）
  - シャドウはダークモードで無効化（dark_overrides.component.card.shadow: none）
