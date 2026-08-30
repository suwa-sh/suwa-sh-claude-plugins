# Verifier 8 観点チェックリスト(distillery-impl)

観点キーは findings の `viewpoint` に使う。各観点で「何と突き合わせるか」を固定する。
**1〜7 観点は前提ファイル(AssumptionRecord)を開かずに完走し、8 観点目で初めて開く**(blind join)。

## 1. spec_conformance(仕様整合)— 最重要・手順まで固定

1. **API**: tier md の API 仕様表(メソッド/パス/リクエスト/レスポンス/エラー)と実装ハンドラを 1 行ずつ突合。
   `_api-summary.yaml` の endpoints[] と実装ルーティングの過不足を列挙
2. **データ**: tier md のデータモデル変更表・`_model-summary.yaml` の `tables[].operations[]` と、
   実装のスキーマ・クエリを突合(カラム欠落・型不一致・未実装の operation)。
   schema の正は、対象 tier が関与するデータ契約(contracts[] の rdb-schema 等)が宣言されていれば
   その `source` の `scope` 範囲。宣言が無ければ `_cross-cutting/datastore/rdb-schema.yaml`(+ kvs)。
   関与しない契約・scope 外のテーブルには findings を出さない
3. **ビジネスルール**: tier md のビジネスルール欄の各項が、コード上のどこで担保されるかを特定。
   担保箇所を特定できないルールは blocker 候補
4. **テストとの整合**: tier BDD feature のシナリオが仕様の gherkin と一致しているか(意訳・改変されていないか)。
   スキップ・空実装の step が無いか
5. **契約**: packages/contracts の型を経由しているか(直書きの型・fetch がないか)
6. **UI 構造整合(frontend のみ)**: **実行ベースの比較(dom_snapshot / capture_review)は S5 並走の
   UI Reviewer(dist-impl-ui-review)が所有する。capability(`tiers[].capabilities.ui_review`)が
   無い(`dom_snapshot: false` かつ `capture_review: disabled`)場合、本手順(読解ベース)が唯一の
   UI 検証になる**(tier-rules.md の検証所有表)。以下の照合表は読解ベースとして常時実施する
   (dom_snapshot / capture_review の有無にかかわらず重複ではない)。
   story を構造の正として、次の照合表方式で確認する
   (集合一致ではない。合成コンポーネントの偽陽性を避けるため)。**明示する限界**:
   確認するのは構造的整合まで。レイアウト・スタイル・レスポンシブ挙動などのピクセル忠実度は
   対象外(未保証)であり、微細なレイアウト差は指摘対象にしない
   - **uc 結線の 0/1/N 処理**: uc-map の `ui_screens` を先に確認する。**非空なら
     `ui_screen_resolution` の値にかかわらず全行を対象に以下を行う**(両方が共存していたら
     S1 の掃除漏れとして note に記録。state-schema.md の XOR 制約)。
     `ui_screens` が空の場合のみ `ui_screen_resolution` を確認する:
     `plain_ui_confirmed` または `feedback_requested` なら UI 突合はスキップし、
     `viewpoints_checked.spec_conformance.note` に「UI 結線なし(合意記録あり)」等を記録して
     findings は出さない。記録が無い 0 件は note に「UI 結線なし・合意記録なし」と記録し
     minor findings とする
   - **矛盾 3 条件の preflight**: 突合の冒頭で tier-rules.md の矛盾 3 条件
     (①宣言 story path の実体欠落 / ②variants ↔ story named export の不一致 /
     ③components 宣言が story closure に不在)をすべて判定する。**該当はいずれも
     入力ソース間矛盾であり blocker にしない**。severity major +
     「入力ソース間矛盾(実装では解消不能)。issues → feedback 経由での仕様修正を推奨」を
     明記した findings とする。①②に該当した項目は以降の該当突合(story 構造・画面状態)を
     スキップし note に記録する
   - **コンポーネント在庫の照合表**: design-event `screens[].components` の各コンポーネントについて
     `直接使用(direct) | 他コンポーネント経由(transitive: 経由元を記録) | 実装に見当たらない(missing)`
     を、根拠となる JSX / import 行とともに記録する。実装が import する UI コンポーネントの解決先が
     すべて `packages/ui/` 内であること(直書き自作は違反)。`transitive` は違反ではない
     (合成は design 側の構成)
   - **missing の severity 区別**: story にも実装にも無い場合は矛盾 3 条件の③
     (preflight で major・非 blocker 判定済み)。story には有るが実装に無い場合は
     **実装欠陥**(blocker 候補。通常の attempt ループで修正)
   - **画面状態の突合**: `screens[].variants` の各状態(Empty / Error / Loading 等)に対応する
     表示分岐が実装に存在するかを、story の該当 named export の構成と突き合わせて確認する
   - **prop variant の突合**: tier-frontend.md のコンポーネントマッピング表に記載された
     variant / size prop が実装の該当箇所で使われているかを確認する
   - 階層・文言・トークン参照は story との明らかな乖離(状態の欠落・別コンポーネントへの置換)のみ
     指摘対象とする

