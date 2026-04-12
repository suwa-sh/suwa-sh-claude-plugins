# 推論メモ

## 入力

- 16件の tier-frontend.md (全 UC の Presentation 層仕様)
- _cross-cutting/ux-ui/ の UX/UI 設計仕様 (レイアウトパターン、共通コンポーネント設計)
- design-event.yaml のデザインシステム定義 (トークン、UI/Domain コンポーネント)

## 方針

1. 共通コンポーネント (common-components.md の設計) をまず実装し、ページ Story から参照可能にした
2. 全 16 UC に対応する 16 ページ Story を生成 (代表画面だけでなく全画面)
3. 各ページ Story には Default + 状態バリアント (Loading, Empty, Error, Completed 等) を含めた
4. UserPortalShell / AdminPortalShell で 2 ポータルのレイアウト差異を表現
5. Logo コンポーネントを全ページのヘッダー/サイドバーで使用
6. Icon コンポーネントを全ページで使用 (emoji 不使用)
7. デザイントークン (CSS 変数) を全コンポーネントで使用 (style prop 経由)

## UC 全数チェック

16 tier-frontend.md = 16 ページ Story (全数一致)
