---
name: pipeline
description: >
  USDM-RDRA パイプラインの全スキルを順次実行するワークフロースキル。
  初期要望テキストまたは変更要望テキストを入力とし、
  requirements → nfr → arch → infra → design → spec の6スキルをサブエージェントで順次実行する。
  各スキルはコンテキストを大量消費するため、必ずサブエージェントに委譲する。
  「パイプライン実行」「要件から仕様まで一気通貫」「全スキル実行」
  「requirements から spec まで」「パイプライン一括実行」「end-to-end で要件定義」などで発動。
---

# USDM-RDRA Pipeline

初期要望 / 変更要望テキストから、要件定義 → 非機能要求 → アーキテクチャ → インフラ → デザイン → 仕様 まで一気通貫で実行する。

## 前提条件

- 作業ディレクトリに要望テキスト（任意ファイル名）が存在すること
- 各個別スキルがインストール済みであること:
  - `requirements`, `quality-attributes`, `architecture`
  - `infrastructure`, `design-system`
  - `spec`

## パイプライン概要

```
要望テキスト
  → Step1: requirements          — USDM分解 + RDRA モデル構築/差分更新
  → Step2: quality-attributes      — 非機能要求グレード推論・対話・出力
  → Step3: architecture — アーキテクチャ設計推論・対話・出力
  → Step4a: infrastructure (MCL)  — MCL product-design 実行（成果物生成）
  → Step4b: infrastructure (記録)  — イベント記録 + Arch フィードバック + write-back check
  → Step5: design-system — デザインシステム + Storybook 生成
  → Step6: spec — UC仕様 + API/DB設計
```

各スキルはコンテキストを大量に消費するため、**必ずサブエージェントに委譲する**。
**全 Step (1〜6) で確認推奨項目があれば対話が発火する**。返却値のフォーマットは
`references/dialogue-format.md` に従う（3案＋⭐推奨＋一行説明が必須）。

## イベントID管理

パイプラインは各 Step の完了時にイベントIDを記録し、次の Step に渡す。
全 Step で `ls -t docs/{domain}/events/ | head -1` で最新イベントIDを取得する。

## 進捗ダッシュボード

パイプラインの進行状況をリアルタイムで可視化する Web ダッシュボードを提供する。
`<skill-path>` は `${CLAUDE_PLUGIN_ROOT}/skills/pipeline` のフルパスに置き換える。

**表示内容:** プログレスバー / 各ステップの状態（pending→running→completed/error） / サブエージェントの現在タスク / 対話待ちバナー（「← Claude Code のチャットで回答してください」）

**呼び出しパターン:**

| タイミング | コマンド |
|-----------|---------|
| フル開始 | `node <skill-path>/scripts/progress-update.js init` |
| 途中再開 | `node <skill-path>/scripts/progress-update.js resume <start_step_id>` |
| Step開始 | `... step <id> running --subagent-task "..."` |
| Step完了 | `... step <id> completed --summary "..." --event-id "..."` |
| 対話待ち | `... dialogue <step_id> "質問" --options "opt1,opt2"` |
| 対話完了 | `... dialogue-clear` |
| エラー | `... error <step_id> "メッセージ"` |
| 完了 | `... complete` |

## サブエージェント指示

各 Step のサブエージェント指示は共通テンプレートに従う。詳細は `references/subagent-template.md` を参照。

## 実行手順

### 0. 入力確認

1. ユーザーに要望テキストのファイルパスを確認する（未指定なら質問する）
2. ファイルの存在を確認する
3. パイプラインの実行範囲を確認する:
   - **フル実行**（デフォルト）: Step1〜6 を全て実行
   - **途中から再開**: 既に完了済みの Step がある場合、ユーザーに開始 Step を確認する
     - 判断材料: `docs/` 配下の各モデルディレクトリの存在状況を `ls docs/` で確認
4. **進捗ダッシュボードを起動する**:
   - フル実行: `progress-update.js init`
   - 途中再開: `progress-update.js resume <start_step_id>`（完了済み Step が completed になる）
   - `progress-server.js 3100 &` でバックグラウンド起動
     - サーバーは **プロセスベースで既存起動を検出** する。既存 `progress-server.js` が同ポートを
       掴んでいれば停止して同ポートで再起動、別プロセスが掴んでいれば `3101, 3102...` へフォールバック。
   - 実ポートは `node <skill-path>/scripts/progress-update.js url` で取得してユーザーに提示する
     （ハードコード `http://localhost:3100` は使わない）

### 1〜6. 各 Step の実行パターン

全 Step は以下の共通パターンで実行する。Step 固有の値は表を参照。

