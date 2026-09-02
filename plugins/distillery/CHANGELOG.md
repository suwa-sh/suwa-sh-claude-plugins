# Changelog

distillery プラグインの変更履歴。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、
バージョンは semver（正本は `.claude-plugin/plugin.json`）。

## [1.8.0] - 2026-09-02

### Changed

- **dist-architecture: 推論ルール / スキーマの分割ロードと Step1 の Part 別 subagent 化**（トークン削減 Phase 3）
  - `references/arch-inference-rules.md`（43KB）を基本方針 + Part 索引 + 共通ルール（4KB 台）に縮小し、本体を
    `references/inference/part0-domain.md` / `part1-system.md` / `part2-app.md` / `part3-data.md` / `output-format.md` に分割
  - `references/arch-schema.md`（33KB）を目次（2KB）に縮小し、本体を `references/schema/common.md` / `domain.md` / `system.md` /
    `app.md` / `data.md` に分割（YAML 例もセクションごと）。他 md の節参照は分割後パスに更新
  - Step1 推論を「メインエージェント直接実行」から **Part 0 → Part 1 → (Part 2 ∥ Part 3)** の subagent に変更
    （指示: `references/arch/stage-instructions/step1-part0.md` / `step1-part123.md`。ファイル参照方式、変数 `skill_root` /
    `event_id` / `part` / `mode`）。各 subagent は自 Part のルール・スキーマ・必要 NFR カテゴリ（`_digest/` があればそちら）と
    RDRA tsv 全部を読み、staging `docs/arch/.work/{event_id}/_draft/` に要約 md（Phase 0〜4 の対話に必要な全表 + 要確認項目 +
    RDRA 要素数 / NFR 平均 Lv）とセクションドラフト yaml（`arch-design.parts/` と同名）を書く。メインは要約 md だけ読んで Step2 へ
  - Step3 の出力 subagent はドラフトを同名の `arch-design.parts/` にコピーして確定内容を Edit で反映。バリデーション PASS 後に
    `.work/{event_id}/` を削除（events/ に一時ファイルを置かない）
  - イベント ID の採番を Step1 冒頭に前倒し（Step3 は再採番しない。手動更新のみ例外）
  - 差分更新モードは変更セクションに対応する Part だけを起動（Part 0 未実行時は `latest/_digest/domain_architecture.yaml` を共通入力）
  - 共通ルール「Entity ID の決定規則」を追加（初期構築: 情報.tsv の行順で `E-{NNN}`、派生は `E-9NN`、差分更新は既存 ID 優先）。
    Part 0 の `owned_entity_ids` と Part 3 の `entities[].id` を一致させる
  - 差分更新の影響伝播（Part 0 → 全 Part、Part 1 のティア変更 → Part 2 必須再実行）、`trigger_type`（rdra / nfr / manual）、
    domain 無し既存スナップショットの no-domain モード（`domain: none`）を明記

### Known issues（今回の変更範囲外・既存）

- dist-architecture SKILL.md の Markdown / カバレッジ生成は差分更新モードでも `events/{event_id}/arch-design.yaml`（差分時は存在しない）を
  入力にしている。`arch-output.md` の「差分モードでは latest のマージ結果から生成」との不整合。次版で分岐を追加する

## [1.7.0] - 2026-09-02

### Changed

