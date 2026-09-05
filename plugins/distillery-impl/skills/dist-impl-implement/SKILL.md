---
name: distillery-impl:dist-impl-implement
description: >
  distillery-impl の Implementer スキル。mode 引数で 4 役を切り替える:
  test-scaffold(4 段テストの red baseline 生成)/ tier-impl(単一 UC × tier の TDD 実装、
  ゲート 1〜4 通過まで)/ uc-bdd / atdd(統合テストの step 実装と実行)。
  契約型・Storybook コンポーネント起点の契約駆動で、ddd-tactical-implementation を知識ガイドに使う。
  通常は dist-impl-run のサブエージェントとして呼ばれる。
---

# dist-impl-implement

引数: `mode={test-scaffold|tier-impl|uc-bdd|atdd} uc_id={id} [tier={tier_id}] [attempt={n}] config={impl-config.yaml へのパス} manifest_sha256={オーケストレータ算出の projection hash} [tiers={mode=test-scaffold の scoped 再実行対象 tier(カンマ区切り)}]`

`manifest_sha256` は再計算せず done に転記し、`manifest_projection: v2` を併記する
(state-schema.md の projection 規則。値の算出と受理時照合はオーケストレータの責務)。

共通の前提:

- `config` から specs_root / repo_root / tiers / commands / capabilities を読む
- 対象 UC のパスは `docs/impl/latest/uc-map.yaml` の uc_id 行から引く
- **読む入力を最小に保つ**(コンテキスト 25% 制約): 該当 UC の spec.md / tier md / _api-summary.yaml /
  _model-summary.yaml / docs/dev-rules と、impl-config の contracts[] で自 tier が
  provider/consumers に含まれる契約の生成物・source のみ。
  spec / tier が明示する共有定義はファイル + 見出し / ID の該当箇所だけ追加で読む。
  契約 source は contracts.lock の source_read / scope に従う。範囲外の定義が必要なら暗黙に読まず issues に記録する。
  無関係な他 UC・関与しない契約・契約 source の全量・実装履歴は読まない
- **git 操作禁止**。done ファイルは自分の write-set 内のものだけを書く(state-schema.md の write-set 表)
- 仕様と実装が両立しない事実を見つけたら、実装で仕様を曲げず
  `docs/impl/latest/{uc_id}/issues/{ts}_{slug}.md` に「仕様の記載 / 実装で判明した事実 / 提案」を書き捨てて先へ進む
  (blocker で進めない場合はその旨を結果として返す)

`_api-summary.yaml` の `schema_version: distillery.api-summary/v2` は索引である。
対象UCの `_contract-slice.json` を追加で読み、summaryの `contract_sha256` と実ファイルのSHA-256を照合する。
型・認可・エラー・イベントpayload/headerはslice内のOpenAPI/AsyncAPIから取得する。
欠落やhash不一致をlegacy形式として補完しない。提供操作だけでなく `consumes` の依存操作も対象にする。

## mode=test-scaffold(S2)

4 段テストの実行可能な足場を作り、**red baseline** を確認する。

1. `docs/dev-rules/test-strategy.md` の転写ルールに従い、
   ② `features/uc/{uc_slug}.feature`(spec.md の E2E 完了条件)/ ③ 各 tier の
   `{tier_dir}/features/{uc_slug}.feature`(tier md のティア完了条件)を転写生成
   (`{uc_slug}` = uc-map の `branch_slug`。step definition も同じ slug。
   ① ATDD は bootstrap P7 で生成済み。無ければ同ルールで補生成。
   **skeleton と red baseline の対象は uc-map の `atdd_scenarios` に列挙された Scenario のみ**。
   生成済みの共有 feature 本文は変更しない)。
   **転写時に E2E Scenario の Then ごとに担当 UC を判定し**、他 UC の責務(後続 UC が遷移させる状態、
   完了待ち等)を含む Scenario を「UC 横断 Scenario」として `issues/` に一覧化する(S6 で必要になる
   ハーネス注入の要否を着手前に確定させ、S8 で仕様側へ「Then の責務分離」を要求できるようにする)
2. step definition skeleton(全 step が「未実装」を明示して fail)+ runner 設定を配置
3. ④ 対象 UC × tier ごとに最初の failing 単体テストを 1 本以上書く(命名・AAA は test-strategy.md)
4. **dom_snapshot が true な frontend tier のみ**: `docs/dev-rules/test-strategy.md` の
   「DOM 一致テストの転写規約」に従い、**executable target**(定義の正本は
   `dist-impl-run/SKILL.md` の S5 dispatch 手順。本節では再定義しない)ごとに red の
   DOM 一致テストを生成する。正本の算出規則で除外された行・variant は `issues/` に起票済みとして
   **red baseline の分母から外す**(テスト自体を生成しない。除外理由は生成したテストファイル側の
   コメントにも記録する)。
   **生成物は 2 種に分離する**(test-strategy.md の表を参照。混同しない): 実装画面は直接 import せず、
   variant ごとに明示的な not-implemented stub の**結線 module**を生成してテストは結線 module
   経由にする(module resolution error は red baseline と認めない)
