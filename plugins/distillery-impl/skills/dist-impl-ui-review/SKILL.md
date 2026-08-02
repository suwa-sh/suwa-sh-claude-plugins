---
name: distillery-impl:dist-impl-ui-review
description: >
  distillery-impl の UI Reviewer スキル。dist-impl-verify(コード vs 仕様書、手段は読解)とは
  対象も手段も異なる並走レビューレーンとして、実行された画面 vs story のレンダリング結果を
  突き合わせる(手段は実行)。capability に応じて dom_snapshot(構造署名の決定論比較)と
  capture_review(browser でキャプチャした画面のアドホック目視比較)を実行し、専用スキーマの
  findings を生成する。修正は行わない。dist-impl-run のサブエージェント
  (agent_type: impl-verifier、model 指定)として呼ばれる。
---

# dist-impl-ui-review

引数: `uc_id={id} tier={tier_id} attempt={n} config={impl-config.yaml へのパス} targets={executable target 集合} targets_hash={targets の canonical hash} targets_count={targets 件数} [checks={dom_snapshot,capture_review}]`

`targets` は呼び出し側(dist-impl-run)が算出済みの (screen × variant) 集合。各行は
`{screen: {name, route}, story: {storybook 相対 path}, variant: {story の named export 名}}`。
**executable target の算出規則(正本)は `dist-impl-run/SKILL.md` の S5 dispatch 手順**
(story 実体の存在・variants 非空に加え、tier-rules.md の矛盾 3 条件による除外を含む)であり、
本スキルでは再定義しない。**自分で uc-map の `ui_screens` 全件をなめて対象を再算出しない**
(dispatch 前提の算出とのズレを検知できなくなるため。前提とのズレは手順「対象数の再検証」で扱う)。

`targets_hash` / `targets_count` はオーケストレータが dispatch 時に算出した `targets` の
canonical hash と件数(state-schema.md「dispatch target の canonical hash」参照)。**そのまま**
done の `dispatch_targets: {hash, count}` に転記する(自分で再計算しない — オーケストレータが
受理時に独立して再計算し照合するための、dispatch 時点の値の記録)。

`checks` は省略時、capability(`tiers[].capabilities.ui_review`)で有効な全 check を実施する
(通常の dispatch はこの既定動作)。**`checks=capture_review` が明示された場合は capture_review の
みを実施し、dom_snapshot には触れない**(D10 の skipped(runtime_unavailable) 復旧専用。
「capture_review のみの再実行」節を参照)。

## UI Reviewer の掟(dist-impl-verify と共通の反証原則を継承)

1. **反証に徹する**。実装コードの修正・追記・削除は禁止(write-set は done / findings /
   `attempt-{n}/ui-artifacts/{tier_id}/` のみ)
2. **Implementer の説明を読まない**。渡されるのは成果物・story・`targets` だけ
3. **自分で動かして確かめる**。dom_snapshot テストの再実行も capture_review のキャプチャ・比較も、
   自分が実際に行った結果だけを根拠にする(Implementer・S2 テストの自己申告を信用しない)
4. **推測で severity を上げない**

## 対象数の再検証(dispatch 前提とのズレの検知)

dist-impl-run は「該当 UC の tiers のうち `tiers[].capabilities.ui_review` のいずれかが true の
frontend tier」かつ「executable target が 1 件以上」のときのみ本スキルを起動する。**起動後に
`targets` を実測して 0 件と判明した場合(uc-map / design-event の不整合。story の実体欠落や
variants 非空条件の再判定漏れ等)は、その check を `pass` にしてはならない**: `checks_checked` の
該当 check を `unverified` とし、done の `result` も `unverified` として入力不整合を報告する
(`pass` にも `environment_failure` にもしない — 環境は正常だが検証対象が成立しなかった状態)。

## 手順

1. `config` と uc-map から対象パスを解決し、次だけを読む:
   `{tier_dir}/` の成果物(src / test)、`{tier_id}.md`、design-event.yaml の `targets` が指す
   `screens[]` 行、結線 story、story から到達する packages/ui 内の推移的 import closure、
   `docs/dev-rules/test-strategy.md`(構造署名の正規化規則・共通 helper の仕様。生成条件は
   `dom_snapshot || capture_review: enabled` — capture_review 単独でも helper は存在する)。
   **tier 内に 1 箇所だけ生成された共通 helper(署名 extractor + variant→props adapter +
   HTML shell 生成。D9・D11)を S2/S4 のテストと同じものを使って再実行・再利用する**
   (自前で署名生成・HTML 生成ロジックを作らない — 実装ごとに判定基準が変わる事態を防ぐ)