## 2. readability_maintainability(可読性・保守性)

- 実装リポの docs/dev-rules/coding-rules.md・test-strategy.md への準拠(テスト命名 / AAA / 用語の一致)
- 仕様の用語(RDRA 由来の名前)と実装の命名のずれ / 説明なしの複雑さ / 重複ロジック

## 3. security(セキュリティ)

- 入力検証: 契約(openapi 等、自 tier が関与する contracts[])の制約(required / format / range)が実装でも検証されるか
- 認証・認可: tier md の認証欄・アクセス権欄との一致
- 秘密情報のハードコード / ログへの個人情報・秘密の出力

## 4. performance(パフォーマンス)

- `_model-summary.yaml` の `tables[].indexes_needed[]` に対応するインデックス・クエリ設計
- N+1 / 全件走査 / 不要な同期待ち。NFR(nfr-grade.yaml)に性能グレードがあればその水準で判定

## 5. operability(運用性)

- 失敗時に原因が特定できるログ・エラーメッセージ(利用者が直せる言葉か)
- 設定の外出し(環境依存値のハードコード禁止)

## 6. fault_tolerance(耐障害性)

- 外部呼び出し(DB / API / イベント)の失敗時挙動が仕様のエラー表と一致するか
- worker 系: 再配送への冪等性(tier-rules.md)/ 部分失敗時の整合性

## 7. refactoring(リファクタリング)

- ddd 基準(集約境界 / 値オブジェクト / 貧血回避)からの逸脱で、次の変更を高くつかせるもの
- テスト構造の負債(1 テスト複数 Act / 過剰モック / 実装詳細への結合)

## 8. assumption_conformance(前提整合)— Implementer が黙って決めた判断の照合

対象: `attempt-{n}/S4_tier-impl.{tier_id}.assumptions.yaml`(AssumptionRecord。正本は
`dist-impl-implement/references/assumption-record.md`)。仕様に照合先が無い判断は 1〜7 観点から
原理的に落ちるため、Implementer 自身に書かせた「補った判断の一覧」を反証対象にする。

### 手順(blind join — 順序を守る)

1. **1〜7 観点の完走中に**、実装から読み取れる「仕様・契約・dev-rules に根拠が無い設計判断」
   (時刻精度・失敗時の状態値・hash の正規化順・冪等キー等)を**候補リストとして控える**。
   この時点で前提ファイルは開かない(Implementer の理由づけに引きずられないため)
2. 前提ファイルを開き、まず各要素の `id / assumption / target` だけを読む。候補リストと突合する
3. 各前提を仕様(tier md / 契約 / _api・_model summary / dev-rules)と照合し、**さらに S4 固定指示
   `dist-impl-run/references/stage-instructions/S4_tier-impl.md` を読んで**、下表の verdict を付ける
4. `reason / confidence / spec_refs` は verdict 確定後に補助証拠として読む(verdict を変える根拠には
   仕様側の記載だけを使う)
5. 各前提の `verified_category`(6 値のどれか)を Implementer の `category` と独立に判定する。
   不一致なら `kind: category_mismatch` の minor finding を出す(分類ミスの可視化。減点ではない)
6. 候補リストに残った「前提ファイルに無い黙った判断」を `V-nnn`(unlisted)として `assumption_verdicts`
   に追記する(`category: null`、`verified_category` は自分の判定)

### verdict と finding

| verdict | 意味 | finding(`viewpoint: assumption_conformance`、`kind` = verdict 名 / consistent は `restatement`) |
|---|---|---|
| `consistent` | 仕様・契約・dev-rules・S4 固定指示に明示があった(復唱) | minor `restatement`(一覧のノイズとして可視化。再実行はしない) |
| `spec_absent` | 仕様に照合先が無い(真の前提) | `category` または `verified_category` が security / persistence なら **major**、他は minor。finding は S9 の人間確認の入口であり blocker ではない |
| `contradicts` | 仕様と矛盾する | **blocker(カテゴリにかかわらず)**。既存定義「仕様違反 = blocker」のとおり |
| `unlisted` | 候補にあるが前提ファイルに無い | Verifier が `V-nnn` で追記。severity は spec_absent と同じ規則(仕様と矛盾するなら `contradicts` で blocker) |

**全 A-id に verdict を exactly-one で付ける**。verdict ごとに専用の finding を 1 件出し、
`assumption_verdicts[].finding_id` で結ぶ(finding 側は `assumption_id` で逆参照)。
前提 0 件・候補 0 件なら `assumption_verdicts: []` を明示する。
記録の妥当性はオーケストレータが `validateAssumptions.js verdicts` で受理時に検査する
(hash の再計算一致 / exactly-one / V-id 一意 / severity の期待一致 / 集計一致)。

## severity の目安

- **blocker**: 仕様違反・ゲート不成立・立証済みの脆弱性(修正なしで S6 へ進めない)
- **major**: 仕様は満たすが、運用・保守で高くつく欠陥(次 attempt で修正推奨)
- **minor**: 改善提案(修正は任意。learnings 行き)