5. **dom_snapshot が true または capture_review が enabled な frontend tier**: 構造署名の
   extractor・variant→実装 props の adapter・HTML shell 生成(capture_review の SSR 静的 HTML 化が
   使う)を含む**共通 helper**を tier 内に 1 箇所だけ生成する(結線 module とは別生成物・S4 では
   変更しない)。capture_review のみ enabled で dom_snapshot テスト自体は生成しない場合でも、この
   helper は生成する。S5 UI Reviewer の dom_snapshot 再実行・capture_review の SSR 静的 HTML 生成の
   両方がこれを使う
6. **red baseline 確認**: 4 段すべて(dom_snapshot テストがあればそれも含む)を実行し
   「未実装を理由に fail する」ことを確認。パースエラー・設定ミス由来の fail は red と認めず修正する
7. `S2_test-scaffold.done.yaml` を書く(`red_baseline: pass` を含める)

**scoped 再実行(`tiers` 引数が渡された場合)**: spec 変更起因の stale 再実行であり、
指定 tier の scaffold だけを更新する。初回とは次の点が異なる:

- 手順 1〜5 を**指定 tier に限定**する。features/uc/ の共有 feature は spec.md が変わった場合のみ
  再転写し、他 tier の scaffold・features/atdd/ の既存 feature 本文には触れない
- **red baseline は done 条件にしない**(既存実装が残っているため「未実装を理由に fail」は
  成立しない)。代わりに、再生成した feature / テストが parse 可能かつ実行可能であることを確認し、
  新規・変更 Scenario が fail する場合は「未実装(実装が後続の S4 再実行で追従予定)」か
  「パースエラー・設定ミス」かを区別して前者のみ許容する
- done には `red_baseline` の代わりに `scaffold_scope: {tiers: [...], uc_feature:
  untouched | regenerated, atdd: untouched}` と再実行モードであることを記録する

## mode=tier-impl(S4)

単一 (UC × tier) を TDD で実装し、ゲート 1〜4 を通す。

1. 入力を読む: tier md(ファイル名は `{tier_id}.md`。例 `tier-frontend.md`。API 仕様表 /
   データアクセス・実行条件 / spec.md の業務ルール参照 / ティア完了条件。旧形式の
   データモデル変更表・ビジネスルールも読取可能)、spec.md、_api-summary / _model-summary、
   自 tier が関与する契約の生成物・source(impl-config の contracts[] が正。
   生成物 dir は `docs/impl/latest/contracts.lock.yaml` の該当契約の generated[] のうち
   audience が自 tier の role(provider / consumers)または both で、lang 指定があれば
   自 tier の lang と一致するもの。契約 source は lock の source_read が none 以外の契約のみ・
   scope 指定時は scope 範囲)、
   `docs/dev-rules/` 3 ファイル。
   図・DB型表・共通Propsがないことを仕様不足と判断しない。参照先の該当定義を確認し、
   UCのデータ操作は _model-summary、型・制約は契約、固有の実行条件は tier md から読む。
   **tier 種別に応じて追加で読む**(tier-rules.md):
   frontend は read-set 定義(uc-map の `ui_screens` が指す design-event.yaml の該当 screens[] 全行 +
   結線 story + story から到達する packages/ui 内の推移的 import closure)、
   backend(datastore_owner)は `_cross-cutting/datastore/` の schema、
   worker は async 型定義(asyncapi 契約が宣言されている場合)。
   **読込時に「仕様・契約・dev-rules・S4 固定指示に定義が無いのに実装には決める必要がある事項」
   (hash の正規化形式・シリアライズ形式・時刻精度・識別子形式・失敗時の状態値 等)を
   前提候補として控える**。実装で仮置きした判断は関数を 1 箇所に集約し、
   `references/assumption-record.md` に従って **AssumptionRecord(手順 5)に記録する**
   (独立検証の後で初めて発覚させない。`issues/` には書かない — issues は「仕様どおりに実装すると
   動かない事実」専用)。
   - **frontend の実装前チェック**: tier-rules.md の矛盾 3 条件(story path 実体の不在 /
     variants と named export の不一致 / components 宣言と story 実体の不一致)を確認する。
     矛盾があれば `issues/{ts}_{slug}.md` に起票した上で、story 実体を優先して実装を続行する
     (停止しない。ui_screen_resolution が plain_ui_confirmed / feedback_requested の場合は
     UI 突合そのものをスキップする)
