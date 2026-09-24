# 決定候補カタログ: UI 部品の方針

デザインシステム / 共有コンポーネントライブラリを持つか、UI をどう分けるかを決める。
presentation ティア (frontend) があるときだけ ADR を書く。ADR の `scope: [ui]`。

---

## 共有コンポーネントライブラリの採否

- **選択肢**: あり (`packages/ui` に design tokens + 部品 + Storybook) / なし (画面ごとに直接実装)
- **向く条件 (あり)**: フロントが 2 種以上 (利用者向け / 管理者向け) で見た目を揃えたい。画面数が多く再利用が効く。アクセシビリティ / ブランド一貫性の要件がある。
- **向かない (なし)**: 画面が数枚の管理 UI だけ。早すぎる抽象化は保守コストになる。
- distillery2 では design tokens と部品生成は後段の d2-design が担う。ここでは「持つ / 持たない」と分割方針だけ決める。
- **派生するルール例**:
  ```yaml
  - scope: tier:frontend
    text: "共通 UI 部品は packages/ui からのみ取得し、アプリ側で独自に再実装しない"
  ```

## フロントの分割

- **選択肢**: 単一フロント / 利用者向け + 管理者向けの分離 / BFF 追加
- **向く条件 (分離)**: アクター種別 2 種以上で権限・導線が大きく異なる (NFR E.5.3 の経路分離とも整合)。
- **向く条件 (BFF)**: フロント種別 3 以上で UI 要件が大きく異なる。
- **向かない**: 利用者だけ・管理者だけの単純プロダクトは単一フロントで十分。

## ADR に残す `ui:` ヒント (d2-design が読む)

`scope: [ui]` の ADR の front matter に、後段 d2-design が従う UI 技術の決定を `ui:` として残す。d2-design はここを読み、無ければ SPA を既定にする (実走で ADR に `ui:` が無く、design が既定の Next.js を選んで ADR の SPA 方針と食い違った)。

```yaml
ui:
  framework: react            # react / vue / svelte 等 (既定 react)
  rendering: spa              # spa / ssr / ssg (既定 spa)。SSR/SSG が要るときだけ ssr/ssg
  styling: tailwind           # 任意 (tailwind / css-modules 等)
  component_lib: true         # packages/ui を持つか
```

- `rendering: spa` なら d2-design は SPA 構成 (例 Vite + React) で Storybook を作る。Next.js は `rendering: ssr`/`ssg` を選んだときだけ使う。
- モバイル / SEO 要件から SSR/SSG が必要かは [tiers.md](tiers.md) の frontend の目安に従って決める。

## ブランド方針 `ui.brand` (d2-design のトークンの起点)

**ブランドは UI ADR が人の決める場所**。`ui:` に `brand` を持たせ、d2-design はここを起点に色・タイポグラフィの
primitive トークンを作る (design 側で再推論しない)。決め方:

- `brand` スキルが使えるなら (`~/.claude/skills/brand` / `~/.agents/skills/brand` / `.claude/skills/brand`、
  またはプラグインのスキル一覧) それを走らせ / 出力を読み、`ui.brand` を埋める。`source: "brand skill"`。
- 使えなければ RDRA (システム名・アクター・ドメイン語) から推論し、`source: "inferred"` と `confidence: low` を付ける。
  低確信なので `_review-summary.md` に「確認してほしいこと」として載せ、人が UI ADR で確定する。

```yaml
ui:
  framework: react
  rendering: spa
  design_system: true
  component_lib: true
  brand:
    name: 図書館システム
    tagline: 蔵書をすぐ探せる      # 任意
    colors: { primary: "#2563EB", secondary: "#0EA5E9", accent: "#F59E0B", neutral: "#64748B" }
    typography: { heading: "Inter", body: "Inter" }
    tone: [信頼できる, 静か]        # 任意
    source: "inferred"            # brand skill | inferred | <path>
    confidence: low
```

- 必須は `name` / `colors.primary` / `typography.heading` / `typography.body` / `source`。他は任意。
- 色は 16 進 (`#RRGGBB`)。ベンダー名でなく値で書く。

## 国際化 (i18n)

- **向く条件**: 多言語要件がある。
- **派生するルール例**:
  ```yaml
  - scope: tier:frontend
    text: "表示文字列は外部化し、CSS は logical properties で書いて言語切替に耐える"
  ```