1. **進捗更新（開始）:** `progress-update.js step <id> running --subagent-task "<タスク名>"`
2. **サブエージェント起動:** `references/subagent-template.md` のテンプレートに各 Step の変数を埋めて指示
3. **サブエージェント完了後の対話処理（全 Step 共通）:**
   サブエージェント結果に「質問」または「確認推奨項目リスト」（confidence: low/medium、または自動推論で埋めた項目）が含まれている場合、対話を**必ず発火する**:
   a. `progress-update.js dialogue <step_id> "質問内容" --options "選択肢1,選択肢2"` でダッシュボード更新
   b. ユーザーにチャットで質問または確認推奨項目を中継し、回答を待つ
   c. 回答を受け取ったら `progress-update.js dialogue-clear`
   d. 回答内容を反映して同スキルのサブエージェントを再起動する（または回答不要でそのまま完了チェックへ進む）

   **フォーマット検査:** 返却された確認推奨項目が `references/dialogue-format.md` に従っていない
   （3案不足、⭐推奨なし、一行説明なし等）場合は、オーケストレータはサブエージェントに再返却を要求する。

   **対話スキップ検知:** 全 Step で、サブエージェントが一度も質問・確認推奨項目を返さずに completed を返した場合は、オーケストレータ側で以下をチェックする:
   - Step 1: `docs/rdra/latest/` の自動追加アクター/情報の有無
   - Step 2: `docs/nfr/latest/nfr-grade.yaml` 内の confidence が low/medium の項目、または source_model が自動推論の項目
   - Step 3: `docs/arch/latest/arch-design.yaml` 内の confidence が low/medium の項目
   - Step 4a: MCL 成果物の生成状態を確認（`docs/infra/events/{event_id}/specs/` の存在）
   - Step 4b: `docs/infra/latest/infra-event.yaml` 内の confidence が low/medium の項目（クラウドベンダー、リージョン、コスト方針等）
   - Step 5: `docs/design/latest/design-event.yaml` 内の confidence が low/medium の項目
   - Step 6: `docs/specs/latest/` の API 命名/エラー戦略/DB 正規化レベル等の自動推論項目

   該当項目が存在する場合は、オーケストレータがそれらを抽出して上記の対話フロー (a〜d) を発火する。
4. **完了チェック:** 必須ファイルの存在を確認
5. **イベントID取得:** `ls -t docs/{domain}/events/ | head -1`
6. **進捗更新（完了）:** `progress-update.js step <id> completed --summary "..." --event-id "..."`
7. **完了報告:** 概要とイベントIDをユーザーに伝える

| Step | スキル名 | 対話 | 完了チェック | 備考 |
|------|---------|:---:|-------------|------|
| 1 | requirements | あり | `docs/rdra/latest/BUC.tsv` + `docs/usdm/latest/requirements.yaml` | 曖昧要望の解釈を確認 |
| 2 | quality-attributes | あり | `docs/nfr/latest/nfr-grade.yaml` | Step0 規模感プリインタビュー必須 |
| 3 | architecture | あり | `docs/arch/latest/arch-design.yaml` | RDRA 整合性厳守 |
| 4a | infrastructure (MCL) | あり | `docs/infra/events/{event_id}/specs/` が存在 | MCL product-design 成果物生成で完了 |
| 4b | infrastructure (記録・FB) | あり | `docs/infra/latest/infra-event.yaml` + arch feedback event 存在 | Phase3〜5 を実行。Step4a の event_id を引き継ぐ |
| 5 | design-system | あり | `docs/design/latest/design-event.yaml` + `docs/design/latest/storybook-app/` | ブランド/カラー/フォント/レイアウトを3案確認 |
| 6 | spec | あり | `docs/specs/latest/spec-event.yaml` + `docs/specs/latest/_cross-cutting/` | API/エラー/DB 方針を確認 |

**Step4a/4b infrastructure の完了検証:**

- **Step4a (MCL実行):** `docs/infra/events/{event_id}/specs/` ディレクトリが存在し、MCL 成果物が生成されていること。
  未達ならサブエージェントに補完実行を指示する。
- **Step4b (イベント記録・FB):** `docs/infra/latest/infra-event.yaml` の存在、および Phase4 で
  `docs/arch/latest/arch-design.yaml` のタイムスタンプが Step4b 開始以降に更新されていることを確認する。
  `skills/infrastructure/SKILL.md` の「完了チェックリスト」Phase3〜5 が全て checked であること。
  未達ならサブエージェントに補完実行を指示する。

### 6a. Storybook Story 生成（spec-stories スキル）

spec スキルは Step8 で完了し、Storybook Story 生成は独立スキル `spec-stories` で実施する。Step6 完了後に必ず実行する。

**進捗更新（開始）:** `progress-update.js step 6a running --subagent-task "Storybook Story 補完チェック"`

**判定:**

```bash
STORY_COUNT=$(find docs/design/latest/storybook-app/src/stories -iname "*.stories.tsx" -path "*[Pp]ages*" 2>/dev/null | wc -l)
# UC 数の source of truth は spec 出力（docs/specs/latest/）の UC spec.md 件数。
# rdra の BUC と spec の UC は 1:1 対応しない。
UC_COUNT=$(find docs/specs/latest -name "spec.md" -path "*/UC/*" 2>/dev/null | wc -l)
```

