# デザイントークン生成 (design-tokens)

3 層 (primitive → semantic → component) のトークンを、JSON と CSS 変数の 2 形式で出力する。
出力先は Storybook app の `tokens/tokens.json` と `styles/design-tokens.css`。

## 3 層構造

```
Primitive (生値)     色スケール(gray/primary/accent/status) / spacing(4px grid) / typography / radius / shadow / duration / breakpoint
  ↓
Semantic (用途)      background / foreground / border / ring / muted / status(success/warning/destructive/info +light) /
                     portal(user/owner/admin.primary) / spacing(page-padding/section-gap/component-gap/card-padding) /
                     layout(sidebar-width/content-max-width)
  ↓
Component (固有)     button / input / card / badge / avatar / sidebar / table / modal / (RDRA 由来のドメイン部品)
```

## tokens.json (Design Tokens Community Group 形式)

```json
{
  "primitive": { "color": { "gray": { "50": { "$value": "#F9FAFB", "$type": "color" } } } },
  "semantic":  { "color": { "background": { "$value": "{primitive.color.gray.50}", "$type": "color" } } },
  "component": { "button": { "bg": { "$value": "{semantic.color.primary}", "$type": "color" } } },
  "dark":      { "semantic": { }, "component": { } }
}
```

screens.yaml の `tokens.file` はこのパス (app からの相対、既定 `tokens/tokens.json`) を指す。

## design-tokens.css (必須ルール)

1. `--color-white: #FFFFFF` を `:root` に明示的に定義する。
2. ポータル切替は `data-portal` 属性で行う:
   ```css
   :root, [data-portal="user"] { --primary: var(--color-blue-600); }
   [data-portal="owner"]       { --primary: var(--color-teal-600); }
   [data-portal="admin"]       { --primary: var(--color-slate-700); }
   ```
3. dark mode は `.dark` クラスと `@media (prefers-color-scheme: dark)` の両方に定義する。
4. dark mode の status `-light` 系は `rgba()` 半透明値を使う (`--color-green-50` は明るすぎる):
   ```css
   .dark { --success-light: rgba(22,163,74,.15); --warning-light: rgba(249,115,22,.15);
           --destructive-light: rgba(220,38,38,.15); --info-light: rgba(59,130,246,.15); }
   ```
5. hover 色は light/dark で別値。`--hover-muted` を `.dark` に定義し、コンポーネントは
   `hover:bg-[var(--hover-muted,var(--color-gray-200))]` と fallback を書く。
6. **すべての** semantic / component トークンに dark override を定義する
   (`--card-bg` / `--card-border` / `--card-shadow` / `--table-header-bg` など)。

## レイアウト・スペーシングトークン

`design-infer.md` 5 節の推論結果を値に反映する (任意値をハードコードしない)。

```css
:root {
  --sidebar-width: 16rem;            /* ナビ項目数から */
  --sidebar-collapsed-width: 4rem;   /* アイコン24px + padding = 固定 */
  --content-max-width: 80rem;        /* 12col グリッド幅 */
  --page-padding: 1.5rem;            /* ポータル構成から */
  --section-gap: 2rem;               /* 情報密度から */
  --component-gap: .75rem;           /* 画面要素数から */
  --card-padding: 1.5rem;            /* カード属性数から */
  --grid-columns: 12;
}
```

カラム分割 (フル幅 / マスター・ディテール / 中央寄せ / ダッシュボード) は
Tailwind の `col-span-*` で画面ごとに適用する。

## 品質チェック

- [ ] `--color-white` が `:root` にある
- [ ] 全ポータルの `--primary` が定義済み
- [ ] `.dark` に semantic + component の override が揃う
- [ ] status-light が dark で `rgba()` 値
- [ ] `--hover-muted` が `.dark` にある
- [ ] spacing/layout トークンが推論値と一致する