2. **dom_snapshot チェック**(`tiers[].capabilities.ui_review.dom_snapshot: true` の場合のみ実施。
   false なら `checks_checked.dom_snapshot: {status: skipped}`):
   - `targets` の (screen × variant) ごとに、S2/S4 で生成済みの DOM 一致テストが存在し、
     かつ実質的か(空実装・スキップ指定・署名比較の回避(常に true を返す等)でないか)をコードで確認する
   - 存在・実質性を確認した上で**自分で再実行**する(check-only。既存テストの green 報告を
     そのまま信用しない)
   - 対象数(例「対象 3 画面 × 4 状態」)を `checks_checked.dom_snapshot.note` に必ず記録する
   - 構造署名が story と実装で不一致(story に有る要素が実装に無い、状態依存要素の欠落・置換)は
     findings 化する。判定基準は test-strategy.md の正規化規則(比較する/しない対象)に従う
3. **capture_review チェック**(`tiers[].capabilities.ui_review.capture_review: enabled` の場合のみ
   実施。`disabled` なら `checks_checked.capture_review: {status: skipped, reason: capability_disabled}`)。
   **アドホックな目視レビュー**であり、決定論のゲートではない(CI では回らない。ゲートは
   dom_snapshot テストが担う。D11-6)。プロジェクト側に比較コマンドの事前整備は要求しない:
   1. **セッション可否の判定(実行時のみ。P1 では probe しない)**: browser 系ツール
      (Claude in Chrome の `mcp__claude-in-chrome__*` 等)が本セッションで利用可能かを確認する。
      **利用不能なら check 全体を `checks_checked.capture_review: {status: skipped,
      reason: runtime_unavailable}` として記録し、done の `result` は `pass` のまま進める**
      (environment_failure にしない・縮退確認は不要 — D10。「skipped 状態の復旧」節で後述する
      再実行規則に乗る)
   2. **表示手段の解決**(target ごと。優先順。生成契約に存在するものを一次手段にする):
      1. **SSR 静的 HTML(一次手段・両側共通)**: 共通 helper(variant→props adapter + HTML shell 生成。
         D9・D11)を使い、story render と実装 render をそれぞれ静的 HTML 化して browser で開く。
         生成先は `attempt-{n}/ui-artifacts/{tier_id}/render/`(write-set 内)。
         **再現範囲はコンポーネントが自己完結で持つスタイル(inline style / CSS-in-JS の SSR 出力)に
         限る**(import される外部 CSS・外部 asset・Storybook decorators への依存は再現しない)。
         開き方は `file://` を既定とし、それが不可な browser ツールでは一時 static serve を許可する
      2. dev server / storybook-app の起動は、impl-config に起動コマンドが宣言されている場合のみ
         優先してよい(optional。bootstrap の生成契約には dev server が無いため前提にしない)
      3. **片側でも表示手段を作れない target は比較せず**、`skipped(reason:
         render_context_unavailable)` として `captures[]` に記録する(偽差分を作らない。停止しない)
   3. 表示手段が両側とも用意できた target ごとに、story 側と実装側をそれぞれキャプチャし、
      `attempt-{n}/ui-artifacts/{tier_id}/` へ保存する(既存の証跡永続化 + sha256 記録を流用)
   4. **目視比較(LLM 判定)**: 色・レイアウト・要素の欠落/置換・状態表示を見比べる。乖離は
      findings 化する(`check: capture_review`)
   5. **全 target を `captures[]` に manifest 化し、findings は乖離のみ**とする(差分が無い正常
      ケースでも S9 が「スクショ 2 枚並記」を生成できるようにするため。下記「captures[] スキーマ」参照)。
      **`captures[]` は `targets` と 1:1 対応させる**(欠落・重複・過剰を作らない — `targets` の
      全行が `captures[].target` にちょうど 1 回ずつ現れること。`captures[].target` は
      `{screen: {name, route}, story, variant}` の完全な記述を持ち、`targets` の各行と
      **同一の canonicalization 規則**(state-schema.md「dispatch target の canonical hash」)で
      比較する。オーケストレータが S5 受理時・S9 の両方でこの対応を検証する)
   6. 対象数を `checks_checked.capture_review.note` に必ず記録する