- **dist-spec: subagent の入力削減とレビュー/修正ループの短縮**（トークン削減 Phase 2）
  - `references/specs/spec-template.md`（16.9KB）を共通部（9.9KB）と `tier-templates/{presentation|api|worker|cli}.md`
    （各 2〜3KB）に分割。生成 subagent は対象ティアの kind に一致するファイルだけを読む
  - `references/specs/spec-generate.md`（17.6KB → 12.1KB）から「ティア構成の決定」を `tier-selection-rules.md`
    （Step1 オーケストレータ専用）、「設計判断記録」を `decision-records.md`（Step4f 専用）に分離
  - Step1 で UC ごとの `{tier_id} ({kind})` を確定して `_inference.md` に記録し、生成 subagent の指示に渡す
  - `references/specs/stage-instructions/` を新設（dist-impl-run と同じファイル参照方式）: `step3-generate.md` /
    `step3-review.md` / `step3-fix.md` / `step35-review.md` / `step4-review.md` / `step65-review.md`。
    オーケストレータのプロンプトは「role 1 行 + 指示ファイルの絶対パス + 変数ブロック」のみ
  - レビュー結果は findings YAML（`docs/specs/events/{event_id}/_review/step3-{group}-round{n}.yaml` 等）経由で受け渡し、
    チャットには件数と path だけを返す。修正 subagent は指摘のある UC のファイルと findings だけを読む
  - Step3 / 3.5 / 4 のレビューループは「round 1 全件 → 修正 → round 2 は指摘のあった UC / 担当のみ → blocker/major 修正 →
    round 3 は修正した対象だけの検証パス（修正なし）」に変更（従来: LGTM まで全件を最大 3 回）。残る finding は
    オーケストレータが `resolution: deferred` + 理由で記録する（記録主体・状態は `step3-fix.md` の表）。
    Step6.5 は従来どおり 3 ラウンド・blocker/major 収束条件を維持
  - `subagent-template.md` は stage → 指示ファイルの対応表に置き換え。変数ブロックに `skill_root`（dist-spec の絶対パス）を渡し、
    指示ファイル内の `references/...` はその基準で解決する。専用指示ファイルの無い生成 stage（Step3.5 / Step4a〜4d）は
    既存テンプレート・ルールファイルと一次入力の絶対パス + 共通の完了報告形式をプロンプトに書く
  - findings YAML の `file` を全 stage 共通の修正対象パスとし、任意の `source_refs`（検証に使った一次入力）を追加。
    round 2 以降のレビューは対象成果物 + `source_refs` の最小部分だけを読む
  - Step1 の `_inputs-digest.md` を LLM 転写から `dist-pipeline/scripts/extractSections.js`（原文切り出し）による生成に置換
    （トークン 0・決定的。1 行目 `design_available:` と転写済みチェックリストの契約は維持）
- **dist-pipeline: `scripts/extractSections.js` / `scripts/buildDigest.js` を追加**（段階的開示の基盤。消費側 SKILL.md への
  適用は 1.9.0）。`extractSections.js` は YAML の指定セクション（`system_architecture.tiers` / `categories[id=A]` 等）を
  原文のまま切り出し、`--md` で `_inputs-digest.md` 形式を出力。`buildDigest.js` は `docs/{arch,nfr,design}/latest/_digest/`
  （index.md + セクション別 YAML、正本の sha256 つき）を冪等に生成する

## [1.6.1] - 2026-09-02

### Changed

- **feedback mode の手順を `dist-pipeline/references/feedback-mode.md` へ分離**（トークン削減 Phase 1。挙動変更なし）
  - SKILL.md の F0〜F3（約 230 行）と subagent-template.md の `{feedback_instructions}` ブロック（約 50 行）を移動し、
    SKILL.md の feedback request mode 節には呼び出し形式・新規セッションでの起動推奨・
    「feedback 入力を検出したら `references/feedback-mode.md` を読む」・関連契約の一覧を残す（入力判定の fail-closed・dialogue_policy・config 読込順序は通常 mode と共通のため「0. 入力確認」に残る）。
    通常 / harvest mode のオーケストレータは feedback 手順をロードしなくなる（1.6.0 比: SKILL.md 47.6KB → 38.8KB、
    subagent-template.md 20.5KB → 15.4KB）
  - SKILL.md / pipeline-config-schema.md の F0b / F1 参照を `feedback-mode.md` 参照に張り替え

### Fixed

- dist-harvest SKILL.md: `scripts/makeGraphData.js` の参照先を実在する
  `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/makeGraphData.js` に修正（誤参照。下記テストで検出）
- root `tests/distillery-reference-links.test.js` を追加: distillery の SKILL.md / references 内の
  `references/...` / `scripts/...` パスの実在を検証（以後の分割で相互参照が破断したら CI で検出）

## [1.6.0] - 2026-09-02

### Added

- **トークン計測基盤**（トークン削減の Phase 0。以後の Phase で before/after を取るための土台）
  - `scripts/tokenReport.js`: セッション transcript（`~/.claude/projects/<project>/<session>.jsonl` と
    `<session>/subagents/agent-*.jsonl` + `.meta.json`）からエージェント別に input / cache_creation / cache_read /
    output / msgs / max_context を集計し、markdown 表と JSON を出力。同一 `message.id` が content block ごとに
    複数行出るため id で重複排除する（重複排除しないと約 4 倍に過大計上される）。main transcript 内の
    task-notification `<subagent_tokens>` を subagent id で突合して `reported` 列に出す（≒ 最終コンテキスト量）。
    `--latest` / `--out <dir>`（常に md + json の両方を書く）/ `--weights`（有限・非負のみ受理）対応
  - `scripts/progress-update.js`: `step ... --tokens <N>`（非負整数のみ。加算）と `summary` サブコマンド（Step 別表）。
    `resume` は前回 status の tokens を全 Step から引き継ぐ（先行 Step は event_id も）。
    Step 別記録は通常/harvest mode 限定（feedback mode は status を持たないため tokenReport.js で集計）。
    `DIST_PIPELINE_STATUS_PATH` で status 出力先を上書き可能（テスト用）
  - dist-pipeline SKILL.md: サブエージェント完了通知ごとに `subagent_tokens` を `--tokens` で加算し、完了サマリに
    「完了時コンテキスト量（Step 別・参考値）」表を追加（課金対象の総消費量ではない。精密集計は tokenReport.js）
  - ベースライン（dist-spec 単体 headless 実行、2026-08-30、35 エージェント、重複排除後）:
    cache_read 32.5M / cache_creation 4.2M / msgs 346。オーケストレータ最大コンテキスト 245k

