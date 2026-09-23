---
name: distillery2:d2-design
description: >-
  段階③「基盤」の画面部品。RDRA の UC と情報、ADR の UI 決定から、デザイントークンと Storybook 部品を作る。
  画面と UC の対応 (docs/design/screens.yaml) を出し、d2-foundation phase=F6 が packages/ui に取り込む。
  画面を持たないプロダクトでは呼ばれない。「デザインシステム」「Storybook を生成」「画面設計」「デザイントークン」で発動。
---

# d2-design

RDRA モデルと ADR の UI 決定から、デザイントークンと Storybook 部品を生成する。
LLM 主体のステージ。d2-run が段階③で、F3 (test-support) と F6 (取り込み) の間に呼ぶ。

- 唯一残す doc は `docs/design/screens.yaml` (画面 ↔ Story ↔ UC ↔ コンポーネント)。
- 部品一式は `docs/design/storybook-app/` に置き、F6 が `packages/ui/` に取り込む。
- 原則「**Story = 画面構造の正**」。画面の状態は Story の named export (variants) で表す。

## 入出力

| 入力 | 出力 |
|---|---|
| `docs/requirements/rdra/*.tsv` (画面 / アクター / 情報 / 状態 / バリエーション) | `docs/design/screens.yaml` |
| `docs/requirements/use-cases.yaml` (`use_cases[].slug`) | `docs/design/storybook-app/` (tokens / components / stories) |
| `docs/adr/*.md` (`scope: ui`、front matter `ui:` ヒント) | `docs/design/_review-summary.md` (人レビュー用の平易な要約) |
| `docs/nfr/nfr-grade.yaml` (任意。アクセシビリティ/ユーザビリティ grade) | |

## 手順

### 1. 入力を読む / UI の有無を判定する

`references/design/design-infer.md` を読む。

- 最初に **UI の有無を判定**する。`docs/requirements/rdra/システム概要.json` の `interface_kind`
  (省略時 `gui`) が `gui` 以外、または ADR の tier に `frontend` / `presentation` / `ui` が無いなら、
  design を生成せず「画面を持たないプロダクトのため design を skip」と報告して終了する。
- GUI なら RDRA / use-cases.yaml / ADR / NFR を読み、ポータル・画面一覧・コンポーネント候補を抽出する。

### 2. デザイントークンを推論する

`references/design/design-tokens.md` を読む。

- primitive → semantic → component の 3 層で `src/tokens/tokens.json` と `src/styles/design-tokens.css` を作る
  (どちらも `src/` 配下。F6 は `src/` だけを取り込むため)。
- レイアウト / スペーシングは `design-infer.md` 5 節の推論値を使う (任意値をハードコードしない)。
- 提案バリアントは出さず、⭐推奨のトークンを自動採用する。低確信の色・フォント選択は手順 6 の要約に明記する。

### 3. コンポーネント一覧と画面を導出する

`references/design/design-components.md`、`references/design/design-infer.md` を読む。

- UI 共通部品 (Button / Badge / Card / Input) を必ず用意する。
- RDRA の情報 / 画面 / 状態からドメイン部品を導出する。RDRA に無い画面を増やさない。
- 各画面について `name / route / uc_slugs / story / variants / components` を決める。
  `uc_slugs` は use-cases.yaml の `slug` を指す。

### 4. Storybook アプリを生成する

`references/design/design-storybook.md` を読む。

- Next.js + TypeScript + Tailwind CSS v4 + Storybook (`@storybook/nextjs-vite`) で
  `docs/design/storybook-app/` を生成する。
- トークン CSS、UI 部品、ドメイン部品、画面 Story (`stories/<Name>.stories.tsx`)、MDX を作る。
- 部品群の生成は独立性が高いので、**サブエージェント分割 / 並列 Write** で時間を短縮する
  (派遣時はパスだけ渡す)。
- ビルド検証: `npx storybook build` が通ること。
- **目視確認 (完了条件)**: ビルドが通っても表示崩れは残る。代表 Story と主要 variants を
  ブラウザ (または `storybook-static/` の静的ビルドを開いて) 目視し、**はみ出し・文字切れ・
  コントラスト**を確認する。崩れがあれば部品を直して再ビルドする。
  環境の都合でブラウザを開けない場合は、手順 6 の要約と最終報告に**「目視未実施」**と明記する
  (通過扱いにしない)。

### 5. screens.yaml を書いて検証する

先頭に basis 行を刻む:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/lib/basis.js stamp requirements=docs/requirements adr=docs/adr
```

出力の `basis: requirements@<sha> adr@<sha>` を `docs/design/screens.yaml` の先頭キー `basis:` に入れ、
`screens:` (画面ごとの行) と `tokens: {file: tokens/tokens.json}` を書く (`tokens` は必須。省くとスキーマエラー)
(`tokens.file` は `--app` = `src/` からの相対。実体は `src/tokens/tokens.json`。`--app` 指定時は実在も検査する)。検証:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-design/scripts/validateScreens.js \
  docs/design/screens.yaml \
  --app docs/design/storybook-app/src \
  --use-cases docs/requirements/use-cases.yaml
```

exit 0 = PASS。1 = 違反 (uc_slug 未定義 / story 不在 / variant 未 export / name・route 重複 /
component 不在 / tokens.file 不在) を直す。2 = 読み込み失敗。

### 6. _review-summary.md を書く

`docs/design/_review-summary.md` に、前提知識のない読者向けの平易な要約を書く。

- UC ごとの画面 (何を操作する画面か)
- コンポーネント一覧 (共通 + ドメイン)
- トークンの要点 (主要色 / フォント / 余白方針)、および自動採用した低確信の選択
- 内部 ID・ジャーゴンは本文に出さない

d2-run はこの要約を `toolbox:human-html-review` に渡して人に見せる。

## Scripts

| スクリプト | 用途 |
|---|---|
| [`scripts/schema-screens.json`](scripts/schema-screens.json) | screens.yaml の JSON Schema |
| [`scripts/validateScreens.js`](scripts/validateScreens.js) | screens.yaml 検証 (exit 0/1/2)。`--app` / `--use-cases` で実在検査 |

共有ライブラリは `${CLAUDE_PLUGIN_ROOT}/scripts/lib/` (basis.js, yaml.js, schemaValidate.js) を使う。
スキル内スクリプトは他プラグインを require しない。

## References

| ファイル | 用途 |
|---|---|
| [`references/design/design-infer.md`](references/design/design-infer.md) | 手順 1・3: モデル分析・画面/コンポーネント/レイアウト推論 |
| [`references/design/design-tokens.md`](references/design/design-tokens.md) | 手順 2: 3 層トークン生成ルール |
| [`references/design/design-components.md`](references/design/design-components.md) | 手順 3: RDRA からのコンポーネント導出 |
| [`references/design/design-storybook.md`](references/design/design-storybook.md) | 手順 4: Storybook 生成・F6 受け渡し (`docs/design/storybook-app/` → `packages/ui/`) |

## v1 から持ち込まないもの

| 廃止 | 理由 |
|---|---|
| 設計イベント YAML / イベント履歴ディレクトリ | screens.yaml + Git 履歴に置き換え。中間 `_inference.md` も残さない |
| 提案バリアント (proposal-variants) | ⭐推奨を自動採用。低確信の選択はレビュー要約に書く |
| アセット生成 (Logo / Icon SVG) | 現版では対象外。必要なら SVG 直書きで代替 |
