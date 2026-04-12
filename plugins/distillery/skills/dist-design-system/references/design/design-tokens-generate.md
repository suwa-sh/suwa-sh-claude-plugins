# Step3: デザイントークン生成

## 生成ルール

### 3層構造

```
Primitive (生の値)
  - カラースケール (gray, primary, accent, status)
  - スペーシング (4px base grid)
  - タイポグラフィ (font-size, font-weight, line-height, font-family)
  - 角丸 (radius)
  - シャドウ (shadow)
  - アニメーション (duration)
  - ブレークポイント
      ↓
Semantic (意味レイヤー)
  - background, foreground, border, ring, muted
  - status: success, warning, destructive, info (+light variants)
  - portal: user.primary, owner.primary, admin.primary
  - accent: rating, virtual (+light variants)
  - spacing: component-gap, section-gap, page-padding, card-padding
  - layout: sidebar-width, sidebar-collapsed-width, content-max-width
      ↓
Component (コンポーネント固有)
  - button: height, padding, radius, font
  - input: height, padding, radius, border, focus
  - card: bg, border, shadow, padding, radius
  - badge: height, padding, radius, font
  - avatar: sizes, radius
  - sidebar: width, collapsed-width, item-height
  - table: header-bg, row-height, cell-padding
  - modal: backdrop, radius, padding, shadow, widths
  - domain-specific: (RDRA 情報から導出されたドメインコンポーネント)
```

### design-tokens.json

Design Tokens Community Group 形式に準拠。

```json
{
  "primitive": { "color": { "gray": { "50": { "$value": "#...", "$type": "color" } } } },
  "semantic": { "color": { "background": { "$value": "{primitive.color.gray.50}" } } },
  "component": { "button": { "bg": { "$value": "{semantic.color.primary}" } } },
  "dark": { "semantic": { ... }, "component": { ... } }
}
```

### design-tokens.css

**必須ルール:**

1. `--color-white: #FFFFFF` を `:root` に明示的に定義する
2. ポータル切替は `data-portal` 属性で実現する:
   ```css
   :root, [data-portal="user"]  { --primary: var(--color-blue-600); }
   [data-portal="owner"]        { --primary: var(--color-teal-600); }
   [data-portal="admin"]        { --primary: var(--color-slate-700); }
   ```
3. dark mode は `.dark` クラスと `@media (prefers-color-scheme: dark)` の両方に定義する
4. dark mode では status 系の `-light` トークンに `rgba()` 半透明値を使う:
   ```css
   .dark {
     --success-light: rgba(22, 163, 74, 0.15);  /* NOT var(--color-green-50) */
     --warning-light: rgba(249, 115, 22, 0.15);
     --destructive-light: rgba(220, 38, 38, 0.15);
     --info-light: rgba(59, 130, 246, 0.15);
     --virtual-light: rgba(139, 92, 246, 0.15);
   }
   ```
5. hover 色は light/dark で別値が必要:
   ```css
   :root { /* --hover-muted は未定義 → fallback で --color-gray-200 */ }
   .dark { --hover-muted: var(--color-gray-700); }
   ```
   コンポーネント側: `hover:bg-[var(--hover-muted,var(--color-gray-200))]`
6. **すべてのセマンティック/コンポーネントトークン** に dark mode オーバーライドを定義する:
   - `--card-bg`, `--card-border`, `--card-shadow`
   - `--table-header-bg`
   - `--rating-empty-color`
   - `--calendar-*-bg`

### レイアウト・スペーシングトークン

Step1（`design-infer.md` セクション 5）の推論結果を参照し、以下のトークンを生成する。
値は推論で導出された根拠付きの数値を使うこと（任意の値をハードコードしない）。

**Semantic レイヤーに追加するトークン:**

```css
:root {
  /* Layout — Step1 セクション 5-1 の推論結果から */
  --sidebar-width: /* ナビ項目数から導出 (例: 16rem) */;
  --sidebar-collapsed-width: 4rem; /* アイコン24px + padding左右20px = 固定値 */
  --content-max-width: /* 12col グリッド幅。ブレークポイントに連動 */;

  /* Spacing — Step1 セクション 5-2 の推論結果から */
  --page-padding: /* ポータル構成から導出 */;
  --section-gap: /* 情報密度から導出 */;
  --component-gap: /* 画面要素数から導出 */;
  --card-padding: /* カード候補の属性数から導出 */;
}
```

**Component レイヤーのグリッド定義:**

```css
:root {
  /* Grid — 画面パターン別。Step1 セクション 5-1 の推論結果から */
  --grid-columns: 12;
  --grid-gutter: var(--component-gap);
}
```

**グリッドのカラム分割は CSS class/Tailwind で画面ごとに適用する:**

| パターン | Tailwind 実装例 |
|---------|----------------|
| フル幅 (12col) | `col-span-12` |
| マスター・ディテール (8+4) | `col-span-8` + `col-span-4` |
| 中央寄せフォーム (2+8+2) | `col-start-3 col-span-8` |
| ダッシュボード (6+6) | `col-span-6` |
| KPI 3列 (4+4+4) | `col-span-4` |

**レスポンシブのブレークポイントトークン:**

NFR F.1.1.1（端末対応レベル）から必要なブレークポイントを決定する。
全ブレークポイントを定義するが、NFR で不要と判定されたものは簡易対応とする。

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

### 品質チェック

生成後、以下を確認:
- [ ] `--color-white` が `:root` に定義されている
- [ ] すべてのポータルの `--primary` が定義されている
- [ ] `.dark` ブロックに semantic + component のオーバーライドが揃っている
- [ ] status-light トークンが dark mode で `rgba()` 値になっている
- [ ] `--hover-muted` が `.dark` に定義されている
- [ ] `--sidebar-width` の値が `_inference.md` の推論結果と一致している
- [ ] `--page-padding`, `--section-gap`, `--component-gap`, `--card-padding` が定義されている
- [ ] グリッドのカラム分割が画面パターンごとに `_inference.md` の推論と一致している
