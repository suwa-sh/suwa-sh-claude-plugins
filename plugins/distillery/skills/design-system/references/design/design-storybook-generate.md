# Step7: Storybook プロジェクト生成

## プロジェクト初期化

```bash
# 1. Next.js プロジェクト作成
npx --yes create-next-app@latest storybook-app \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack --yes

# 2. Storybook 初期化
cd storybook-app
npx --yes storybook@latest init --yes --no-dev

# 3. 必要パッケージ追加 (Storybook 10 の場合)
# @storybook/blocks は Storybook 10 では不要
# @storybook/addon-docs/blocks を使う
```

## ディレクトリ構成

```
storybook-app/
  .storybook/
    main.ts
    preview.ts          # ポータル/テーマ切替デコレーター
  src/
    app/
      globals.css       # Tailwind + design-tokens.css import
    styles/
      design-tokens.css # トークン CSS (tokens/ からコピー)
    components/
      ui/               # 汎用コンポーネント + stories
        Button.tsx / Button.stories.tsx
        Badge.tsx / Badge.stories.tsx
        Card.tsx / Card.stories.tsx
        Input.tsx / Input.stories.tsx
      domain/           # ドメインコンポーネント + stories
        {Component}.tsx / {Component}.stories.tsx
    docs/               # MDX ドキュメント
      Introduction.mdx
      DesignTokens.mdx
      ScreenMapping.mdx
```

## .storybook/preview.ts 設定

**重要なポイント:**

```typescript
import type { Preview } from '@storybook/nextjs-vite'
import '../src/app/globals.css'

const preview: Preview = {
  // ... parameters, globalTypes ...
  decorators: [
    (Story, context) => {
      const portal = context.globals.portal || 'user'
      const theme = context.globals.theme || 'light'

      document.documentElement.setAttribute('data-portal', portal)
      document.documentElement.classList.toggle('dark', theme === 'dark')

      // ★ 必須: body にも背景/文字色を設定する
      document.body.style.background = 'var(--background)'
      document.body.style.color = 'var(--foreground)'

      return Story()
    },
  ],
}
```

- `document.body.style` を設定しないと、dark モード切替時に Storybook の iframe 背景が白のままになる

## globals.css 設定

```css
@import "tailwindcss";
@import "../styles/design-tokens.css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... 必要なトークンを Tailwind テーマに公開 */
  --font-sans: 'Noto Sans JP', 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

## Stories 作成ルール

- CSF3 形式 (`import type { Meta, StoryObj } from '@storybook/nextjs-vite'`)
- Meta の title は `UI/{ComponentName}` or `Domain/{ComponentName}`
- `tags: ['autodocs']` で自動ドキュメント生成
- サンプルデータは日本語を使う
- 各バリアントを named export で定義
- co-located stories (コンポーネントと同じディレクトリ)

## MDX ドキュメント ルール

**★ 最重要: MDX では markdown テーブルは HTML テーブルに変換されない**

```mdx
{/* NG: markdown テーブル → 描画されない */}
| Column1 | Column2 |
|---------|---------|
| data    | data    |

{/* OK: HTML テーブル → 正常に描画される */}
<table>
  <thead>
    <tr><th>Column1</th><th>Column2</th></tr>
  </thead>
  <tbody>
    <tr><td>data</td><td>data</td></tr>
  </tbody>
