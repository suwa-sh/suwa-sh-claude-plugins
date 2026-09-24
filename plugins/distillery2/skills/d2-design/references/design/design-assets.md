# アセット生成 (design-assets)

ロゴ・ファビコン・アイコンセットを **SVG 直書き**で生成し、`docs/design/storybook-app/src/assets/` に置く。
外部 AI API は使わない。`src/assets/` 配下なので F6 の `importUi.js` (`src/` を丸ごと取り込む) で `packages/ui/assets/` に入る。

コンポーネント導出 (手順 3) の後、Storybook アプリ生成 (手順 4) の一部として作る。ブランドは UI ADR の `ui.brand`
を起点にする (色は `brand.colors.primary`、フォントは `brand.typography`)。`ui.brand` が無ければトークンの主要色を使う。

## 出力

```
src/assets/
  logo-full.svg       # 横長 (アイコン + ブランド名)
  logo-icon.svg       # 正方形 48x48 (アイコンのみ)
  logo-stacked.svg    # 縦 (アイコン上・名前下)
  favicon.svg         # 32x32。logo-icon を単純化した単色
  icons/<name>.svg    # RDRA 由来のアイコンセット (24x24 line icon)
  icons/index.md      # アイコン一覧 (name → 用途)
```

## 共通ルール

- ブランドの主要色 (`ui.brand.colors.primary`、無ければトークンの `--primary`) をメインにする。
- `fill="none"` + `stroke` ベースでスケーラブルに。単色は `currentColor` で CSS から色を制御できるようにする。
- フォントは SVG 内に埋め込まず `font-family` で指定する (`ui.brand.typography.heading` に合わせる)。
- 色は 16 進で直書きし、ベンダー名を使わない。決定論的に (同じブランドなら同じ SVG)。

## ロゴ

### logo-full.svg (横長)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" fill="none">
  <!-- アイコン部分: ドメインを象徴する形 (下の導出表) -->
  <text x="52" y="33" font-family="'Inter',system-ui,sans-serif" font-size="22" font-weight="600">
    <tspan fill="{primary}">ブランド</tspan><tspan fill="#0F172A">名</tspan>
  </text>
</svg>
```

### logo-icon.svg (正方形 48x48)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"><!-- アイコンのみ --></svg>
```

### logo-stacked.svg (縦)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" fill="none">
  <!-- アイコン (上) / テキスト (下, text-anchor="middle") -->
</svg>
```

## ファビコン

`favicon.svg` は `logo-icon.svg` を単純化した 32x32 の単色。細部を落とし、小サイズでも判別できる形にする。

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><!-- 単色の象徴形 (fill="{primary}") --></svg>
```

## アイコンセット (RDRA 由来)

RDRA の画面名・情報名・アクター名からキーワードを拾い、必要なアイコンだけを 24x24 の line icon で作る。RDRA に無い
アイコンを増やさない。

- 24x24 `viewBox` / `fill="none"` `stroke="currentColor"` `stroke-width="2"` `stroke-linecap="round"` `stroke-linejoin="round"`

| RDRA のキーワード | アイコン |
|---|---|
| 検索・探す・一覧 | search (虫眼鏡) |
| カレンダー・日時・予約 | calendar |
| 時間・時刻・期限 | clock |
| 鍵・貸出・返却 | key |
| 利用者・会員 | user |
| グループ・人数 | users |
| 管理者・審査・認証 | shield-check |
| 通知・メッセージ・メール | mail |
| 設定・管理・運用 | settings |
| 売上・分析・集計・統計 | chart |
| フィルター・条件・絞込 | filter |
| 所在地・住所・場所 | map-pin |

ドメイン固有の対象 (書籍・棚など) は汎用アイコンに無いため、ドメインに合わせて 24x24 line icon をデザインする。

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- パス -->
</svg>
```

`icons/index.md` に `name → 用途 (どの画面 / 情報から導いたか)` を 1 行ずつ書く。

## 品質チェック

- [ ] logo-full / logo-icon / logo-stacked / favicon の 4 ファイルがある
- [ ] ロゴの主要色が `ui.brand.colors.primary` (無ければトークンの主要色) と一致する
- [ ] アイコンは RDRA から導いたものだけ (勝手に増やさない)
- [ ] すべて `src/assets/` 配下 (F6 で `packages/ui/assets/` に取り込まれる)
