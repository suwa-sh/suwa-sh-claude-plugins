# Step6: アセット生成 (Logo / Icon SVG)

## Logo SVG 直接生成パターン

`design` スキルのプロンプト設計ノウハウ（55スタイル、30カラーパレット、25業界ガイド）を参考にしつつ、SVG コードを直接記述する。外部 AI API (Gemini 等) は不要。

**design スキルから活用するナレッジ:**
- `references/logo-style-guide.md` — スタイル選定 (Minimalist, Geometric, Line Art 等)
- `references/logo-color-psychology.md` — カラー心理学 (Blue=信頼, Green=成長, etc.)
- `references/logo-prompt-engineering.md` — モチーフ・構図の設計ガイド
- `data/logo/industries.csv` — 業界別ガイドライン

### 共通ルール

- ブランドカラー (`brand.colors.primary.hex`) をメインカラーにする
- `fill="none"` + `stroke` ベースでスケーラブルに
- フォントは `font-family` で指定（SVG 内に埋め込まない）
- テキストのブランド名は primary + foreground の2色分け (`<tspan>`)

### logo-full.svg (横長)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" fill="none">
  <!-- アイコン部分: ドメインを象徴する形 -->
  <!-- テキスト部分: ブランド名 -->
  <text x="52" y="33" font-family="'Inter',system-ui,sans-serif" font-size="22" font-weight="600">
    <tspan fill="{primary}">Brand</tspan><tspan fill="#0F172A">Name</tspan>
  </text>
</svg>
```

### logo-icon.svg (正方形 48x48)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <!-- アイコンのみ。テキストなし。-->
</svg>
```

### logo-stacked.svg (縦)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" fill="none">
  <!-- アイコン（上半分）-->
  <!-- テキスト（下半分、text-anchor="middle"）-->
</svg>
```

### ドメイン別アイコンデザイン例

| ドメイン | アイコンモチーフ |
|----------|---------------|
| 会議室 SaaS | ドア + 接続ドット |
| EC サイト | ショッピングバッグ |
| タスク管理 | チェックボックス + リスト |
| チャット | 吹き出し |
| ヘルスケア | ハート + パルス |

## Icon SVG 直接生成パターン

### 共通ルール

- 24x24 `viewBox`
- `fill="none"` `stroke="currentColor"` `stroke-width="2"` `stroke-linecap="round"` `stroke-linejoin="round"`
- CSS の `color` プロパティで色を制御可能
- シンプルな幾何学図形で構成

### RDRA → アイコン導出ルール

RDRA モデルの画面名・情報名・アクター名からキーワードを抽出し、必要なアイコンを決定する。

| RDRA のキーワード | → Icon カテゴリ | 例 |
|-----------------|---------------|-----|
| 検索、探す、一覧 | search (虫眼鏡) | 会議室検索画面 → search |
| カレンダー、日時、予約 | calendar | 予約申請画面 → calendar |
| 時間、時刻、タイマー | clock | 利用開始時刻 → clock |
| 鍵、ロック、貸出 | key | 鍵貸出記録 → key |
| 評価、レビュー、スコア | star | 評価登録画面 → star |
| 利用者、ユーザー、会員 | user | アクター「利用者」→ user |
| グループ、人数、複数人 | users | 収容人数 → users |
| 管理者、審査、認証 | shield-check | アクター「管理者」→ shield-check |
| 問合せ、メッセージ、チャット | message | 問合せ画面 → message |
| 決済、支払、カード | credit-card | 決済情報 → credit-card |
| 設定、管理、運用 | settings | 運用ルール設定 → settings |
| 売上、分析、集計 | chart | 売上分析画面 → chart |
| フィルター、条件、絞込 | filter | 検索条件 → filter |
| 所在地、住所、場所 | map-pin | 所在地属性 → map-pin |
| 建物、部屋、物件 | room (ドメイン固有) | 会議室情報 → room |
| オンライン、バーチャル、リモート | virtual-room (ドメイン固有) | バーチャル会議室 → virtual-room |

**ドメイン固有アイコン** (room, virtual-room 等) は汎用アイコンセットにないため、ドメインに合わせてデザインする。

### アイコン SVG テンプレート

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round">
  <!-- パス要素 -->
</svg>
```
