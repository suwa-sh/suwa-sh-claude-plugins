---
name: d2-design
description: >-
  段階③「基盤」の画面部品。RDRA の UC と情報、ADR の UI 決定から、デザイントークンと Storybook 部品を作る。
  画面と UC の対応 (docs/design/screens.yaml) を出し、d2-foundation phase=finish (F6) が packages/ui に取り込む。
  画面を持たないプロダクトでは呼ばれない。「デザインシステム」「Storybook を生成」「画面設計」「デザイントークン」で発動。
---

# d2-design

RDRA モデルと ADR の UI 決定から、デザイントークンと Storybook 部品を生成する。
LLM が主体の作業である。
原則は「**Story = 画面構造の正**」である。
画面の状態は、Story の named export (variants) で表す。

残す文書は `docs/design/screens.yaml` だけである。
これは、画面、Story、UC、コンポーネントの対応を持つ。
部品一式は `docs/design/storybook-app/` に置く。
基盤の仕上げ (F6) が、これを `packages/ui/` に取り込む。

## 呼び出し

| 呼ばれ方 | いつ | すること |
|---|---|---|
| 引数なし | 段階③。契約の骨格の後、基盤の仕上げの前に d2-run が呼ぶ | 下の手順 1〜6 で全生成する |
| `mode=feedback items=<項目>` | 要求の差分で、画面の見本の修正が残ったとき | 項目のファイルだけを直す。手順は [references/design/feedback.md](references/design/feedback.md) にある。全生成はしない |

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## 入出力

| 入力 | 出力 |
|---|---|
| `docs/requirements/rdra/*.tsv` (画面 / アクター / 情報 / 状態 / バリエーション) | `docs/design/screens.yaml` |
| `docs/requirements/use-cases.yaml` (`use_cases[].slug`) | `docs/design/storybook-app/` (tokens / components / stories) |
| `docs/adr/*.md` (`scope: ui`、front matter `ui:` ヒント) | `docs/design/_review-summary.md` (人レビュー用の平易な要約) |
| `docs/nfr/nfr-grade.yaml` (任意。アクセシビリティ/ユーザビリティ grade) | |

## 手順

各手順の前に、表の「先に読む文書」を読む。

| 順 | すること | 先に読む文書 | 次へ進む条件 |
|---|---|---|---|
| 1 | 入力を読み、UI の有無を判定する | [design-infer.md](references/design/design-infer.md) | GUI である。GUI でなければ、skip を報告して終わる |
| 2 | デザイントークンを推論する | [design-tokens.md](references/design/design-tokens.md) | `src/tokens/tokens.json` と `src/styles/design-tokens.css` を作った |
| 3 | コンポーネント一覧と画面を導出する | [design-components.md](references/design/design-components.md)、[design-infer.md](references/design/design-infer.md) | 各画面の `name / route / uc_slugs / story / variants / components` を決めた |
| 3.5 | アセットを生成する (ロゴ / ファビコン / アイコン) | [design-assets.md](references/design/design-assets.md) | `src/assets/` に SVG を置いた |
| 4 | Storybook アプリを生成する | [design-storybook.md](references/design/design-storybook.md) | `npx storybook build` が通り、目視で崩れが無い |
| 5 | screens.yaml を書いて検証する | (なし) | `validateScreens.js` が exit 0 を返す |
| 6 | `_review-summary.md` を書く | (なし) | 要約を書いた |

### 1. 入力を読む / UI の有無を判定する

最初に **UI の有無を判定**する。
次のどちらかなら、design を生成しない。
「画面を持たないプロダクトのため design を skip」と報告して終了する。

- `docs/requirements/rdra/システム概要.json` の `interface_kind` (省略時 `gui`) が `gui` 以外である
- ADR の tier に `frontend` / `presentation` / `ui` が無い

GUI なら、RDRA、use-cases.yaml、ADR、NFR を読み、ポータル、画面一覧、コンポーネント候補を抽出する。

**ADR の `ui:` ヒントを読み、従う。**
`scope: [ui]` の ADR front matter の `ui:` (`framework` / `rendering` / `styling` / `component_lib`) を取り出す。
手順 4 の技術選定は、このヒントに従う。
`ui:` が無ければ **`framework: react` / `rendering: spa` を既定**にする。
既定で Next.js を選ばない (ADR が SPA 方針でも Next.js になる食い違いを防ぐ)。

### 2. デザイントークンを推論する