- `src/stories/pages/` が存在しない or Story 数が UC 数の半数未満 → **未実施**
- それ以外 → **実施済み**

**未実施の場合:** `references/step6a-story-補完.md` の指示でサブエージェントを起動する。

**進捗更新（完了/スキップ）:** `progress-update.js step 6a completed --summary "実施済み"` or `--summary "27 Stories 生成"`

### 6b. 網羅率チェック + RDRA フィードバックループ

**進捗更新（開始）:** `progress-update.js step 6b running --subagent-task "網羅率チェック"`

`docs/specs/latest/_cross-cutting/rdra-feedback.md` の存在を確認する。

- **存在しない場合**: 網羅率 100% 達成済み。
  - **進捗更新（完了）:** `progress-update.js step 6b completed --summary "網羅率100%達成"`
- **存在する場合**: ユーザーに提示し承認/却下を確認。承認なら Step1〜6 を差分再実行（最大2回）
  - **進捗更新（完了・承認）:** `progress-update.js step 6b completed --summary "差分再実行を実施"`
  - **進捗更新（完了・却下）:** `progress-update.js step 6b completed --summary "feedback 却下"`

## 完了時の報告

**進捗更新:** `progress-update.js complete`

**README 生成:** 全成果物のナビゲーション用 `docs/README.md` を自動生成する:

```bash
node <skill-path>/scripts/generateReadme.js docs
```

各ドメインの latest/ から主要情報を抽出し、C4 図解・サマリテーブル・UC 一覧・ADRs・イベント履歴を含む README を生成する。

全 Step 完了後、以下のサマリをユーザーに提示する:

```
## パイプライン完了サマリ

| Step | スキル | 成果物 | イベントID |
|------|--------|--------|-----------|
| 1 | requirements | docs/usdm/latest/, docs/rdra/latest/ | usdm:{id}, rdra:{id} |
| 2 | quality-attributes | docs/nfr/latest/nfr-grade.yaml | nfr:{id} |
| 3 | architecture | docs/arch/latest/arch-design.yaml | arch:{id} |
| 4a | infrastructure (MCL) | docs/infra/events/{id}/specs/ | infra:{id} |
| 4b | infrastructure (記録・FB) | docs/infra/latest/ | infra:{id} |
| 5 | design-system | docs/design/latest/ | design:{id} |
| 6 | spec | docs/specs/latest/ | spec:{id} |

TODO (docs/todo.md): open 件数 = {N}
```

**todo.md サマリの算出:**

```bash
# 0 件なら行ごとスキップ可
OPEN=$(grep -c '\*\*ステータス\*\*: open' docs/todo.md 2>/dev/null || echo 0)
```

open 件数が 1 以上の場合は「後続スキルから RDRA/NFR 等への追加提案があります。
`docs/todo.md` を確認し、必要なら requirements スキルを再実行してください」と案内する。

## ダッシュボード停止

サマリ提示後、ダッシュボードを停止してよいか確認する。承認されたら:

```bash
kill $(lsof -t -i :3100) 2>/dev/null
```

## エラーハンドリング

サブエージェントが失敗した場合:

1. **進捗更新:** `progress-update.js error <step_id> "エラーメッセージ"`
2. エラー内容をユーザーに報告する
3. ユーザーに「再試行」「スキップして次へ」「中断」の選択肢を提示する
4. 途中で中断した場合、再開時に `resume` コマンドで完了済み Step をスキップできる

## 注意事項

- 各サブエージェントは独立したコンテキストで動作する。前の Step の情報は `docs/` 配下のファイルを通じて引き継がれる
- イベントIDはパイプラインオーケストレータが管理し、サブエージェント指示に `trigger_event` として含める
- Step5（design）は最も時間がかかる。ユーザーに所要時間の目安を事前に伝えることを推奨する

## リファレンス

| ファイル | 用途 |
|----------|------|
| `references/subagent-template.md` | サブエージェント指示の共通テンプレート + 各 Step の変数値 |
| `references/step6a-story-補完.md` | Step6a 補完サブエージェント指示（そのまま使用） |
| `references/dialogue-format.md` | 確認推奨項目のフォーマット仕様（3案＋⭐推奨） + RDRA整合性ルール |
| `scripts/progress-update.js` | 進捗ステータス更新 CLI（`port` / `url` サブコマンドで実行中ポート取得） |
| `scripts/progress-server.js` | 進捗ダッシュボード Web サーバー（SSE、プロセスベースのポート解決） |
| `scripts/appendTodo.js` | `docs/todo.md` への追加提案追記 CLI（冪等） |
| `scripts/generateReadme.js` | docs/README.md 自動生成（完了時に実行） |
