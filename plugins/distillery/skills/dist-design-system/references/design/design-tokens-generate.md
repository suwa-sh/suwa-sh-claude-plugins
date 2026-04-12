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
      ↓
Component (コンポーネント固有)
  - button: height, padding, radius, font
  - input: height, padding, radius, border, focus
  - card: bg, border, shadow, padding, radius
  - badge: height, padding, radius, font
  - avatar: sizes, radius
  - sidebar: width, item-height
  - table: header-bg, row-height, cell-padding
  - modal: backdrop, radius, padding, shadow, widths
  - domain-specific: room-card, rating, calendar, etc.
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

### 品質チェック

生成後、以下を確認:
- [ ] `--color-white` が `:root` に定義されている
- [ ] すべてのポータルの `--primary` が定義されている
- [ ] `.dark` ブロックに semantic + component のオーバーライドが揃っている
- [ ] status-light トークンが dark mode で `rgba()` 値になっている
- [ ] `--hover-muted` が `.dark` に定義されている