- **`ui.brand` があれば primitive トークンはそこを起点にする** (再推論しない)。`ui.brand` が無いときだけ RDRA から推論する
- `brand.colors` (primary / secondary / accent / neutral) を、primitive の色スケールの基点にする
- `brand.typography` (heading / body) を、フォント指定に使う
- primitive → semantic → component の 3 層で、`src/tokens/tokens.json` と `src/styles/design-tokens.css` を作る。どちらも `src/` 配下に置く (F6 は `src/` だけを取り込むため)
- レイアウトとスペーシングは、`design-infer.md` 5 節の推論値を使う。任意値をハードコードしない
- 提案バリアントは出さず、⭐推奨のトークンを自動採用する。低確信の色とフォントの選択は、手順 6 の要約に明記する

### 3. コンポーネント一覧と画面を導出する

- UI 共通部品 (Button / Badge / Card / Input) を必ず用意する
- RDRA の情報 / 画面 / 状態から、ドメイン部品を導出する。RDRA に無い画面を増やさない
- 各画面について `name / route / uc_slugs / story / variants / components` を決める。`uc_slugs` は use-cases.yaml の `slug` を指す

### 3.5 アセットを生成する

コンポーネントを導出した後、Storybook アプリ生成の一部として作る。

- SVG 直書きで `docs/design/storybook-app/src/assets/` に置く。外部 API は使わない
- 置くファイルは `logo-full.svg` / `logo-icon.svg` / `logo-stacked.svg` / `favicon.svg` / `icons/<name>.svg` / `icons/index.md` である
- ロゴとファビコンの主要色は `ui.brand.colors.primary` を使う (無ければトークンの主要色)。フォントは `ui.brand.typography` を使う
- アイコンは、RDRA (画面 / 情報 / アクター) から導いたものだけ作る。勝手に増やさない
- `src/assets/` 配下なので、F6 の `importUi.js` が `packages/ui/assets/` に取り込む (`src/` を丸ごと取り込む)

### 4. Storybook アプリを生成する

**手順 1 で読んだ `ui:` ヒントの `framework` / `rendering` / `styling` に従って**技術構成を選ぶ。
ADR の方針と食い違う技術を選ばない (SPA 指定なのに Next.js を選ぶ、など)。

| ヒント | 選ぶ構成 |
|---|---|
| `rendering: spa` (既定) | SPA 構成 (例 Vite + React + TypeScript + Storybook)。**既定で Next.js を使わない。** |
| `rendering: ssr` / `ssg` | SSR/SSG 構成 (例 Next.js + Storybook `@storybook/nextjs-vite`) |
| `styling` | 既定は Tailwind CSS v4 |
| `framework` | 既定は React |

選んだ構成で `docs/design/storybook-app/` を生成する。

- トークン CSS、UI 部品、ドメイン部品、画面 Story (`stories/<Name>.stories.tsx`)、MDX を作る
- **`src/index.ts` (部品の公開口) を必ず作る**。UI 部品とドメイン部品 (と部品が使う型) を再輸出する。story は再輸出しない
- 部品群の生成は独立性が高いので、**サブエージェント分割 / 並列 Write** で時間を短縮する (派遣時はパスだけ渡す)

`src/index.ts` は、F6 の `importUi.js` が `packages/ui` の入口 (package.json の main) にする。
画面 (`apps/<frontend>`) は `@repo/ui` から部品を取る。

完了条件は 2 つある。

1. ビルド検証: `npx storybook build` が通る
2. **目視確認**: `captureStories.js` で各 Story を撮り、**はみ出し・文字切れ・コントラスト**を確認する。崩れがあれば部品を直して再ビルドする

ビルドが通っても、表示崩れは残る。
そのため、目視確認も完了条件にする。

```bash
node <skills>/d2-design/scripts/captureStories.js --cwd .
```

| 終了コード | 意味 | 扱い |
|---|---|---|
| exit 0 | 各 Story を撮って `docs/design/screenshots/<StoryId>.png` と `index.md` (一覧) を書いた | 撮れた `docs/design/screenshots/` を、目視の証跡として残す |
| exit 2 | 目視未実施。**`playwright` が無い / ビルド失敗 / Story 0 件 / chromium 起動・撮影失敗**のどれか | 手順 6 の要約と最終報告に **「目視未実施」**と明記する。通過扱いにしない |

