# dist-harvest 進捗チェックリスト

event_id: `20260703_122735_harvest_initial`
対象: `/Users/suwa_sh/src/github.com/suwa-sh/claude-code-rdra-rev/system-sekkei/library`
オプション: `--no-confirm`

## Phase0: 入力確認

- [x] 対象リポジトリパスの存在確認
- [x] 既存 RDRA チェック（docs/rdra/latest/*.tsv なし → 初期構築モード）
- [x] event_id 採番
- [x] sources.md 記録
- [x] checklist.md 初期化

## Phase1: リポジトリ解析

- [x] phase1-overview → analysis/01-overview.md（low 4 件、FIXME 3 件）
- [x] phase2-value → analysis/02-value.md（low 3 件、FIXME 5 件）
- [x] phase3-environment → analysis/03-environment.md（low 9 件、FIXME 継続+新規 1 件）
- [x] phase4-boundary → analysis/04-boundary.md（low 9 件、新規 FIXME 2 件）
- [x] phase5-internal → analysis/05-internal.md（low 7 件）
- [x] 整合性チェック（矛盾 6 件を FIXME 記録: 予約/取置状態の齟齬、取置期限の仕様乖離ほか）
- [x] analysis/ を docs/harvest/latest/ にコピー

## Phase2: USDM 逆生成

- [x] docs/usdm/events/{event_id}/requirements.yaml + source.txt 生成（REQ 5 / SPEC 17）
- [x] validateRequirements.js PASS（終了コード 0）
- [x] docs/usdm/latest/requirements.yaml + requirements.md 生成

## Phase3: ユーザー確認

- [x] --no-confirm 指定のためスキップ（confidence: low は完了報告で返却）

## Phase4: RDRA フルビルド

- [x] RDRA Phase1〜5 + 統合（rdra-fullbuild.md 準拠、USDM YAML 入力）
- [x] makeGraphData.js / makeZeroOneData.js 実行（両方 rc=0）
- [x] docs/rdra/latest/ + docs/rdra/events/{event_id}/ 配置（10 ファイル、system_name「図書館システム」一致確認済み）
- [x] 一時ディレクトリ削除（0_RDRAZeroOne/, 1_RDRA/）

## 完了報告

- [x] サマリ + confidence: low 一覧（確認推奨項目リスト）の報告
