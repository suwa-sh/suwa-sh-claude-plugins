# スタイルプリセット: isometric-layer-stack (アイソメ積層プラットフォーム)

Palantir Ontology / Apollo GraphOS 系の、**等角投影の「板 (スラブ)」でレイヤーを表す**製品マーケ図。
レイヤー構造・階層・データフローがハマる概念に使う。

呼び方の目安: isometric platform stack / axonometric layered architecture illustration /
enterprise data-platform diagram。日本語なら「アイソメ積層プラットフォーム図」。

[[style-technical-schematic]] が「平面の概念図」なのに対し、こちらは**層と層の間を流れる**構造向け。

## スタイルの構成要素

| 要素 | 内容 |
|---|---|
| 投影 | 真の等角投影 (30度)。全オブジェクトが同一軸。透視消失点なし |
| 配色 | デフォルト: 薄いグレージュ背景 `#EAE5DD` + ソフトチャコール `#444444` ヘアライン + アクセント1色 `#3B82F6`。**COLOR SCHEME ブロックの差し替えで実行時に上書き可** (下記) |
| レイヤー表現 | **厚みのある平板 (スラブ)** を縦に浮かせて積む。板の側面が見える |
| 板の上 | 小さなワイヤーフレーム 3D モデル (建物・機械・サーバ・車両・モニタ) |
| 板の間 | **細い破線カーブの束**が扇状に広がって流れる (データ移動) |
| ラベル | 板の縁にアイソメ変形して配置。大文字 + レタースペース広め |
| 浮遊 UI | 小さなカード/モニタ/ツールチップが板の上に浮く |
| アクセント | **1色だけ**。面積は 10% 未満 (色は COLOR SCHEME で指定) |
| 影 | 板の下にごく淡い接地影のみ。グロー・反射・テクスチャなし |

## 3つの構図バリエーション

| 型 | いつ使うか | SUBJECT の骨格 |
|---|---|---|
| **積層型 (stack)** | 層が上下関係を持つ (基盤→中核→活用) | `Three isometric slabs stacked vertically with generous gaps, labeled X (bottom), Y (middle), Z (top), connected by bundles of dashed curved flow lines.` |
| **階段型 (cascade)** | 層を**通過する一本の経路**を見せる (入口→中継→着地) | `Three large isometric slabs arranged as a descending diagonal cascade from the upper-left of the canvas to the lower-right, like three stair treads. Each next slab is BOTH shifted about one slab-length toward the lower-right AND floating at a clearly lower height than the previous one, so the sequence steps down diagonally. The slabs are three separate floating layers: a sliver of background always separates their outlines; they never touch, abut or merge into one continuous surface. The cascade spans most of the canvas width.` |
| **配置型 (scatter)** | 層でなく並列な構成要素を矢印で繋ぐ | `Four isometric slabs arranged around the canvas at different heights, each carrying one wireframe object, connected by thin straight arrows between slab edges.` |

階段型の文言は**一語も要約しないこと**。「staircase」だけに縮めると再現しない (後述の失敗録)。

## プロンプト本体 (コピペ用)

