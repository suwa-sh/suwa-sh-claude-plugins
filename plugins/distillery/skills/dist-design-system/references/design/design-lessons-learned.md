# Design System 実装の教訓

このセッションで発見した問題と解決策の一覧。スキル実行時に必ず参照すること。

---

## 必須ルール

### 1. 画面確認なしに完了扱いにしない

- Storybook の `npx storybook build` 成功 ≠ UI が正しい
- **必ずブラウザで目視確認してから完了とする**
- 利用可能なツールすべてで確認を試みる:
  1. `mcp__chrome-devtools__` (navigate_page, take_screenshot, evaluate_script, emulate)
  2. `mcp__claude-in-chrome__` (tabs_create_mcp, computer screenshot)
  3. `mcp__playwright__` (browser_navigate, browser_take_screenshot)
- OS が dark mode の場合、`mcp__chrome-devtools__emulate` で `colorScheme: light` を設定してから確認する
- iframe URL (`/iframe.html?id=...&viewMode=story`) に直接アクセスすると描画が速い

### 2. 当たり前品質チェックリスト

以下は**必ず解消する**。完了前に全項目を確認:

- [ ] **はみ出し**: 要素が親コンテナからはみ出していないか
- [ ] **文字切れ**: テキストが途中で切れていないか（特に金額、長い日本語）
- [ ] **コントラスト**: テキストが背景に対して読めるか（全ポータル x light/dark）
- [ ] **クリッカブル**: インタラクティブ要素にホバー/ポインターカーソルがあるか
- [ ] **色の適用**: CSS変数が正しく解決されているか（透明や黒になっていないか）

---

## Tailwind v4 固有の問題

### text-[var(--color)] が色として機能しない

**問題**: Tailwind v4 では `text-[var(--custom-color)]` を `font-size` として解釈する。`text-[color:var(--custom-color)]` も動かない場合がある。

**解決策**: 色指定は `style` prop で直接指定する。

```tsx
// NG: Tailwind v4 で色が適用されない
<button className="text-[var(--primary-foreground)]">...</button>
<button className="text-[color:var(--primary-foreground)]">...</button>

// OK: style prop で直接指定
const variantColors = { default: 'var(--primary-foreground)' }
<button style={{ color: variantColors[variant] }}>...</button>

// OK: @theme inline で登録して Tailwind ネイティブクラスを使う
// globals.css: @theme inline { --color-primary-foreground: var(--primary-foreground); }
<button className="text-primary-foreground">...</button>
```

**影響範囲**: Button, Badge, Card, Input, および全ドメインコンポーネント内のテキスト色指定。

---

## Storybook 固有の問題

### MDX テーブル

**問題**: MDX では markdown テーブル (`| col |`) が HTML テーブルに変換されない。

**解決策**: `<table>` タグで直接記述する。

### @storybook/blocks

**問題**: Storybook 10 では `@storybook/blocks` パッケージが存在しない。

**解決策**: `@storybook/addon-docs/blocks` を使う。

### OS dark mode とプレビュー

**問題**: OS が dark mode の場合、`@media (prefers-color-scheme: dark)` が Storybook iframe 内でも有効になり、light テーマのプレビューが dark になる。

**解決策**:
- 確認時: `mcp__chrome-devtools__emulate` で `colorScheme: light` を設定
- 本番: Storybook の preview decorator で CSS ハックせず、`@media` と `.dark` クラスの両方を維持する（実運用では OS 設定に従うのが正しい挙動）

### preview decorator

**問題**: `document.body.style.background` を設定しないと dark モード切替時に iframe 背景が白のまま。

**解決策**: decorator で body スタイルも設定する。

---

## デザイントークン

### 基本トークンの明示定義

**問題**: `--color-white` が未定義で `var(--color-white)` が解決されない。

**解決策**: `:root` に `--color-white: #FFFFFF` を明示的に定義する。

### dark mode のステータス色

**問題**: `--color-green-50` (#F0FDF4) 等の `-50` 色は dark 背景で明るすぎる。

**解決策**: dark mode では `rgba()` 半透明値を使う。

```css
.dark {
  --success-light: rgba(22, 163, 74, 0.15);  /* NOT var(--color-green-50) */
}
```

### hover 色

**問題**: `hover:bg-gray-200` は dark mode で明るすぎる。

**解決策**: `--hover-muted` トークンを用意し、dark mode で別値を定義する。

---

## フォーム要素の使い分け

### 使うべき要素

| 用途 | 正しい要素 | 理由 |
|------|-----------|------|
| 単一選択 (排他) | `<button>` グループ (トグル) | クリッカブル、選択状態が明確 |
| 複数選択 (非排他) | `<button>` トグル (multi) | チェックボックスよりビジュアル |
| 範囲指定 | `<input type="range">` | スライダーが直感的 |
| 数値入力 | `<input type="number">` | スピナー付き |
| テキスト入力 | `<input type="text">` | 標準 |
| 日付選択 | カスタム Calendar コンポーネント | UX が良い |
| 評価選択 | StarRating コンポーネント (SVG) | ビジュアルフィードバック |

### 使うべきでない要素

| NG パターン | 理由 | 代替 |
|------------|------|------|
| Badge をフィルター選択肢に使う | クリック不可、cursor: default | `<button>` トグル |
| `<select>` で 3 個以下の選択肢 | 隠れて一覧性が悪い | ボタングループ |
| Unicode 星 (★☆) でテキスト色に依存 | CSS 変数が効かない場合がある | SVG StarRating or `style` で色指定 |
| `<input type="number">` に `¥` プレフィックス | placeholder が切れる | `flex-1 min-w-0` で幅確保 |
| 固定幅 (`w-24`) の入力フィールド | コンテンツが切れる | `flex-1 min-w-0` |

---

## events/ と latest/ の同期

**問題**: events/ のファイルを編集しても latest/ の Storybook には反映されない（latest/ で dev server を起動している場合）。

**解決策**: 編集は latest/ を先に行い、完了後に events/ にコピーする。または常に両方を同期する。