4. findings を `attempt-{n}/S5_ui-review.{tier_id}.findings.yaml` に書く(下記スキーマ。
   `captures[]` を含む)。**capture_review の finding は `capture_index` が指す `captures[]` の
   エントリが `result: diff` であることを確認してから書く**(`match`/`skipped` を参照する finding は
   作らない — 反証できる根拠が無いため)
5. `attempt-{n}/S5_ui-review.{tier_id}.done.yaml` を書く(下記スキーマ。`result` は
   `pass | environment_failure | unverified` の union)

## capture_review のみの再実行(skipped(runtime_unavailable) の復旧)

引数に `checks=capture_review` が渡された場合(dist-impl-run が D10 の再開規則で dispatch する):

1. **既存の** `attempt-{n}/S5_ui-review.{tier_id}.done.yaml` と `.findings.yaml` を読み込む
2. **dom_snapshot の記録には一切触れない**(再実行しない・上書きしない)。capture_review の
   手順(上記 3)だけを実施する
3. **成果物は canonical latest/ を直接更新せず、`attempt-{n}/ui-artifacts/{tier_id}/staging/` に
   だけ書く**(D10 round2。UI Reviewer が canonical を直接更新する構造だと成果物確定の証跡が
   不足するため、staging 昇格方式に変更する。write-set の例外は下記「write-set」参照):
   - キャプチャ画像・SSR 静的 HTML は `staging/` 配下に保存する(canonical と同名でよい。
     昇格時にオーケストレータが `ui-artifacts/{tier_id}/` 直下へ移動する)
   - `staging/findings-delta.yaml` に capture_review の更新分だけを**差分**として書く:
     `{checks_checked_capture_review: {...}, captures_added: [...], findings_added: [...]}`
     (dom_snapshot 分の既存 findings・captures には触れない。canonical `.findings.yaml` への
     マージはオーケストレータが昇格時に行う)
4. **canonical な `S5_ui-review.{tier_id}.done.yaml`・`.findings.yaml`・`ui-artifacts/{tier_id}/`
   (`staging/` を除く)はここでは一切更新しない**。完了報告に次を含める:
   - `checks_checked_after`: 更新後の `checks_checked` の**全文**(dom_snapshot 分を含む。
     既存値をそのまま引き継いだ上で capture_review だけを更新したもの)
   - `staged_artifacts`: `staging/` に書いた各ファイルの `[{staged_path, sha256, canonical_path}]`
     (`canonical_path` は昇格後の配置先。例 `staging/xxx_story.png` → `ui-artifacts/{tier_id}/xxx_story.png`)
   - `findings_delta_sha256`: `staging/findings-delta.yaml` の sha256
   - `captures_manifest_sha256`: 昇格後に `captures[]` 全体が持つことになる screenshot path を
     昇順に `{path}\n{sha256}\n` 連結した文字列の sha256(`ui_imported.tree_hash` と同じ計算規則。
     `staged_artifacts` の内容と既存 captures[] から算出できる)

オーケストレータは報告値を `staging/` の実測(sha256)と照合してから `capture_review_completed`
イベントを追記し、その後に staging→canonical への昇格(ファイル移動・findings マージ・done 更新)を
行う。手順・payload の詳細は state-schema.md を正本とする。

## findings スキーマ(dist-impl-verify の 7 観点スキーマとは別物)

