# toolbox — 汎用ワークフロースキル集

特定ドメインに縛られない、日々の作業プロセスを支える汎用スキルの置き場。今後も汎用スキルをこのプラグインに追加していく。

## スキル

### `toolbox:review-refute-loop` — クロスモデル外部レビュー収束ループ

git diff / プラン / 直近の成果物を、実行中とは**別系統**のコーディングエージェント (Claude Code 実行時は Codex、Codex 実行時は Claude Code) に第三者レビューさせる。各指摘をまず自分で吟味 (反証) してから、反証しきれないものだけ修正し、再レビューで収束するまで最大 3 ラウンド繰り返す。

- 同じモデルの内製レビューに残る「同じモデルの盲点」をクロスモデルで除去する
- レビュアーの指摘を鵜呑みにせず REFUTED / ACCEPTED / NEEDS_INFO に分類してから直す
- Codex companion の background 実行・スタック検知・途中成果 salvage・サブエージェントフォールバックを同梱スクリプトに集約

トリガー例: 「外部レビューして」「セカンドオピニオン」「指摘を反証して」「この diff/プランをレビューに投げて」

### `toolbox:human-html-review` — ヒトの判断待ちページを図と表で作る

文脈を忘れている読者でも 1 ページで状況を思い出し、判断できる自己完結 HTML を 1 ファイル生成する。固定フォーマットは無く、読者の問いの順にコンテンツを毎回設計する。

- 必須は 3 部品だけ: 「いま何の話か」(現在地マップつき) / 「何を決めてほしいか」 / 「どう答えるか」(選ぶと返信の文面が組み上がり、ボタン 1 つでコピーできる回答欄)
- 平易な言葉で書き、内部 ID (`UC-06` / ハッシュ / ステージ番号) を本文に出さず名前で呼ぶ
- 見出し 2 つにつき図 1 つ以上。本文幅の上限 1760px で図と説明を横に並べる
- 主張には「確認済み / 報告のみ / 推測 / 未確認」の文字ラベルを付ける
- `scripts/validate.py` が自己完結性と必須部品を検査し、内部 ID・長い段落・図解不足を警告する
- `references/`: `content-design.md` (問いの階段と言葉の規則) / `diagrams.md` (図の型と描き方) / `components.md` (部品カタログ)

トリガー例: 「このプランを確認用の HTML にして」「承認に必要な情報をまとめて」「選択肢を比較できる形で見せて」「レビューをお願いする画面を作って」

### `toolbox:codex-imagen` — Codex → Grok → AGY の画像生成/編集

`codex exec` の imagen スキルをラップし、失敗時は Grok、Antigravity の順に退避する。指定した出力パスに PNG を保存して絶対パスを返し、入力画像を渡せば edit モードになる。

- `--size=<WxH>` で最終サイズを厳密担保 (scale-to-cover + center-crop、目標未満はリトライで引き直し)
- Grok 経路は生成に `image_gen`、既存画像の編集に `image_edit` だけを許可
- Grok のセッションIDを invocation ごとに固定し、`images/1.jpg` を回収・PNG変換するため並列実行でも混線しない
- `codex exec --json` の thread_id で自分の出力を一意特定するため**並列実行しても干渉しない**
- スタイルプリセット同梱 (`references/`): 製図風モノクロ概念図 (technical-schematic) / アイソメ積層図 (isometric-layer-stack)
- `CODEX_IMAGEN_CODEX_WRAPPER` 等の環境変数でラッパー注入・タイムアウト・リトライ回数を制御

トリガー例: 「画像を生成して」「codex で画像作って」「イラストを作って」「この画像を編集」

### `toolbox:mid-harness` — 中ハーネス (portable core + 製品別 adapter) の展開・適用・検査

コーディングエージェントをまたいで持ち運べる資産 (AGENTS.md / skills / agent-specs / hooks / memory = **中ハーネス**) を、製品非依存の portable core に置き、各製品 (Claude Code / Codex CLI / Cursor / Grok Build / GitHub Copilot CLI / Antigravity CLI) が読む設定は core から生成する薄い adapter にする。

