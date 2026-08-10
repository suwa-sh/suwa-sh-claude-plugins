# スタイルプリセット: technical-schematic (テクニカル・スキマティック)

IPA「Open Dataspaces」サイト (https://www.ipa.go.jp/digital/opendataspaces/) の図解と同系統の、
**モノクロームの製図風コンセプト図**を codex-imagen で生成するためのプロンプトテンプレート。

呼び方の目安: monochrome technical schematic / blueprint-style conceptual diagram /
institutional whitepaper infographic。日本語なら「製図風モノクロ概念図」。

## スタイルの構成要素 (なぜこれで再現できるか)

| 要素 | 内容 |
|---|---|
| 配色 | デフォルト: 薄いグレージュ背景 `#EAE5DD` + ソフトチャコール `#444444` + アクセント1色 `#3B82F6`。**COLOR SCHEME ブロックの差し替えで実行時に上書き可** (下記) |
| 線 | 全要素が同一太さの極細ヘアライン (0.75pt 相当)。強弱をつけない |
| 角 | **図形の角は鋭角 (90度)**。角丸はソフト UI の記号なので使わない。丸めてよいのは配線の曲がりだけ |
| 質感 | 完全フラット。グラデーション・ドロップシャドウ・立体陰影・テクスチャなし |
| 主モチーフ | **六角形 (hexagon)**。輪郭のみ or グレー塗り |
| 配線 | 角丸の直交トレース (PCB 配線風)。直線 + 大きめの角R |
| 補助線 | 図形の外へはみ出す細い破線 (製図のガイドライン) |
| アイコン | 単線ピクトグラム (AI ヘッド+回路、モニタ+ノードグラフ、棒グラフ、工場、ビル、倉庫) |
| アクセント | 太い黒のブラシ状矢印を 1-2 本だけ (使いすぎない) |
| 構図 | 余白多め。左右対比を細い `≫` (ダブルシェブロン) で連結 |
| 文字 | ジオメトリックサンセリフ、中央揃え。小さいグレーのキャプション + 大きい黒のタイトルの2段 |

## 使い方

`SUBJECT:` ブロックだけ書き換えて、`STYLE RULES` 以降はそのままコピーする。

```bash
# プロンプトはファイルに書いてから渡す (Bash のヒアドキュメント/長い単行は tool call が壊れる)
# SKILL_DIR = このスキル読込時に表示される "Base directory for this skill"
bash "$SKILL_DIR/scripts/codex-imagen.sh" out.png "$(cat prompt.txt)"
```

## プロンプト本体 (コピペ用)

```
Monochrome technical schematic diagram in the style of a precision engineering blueprint / institutional whitepaper infographic.

SUBJECT: <ここに描きたい構造を1段落で書く。図形の種類・配置・接続関係・ラベル文字列を具体的に指定する。要素の並びは「AとBとCが1つの横列を成す」のように row / column で宣言し、曲げたい経路だけ curved と明記する>

LAYOUT RULES (strict):
- Elements arranged side by side in a row are vertically centered on one shared horizontal centerline, and spaced at equal horizontal intervals.
- Elements arranged one above another in a column are horizontally centered on one shared vertical axis, and spaced at equal vertical intervals.
- A connector between two elements on the same axis is a single perfectly straight line along that axis, with no bends, jogs or steps, and ends in a small open arrowhead showing the flow direction.
- Only connectors explicitly described as curved in the SUBJECT may curve; every other connector is straight.

COLOR SCHEME (default — 再スキンはこの4行の差し替えだけで行う):
- Background: light greige #EAE5DD, filling the entire canvas.
- Ink (all lines, outlines and text): soft charcoal grey #444444, never pure black.
- Shape fills: pure white #FFFFFF or a very light ink tint (about 8% and 16% ink over the background). No other greys.
- EXACTLY ONE accent color in the whole image: blue #3B82F6, used on a single element or a single path only. Everything else is ink on background. No second accent color.

STYLE RULES (strict):
- Ultra-thin uniform hairline strokes (like 0.75pt) for every outline and connector. Stroke weight is identical everywhere.
- Flat vector. No gradients, no drop shadows, no 3D shading, no texture, no glow.
- Hexagon is the primary unit motif, either outlined or filled with flat grey.
- Every rectangle and polygon has SHARP 90-degree corners, like drafted linework. No rounded corners on any shape. Rounding exists ONLY where connector traces turn a corner.
- Connectors are rounded-orthogonal traces, like PCB routing: straight runs with generous 90-degree corner radii.
- Thin dashed construction guide lines extend past some shapes, like a drafting layout.
- Pictogram icons are single-weight line art, no fill.
- Generous white space; the diagram breathes. Wide 16:9 canvas.
- Labels in a geometric sans-serif, centered, two tiers: small muted caption above, larger title below, both in the ink color.
- Japanese text must be rendered correctly with proper glyphs (Noto Sans JP style). Do not garble kanji.

MOOD: calm, academic, restrained, Google Design / IPA institutional aesthetic. Absolutely no illustrative flourish, no people photos, no color beyond the single accent.
```

日本語ラベルを使わないなら最後から2行目の Japanese の行は削ってよい。

## 配色の上書き (COLOR SCHEME ブロック)

配色は `COLOR SCHEME` ブロックに集約してある。**再スキンはこのブロックの hex 差し替えだけ**で行い、
STYLE RULES / LAYOUT RULES には触れない。名前付きスキン:

| スキン | Background | Ink | Accent | 用途 |
|---|---|---|---|---|
| **default (greige)** | `#EAE5DD` | `#444444` (黒は強すぎ NG) | `#3B82F6` blue | 既定。マーケ成果物のブランドトーン (2026-08-09 検証済み) |
| ipa-mono (原典) | pure white | black + grey tints `#EDEDED` / `#C8C8C8` / `#8A8A8A` | なし (彩色ゼロ) | IPA 原図の完全モノクロ再現。Accent 行を `NO color at all` に置換 |

アクセントは常に**最大1色**。トピック固有色に変えてよいが2色目は混ぜない (ipa-mono は0色)。

## SUBJECT の書き方

抽象語だけ渡すと構図が決まらない。**図形・配置・接続・ラベル文字列**を名指しする。

- 悪い例: `SUBJECT: データ基盤の分散化を表す図`
- 良い例: `SUBJECT: A left-vs-right comparison. LEFT titled "Centralized" shows small outlined 3D primitives (cube, cylinder, pyramid) whose connector lines converge into one large outlined cylinder at the center, from which thin arrows fan out to four pictogram icons. RIGHT titled "Distributed" shows six flat grey hexagons linked peer-to-peer by rounded-orthogonal traces. A thin double-chevron separates the two sides.`

### LAYOUT RULES の使い方 (矢印の曲がり対策)

プロンプト本体の `LAYOUT RULES` は**既定で毎回入れる**。役割分担は:

- **規則側 (固定)**: 横列=水平センターラインに芯揃え+横等間隔 / 縦列=垂直軸に芯揃え+縦等間隔 /
  同一軸上のコネクタ=直線+矢頭 / 曲線は SUBJECT で明記した経路のみ
- **SUBJECT 側 (毎回書く)**: どの要素が1つの row / column を成すか、どの経路が curved か

背景: 整列軸を書かないと要素の芯が微妙にずれ、直交配線ルールが**コネクタにジョグ (段差) を挿入する**
(2026-08-09 に実発生)。軸を宣言するとジョグが消え、軸自体が破線ガイドとして描かれて製図トーンも強まる。
等間隔指定を足すと要素間の破線ガイドも等リズムになる。曲線のホワイトリスト方式は、例外経路
(自己修復の戻りなど) まで直線に矯正される事故を防ぐ。

よく使う構図パターン:

| パターン | SUBJECT の骨格 |
|---|---|
| Before → After 対比 | `A left-vs-right comparison. LEFT titled "X" shows … RIGHT titled "Y" shows … A thin double-chevron separates the two sides.` |
| 階層/積層 | `Three hexagons stacked vertically and interlocking: upper light-grey "A", center mid-grey "B", lower light-grey "C".` |
| 入力→中核→出力 | `On the far left a vertical stack of pictogram icons connected into the center hexagon by rounded-orthogonal traces; on the far right thin arrows exit toward two pictograms.` |
| 組織横断のメッシュ | `Three soft ellipses each containing a small mesh of grey hexagons, with an organization pictogram (office building / warehouse / factory) at each ellipse's edge; the ellipses overlap.` |

## 高密度の実測 (2026-08-09)

箱13 + 破線ゾーン2 + テキスト26箇所 (ポート番号・コマンド・日本語タイトル混在) を同一プロンプトで2枚生成した結果:

- **文字は2枚とも崩れゼロ**。ラベル密度はこのスタイルの制約にならない。プロンプトに
  `Every text label must be spelled EXACTLY as written in the SUBJECT` を入れておく。
- 弱点は**配線トポロジの忠実度**。接続8本規模で「ハブ&スポーク指示がチェーンに書き換わる」
  「矢印がゾーン境界で止まり終端に届かない」個体が出た。
- **検収は文字ではなく、全矢印の (始点, 終点, 向き) を SUBJECT と照合する。**
  接続関係そのものが主情報の図 (依存グラフ等) は diagram-design を使う。

## 検証済み (2026-08-09)

- 2枚生成して再現性を確認済み。左右対比構図・単一中心構図ともに成立。
- **日本語ラベルは正しく描画された** (「エージェント実行基盤」「コンセプト図」)。ただし長文は崩れやすいので短い語に留める。
- 「重なり合う六角形」は隣接配置になることがある。厳密な重なりが要るなら `overlapping so their edges interlock, sharing edges` と強めに書く。

## 注意

- **SUBJECT 側でも図形は `sharp-cornered rectangle` / `square` と書く。** `rounded rectangle` と書くとカード UI 風に甘くなり製図トーンが崩れる (2026-08-09 検証: 鋭角化で締まりが明確に向上)。角丸の座は配線カーブ専用。
- アクセントを2色以上混ぜたい誘惑に負けない。2色目が入るとこのスタイルの説得力が落ちる。
- 太い黒矢印は「アクセント」なので 1-2 本まで。全部太くすると別のスタイルになる。
- 参照画像を渡す edit モードは、REF に引きずられて構図まで複製されやすい。**新規構図はテキストのみで生成する**方が安定する。
