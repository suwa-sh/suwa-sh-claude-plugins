---
name: codex-imagen
description: Codex CLI 経由で画像を生成/編集するスキル。scripts/codex-imagen.sh が `codex exec` を呼び、指定した出力パスに PNG を保存して絶対パスを返す。入力画像を指定すれば編集 (edit モード) にも対応する。「画像を生成して」「codex で画像作って」「イラストを作って」「この画像を編集」などで使う。
---

# codex-imagen

Codex CLI (`codex exec`) の imagen スキル経由で画像を生成、または既存画像を編集し、指定した出力パスに PNG を保存して絶対パスを返す。

## ⚠️ あなた自身が Codex の場合 (再帰禁止・最重要)

**あなたが Codex CLI としてこのスキルを読んでいる場合、`scripts/codex-imagen.sh` を実行してはならない。**
このスクリプトは *外部エージェント (Claude Code 等) が Codex を呼び出すためのラッパー* であり、中身は `codex exec 'imagenスキルで...'` である。Codex 自身がこれを実行すると **codex exec → SKILL.md 読込 → codex-imagen.sh → codex exec... の無限再帰**になり、画像は永遠に生成されない (実発生歴あり)。

Codex 自身への指示: プロンプトの「出力ファイルパス」に対して、**組み込みの画像生成機能 (image_gen ツール / imagen 内蔵スキル) を直接使って生成・編集し、指定パスに PNG を保存する**こと。このファイルの以降のセクションは外部エージェント向けの手順であり、Codex 自身は従わなくてよい。

## 前提

- `codex` CLI が PATH に存在し、ログイン済みであること
- (任意) `agy` (Antigravity CLI) が PATH にあり、ログイン済みであること。codex が usage limit 等で尽きたときのフォールバックに使う
- 出力パスは呼び出し側が指定する（例: `tmp/shiba.png`）
- 編集モードの場合、入力画像も呼び出し側が指定する（ローカルファイルパス）
- `--size` のリサイズは macOS の `sips` を使用する (無い環境では警告してスキップ)

## 手順

1. ユーザーから画像プロンプトと出力パスを受け取る。編集の場合は入力画像パスも受け取る
2. `<skill-base-dir>/scripts/codex-imagen.sh <出力パス> "<プロンプト>" [<入力画像>]` を **Bash** で実行する
   (`<skill-base-dir>` はこのスキル読込時に表示される "Base directory for this skill" の絶対パス)
3. stdout に出力される PNG の絶対パスをユーザーに提示する
4. 失敗時はエラー理由をユーザーに伝える

## スクリプトの契約

`scripts/codex-imagen.sh <output_path> <prompt> [<input_image>] [--size=<WxH>]`

- 引数1: 出力パス（相対/絶対どちらでも可。ディレクトリは自動作成）
- 引数2: プロンプト文字列
- 引数3（任意）: 入力画像パス。指定すると **edit モード**として呼ぶ（既存画像の編集）
- `--size=<WxH>`（任意）: 最終画像サイズ/縦横比を厳密に指定。例: `--size=1280x670`
  - プロンプトに「画像サイズは W×H ピクセル以上、縦横比 W:H で生成してください」を付加して codex に指示（目標以上のサイズを誘導）
  - 生成後 **scale-to-cover + center-crop** でリサイズ（歪みなし）:
    1. `sips --resampleHeightWidth` で縦横比を保ったまま目標を覆うサイズに縮小
    2. `sips -c` で中央を切り抜き、正確に W×H にする
  - **元画像が目標より小さい場合はエラー扱い**。10秒待ってリトライする（codex に「もっと大きく」を期待）
  - **用途**: アイキャッチなど、特定縦横比が必須の用途で確実にサイズ担保したいとき
- 実行コマンド (codex 経路):
  - generate: `codex exec 'imagenスキルで画像を生成します。出力ファイルパス: <path>  <prompt>'`
  - edit: `codex exec 'imagenスキルで画像を編集します。入力画像: <in>  出力ファイルパス: <out>  <prompt>'`
- `scripts/agy-imagen.sh` も **同じ引数契約**で単体実行できる (プロバイダを明示指定したいとき)
- 成功時: PNG の絶対パスを stdout に1行出力、exit 0
- 失敗時（ファイルが生成されなかった）: 10秒待ってリトライ。codex の上限到達後は `agy` フォールバックへ切り替え、そこも尽きたら stderr にエラー理由、exit 1

### 環境変数

| 変数 | 既定 | 用途 |
|---|---|---|
| `CODEX_IMAGEN_MAX_ATTEMPTS` | 4 | 同一 invocation 内のリトライ上限 (下記) |
| `CODEX_IMAGEN_TIMEOUT` | 300 | `codex exec` 1 回の上限秒数 (timeout/gtimeout がある環境のみ有効) |
| `CODEX_IMAGEN_KEEP_DAYS` | 7 | `~/.codex/generated_images/` の中間出力の保持日数。0 で掃除無効化 |
| `CODEX_IMAGEN_CODEX_WRAPPER` | (なし) | `codex` の代わりに実行するラッパーコマンドの絶対パス。実行可能な場合のみ使用 (例: OTel トレーシングラッパー)。未設定なら `codex` を直接呼ぶ |
| `CODEX_IMAGEN_FALLBACK` | `agy` | codex が尽きたときの二段目。`off` で無効化 (codex のみ) |
| `AGY_IMAGEN_MAX_ATTEMPTS` | 2 | agy-imagen.sh のリトライ上限 |
| `AGY_IMAGEN_TIMEOUT` | 420 | `agy` 1 回の上限秒数 |
| `AGY_IMAGEN_BIN` | `agy` | `agy` 実体の上書き (テスト用) |

