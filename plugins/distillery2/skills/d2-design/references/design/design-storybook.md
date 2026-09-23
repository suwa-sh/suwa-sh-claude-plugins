# Storybook アプリ生成 (design-storybook)

Next.js + TypeScript + Tailwind CSS v4 + Storybook のアプリを生成する。
出力先は `docs/design/storybook-app/` (d2-foundation phase=F6 がここを `packages/ui/` に取り込む)。

> API・パッケージ名は Context7 (Storybook / Tailwind CSS v4 公式ドキュメント, 2026-09-23 確認) に基づく。
> 具体的なメジャーバージョンは生成時点の最新を `create-next-app@latest` / `storybook@latest` で入れる。

## プロジェクト初期化

出力先は `docs/design/storybook-app/`。**必ず `docs/design` へ移動してから** `create-next-app` を実行する
(リポジトリルートで実行するとルート直下に `storybook-app/` ができ、F6 の `--from docs/design/storybook-app` が空になる)。

```bash
mkdir -p docs/design
cd docs/design
npx --yes create-next-app@latest storybook-app \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd storybook-app   # 以降このディレクトリ (docs/design/storybook-app) で作業する
npx --yes storybook@latest init --yes --no-dev
```

## ディレクトリ構成

```
storybook-app/
  .storybook/main.ts        # framework: '@storybook/nextjs-vite'
  .storybook/preview.tsx    # ポータル/テーマ切替デコレーター
  src/
    app/globals.css         # @import "tailwindcss" + design-tokens.css
    styles/design-tokens.css
    components/ui/           # Button/Badge/Card/Input + *.stories.tsx (co-located)
    components/domain/       # ドメイン部品 + *.stories.tsx
    docs/                    # Introduction.mdx / DesignTokens.mdx / ScreenMapping.mdx
    stories/                 # 画面 (Screen) Story。screens.yaml の story はここを指す
    tokens/tokens.json      # tokens.json (screens.yaml の tokens.file。src/ 配下に置く)
```

> **重要**: `tokens/` は必ず `src/` 配下に置く。F6 の `importUi.js` は `src/` だけを `packages/ui/` に
> コピーするため、`src/` の外 (storybook-app 直下など) に置くとトークン JSON が取り込まれない。

## .storybook/main.ts (framework)

```ts
import type { StorybookConfig } from '@storybook/nextjs-vite';
const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
};
export default config;
```

## .storybook/preview.tsx (テーマ/ポータル)

```tsx
import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';
const preview: Preview = {
  decorators: [(Story, context) => {
    const portal = context.globals.portal || 'user';
    const theme = context.globals.theme || 'light';
    document.documentElement.setAttribute('data-portal', portal);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // 必須: body 背景/文字色も設定しないと dark 切替で iframe が白のまま
    document.body.style.background = 'var(--background)';
    document.body.style.color = 'var(--foreground)';
    return Story();
  }],
};
export default preview;
```

## globals.css (Tailwind v4)

```css
@import "tailwindcss";
@import "../styles/design-tokens.css";

/* @theme inline: 実行時 CSS 変数 (--primary 等) を Tailwind ユーティリティに公開する */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --font-sans: 'Noto Sans JP', 'Inter', system-ui, sans-serif;
}
body { background: var(--background); color: var(--foreground); font-family: var(--font-sans); }
```

- Tailwind v4 では `text-[var(--x)]` が色として効かないことがある。`@theme inline` で
  `--color-*` として登録して `text-*` を使うか、`style={{ color: 'var(--x)' }}` を使う。

## Story 作成ルール (CSF3)

- `import type { Meta, StoryObj } from '@storybook/nextjs-vite'`
- Meta の `title` は `UI/{Name}` / `Domain/{Name}` / `Screens/{Name}`
- `tags: ['autodocs']` で自動ドキュメント
- 各状態を **named export** で定義 (`Default` / `Empty` / `Error` / `Loading`)。
  これが screens.yaml の `variants` と一致する (validateScreens が突合する)
- サンプルデータは日本語

## MDX ドキュメントルール

- `import { Meta } from '@storybook/addon-docs/blocks'` を使う (`@storybook/blocks` は使わない)
- MDX では markdown テーブルが描画されない → `<table>` タグで直接書く
- カラープレビューは inline `<span style={{ background: 'var(--token)', ... }} />`
- DesignTokens.mdx には CSS 変数名をそのまま載せ、実装者がコピーできるようにする

## 生成の並列化

コンポーネント群の生成は独立性が高い。サブエージェント分割 / 並列 Write で時間を短縮する
(v1 実績: 直列 8 分 → 並列 4〜5 分)。派遣時はパスだけ渡す (subagent 規則)。

## ビルド検証

```bash
npx storybook build
```

主な失敗パターン: `@storybook/blocks` の import (→ `@storybook/addon-docs/blocks`)、
CSS 変数の未定義 (→ design-tokens.css に追加)、TypeScript 型エラー。

## F6 への受け渡し

- 生成物一式を `docs/design/storybook-app/` に置く (初期化を `docs/design` で実行していれば自然にここに入る)。
- d2-foundation phase=F6 (`importUi.js --from docs/design/storybook-app`) が
  ソースを `packages/ui/` にコピーし、取り込み記録を `packages/ui/.imported.yaml` に残す。
- screens.yaml の `story` / `components` / `tokens.file` は **`src/` からの相対パス**
  (`validateScreens.js --app docs/design/storybook-app/src` が実在を検査する)。
  例: `tokens.file: tokens/tokens.json` は `src/tokens/tokens.json` を指す。
- `src/` を `packages/ui/` にコピーするため、取り込み後は `packages/ui/tokens/tokens.json` になり、
  同じ相対構造 (`tokens/tokens.json`) を保つ。
