# Changelog

distillery プラグインの変更履歴。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、
バージョンは semver（正本は `.claude-plugin/plugin.json`）。

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
