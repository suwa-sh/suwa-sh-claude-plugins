# toolbox — 汎用ワークフロースキル集

特定ドメインに縛られない、日々の作業プロセスを支える汎用スキルの置き場。今後も汎用スキルをこのプラグインに追加していく。

## スキル

### `toolbox:review-refute-loop` — クロスモデル外部レビュー収束ループ

git diff / プラン / 直近の成果物を、実行中とは**別系統**のコーディングエージェント (Claude Code 実行時は Codex、Codex 実行時は Claude Code) に第三者レビューさせる。各指摘をまず自分で吟味 (反証) してから、反証しきれないものだけ修正し、再レビューで収束するまで最大 3 ラウンド繰り返す。

- 同じモデルの内製レビューに残る「同じモデルの盲点」をクロスモデルで除去する
- レビュアーの指摘を鵜呑みにせず REFUTED / ACCEPTED / NEEDS_INFO に分類してから直す
- Codex companion の background 実行・スタック検知・途中成果 salvage・サブエージェントフォールバックを同梱スクリプトに集約

トリガー例: 「外部レビューして」「セカンドオピニオン」「指摘を反証して」「この diff/プランをレビューに投げて」

### `toolbox:human-html-review` — 判断可能な自己完結レビュー HTML 生成

前提知識ゼロのレビュアーが、背景 → 代替案 → 対象の構造/振る舞い/データモデル → 証拠 → 残リスク → 承認後に起きること、の順でメンタルモデルを再構築して判断できる、自己完結 HTML を 1 ファイル生成する。

- 決定モードは `approval` (承認/差し戻し) と `selection` (選択肢の比較選定) の 2 種
- 主張を observed / agent-claim / inference / human-decision に分類する evidence ledger
- 図解は `diagram-design` スキル (依存) の設計システムに従う
- `scripts/validate.py` による構造検証つき

トリガー例: 「このプランをレビュー用 HTML にして」「承認に必要な情報をまとめて」「選択肢を比較できる形で見せて」

### `toolbox:codex-imagen` — Codex → Grok → AGY の画像生成/編集

`codex exec` の imagen スキルをラップし、失敗時は Grok、Antigravity の順に退避する。指定した出力パスに PNG を保存して絶対パスを返し、入力画像を渡せば edit モードになる。

- `--size=<WxH>` で最終サイズを厳密担保 (scale-to-cover + center-crop、目標未満はリトライで引き直し)
- Grok 経路は生成に `image_gen`、既存画像の編集に `image_edit` だけを許可
- Grok のセッションIDを invocation ごとに固定し、`images/1.jpg` を回収・PNG変換するため並列実行でも混線しない
- `codex exec --json` の thread_id で自分の出力を一意特定するため**並列実行しても干渉しない**
- スタイルプリセット同梱 (`references/`): 製図風モノクロ概念図 (technical-schematic) / アイソメ積層図 (isometric-layer-stack)
- `CODEX_IMAGEN_CODEX_WRAPPER` 等の環境変数でラッパー注入・タイムアウト・リトライ回数を制御

トリガー例: 「画像を生成して」「codex で画像作って」「イラストを作って」「この画像を編集」

## インストール

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install toolbox@suwa-sh-claude-plugins
```

## 前提条件

| スキル | 依存 | 備考 |
|---|---|---|
| `review-refute-loop` | Codex CLI (companion plugin) または `claude` CLI | どちらも無い場合はサブエージェントフォールバックで動作 (クロスモデル効果は失われる) |
| `human-html-review` | [diagram-design](https://github.com/cathrynlavery/diagram-design) スキル | 未導入時はスキルが URL とインストールコマンド (`npx skills add cathrynlavery/diagram-design`) を提示する。`python3` も使用 (validate.py) |
| `codex-imagen` | Codex CLI。Grok CLI / Antigravity CLI は任意 | 既定の退避順は codex → grok → agy。`--size` は macOS `sips` を使用 |

## 使い方

```
# 現在の作業ツリー差分を外部レビューして収束させる
/toolbox:review-refute-loop

# 対象を指定してレビュー
/toolbox:review-refute-loop notes/zenn/articles/foo.md

# 現在の変更の承認レビュー HTML を生成
/toolbox:human-html-review current changes --mode approval

# 選択肢比較のレビュー HTML を生成
/toolbox:human-html-review choose auth migration approach --mode selection
```

組み合わせパターン: 成果物を `review-refute-loop` で収束させてから、`human-html-review` でヒト承認用の HTML を出す、という 2 段構えが既定の使い方。