</table>
```

**その他の MDX ルール:**
- `import { Meta } from '@storybook/addon-docs/blocks'` を使う (Storybook 10)
  - `@storybook/blocks` は Storybook 10 では使えない
- カラープレビューは inline `<span style={{...}} />` で表現
- JSX 式は `{{ }}` (二重波括弧) で記述

## Emoji → Icon 置換ルール

Storybook のコンポーネント実装では **絵文字 (emoji) を使わない**。
Step5 の Markdown ドキュメント (design-event.md) では emoji で十分だが、
Step7 の Storybook コンポーネントはプロダクション品質の Icon SVG を使う。

### 置換の進め方

1. Step6 で生成した `assets/icons/` の一覧を確認する
2. 各コンポーネントの TSX から emoji (Unicode 絵文字、★☆ 等) を検索する
3. 以下のカテゴリに従って Icon に置換する

### カテゴリ別マッピングルール

| emoji のカテゴリ | 置換先 | 例 |
|-----------------|--------|-----|
| 場所・地図系 (📍🌍🏠) | `map-pin` 等の場所アイコン | `📍 渋谷区` → `<Icon name="map-pin" /> 渋谷区` |
| 人・グループ系 (👤👥🧑) | `user` / `users` | `👥 20名` → `<Icon name="users" /> 20名` |
| 建物・部屋系 (🏢🏠🚪) | ドメイン固有のアイコン (`room` 等) | Step6 で生成したものを使う |
| デバイス系 (🖥️💻📱) | `virtual-room` / `monitor` 等 | |
| セキュリティ系 (🔑🔒🛡️) | `key` / `shield-check` | |
| コミュニケーション系 (💬📧) | `message` | |
| 金融系 (💳💰) | `credit-card` | |
| 時間系 (⏳🔄⏰) | `clock` | |
| 評価系 (⭐★☆) | StarRating SVG コンポーネント | Unicode 星も禁止。SVG で統一 |
| チェック系 (✓✕✅❌) | inline SVG or `shield-check` | |
| プレースホルダー画像 | Icon を中央配置 | 画像未設定時のフォールバック |

### 使い方

```tsx
import { Icon } from '../ui/Icon'

// NG: emoji
<span>📍 東京都渋谷区</span>
<span>👥 収容人数: 20名</span>

// OK: Icon コンポーネント
<span className="inline-flex items-center gap-1">
  <Icon name="map-pin" size={16} /> 東京都渋谷区
</span>
<span className="inline-flex items-center gap-1">
  <Icon name="users" size={16} /> 収容人数: 20名
</span>
```

## アセット統合 (Logo / Icon)

生成した SVG アセットを Storybook 内で実際に利用する。`public/assets/` に配置するだけでは不十分。

### Icon コンポーネント

再利用可能な Icon コンポーネントを作成し、SVG を動的に読み込む。

```tsx
// src/components/ui/Icon.tsx
import React from 'react'

export interface IconProps {
  name: string
  size?: number
  className?: string
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '' }) => (
  <img
    src={`/assets/icons/${name}.svg`}
    alt={name}
    width={size}
    height={size}
    className={className}
    style={{ display: 'inline-block' }}
  />
)
```

### Logo/Icon カタログ Story

Brand カテゴリに Logo と Icon の一覧 Story を作成する。

```tsx
// src/components/ui/Icon.stories.tsx
const meta: Meta = {
  title: 'Brand/Icons',
  tags: ['autodocs'],
}

// 全アイコンをグリッド表示する AllIcons Story
export const AllIcons: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {['search', 'room', 'calendar', 'key', 'star', 'user', ...].map(name => (
        <div key={name} style={{ textAlign: 'center' }}>
          <Icon name={name} size={32} />
          <div style={{ fontSize: 12, color: 'var(--foreground-secondary)', marginTop: 4 }}>{name}</div>
        </div>
      ))}
    </div>
  ),
}
```

```tsx
// src/docs/Logo.stories.tsx or Logo.mdx
// Logo 3バリアントを並べて表示
<div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
  <img src="/assets/logo-full.svg" alt="Logo Full" height="48" />
  <img src="/assets/logo-icon.svg" alt="Logo Icon" height="48" />
  <img src="/assets/logo-stacked.svg" alt="Logo Stacked" height="64" />
</div>
```

### Introduction MDX にロゴ表示

```mdx
{/* Introduction.mdx の冒頭に追加 */}
<img src="/assets/logo-full.svg" alt="RoomConnect" style={{ height: 48, marginBottom: 24 }} />

# RoomConnect Design System
```

### ドメインコンポーネントでの Icon 利用例

SearchFilter やナビゲーションで Icon コンポーネントを使用:

```tsx
// SearchFilter 内
<Icon name="search" size={16} className="mr-2" />
<Icon name="filter" size={16} />
```

## ビルド検証

```bash
npx storybook build
```

- ビルドエラーが発生したら修正して再ビルド
- 主な失敗パターン:
  - `@storybook/blocks` の import エラー → `@storybook/addon-docs/blocks` に変更
  - CSS variable の未定義 → design-tokens.css に追加
  - TypeScript 型エラー → 型定義を修正