```
Isometric technical illustration for an enterprise platform, in the style of a modern data-platform product brand.

SUBJECT: <ここに層構成・各層に載るオブジェクト・層間の流れ・ラベル文字列を具体的に書く>

CAMERA (must be identical in every image of this series, do not deviate):
- Fixed true isometric view. The two ground axes recede at exactly 30 degrees above the horizontal: one axis to the upper-right, the other to the upper-left. Every vertical edge stays perfectly vertical.
- Every slab is a flat rectangle lying on that ground plane and aligned to those two axes, so each slab reads as a rhombus: its right-hand edge rises to the upper-right at 30 degrees, its left-hand edge rises to the upper-left at 30 degrees. The slab's long side runs along the upper-right axis.
- Slab thickness is a constant vertical extrusion of the same height on every slab.
- Every slab is a plain four-cornered rectangle. Never cut, bevel, notch or round off a slab corner, and never fuse two slabs into a single polygon.
- CRITICAL PARALLELISM RULE: the entire drawing contains only THREE straight-edge directions: (1) vertical, (2) the upper-right ground axis, (3) the upper-left ground axis. Every straight edge of every slab, box, block and volume in the picture is parallel to one of these three directions. In particular, every edge of an object standing on a slab is exactly PARALLEL to the corresponding edge of the slab beneath it; if you extend an object edge and the matching slab edge, the two lines never converge. If any shape introduces a fourth edge direction, it is wrong. No object may be rotated to face a different direction, turned to a front-on view, or drawn at its own angle.
- CRITICAL: every object standing on a slab is a small three-dimensional isometric volume that shows BOTH a top face and side faces. Never draw an on-slab object as a flat front-facing rectangle, badge or sticker pasted onto the picture. A label on an object sits on the object's top face, sheared to the isometric plane.
- No perspective, no vanishing point, no camera roll, no bird's-eye tilt. Orthographic only.
- Fill the canvas generously: the arrangement should span most of the canvas width and read large. But every slab and object, including the lowest and right-most one, must sit fully inside the canvas with a small clear margin on all four sides. Nothing may be cropped by the canvas edge.

COLOR SCHEME (default — 再スキンはこの3行の差し替えだけで行う):
- Background: light greige #EAE5DD, filling the entire canvas.
- Ink: soft charcoal grey #444444 for all line art and text, never pure black, in thin uniform hairlines. Volume faces are pure white #FFFFFF or very light ink tints (about 8% and 16% ink over the background) to distinguish top faces from side faces. No gradients.
- EXACTLY ONE accent color: blue #3B82F6, used only on small chips, highlighted cells and the main flow lines. Everything else is ink on background. The accent must cover less than 10% of the canvas.

STYLE RULES (strict):
- Layers are flat isometric SLABS: thin rectangular platforms with visible side thickness, floating with generous vertical gaps between them.
- Objects sit ON TOP of the slabs as small isometric wireframe models, drawn in the same hairline weight.
- Slabs are connected by BUNDLES of thin dashed curved lines that fan out and flow from one slab to the next, suggesting data movement.
- Slab labels sit along the slab edge, sheared to match the isometric plane, geometric sans-serif, uppercase, wide letter-spacing.
- Small floating UI cards (monitors, panels, tooltips with tiny text and accent chips) hover above the slabs.
- Flat and minimal: at most a very soft light-grey contact shadow under each slab. No glow, no reflections, no texture.
- Generous negative space around the stack. Wide 16:9 canvas.
- Japanese text must be rendered correctly with proper glyphs (Noto Sans JP style). Do not garble kanji.

MOOD: precise, engineered, calm, premium enterprise. Not playful, not cartoonish, no color gradients.
```

床のグリッド線が欲しければ SUBJECT に `a faint light-grey isometric grid floor beneath the lowest slab` を足す。

## 配色の上書き (COLOR SCHEME ブロック)

配色は `COLOR SCHEME` ブロックに集約してある。**再スキンはこのブロックの hex 差し替えだけ**で行い、
STYLE RULES / CAMERA には触れない。名前付きスキン:

| スキン | Background | Ink | Accent | 用途 |
|---|---|---|---|---|
| **default (greige)** | `#EAE5DD` | `#444444` (黒は強すぎ NG) | `#3B82F6` blue | 既定。マーケ成果物のブランドトーン (2026-08-09 検証済み) |
| product-mint | `#FAFAFA` | `#333333` | `#6EE7B7` mint | Palantir/Apollo 原典寄りの製品マーケ風 |
| product-violet | `#FAFAFA` | `#333333` | `#7C6EF0` violet | 同上のパープル版 |

アクセントは常に**最大1色**。

## SUBJECT の書き方

層の**名前・順番・載るもの・流れの向き**を名指しする。抽象語だけだと板が崩れる。

良い例:
```
SUBJECT: Three isometric slabs stacked vertically. The BOTTOM slab labeled "DATA" carries a grid of small
wireframe database drums and file icons. The MIDDLE slab labeled "ONTOLOGY" is the largest and carries a
network of wireframe objects (a factory, a truck, a warehouse, a robot arm) linked by dashed lines with
small mint-green pill labels on the links. The TOP row has three smaller slabs side by side labeled
"ANALYTICS", "WORKFLOWS", "INTEGRATIONS", each carrying floating monitor panels. Bundles of dashed curved
lines fan upward from the bottom slab into the middle slab, and from the middle slab up into the three top slabs.
```

## 検証済み (2026-08-09)

3バリエーションを生成して再現性を確認済み。

| # | 構図 | アクセント | 結果 |
|---|---|---|---|
| A | 積層3層 (SOURCES → PIPELINE → 上段3枚) | ミント | 破線束の扇状フロー・板縁ラベル・pill ラベルすべて再現。最も参照に近い |
| B | 配置型4枚 + 点線楕円の囲い | ミント + 極小の青/赤 | ラベルタブ・直線矢印・`CLOUD` の点線囲いを再現。開発者ドキュメント寄り |
| C | 積層4層 + グリッド床 + 周囲のプレート群 | パープル | 層の厚み・大きな傾斜ラベルを再現。**同一ラベルの小プレートを大量に並べると一部が鏡像反転する** |

