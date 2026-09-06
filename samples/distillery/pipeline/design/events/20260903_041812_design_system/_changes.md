# 変更内容 — 20260903_041812_design_system（初期構築）

すべて「追加」。差分の基点はなし。

## 追加

| 区分 | 内容 |
|---|---|
| brand | Libro（信頼・堅実路線）。primary #2563EB / secondary #334155。Noto Sans JP + Inter / JetBrains Mono。ボイス原則 5 件 |
| portals | patron（利用者ポータル, 6 画面）/ staff（司書ポータル, 18 画面） |
| tokens.primitive | gray / blue / slate / green / amber / orange / red / violet、spacing 11 段、radius 6、shadow 4、font_size 7、duration 3、breakpoint 4 |
| tokens.semantic | background / foreground / border / hover / primary（ポータル別）/ status 7 系統（+light）/ layout・spacing 8 |
| tokens.component | button / input / card / badge / table / sidebar / modal / due_date / queue_tracker / stat_card / chart / pii |
| tokens.dark_overrides | semantic 全項目 + component 8 項目（status-light は rgba） |
| components.ui | Button / Badge / Card / Input / Select / ToggleGroup / Table / Alert / EmptyState / Skeleton / Spinner / Pagination / Modal / Icon / PortalShell（15） |
| components.domain | BookStatusBadge / LoanStatusBadge / ReservationStatusBadge / ReservationQueueTracker / DueDateIndicator / BookSearchFilter / BookCard / BookTable / BookForm / UserForm / UserTable / PiiMaskedText / LoanTable / OverdueTable / NotificationLogTable / LoanRegisterPanel / ReturnRegisterPanel / ReservationTable / ConfirmPanel / StatCard / RankingList / PeriodSelector / PeriodStatChart（23） |
| screens | RDRA BUC.tsv の画面 24 件すべて（RDRA 外の画面は追加なし） |
| states | 書籍の状態（3）/ 貸出の状態（3）/ 予約の状態（3） |
| nfr_decisions | 9 件（B.1.1.1 / B.2.1.1 / B.2.1.3 / E.1.2.1 / E.6.1.1 / E.5.3.1 / SR-002 / SR-005 / F.1.1.3 / F.3.1.2 / CTP-007） |
| assets | logo-full / logo-icon / logo-stacked、icons 49 種（outlined, 24x24, currentColor） |
| decisions | design-decision-001〜007 |
| storybook-app（latest/ のみ） | Next.js 16 + Storybook 10（nextjs-vite）。UI 11 stories / Domain 5 stories ファイル / MDX 4（Introduction, Design Tokens, Screen Mapping, State Mapping）/ Brand Icons・Logo |

## todo.md 登録（confidence: low の仮採用）

- DIST-027 スマートフォン対応の要否（NFR F.1.1.3）
- DIST-028 アクセシビリティ目標レベル（NFR F.3.1.2）