- `init`: 推奨ツリー (`AGENTS.md` / `docs/` / `.agents/{memory,skills,agent-specs}` / `scripts/agent-hooks/`) と manifest `.agents/harness.yaml` を展開し、adapter を生成して受け入れテストを回す
- `apply`: 既存リポの資産を棚卸し → 6 つの振る舞い契約へ分類 → 人の承認 (human-html-review) → `git mv` で core へ移送 → adapter 生成
- `audit`: manifest から再生成した adapter と commit 済みの差分 (drift) を検査し、受け入れテスト (skill 発見 / headless / hook 拒否) を targets の製品ごとに実行。CI 向け
- hook は `scripts/agent-hooks/` の 1 本を各製品の設定が呼ぶだけの二層構成。custom agent は `prompt.md` + `policy.yaml` (論理能力) から各製品の front matter / TOML を生成し、変換不能は失敗させる
- 各モードの最後に `trust_status.py` で「hook を製品に読ませるためにユーザー側で必要な trust」(Codex の project trust / Grok の folder trust / Antigravity の project 登録 / Copilot の `trustedFolders`) の不足を検査し、付け方を報告に載せる (repo 内のファイルでは有効化できないため)
- 対応製品は Claude Code / Codex CLI / Cursor / Grok Build / GitHub Copilot CLI / Antigravity CLI の 6 つ。読込規則と実測結果は `references/adapters/<product>.md` に確認日つきで置く。hook スクリプト 1 本が 6 製品の stdin/stdout 形式を吸収する
- `samples/toolbox/mid-harness/` に 6 製品 targets で `init` した結果と受け入れテストの記録を公開

トリガー例: 「中ハーネスを展開して」「この構成を既存リポに適用して」「Claude Code と Codex で同じ動きをさせたい」「adapter がドリフトしていないか見て」

## インストール

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install toolbox@suwa-sh-claude-plugins
```

## 前提条件

| スキル | 依存 | 備考 |
|---|---|---|
| `review-refute-loop` | Codex CLI (companion plugin) または `claude` CLI | どちらも無い場合はサブエージェントフォールバックで動作 (クロスモデル効果は失われる) |
| `human-html-review` | `python3` (validate.py)。[diagram-design](https://github.com/cathrynlavery/diagram-design) スキルは任意 | diagram-design があれば図の描き方をそれに従わせる。無ければ `references/diagrams.md` の最小ルールで描く (インストールを求めない) |
| `codex-imagen` | Codex CLI。Grok CLI / Antigravity CLI は任意 | 既定の退避順は codex → grok → agy。`--size` は macOS `sips` を使用 |
| `mid-harness` | `python3` 3.11+ (3.10 は `tomli` 追加) + PyYAML。受け入れテストだけ targets に含めた製品の CLI (`claude` / `codex` / `agent` / `grok` / `copilot` / `agy`) | CLI が無い製品は verify を skip。製品ごとの trust 前提 (Codex の hook trust、Grok の folder trust、Antigravity の project 登録) は `references/adapters/<product>.md` |

## 使い方

```
# 現在の作業ツリー差分を外部レビューして収束させる
/toolbox:review-refute-loop

# 対象を指定してレビュー
/toolbox:review-refute-loop notes/zenn/articles/foo.md

# いま会話で判断待ちになっている事柄を確認ページにする
/toolbox:human-html-review

# 現在の変更の承認ページを生成
/toolbox:human-html-review current changes

# 選択肢比較のページを生成
/toolbox:human-html-review 認証の移行方式を A と B から選ぶ

# 新規リポに中ハーネスを展開 (Claude Code + Codex)
/toolbox:mid-harness init . --targets claude-code,codex

# 既存リポに段階適用 / CI で drift と同等性を検査
/toolbox:mid-harness apply .
/toolbox:mid-harness audit .
```

組み合わせパターン: 成果物を `review-refute-loop` で収束させてから、`human-html-review` でヒト承認用の HTML を出す、という 2 段構えが既定の使い方。