得られた知見:

- 流れの向き (下から上 / 左から右) を SUBJECT に明記すると矢印が意図通り出る。
- 板の縁ラベルは、B のように**小さなタブを付ける**と指定するとより図面的になる。
- **同じラベルの小さな要素を10個以上並べない。** C では `AGENT` プレートの一部が鏡像になった。数を5〜6個に抑えるか、ラベルは代表1〜2枚だけに付ける。

## 複数枚シリーズで角度を揃える (重要)

`True isometric projection` とだけ書くと、**枚ごとに板の回転が変わる**。ある図は板が正面向きの浅い等角、
別の図は菱形の標準的な等角、という不揃いが起きる (2026-08-09 に実発生)。

`CAMERA` ブロックを**全枚に一字一句同じ文面で**入れると揃う。要点は3つ。

1. 2つの地面軸を「右上へ30度」「左上へ30度」と**方向まで**書く
2. 板を「菱形として読める」「長辺は右上軸に沿う」と**向きを固定**する
3. 板の厚みを「全板で同じ高さの垂直押し出し」と固定する

### 板の上のオブジェクトが別角度になる

板だけを縛ると、**板の上に載る箱やマシンが自分だけ別の角度で描かれる**。検収の判定基準は
**「オブジェクトの辺が、下の板の対応する辺と平行か」**。等角投影では図中の直線の方向は
垂直・右上軸・左上軸の**3種類しか存在しない**ので、第4の方向の辺が見えたらずれている
(延長して板の辺と交わる線は誤り)。「同じ軸に乗せる」という指示より、この平行定式の方が安定した
(2026-08-09 検証: 軸指示だけでは Pod 群が微妙に回転した個体が出た)。CAMERA の
CRITICAL PARALLELISM RULE がこれを縛る。個別に効かせたいときは SUBJECT 側でも
`its bottom edges run along the exact same two ground axes as the slab's edges. It must NOT be rotated
to a different angle from the slab.` と名指しする。

亜種として、小さな要素 (Pod 等) が**正面向きの平面バッジ/ステッカー**に退化する事故もある
(2026-08-09 実発生。回転ではなく立体性の喪失)。`rounded boxes` のような曖昧な形状語が誘発する。
CAMERA の2つ目の CRITICAL 行 (top face + side faces を持つ立体、バッジ禁止、ラベルは天面にシアー) で防ぎ、
SUBJECT 側でも `small isometric block volumes, each showing a top face and side faces, labeled on the top face`
と書く。

### 階段配置は「横ずれ」と「縦下がり」を別の量として明示する (失敗録)

階段状のレイヤーカスケードを曖昧語で書くと、3通りの壊れ方をした (2026-08-09、k8s Step4 で実測):

| 文言 | 結果 |
|---|---|
| `descending staircase` のみ | 構図は出るが揺れる。別の試行では真上積みや浅い等角に化けた |
| `each slab's near corner slightly overlaps ...` | 板同士が接続して**巨大な1枚のポリゴン**に融合。層に見えない |
| `obvious vertical gap of empty background` | 縦分離だけが効いて**真上積み**になり、斜めの階段が消えた |

安定した最終形が構図バリエーション表の**階段型 (cascade)** の文言。効いている要素は4つで、削るとどれかの壊れ方に戻る:

1. `shifted about one slab-length toward the lower-right` — 横ずれを量で指定
2. `AND floating at a clearly lower height` — 縦下がりを別の量として併記 (BOTH で束ねる)
3. `a sliver of background always separates their outlines` — 分離は「隙間の背景が見える」で表現 (gap の大きさで書かない)
4. `never touch, abut or merge into one continuous surface` — 融合の禁止を明示

併せて CAMERA の `plain four-cornered rectangle / never fuse` 行が、板が八角形に欠ける・融合する事故を防ぐ。

シリーズ生成では CAMERA を別ファイルにして、各プロンプトへ連結するのが確実。

```bash
bash "$SH" out.png "$(cat subject.txt)

$(cat camera.txt)"
```

## 注意

- **板は3〜5枚まで**。増やすと等角が破綻して層が潰れる。
- アクセント色を2色以上入れると一気に安っぽくなる。1色厳守。
- 「板の上のオブジェクト」を具体名で挙げないと、抽象的な箱だけの図になる。
- 板の縁ラベルは英字大文字が最も安定する。日本語ラベルは板の外(タイトル位置)に置く方が崩れにくい。