2. **ddd ガイドの読込**(capabilities.has_ddd_plugin が true の場合):
   Skill ツールで `ddd:ddd-tactical-implementation` を呼び出し、判断ゲートとワークフローを把握してから
   実装に入る。呼び出し時に平文で渡す: 対象言語 / 実装対象モデル(_model-summary.yaml の該当エンティティ)/
   不変条件・業務ルール(tier md のビジネスルール欄)/ 成果物パス({tier_dir}/src)。
   false の場合は `docs/dev-rules/coding-rules.md` の基準のみで実装する
3. **TDD ループ**: tier BDD シナリオ(③)を外側の目標に、内側で red→green→refactor を回す。
   attempt が 2 以上なら、渡された findings(verify、当該 tier で ui-review が dispatch されて
   いれば ui-review も。両レーン分)の blocker を先に修正対象へ組み込む。
   **dom_snapshot が true な frontend tier**: S2 が生成した**結線 module のみ**を実装画面への
   参照に書き換え、DOM 一致テストを green にする。**共通 helper(構造署名 extractor +
   variant→props adapter)は変更しない**(S2 生成のまま使う。署名生成ロジックを独自に作らない。
   test-strategy.md「生成物の構造」の区分に従う)
4. **ゲート 1〜4 を実行**(`references/gates.md`。コマンドは config の commands。
   format/lint は check-only。書き換えを伴う format は実行しない)
5. **前提の記録(AssumptionRecord)**: `attempt-{n}/S4_tier-impl.{tier_id}.assumptions.yaml` を
   `references/assumption-record.md` のスキーマで書く。**仕様・契約・dev-rules・S4 固定指示に
   明示されていた事項は含めず、自分が補った判断だけ**を、探して見つからなかった箇所(`spec_refs`)
   つきで書く。**0 件でも `assumptions: []` で必ず書く**(欠落は S4 受理拒否)。書いたら
   `node ${CLAUDE_PLUGIN_ROOT}/skills/dist-impl-implement/scripts/validateAssumptions.js record
   <file> --uc {uc_id} --tier {tier_id} --attempt {n}` を実行し `ok: true` を確認する
   (出力の `count / by_category / sha256` を done に転記する)
6. 全ゲート pass + 前提記録 ok → `attempt-{n}/S4_tier-impl.{tier_id}.done.yaml` を書く
   (gates 結果と `assumptions: {path, count, by_category, sha256, extraction}` を記録 — state-schema.md)

## mode=uc-bdd(S6)/ mode=atdd(S7)

integration writer として統合テストを実装・実行する。**tier 実装コードは変更禁止**。

1. `features/uc/{uc_id}.feature`(S7 は uc-map の `atdd_scenarios` に列挙された Scenario
   **だけ**を対象に、**一意タグ `@atdd_{SPEC-ID}-{連番}` の完全一致フィルタ**で選択実行する —
   SPEC は複数 UC にまたがるため feature 全体を回さず、名前の部分一致フィルタも使わない。
   **実行された Scenario 件数が atdd_scenarios の件数と一致することを確認**する)の
   step definition を実装(全 tier 結合。起動・シード・呼び出しは config の integration_commands)
2. 実行して結果を判定:
   - pass → `S6_uc-bdd.done.yaml`(S7 は `S7_atdd.done.yaml`)を書く
   - fail → done を書かず、「どの tier の何が仕様と食い違うか」の分析を結果として返す
     (S4 への差し戻しはオーケストレータの判断)
3. S7 で uc-map の `atdd_confirmed: false` の場合は実行せず、その旨を返す(S1 の確認漏れ)
4. 統合に必要な前提(認証ヘッダ等)が仕様に無い場合のハーネス注入(subagent-template の注入規約)は、
   根拠として**起票済み issue のパス、または当該 tier の AssumptionRecord の id(`A-nnn`。
   `attempt-{n}/S4_tier-impl.{tier}.assumptions.yaml` のパス併記)**のどちらかを注入箇所のコメントに書く。
   S6/S7 自身は前提を抽出しない(参照のみ)

## 完了報告(全 mode 共通)

生成・更新ファイル一覧 / ゲート・テストの実行結果(コマンドと exit code)/ issues に書いた仕様疑義の有無 /
(tier-impl)前提件数のカテゴリ別内訳と `validateAssumptions.js record` の結果