### フォールバック (CODEX_IMAGEN_FALLBACK, default agy)

codex は usage limit / rate limit で数時間〜1 日単位で止まることがあり、その間は何回リトライしても
画像が出ない。画像生成に依存する pipeline (YouTube サムネ / Shorts ページ / Pinterest pin) が
片方のクォータ枯渇で丸ごと止まらないよう、**プロバイダごとにスクリプトを分け、尽きたら切り替える**。

```
scripts/
├── lib/imagen-common.sh   # 引数契約 / --size リサイズ / 出力パスの正本 (両者が source)
├── codex-imagen.sh        # 既定: codex exec の imagen スキル。尽きたら下へ委譲
└── agy-imagen.sh          # 二段目: Antigravity CLI (agy) の generate_image。単体でも使える
```

- `codex-imagen.sh` は codex のリトライが全て尽きた後にだけ `agy-imagen.sh` を **同じ引数のまま**呼ぶ
  (通常時の挙動・コストは変わらない)。stdout の絶対パス 1 行という契約も同じ
- `agy-imagen.sh` は `agy --dangerously-skip-permissions --print-timeout <d> --add-dir <出力/参照dir> -p "<prompt>"`
  の非対話実行。プロバイダを明示的に選びたいときは単体で呼んでもよい
- リサイズは共通ライブラリの `scale-to-cover + center-crop` なので **サイズ契約は同一**
- 参照画像 (`<input_image>`) は「generate_image の入力画像 (ImagePaths) として渡す」とプロンプトで
  明示しており、キャラクターの造形・画風が保持される (明示しないと参照が無視され別の絵になる)
- `agy` が PATH に無ければフォールバックせずに従来通り失敗する

### リトライ回数 (CODEX_IMAGEN_MAX_ATTEMPTS, default 4)

codex の imagen スキルは組み込み `image_gen` ツール/CLI フォールバックの可用性がセッション単位で揺れる。`--size` 指定時に codex が目標未満サイズを返して resize 拒否されるケース (出力サイズは実行ごとの当たり外れ) があるため、同一 invocation 内で最大 `CODEX_IMAGEN_MAX_ATTEMPTS` 回 (default 4) まで 10 秒間隔でリトライして「外れ」を引き直す。1 回あたり最大 `CODEX_IMAGEN_TIMEOUT`(300s) + 10s なので最悪 ~20 分。恒久的に不可な状況 (API key 未設定・アカウント状態) では何回試しても変わらないが、上限で打ち切るので暴走はしない。

## 実行例

```bash
SKILL_DIR="<Base directory for this skill>"
bash "$SKILL_DIR/scripts/codex-imagen.sh" tmp/shiba.png "青空の下でひまわり畑を駆ける柴犬、油絵風"
# → /path/to/cwd/tmp/shiba.png
```

失敗時:

```
[codex-imagen] failed to generate/resize image at: tmp/shiba.png (after 4 attempts)
```

## スタイルプリセット

特定の図解トーンを再現したいときは `references/` のテンプレートを使う。`SUBJECT:` だけ差し替えて、`STYLE RULES` 以降はそのまま渡す。

| プリセット | 用途 | ファイル |
|---|---|---|
| technical-schematic | 製図・ブループリント風のモノクロ概念図 (六角形モチーフ + ヘアライン + 破線ガイド)。**平面の概念図**向け | `references/style-technical-schematic.md` |
| isometric-layer-stack | アイソメ積層プラットフォーム図 (厚みのある板 + ワイヤーフレーム + 1色アクセント)。**レイヤー構造・層間フロー**向け | `references/style-isometric-layer-stack.md` |

プロンプトが長いので、**ファイルに書いてから `"$(cat prompt.txt)"` で渡す** (Bash のヒアドキュメントや長い単行コマンドは tool call のパースを壊すことがある)。

配色は各プリセットの `COLOR SCHEME` ブロックに集約されている。既定は薄いグレージュ背景 `#EAE5DD` + ソフトチャコール `#444444` (黒は強すぎるので使わない) + アクセント1色 `#3B82F6`。**再スキンは COLOR SCHEME の hex 差し替えだけ**で行い、他のブロックには触れない (名前付きスキンは各プリセットの「配色の上書き」節)。

プリセットの得手不得手 (実測に基づく):

- **ラベル密度には強い**。ポート番号・コマンド文字列・日本語混在の高密度図でも文字崩れは起きにくい
- 弱点は**配線トポロジの忠実度**。接続が8本規模になると、向きの反転・チェーン化・矢印の途切れなどの逸脱個体が出る。**検収は矢印の (始点, 終点, 向き) を仕様と照合する**
- 修正は再生成ガチャ (SVG のような1行 Edit は不可)。接続関係そのものが主情報で間違いが許されない図 (依存グラフ・正確なデータフロー) には、決定論的に描ける図解手段 (SVG/mermaid 等) を使う

## 動作原理

- `codex` を直接叩くと `stdin is not a terminal` で失敗するため、非対話版の `codex exec` を使う
- プロンプトに「出力ファイルパス: <path>」を明示することで、codex 側に保存先を指示する
- codex は指定 out_path でなく `~/.codex/generated_images/<thread_id>/` に書き出すことがあるため、`codex exec --json` の `thread.started` イベントから thread_id を取り、自分の dir だけを harvest する (**並列実行しても干渉しない**)
- codex が画像を書き込んだかどうかをファイル存在でチェックし、失敗時は10秒スリープ後にリトライする
