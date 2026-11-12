# UC 一覧 (use-cases.yaml) のフィールドと編集の決まり

`genUseCases.js` が、requirements.yaml と `rdra/BUC.tsv` から UC 一覧を決定論的に導出する。
LLM は、生成の後に `slug` と `spec_ids` を編集する。

```bash
node <skills>/d2-requirements/scripts/genUseCases.js
# 既定: docs/requirements/requirements.yaml  docs/requirements/rdra/BUC.tsv  docs/requirements/use-cases.yaml
```

## 各 UC のフィールド

| フィールド | 出どころ |
|---|---|
| `uc_id` | 業務・BUC・UC の canonical JSON 配列（NFC 正規化）の sha256 先頭 8 桁。衝突時は全 UC で 12 桁 |
| `business` / `buc` / `uc` | BUC.tsv の 業務 / BUC / UC 列 |
| `actors` | BUC.tsv の「アクター」関連オブジェクト |
| `tiers_hint` | 画面あり→frontend、タイマーあり→worker、常に backend（暫定ヒント。ティアは d2-decide が決める）|
| `spec_ids` | **スクリプトはフロー（BUC）単位で候補を当てる**。LLM が UC が実現する SPEC へ絞り込む。**原則 1 件以上**（空は下記 `no_spec_reason` を書いた UC だけ許す）|
| `no_spec_reason` | 対応 SPEC が無い UC の理由。書くと `spec_ids` を空にでき、その UC は `status: blocked` にする（`validateUseCases` が両方を強制）|
| `spec_ids_rejected` | **LLM が `spec_ids` から外した SPEC の置き場**（スクリプトは空配列を置く）。再生成で uc_id を引き継ぎ、却下済みは `spec_ids` へ戻さない |
| `slug` | **スクリプトは暫定 `uc-<uc_id>` を置く**。LLM が意味のある英語 kebab-case（`^[a-z0-9]+(-[a-z0-9]+)*$`・一意）へ差し替える |
| `status` | 既定 `planned`（`planned` / `in_progress` / `done` / `blocked`）。`no_spec_reason` を書いた UC は `blocked` |

## LLM の作業

生成後、各 UC の `slug` を英名へ、`spec_ids` を実現する SPEC へ編集する。

### spec_ids を空にしない

**`spec_ids` が空の UC を残さない**。
`genUseCases` は、空の UC を警告に列挙する。
次のどちらかをする。

- 対応する SPEC を当てる
- 本当に無いなら、`no_spec_reason` に理由を書いて `status: blocked` にする

どちらもしないと、`validateUseCases` が FAIL する。
下流の受入基準の網羅検査が、空集合で素通りするのを防ぐためである。

### 再生成で引き継がれるもの

既存の use-cases.yaml があれば、`slug`・`status`・`tiers_hint`・`spec_ids_rejected` は uc_id で引き継がれる。
再生成しても、LLM の編集は消えない。

`spec_ids` は、**既存値（LLM が絞った SPEC）と今回はじめて出た推定候補の和集合**になる。
SPEC を取りこぼさないためである。
**外した SPEC は削除せず `spec_ids_rejected` へ移す**と、再生成で候補へ戻らない。

### 新しく増えた候補の扱い

今回新規に増えた候補だけが、各 UC の `spec_ids_added` に記録される (無ければキーごと出ない)。
**LLM は `spec_ids_added` を見て採否を判断し、採用は `spec_ids` に残し、不採用は `spec_ids_rejected` へ移して `spec_ids_added` を削除する**。

`no_spec_reason` を持つ (blocked の) UC に新しい候補が付いたときは、候補は `spec_ids_added` にだけ出る。
`spec_ids` は空のままである。
採用するなら `spec_ids` に移し、`no_spec_reason` を消して `status: planned` に戻す。

### 廃止したフィールド

`carry_over` (0.1.30〜0.1.31 の UC への持ち越し) は 0.1.32 で廃止した。再生成で消えるのは想定どおりで、**手で戻さない**。
残った作業は、d2-run の要求の差分が、種類ごとの宛先に流す。

## 検証

編集後にバリデートする。

```bash
node <skills>/d2-requirements/scripts/validateUseCases.js docs/requirements/use-cases.yaml
```

チェックする内容:

- 構造 (schema-use-cases.json)
- uc_id が一意である
- slug が一意で、パターンに合う
- `spec_ids` が requirements.yaml に実在する
- `spec_ids` が原則 1 件以上ある (空は `no_spec_reason` + `status: blocked` の UC だけ)
- `spec_ids_rejected` が requirements.yaml に実在し、`spec_ids` と重複しない