```yaml
schema_version: "1.0"
uc_id: "..."
tier: "..."
attempt: 1
verified_at: "..."
checks_checked:                  # 実施した check の完走記録(verify の viewpoints_checked に相当)
  dom_snapshot: {status: done | skipped | unverified, note: "対象 3 画面 × 4 状態"}  # 対象数を必ず記録
  capture_review: {status: done | skipped | unverified, note: "対象 3 画面 × 4 状態",
                    reason: capability_disabled | runtime_unavailable}   # reason は status: skipped のときのみ
  # skipped(reason: capability_disabled) = capability が disabled(dom_snapshot は false)でそもそも実施しない
  # skipped(reason: runtime_unavailable) = capture_review が enabled だが browser ツールが本セッションで
  #   利用不能(done は pass のまま。D10。dom_snapshot にはこの理由は無い)
  # unverified = dispatch されたが targets が実測 0 件だった等、検証が成立しなかった状態(pass にしない)
captures:                        # capture_review が実施した全 target の索引(match/diff/skipped 問わず)
  - target: {screen: {name: "...", route: "..."}, story: "...", variant: "..."}
    # ↑ dispatch target(引数 targets の各行)と**同型**: {screen: {name, route}, story, variant}。
    #   canonicalization・重複判定は state-schema.md「dispatch target の canonical hash」の
    #   規則と**同一規則**(key 昇順 canonical JSON 化 → (screen.name, screen.route, story, variant)
    #   の辞書順)を使う(射影比較ではなく完全一致比較を成立させるため)
    result: match | diff | skipped
    story_screenshot: "stages/attempt-{n}/ui-artifacts/{tier_id}/xxx_story.png"   # UC root 相対。skipped では null
    implementation_screenshot: "stages/attempt-{n}/ui-artifacts/{tier_id}/xxx_impl.png"   # skipped では null
    story_sha256: "..."          # skipped では null
    implementation_sha256: "..." # skipped では null
    viewport: "1280x800"         # skipped では null
    observation: "所見(match でも 1 文。skipped は理由の要約)"
    reason: render_context_unavailable   # result: skipped のときのみ(D11 round3 反映)
findings:                        # captures のうち乖離のみ
  - id: UIF-001
    check: dom_snapshot | capture_review    # viewpoint ではなく check
    capture_index: 2               # captures[] の添字(0 始まり)。**check: capture_review のときのみ必須**
                                    #   (対象の screen/variant 記述は captures[] 側を正とし、ここで重複定義しない)。
                                    #   **不正な参照は fail-closed で拒否される**(オーケストレータが
                                    #   S5 受理時・S9 の両方で検証): 0 <= capture_index < captures.length
                                    #   かつ captures[capture_index].result: diff であること
                                    #   (範囲外・存在しない添字・match/skipped 参照は不正)
    severity: blocker | major | minor
    code_target: "frontend/src/loan/LoanConfirmationScreen.tsx"   # コード上の対象パス。
                                    #   check: dom_snapshot では必須、check: capture_review では任意
                                    #   (target フィールドは使わない — コード path と capture 対象記述の
                                    #   型矛盾を capture_index / code_target への分離で解消する)
    claim: "何が問題か(1-2 文)"
    evidence: "story の該当箇所・実行結果・差分画像への相対パス + sha256 など、反証可能な根拠"
    suggested_fix: "修正方針の案(任意)"
summary: {blocker: 0, major: 0, minor: 0}
```

findings ゼロなら `findings: []` を明示する(`checks_checked` は必ず埋める)。`captures` は
capture_review を実施した場合のみ持つ(dom_snapshot のみの場合は省略可)。

## severity 規則

- **入力ソース間矛盾**(tier-rules.md の矛盾 3 条件: story path 実体の不在 / variants と
  story 実体の named export の不一致 / components 宣言と story 実体の不一致)は
  **major・非 blocker**(実装では解消不能。verify-viewpoints.md の既存規則と同一)
- **実装起因の構造乖離**(story に有る要素が実装に無い / 状態依存要素の欠落・置換)は
  **blocker 候補**(通常の attempt ループで修正)
- **capture_review の乖離は既定 major/minor**(色・余白等の視覚差)。**capture_review は
  アドホックレビューであり決定論化はしない**(D11-6)。blocker を出す場合は evidence に
  次を必須とする(偽 blocker 防止): 同一 target/variant・同一 viewport でのキャプチャ /
  両画面の描画完了(ready)を確認した旨 / **1 回の再キャプチャでも再現**したこと /
  対応する story named export。Loading 等の一時状態・レスポンシブ差は blocker にしない

## done スキーマ(union)