### Notes

- transcript の `output_tokens` は streaming 初期値のため過小。tokenReport.js の既定 weight は `output=0`
  （コスト評価に含めない。含めたい場合は `--weights output=5` 等で明示する）

## [1.5.0] - 2026-08-30

### Added

- **design ステージの skip**（UI 画面を持たないプロダクト向け）
  - `docs/pipeline/pipeline-config.yaml` に `skip_steps`（許容値 `step5` / `step6a`。`step5` 指定で `step6a` も暗黙 skip）
  - dist-pipeline: Step3 完了後、arch の tiers に presentation 系（`frontend` / `presentation` / `ui`）が無く
    `skip_steps` が未定義なら「design ステージの実行」を確認推奨項目として提示（⭐ = skip。auto_adopt では config に書き戻す）。
    判定は `scripts/hasPresentationTier.js`（`system_architecture.tiers[].id` のトークン一致のみ検査）と
    `scripts/resolvePipelineConfig.js`（YAML parser で `skip_steps_defined` を判定）。自動生成する config は
    `skip_steps` キーを書かない（書くと「実行する」意思になり推奨が出ない）
  - dist-pipeline → dist-design-system に `design_generation=required` を渡し、config で実行が確定した Step5 の早期終了を抑止
  - `validateSpecEvent.js`: `_inputs-digest.md` に `design_available` がある新規 event では `story_generation` の存在と整合を検証
    （両方欠落は生成契約違反としてエラー、1.4.x 以前の event は警告のみ）
  - skip 推奨判定は `interface_kind != gui` **または** presentation 系 tier 無し（dist-design-system と同じ規則）。
    `hasPresentationTier.js` は `システム概要.json` も受け取り `recommend_design_skip` を返す
  - `resolvePipelineConfig.js` は行末コメント（`key: value # ...`）を除去してから簡易 YAML parser に渡す
  - dist-pipeline → dist-spec に `design_available=true|false` を引数で明示（古い `docs/design/latest/` 残存時の誤判定防止）
  - feedback mode: `planFeedbackRequest.js --skip-stages` を追加。`routing_basis.skipped_stages` に凍結し、
    全 work unit の closure から除外。direct owner が skip stage の場合は fail-closed
- dist-spec **design 無しモード**: `design-event.yaml` を任意入力化。画面仕様・コンポーネント設計・`screens` を生成せず、
  `ui-design.md` を CLI 出力規約（stdout/stderr・終了コード・出力フォーマット）として生成。
  CLI 系ティア（id に `cli` / `command` / `tui`）のコマンド契約フォーマットを追加。
  `spec-event.yaml` に `story_generation: required | not_applicable` を Step5（イベント生成時）で記録（schema に任意 enum 追加。
  `ui-design.md` の出力規約は `interface_kind`（cli / api / batch）で節を差し替え）
- dist-requirements: `システム概要.json` に `interface_kind`（`gui` / `cli` / `api` / `batch`、省略時 `gui`）。
  CLI プロダクトでは「画面」をコマンド出力としてモデル化し、design の画面リストの起点にしない指針を追加
- dist-design-system: `interface_kind` が `gui` 以外、または presentation 系 tier が無い場合は design skip を推奨して停止

### Changed

- Step6a は `skip_steps` / `story_generation: not_applicable` / storybook-app 不在のいずれでも skip
- `generateReadme.js`: `docs/design/latest` が無い場合は空の Design 節を出さない

### Compatibility

- 既存 config（`step_models` のみ）・既存 feedback run（`skipped_stages` 無し）・`interface_kind` 無しの RDRA は
  従来どおり動作する（省略 = skip なし / gui）

## [1.4.4] 以前

git log（`git log --oneline -- plugins/distillery`）を参照。
