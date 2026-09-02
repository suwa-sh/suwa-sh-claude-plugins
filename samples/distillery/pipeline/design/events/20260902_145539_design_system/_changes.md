# 変更内容 — 20260902_145539_design_system（初期構築）

- 種別: **初期構築**（全要素を「追加」として記録する）
- trigger_event: rdra `20260902_130741_initial_build` / arch `20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design`
- dialogue_policy: `auto_adopt`

## 追加した要素

| 区分 | 件数 | 内容 |
|---|---:|---|
| ブランド | 1 | `Libra`（仮称）/ タグライン「図書館蔵書管理システム」/ 和欧ペア Noto Sans JP + Inter / ボイス原則 5 件 |
| ポータル | 2 | `patron`（利用者 / 17 画面 / `#1D4ED8`）、`staff`（司書 / 24 画面 / `#0F766E`） |
| primitive トークン | 8 スケール + 7 群 | gray / blue / teal / green / amber / orange / red / violet の色スケール、spacing（4px グリッド 11 段）、radius 6、shadow 4、font-size 7、font-weight 4、duration 3、breakpoint 4 |
| semantic トークン | 32 | 面 / 文字 / 線 / 状態 7 系統 / ポータル primary / レイアウト 3 / スペーシング 4 |
| component トークン | 15 群 | button / input / card / badge / table / sidebar / modal / alert / skeleton / pagination + ドメイン 5 群（duedate / queue / kpi / chart / pii） |
| dark override | 全 semantic + component | `.dark` クラスと `@media (prefers-color-scheme: dark)` の両方に定義。status `-light` は `rgba()` 半透明値 |
| UI コンポーネント | 13 | Button / Badge / Card / Input / ToggleGroup / Table / Alert / EmptyState / Skeleton / Pagination / Modal / Icon / PortalShell |
| ドメインコンポーネント | 18 | StatusBadge 6 種 / BookCard / BookSearchFilter / DueDateIndicator / LoanTable / ReservationQueueTracker / HoldPickupCard / UserProfileCard / UserTable / NotificationLogTable / ReportKpiCard / ReportPeriodSelector / LoanTrendChart |
| 共通モジュール | 3 | PortalShell / stateMaps / Icon |
| 画面マッピング | 41 | RDRA `BUC.tsv` の画面定義と 1:1。RDRA に無い画面の追加はゼロ |
| 状態マッピング | 6 モデル / 19 状態 | 書籍状態 3 / 貸出状態 3 / 予約状態 4 / 利用者状態 2 / 通知状態 3 / 統計レポート状態 3 |
| NFR 設計判断 | 10 | F.1.1.2 / F.1.1.3 / F.3.1.2 / B.1.1.1 / B.2.1.1 / E.1.2.1 / E.5.3.1 / A + SP-004 / SR-002 / SR-004 |
| 決定記録 | 5 | design-decision-001〜005 |
| ロゴ SVG | 3 | logo-full / logo-icon / logo-stacked |
| アイコン SVG | 42 | Lucide 準拠 24×24 outline（`currentColor`） |
| Storybook Story | 132 エントリ | story 104 / docs 28 |
| MDX ドキュメント | 4 | Introduction / Design Tokens / Screen Mapping / State Mapping |

## RDRA 整合性

- `BUC.tsv` の `関連モデル=画面` から抽出した **41 画面すべて**を `screens` に取り込んだ（追加も削除もしていない）
- `状態.tsv` の 6 状態モデル・19 状態をそのままの表記で `states` と `stateMaps.ts` に取り込んだ
- `バリエーション.tsv` の 9 バリエーションを `ToggleGroup` の選択肢定数として取り込んだ
- **RDRA に存在しない画面・状態の自動追加はゼロ**

## 確認推奨項目の扱い（auto_adopt）

| 項目 | confidence | 扱い |
|---|---|---|
| D1 ブランド方針 | high | ⭐推奨（信頼・堅実路線）を採用 |
| D2 カラーパレット | high | ⭐推奨（信頼感ブルー系）を採用 |
| D3 タイポグラフィ | high | ⭐推奨（Noto Sans JP + Inter）を採用 |
| D4 レイアウト方針 | high | ⭐推奨（12 列グリッド + サイドバーナビ）を採用 |
| D5 コンポーネントスタイル | medium | ⭐推奨（radius 8px / shadow sm）を採用 |
| D6 アイコノグラフィ | high | ⭐推奨（Lucide 準拠 SVG 自作）を採用 |
| D7 ブランド名称 | **low** | ⭐推奨（仮称 Libra）を**仮採用** → `docs/todo.md` DIST-027 |
| D8 スマートフォン対応 | **low** | ⭐推奨（PC + タブレットのみフル設計）を**仮採用** → `docs/todo.md` DIST-028 |
| D9 アクセシビリティ適合レベル | **low** | ⭐推奨（AA 目標・宣言なし）を**仮採用** → `docs/todo.md` DIST-029 |

## 画面確認（Step8）

Storybook dev server（`localhost:6006`）に対して Playwright で 177 パターン
（全 104 story × light/patron + 主要 24 story × dark/staff の組合せ）と docs 4 ページを検査した。

- はみ出し: 0 件
- 文字切れ: 0 件（`.ds-sr-only` の `<caption>` は意図的な視覚非表示のため対象外）
- 色の未解決: 0 件（`--background` / `--foreground` / `--primary` / `--hover-muted` / `--color-white` の解決を全パターンで確認）
- JS エラー: 0 件（`ScreenMapping.mdx` の `<p>` 入れ子による hydration 警告を検出したため `<div>` へ修正済み）
- ポータル切替: patron `#1D4ED8` / staff `#0F766E`、dark で patron `#60A5FA` / staff `#2DD4BF` に切り替わることを確認
- スクリーンショット: `/tmp/dds_shots/`（story 177 枚）、`/tmp/dds_docshots/`（docs 4 枚 + クリップ 4 枚）

## ビルド検証（Step9）

- `npx tsc --noEmit`: エラー 0
- `npx storybook build`: 成功