```yaml
stage: "S5"
tier: "tier-frontend"
attempt: 1
uc_id: "3f9a2b1c"
manifest_sha256: "..."
result: pass | environment_failure | unverified
checks_checked:                   # 必須。findings スキーマと同形の全文(dom_snapshot / capture_review の
                                   #   status・note・reason)。**通常実行時は findings.yaml の
                                   #   checks_checked と完全一致すること**(オーケストレータの受理条件。
                                   #   不一致なら stage failed 扱い)
  dom_snapshot: {status: done | skipped | unverified, note: "対象 3 画面 × 4 状態"}
  capture_review: {status: done | skipped | unverified, note: "対象 3 画面 × 4 状態",
                    reason: capability_disabled | runtime_unavailable}
dispatch_targets: {hash: "...", count: 3}   # dispatch 時に渡された targets_hash/targets_count を
                                   # そのまま転記(state-schema.md「dispatch target の canonical hash」)。
                                   # オーケストレータが受理時に独立再計算して照合する
environment_failure:              # result: environment_failure のときのみ必須(一次根拠。構造化する)
  check: dom_snapshot            # capture_review はこの union に到達しない(D10。下記参照)
  command: "実行したテストコマンド"
  exit_code: 2
  evidence: "stack trace 等、失敗の一次証跡(1-3 行)"
degradation_proposed:            # result: environment_failure のときのみ必須。capability の更新案のみを持つ
  tier-frontend: {dom_snapshot: false}   # ({tier_id}: {check: false})。失敗理由・証跡は書かない(environment_failure に一本化)
completed_at: "..."
completed_by: "dist-impl-ui-review@{plugin_version}"
```

`environment_failure` は「dom_snapshot テストの実行環境自体が壊れている」等、
**Verifier 側の問題ではなく環境起因**の場合に使う(構造乖離は通常の findings で表現し、
`result: pass` のまま進める — done は「検証を完走できたか」、findings は「検証結果として
何を見つけたか」を表す)。**capture_review はこの union に到達しない**: browser ツールが
利用不能なときは `environment_failure` にせず `checks_checked.capture_review: {status:
skipped, reason: runtime_unavailable}` として `result: pass` のまま進める(D10。プロジェクト側の
事前整備を要求しない設計の帰結 — セッション依存のツール可否を「環境の壊れ」として扱わない)。
`unverified` は「環境は正常だが検証対象(targets)が成立しなかった」場合に使う(上記「対象数の
再検証」参照。environment_failure とは原因が異なるため区別する)。
findings には `environment_failure` の判断理由を書かない(一次根拠は done の `environment_failure`
フィールドに構造化して記録する。置き場を分離する)。`degradation_proposed` は capability を
どう更新するかの提案のみを持ち、失敗理由や実行証跡は書かない(理由・証跡は `environment_failure`
に一本化する)。**環境失敗検知後の縮退遷移(issues 起票・ユーザー確認・
`tiers[].capabilities.ui_review` の更新)はオーケストレータ(dist-impl-run)の責務**であり、
本スキルは done を書いて報告するところまでを行う。

## write-set

**通常の dispatch(`checks` 省略。全 check 実施)**: `attempt-{n}/S5_ui-review.{tier_id}.done.yaml`、
`.findings.yaml`、`attempt-{n}/ui-artifacts/{tier_id}/` のみ(**実装コードの修正禁止**。複数
frontend tier の並列実行で衝突しないよう tier_id サブディレクトリに分離する)。capture_review が
生成する SSR 静的 HTML(`attempt-{n}/ui-artifacts/{tier_id}/render/`)・キャプチャ画像もこの配下
(プロジェクト側の managed 領域や事前整備コマンドは不要になったため、output_dir の例外規定は無い)。

**`checks=capture_review` の再実行(「capture_review のみの再実行」節。D10 round2)**:
`attempt-{n}/ui-artifacts/{tier_id}/staging/` **のみ**。canonical な done・`.findings.yaml`・
`ui-artifacts/{tier_id}/`(`staging/` を除く)への書き込みは禁止(write-set 逸脱)。staging から
canonical への昇格はオーケストレータが `capture_review_completed` イベント追記後に行う
(state-schema.md を正本とする)。

## 完了報告

生成・更新ファイル一覧 / `checks_checked` の内訳(実施 check・対象数・status。capture_review が
skipped(runtime_unavailable) の場合はその旨)/ `dispatch_targets`(受け取った targets_hash/targets_count
をそのまま転記したもの)/
`result`(pass / environment_failure / unverified)と、environment_failure の場合は
`environment_failure` フィールドと `degradation_proposed` / findings 件数(severity 別。
capture_review の finding は capture_index が指す captures[] エントリが diff であることを
自己確認した旨も含める)/ `captures[]` を書いた場合はその件数(match / diff / skipped 内訳。
targets との 1:1 対応を自己確認した旨)/ `checks=capture_review` 再実行の場合は上記「capture_review
のみの再実行」節の報告項目(`checks_checked_after`・`staged_artifacts`・`findings_delta_sha256`・
`captures_manifest_sha256`)