スクリプトは、Storybook を静的ビルドし、ローカル http で配信して headless chromium で撮る。
file:// だと ES modules が読めず、白紙になるためである。
目視を行うには、対象リポの devDependency に `playwright` を足す。
足すのは、`capabilities.browser` が true のときか、画面の目視証跡が要るときである。

### 5. screens.yaml を書いて検証する

先頭に basis 行を刻む。

```bash
node <skills>/d2-common/scripts/lib/basis.js stamp requirements=docs/requirements adr=docs/adr
```

出力の `basis: requirements@<sha> adr@<sha>` を、`docs/design/screens.yaml` の先頭キー `basis:` に入れる。
続けて、`screens:` (画面ごとの行) と `tokens: {file: tokens/tokens.json}` を書く。
`tokens` は必須である (省くとスキーマエラー)。
`tokens.file` は `--app` (= `src/`) からの相対で書く。
実体は `src/tokens/tokens.json` である。
`--app` を指定すると、実在も検査される。

```bash
node <skills>/d2-design/scripts/validateScreens.js \
  docs/design/screens.yaml \
  --app docs/design/storybook-app/src \
  --use-cases docs/requirements/use-cases.yaml
```

| 終了コード | 意味 |
|---|---|
| exit 0 | PASS |
| exit 1 | 違反。直す (uc_slug 未定義 / story 不在 / variant 未 export / name・route 重複 / component 不在 / tokens.file 不在) |
| exit 2 | 読み込み失敗 |

### 6. _review-summary.md を書く

`docs/design/_review-summary.md` に、前提知識のない読者向けの平易な要約を書く。
d2-run が、この要約を `human-html-review` に渡して人に見せる。

- UC ごとの画面 (何を操作する画面か)
- コンポーネント一覧 (共通 + ドメイン)
- トークンの要点 (主要色 / フォント / 余白方針) と、自動採用した低確信の選択
- **ブランドの由来** (`ui.brand.source`): `brand skill` / `inferred` (低確信) / 参照パス のいずれか。`inferred` のときは、色とフォントを「確認してほしいこと」に含める
- 内部 ID とジャーゴンは本文に出さない

## 作らないもの

| 作らないもの | 代わり |
|---|---|
| 設計の履歴を持つファイルやディレクトリ | screens.yaml と Git 履歴で足りる。中間の `_inference.md` も残さない |
| 提案バリアント (proposal-variants) | ⭐推奨を自動採用する。低確信の選択は、レビュー要約に書く |

## スクリプト

| スクリプト | 用途 |
|---|---|
| [`scripts/schema-screens.json`](scripts/schema-screens.json) | screens.yaml の JSON Schema |
| [`scripts/validateScreens.js`](scripts/validateScreens.js) | screens.yaml 検証 (exit 0/1/2)。`--app` / `--use-cases` で実在検査 |
| [`scripts/captureStories.js`](scripts/captureStories.js) | 手順 4 の目視。Storybook をビルドし、playwright で各 Story を撮る |

共有ライブラリは `<skills>/d2-common/scripts/lib/` (basis.js, yaml.js, schemaValidate.js) を使う。
スキル内のスクリプトは、他プラグインを require しない。

## 引き継ぎファイル

作業の終わりに、進行役が派遣文で渡す場所 (`{handoff}`) に引き継ぎファイルを書く。
書くのは、人に聞きたいことと、自分の書き込み範囲では直せない前のステップの問題である。
報告の本文にだけ書いたことは扱われない。
推奨は条件を付けずに 1 つ書く。
書き方は [handoff.md](../d2-common/references/handoff.md) にある。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/design/design-infer.md](references/design/design-infer.md) | 手順 1 と 3 の前 | モデル分析と、画面 / コンポーネント / レイアウトの推論 |
| [references/design/design-tokens.md](references/design/design-tokens.md) | 手順 2 の前 | 3 層トークンの生成ルール |
| [references/design/design-components.md](references/design/design-components.md) | 手順 3 の前 | RDRA からのコンポーネント導出 |
| [references/design/design-assets.md](references/design/design-assets.md) | 手順 3.5 の前 | ロゴ / ファビコン / アイコンの SVG 生成 (`src/assets/`) |
| [references/design/design-storybook.md](references/design/design-storybook.md) | 手順 4 の前 | Storybook 生成と、F6 への受け渡し (`docs/design/storybook-app/` → `packages/ui/`) |
| [references/design/feedback.md](references/design/feedback.md) | `mode=feedback` で呼ばれたとき | 項目のファイルだけを直す手順 |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |
