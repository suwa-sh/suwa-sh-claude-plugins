# モデル分析と画面導出 (design-infer)

RDRA・ADR・NFR を読み、ポータル / 画面 / コンポーネント候補 / レイアウトを導出する。
v1 の推論ルールを踏襲する。イベントソーシングや対話バリアント提示は行わない。

## 1. 入力の読み方

### RDRA (`docs/requirements/rdra/*.tsv`)

| ファイル | 抽出するもの |
|---|---|
| `画面.tsv` (または BUC の `画面` 列) | ユニーク画面名 → 画面一覧 |
| `アクター.tsv` (アクター群 / 社内外 / 立場) | ポータル導出 |
| `情報.tsv` (情報 / 属性 / 状態モデル / バリエーション) | データ表示コンポーネント候補 |
| `状態.tsv` (状態モデル / 状態 / 遷移) | StatusBadge / StepTracker 候補 |
| `バリエーション.tsv` | SearchFilter / Select / Tab 候補 |

**ポータル導出:** 社内外 + 立場の組みでポータルを分ける。
- 社外 + 受益者 → User ポータル (Blue 系)
- 社外 + 提供者 → Provider ポータル (Teal 系)
- 社内 + 提供者/管理 → Admin ポータル (Slate 系)
- ポータルが 2 つなら Blue + Slate を推奨。

### UC 一覧 (`docs/requirements/use-cases.yaml`)

`use_cases[]` の `business / buc / uc / slug / spec_ids / actors` を読み、
**画面 ↔ UC の対応**を作る。screens.yaml の `uc_slugs` はここの `slug` を指す。

### ADR (`docs/adr/*.md`)

`scope: ui` の ADR、および front matter の `ui: {framework, design_system, ...}` を UI ヒントとして読む
(任意。無ければ RDRA/NFR から推論)。framework 指定があればそれに従う。

### NFR (`docs/nfr/nfr-grade.yaml`, 任意)

| NFR | デザイン判断 |
|---|---|
| 可用性 | エラー / ローディング状態を全画面に用意 (variants に Error / Loading) |
| 性能 | ページネーション / 仮想スクロールの要否 |
| セキュリティ (RBAC) | ポータル別ナビ・権限表示切替 |
| セキュリティ (PII) | マスク表示コンポーネント (PiiMaskedText) |
| ユーザビリティ / アクセシビリティ (grade) | コントラスト・フォーカスリング・キーボード操作の強度 |

## 2. UI の有無判定 (最初に行う)

`docs/requirements/rdra/システム概要.json` の `interface_kind` (省略時 `gui`) が `gui` 以外
(`cli` / `api` / `batch`)、または ADR の tier に `frontend` / `presentation` / `ui` が無い場合は
**画面を持たないプロダクト**。design を生成せず、その旨を報告して終了する
(d2-requirements が同じ判定を持つ。呼び出し側 d2-run が skip を判断する)。

## 3. コンポーネント候補の導出

`design-components.md` の対応表に従い、RDRA の情報 / 画面 / 状態からコンポーネントを導出する。
RDRA に無い画面を勝手に増やさない (整合性ルール)。

## 4. 画面ごとの screens.yaml 行

各画面について次を決める。

| 項目 | 決め方 |
|---|---|
| `name` | PascalCase の画面名 (例: BookSearch) |
| `route` | REST 風パス (例: /books) |
| `uc_slugs` | この画面が担う UC の slug (use-cases.yaml に実在) |
| `story` | `stories/<Name>.stories.tsx` (画面構造の正) |
| `variants` | 既定 Default。NFR に応じ Empty / Error / Loading を足す |
| `components` | 画面が使う UI + Domain コンポーネント名 |

原則「**Story = 画面構造の正**」。画面の状態 (空・エラー・読み込み) は Story の named export で表す。

## 5. レイアウト・スペーシング推論

12 カラムグリッドを基本とする。値はハードコードせず根拠付きで導出する。

**サイドバー幅:** ナビ項目数 (業務数 + 共通メニュー) から。≤ 8 → 12rem / 9〜15 → 16rem / > 15 → 20rem。
collapsed 幅は 4rem 固定。

**画面パターン別カラム分割:**

| 画面用途 | カラム分割 | 根拠 |
|---|---|---|
| 一覧・検索 (属性数 ≥ 5) | 12col フル幅 | テーブル表示 |
| 詳細 (関連情報あり) | 8col + 4col | マスター・ディテール |
| 登録・編集 (フィールド ≤ 10) | 2col + 8col + 2col | 中央寄せフォーム |
| ダッシュボード | 6col + 6col / 4col × 3 | KPI カード数から |

**レスポンシブ:** NFR F.1.1.1 (端末対応) から必要なブレークポイントを決める。
Lv1 = lg のみ / Lv2 = lg + md / Lv3 = lg + md + sm (モバイルファースト)。

**スペーシング (4px ベース、セマンティックトークン):** `--page-padding` / `--section-gap` /
`--component-gap` / `--card-padding` を情報密度・ポータル構成から導出する。
原則 `gap > padding > margin` (margin はセクション間のみ)。

## 6. 記録

推論根拠 (ポータル / 画面 / コンポーネント / レイアウト / 採用トークン) は `docs/design/_review-summary.md`
の平易な説明に集約する。中間の `_inference.md` は残さない (履歴は Git)。
低確信の選択 (色・フォント等を自動採用した箇所) はレビュー要約に明記する。
