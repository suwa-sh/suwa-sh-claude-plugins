---
name: distillery:dist-harvest
description: >
  既存プロジェクト（リポジトリ）からドキュメント・コード・設定を解析して要求・要件を吸い上げ、
  distillery パイプラインの正規入力（USDM + RDRA）を初期構築するリバースエンジニアリングスキル。
  ソース・エンドポイント定義・データストア定義・テスト・コミット履歴を RDRA 4レイヤーで as-is 分析し、
  「コードから読み取った事実」と「LLM の推測」を evidence / confidence で区別する。
  逆生成した USDM を入力に dist-requirements の RDRA フルビルド資産で docs/rdra/latest/ まで構築するため、
  以降の quality-attributes → architecture → infrastructure → design → spec が無変更で動作する。
  --preflight を付けると、実装内部を読む前に 3 つの整理 view(システムコンテキスト / 業務フロー /
  成果物チェーン)で対象を整理し、変更の影響範囲を判定する軽量パスになる。
  「既存プロジェクトから要件を吸い上げ」「リバースエンジニアリング」「既存コードから RDRA」
  「現行システムを distillery に取り込む」「as-is 分析」「逆生成」「レガシーから要件定義」
  「変更の影響範囲を調べたい」「コードを読む前に影響調査」「preflight」などで発動。
---

# dist-harvest スキル（既存プロジェクトからの要求逆生成 + 影響範囲 preflight）

本スキルは 2 つのモードを持つ:

- **全量パス（既定）**: 既存プロジェクトを解析して要求・要件を吸い上げ、distillery の正規入力
  （USDM + RDRA）を初期構築する。コードから RDRA TSV を直接生成せず、**USDM requirements.yaml を
  逆生成の成果物**とし、RDRA フルビルドは既存 `dist-requirements` の Step0 資産
  （`references/rdra-phases/`）を再利用する。これにより既存バリデータ・イベントソーシングとの整合が
  保たれ、以降の変更要望が差分モードに自然に乗る。
- **preflight パス（`--preflight`）**: 全量解析の前段の軽量パス。実装内部を読まずに、外側から読める
  資料（手順書・運用手順・構成資料・実出力）だけで対象を 3 つの view に整理し、変更の影響範囲を
  判定する。コードリポジトリが無い資産（マクロ・手順書ベースの業務・現場運用のあるアプリ）にも使える。
  手順の正本は `references/preflight.md`。

## 前提条件

**全量パス**:

- 解析対象リポジトリのディレクトリパス（1 つ以上、スペース区切り）が指定されること
- distillery 成果物を置くプロジェクトの作業ディレクトリで実行すること
  （対象リポジトリと同一でも、モノレポの親ディレクトリでもよい）
- **初期構築専用**: `docs/rdra/latest/*.tsv` が既に存在する場合は中断し、差分更新モード
  （`dist-requirements`）を案内する

**preflight パス**:

- 対象パス（外側から読めるテキスト資料、またはそれらを含むディレクトリ）が指定されること
- 読み取り専用の調査のため、**既存 RDRA チェックは適用しない**（上記の初期構築専用ガードは
  全量パス専用。RDRA モデルが既にあるプロジェクトでも preflight は実行できる）
- `--continue` / `--no-confirm` は preflight では対象外（軽量単発パスのため）

## ディレクトリ構成（出力）

```
docs/
  harvest/
    preflight/                # --preflight の出力（軽量パス）
      events/{event_id}/preflight.md   # event_id = {YYYYMMDD_HHMMSS}_preflight
      latest/preflight.md              # events からの置換コピー
    events/{event_id}/
      analysis/
        01-overview.md      # システム概要・技術スタック・ビジネスドメイン
        02-value.md         # アクター / 外部システム / 要求
        03-environment.md   # 業務 / BUC / アクティビティ
        04-boundary.md      # UC / 画面 / イベント / タイマー
        05-internal.md      # 情報 / 状態 / 条件 / バリエーション
      checklist.md          # 進捗（中断再開用）
      sources.md            # 解析対象リポジトリのパス・コミットハッシュ
    latest/                 # ↑ analysis/ のコピー（他ステージと同じ latest 慣例）
  usdm/
    events/{event_id}/requirements.yaml, source.txt
    latest/requirements.yaml, requirements.md
  rdra/
    events/{event_id}/…, latest/…   # dist-requirements の RDRA フルビルド資産で構築
```

- `event_id` は `{YYYYMMDD_HHMMSS}_harvest_initial`。日時は `date '+%Y%m%d_%H%M%S'` で取得する
  （LLM が推測してはならない）。harvest / usdm / rdra で同一 event_id を用いてよい。
- USDM / RDRA のイベント記録形式は dist-requirements の
  `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/event-sourcing-rules.md` に完全準拠する。

## クロススキル参照パス

本スキルは同一プラグイン内の `dist-requirements` の資産を直接参照する。`${CLAUDE_PLUGIN_ROOT}` は
同一プラグイン内で共通なので、以下のパスで解決できる:

- スキーマ/ルール: `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/usdm-schema.md`,
  `.../references/event-sourcing-rules.md`
- RDRA フルビルド: `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/rdra-phases/`
  （`rdra-fullbuild.md`, `rdra-knowledge.md`, `phase1/`〜`phase5/`）
- スクリプト: `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/`
  （`validateRequirements.js`, `generateRequirementsMd.js`, `makeGraphData.js`, `makeZeroOneData.js`, `generateRdraMd.js`）

本スキル自身の references は `${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/`。

## 全体フロー

**モード判定を最初に行う**（Phase0 の対象パス確認・既存 RDRA チェックより前）:
引数に `--preflight` があれば preflight パス（下記「preflight パス」節）へ。無ければ全量パスへ。

```
（--preflight あり）
対象資料（手順書・構成資料・実出力などのテキスト）
  → references/preflight.md の手順で 3 view 整理 + 影響判定
  → docs/harvest/preflight/ に preflight.md を出力して終了（USDM / RDRA は生成しない）

（--preflight なし = 全量パス）
既存プロジェクト（リポジトリ）
  → Phase0: 入力確認（対象パス確認 / 既存 RDRA チェック / --continue 再開）
  → Phase1: リポジトリ解析（Phase1〜5 を順次サブエージェント実行、checklist 駆動）
  → Phase2: USDM 逆生成（analysis → requirements.yaml、バリデーション）
  → Phase3: ユーザー確認（confidence: low を対話提示、dialogue-format 準拠）
  → Phase4: RDRA フルビルド（dist-requirements の資産へ委譲）
```

---

## preflight パス（`--preflight`）

```
/distillery:dist-harvest --preflight <対象パス...> [--change <変更内容テキストまたはファイルパス>]
```

1. **入力確認**: 対象パスの存在を確認する。外側から読めるテキスト資料が無く
   バイナリしか無い場合は、「手順・構成のテキスト化を用意してから再実行」を案内して終了する。
2. **変更内容の確認**: `--change` が未指定なら対話で 1 回だけ質問する。回答が得られない場合は
   影響判定を「保留」にして続行する（エラーにしない）。
3. **実行**: `${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/preflight.md` と
   `references/evidence-rules.md` を読み込み、preflight.md の手順（実装内部を読まない規範 /
   3 つの整理 view / 影響判定 / 出力フォーマット）に従って実行する。
4. **出力チェック**: `docs/harvest/preflight/events/{event_id}/preflight.md` と
   `docs/harvest/preflight/latest/preflight.md` が存在し、結論（影響判定 3 値）・view（または
   N/A + 理由）・ノード一覧（確度/根拠列つき）・残質問リストが揃っていること。
5. **完了報告**: 影響判定と根拠を報告し、「読む必要がある範囲」の各項目ごとに後続を案内する
   （コードリポジトリ内の範囲 → 実在ディレクトリに正規化して全量パスを案内 / 非コード資産 →
   担当者ヒアリング → 回答メモを対象パスに含めて再実行を案内 / 混在時は併記。
   詳細は preflight.md「完了報告と後続案内」節）。

preflight は調査で完結する（USDM / RDRA の生成・更新は行わない）。

---

## Phase0: 入力確認

1. **対象リポジトリパスの確認**: 引数で渡されたディレクトリパスの存在を確認する。未指定なら質問する。
2. **既存 RDRA チェック**: `docs/rdra/latest/` に `*.tsv` が存在する場合は**中断**し、次を案内する:
   「既に RDRA モデルが存在します。既存モデルへの変更は差分更新モード
   （`/distillery:dist-requirements 変更要望テキストのパス`）を使用してください。dist-harvest は
   初期構築専用です。」
3. **--continue 指定時**: `docs/harvest/events/` の最新イベントの `checklist.md` を読み、
   未完了タスクから再開する。
4. **event_id の採番**: `date '+%Y%m%d_%H%M%S'` で取得し `{取得値}_harvest_initial` とする。
5. **sources.md の記録**: 各対象リポジトリで `git rev-parse HEAD`（git 管理下の場合）と絶対パスを
   `docs/harvest/events/{event_id}/sources.md` に記録する。
6. **checklist.md の初期化**: Phase1〜5 + USDM 逆生成 + RDRA フルビルドのチェックリストを作成する。

---

## Phase1: リポジトリ解析（サブエージェント分割・checklist 駆動）

`references/analysis-phases/phase1〜5` の順に、各フェーズを 1 サブエージェントで実行する。
各サブエージェントは共通コンテキストとして `references/analysis-targets.md` と `references/evidence-rules.md`
を読み込んでから、担当フェーズのタスクプロンプトに従って analysis ドキュメントを生成する。

| # | フェーズ | タスクプロンプト | 出力 |
|---|---------|----------------|------|
| 1 | 概要 | `references/analysis-phases/phase1-overview.md` | `analysis/01-overview.md` |
| 2 | 価値 | `references/analysis-phases/phase2-value.md` | `analysis/02-value.md` |
| 3 | 外部環境 | `references/analysis-phases/phase3-environment.md` | `analysis/03-environment.md` |
| 4 | 境界 | `references/analysis-phases/phase4-boundary.md` | `analysis/04-boundary.md` |
| 5 | システム | `references/analysis-phases/phase5-internal.md` | `analysis/05-internal.md` |

- Phase2 以降は前段の analysis ドキュメントを追加コンテキストとして読み込ませる（レイヤー間の一貫性のため）。
- **全インベントリ項目に evidence を必須記載**（`references/evidence-rules.md`）:
  「事実: {ファイルパス:行}」または「推測: {手がかり}」＋ 確度（high|medium|low）。
- 各フェーズ完了ごとに `checklist.md` を更新する（中断再開ポイント）。
- 大規模リポジトリでコンテキストが溢れる場合はフェーズ内でディレクトリ単位に分割し checklist に記録する。
- 全フェーズ完了後、Phase5 末尾の整合性チェックを行い、矛盾は `FIXME:` として該当ドキュメントに記録する。
- Phase1〜5 完了後、`analysis/` を `docs/harvest/latest/` にコピーする。

### Phase1 サブエージェント指示例（各フェーズ共通の型）

```
あなたは既存プロジェクトの RDRA リバース分析を行う実行エージェントです。

まず以下のファイルを読み込んで理解してください:
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/analysis-targets.md
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/evidence-rules.md
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/analysis-phases/{担当フェーズ}.md
- （Phase2 以降）docs/harvest/events/{event_id}/analysis/ の前段ドキュメント

解析対象リポジトリ: {対象パス...}

担当フェーズのタスクプロンプトに従い、指定の analysis ドキュメントを生成してください。
全インベントリ項目に確度（high|medium|low）と根拠（事実: path:line / 推測: 手がかり）を
必ず付けてください。読み取れない項目は空欄にせず「推測」または「FIXME」として明示してください。

出力先: docs/harvest/events/{event_id}/analysis/{出力ファイル}

質問や確認は不要です。指示に従い即座に実行してください。完了後、生成ファイルパスと
確度 low の項目件数を報告してください。
```

---

## Phase2: USDM 逆生成（サブエージェント）

`references/usdm-reverse.md` に従い、analysis ドキュメントから `requirements.yaml` を逆生成する。

### サブエージェント指示例

```
あなたは USDM 逆生成の実行エージェントです。

まず以下のファイルを読み込んで理解してください:
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/usdm-reverse.md
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-harvest/references/evidence-rules.md
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/usdm-schema.md
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/event-sourcing-rules.md
- docs/harvest/events/{event_id}/analysis/01-overview.md 〜 05-internal.md
- docs/harvest/events/{event_id}/sources.md

usdm-reverse.md のタスクに従い、以下を生成してください:
- docs/usdm/events/{event_id}/requirements.yaml（confidence / evidence 拡張フィールド付き）
- docs/usdm/events/{event_id}/source.txt（sources.md の要約 + 逆生成である旨）

生成後、必ずバリデータを実行し PASS させてください:
  node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/validateRequirements.js docs/usdm/events/{event_id}/requirements.yaml
FAIL の場合は requirements.yaml を修正して再実行してください。

PASS 後、docs/usdm/latest/requirements.yaml を作成し（初期構築なので events の内容をコピー）、
  node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/generateRequirementsMd.js docs/usdm/latest/requirements.yaml
で docs/usdm/latest/requirements.md を生成してください。

質問や確認は不要です。指示に従い即座に実行してください。完了後、要求件数・確度 low の要求/仕様の
一覧・バリデーション結果を報告してください。
```

### 出力チェック

- `docs/usdm/events/{event_id}/requirements.yaml`, `source.txt`
- `docs/usdm/latest/requirements.yaml`, `requirements.md`
- バリデータが終了コード 0

---

## Phase3: ユーザー確認（対話・dialogue-format 準拠）

逆生成は推測を必ず含むため、後段へ流す前にユーザー確認を **1 回**行う。dist-requirements Step0 の
確認と同等で、逆生成特有の「推測項目」を重点的に提示する。

- **提示項目**:
  - 業務一覧 / BUC 候補 / 主要情報 / 主要アクター（analysis から抽出）
  - **`confidence: low` の項目一覧**（要求の理由・推測で補完したモデル要素）を必ず提示する
- **フォーマット**: `${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/references/dialogue-format.md` 準拠
  （**3 案以上 + ⭐推奨 + 一行説明 + 推奨理由**）。推奨理由の confidence 表記は evidence-rules.md の
  レベルをそのまま使う。
- **選択肢**: 「このまま進める」「修正指示」「中断」。修正指示を受けた場合は該当 analysis / USDM を
  再生成してから再確認する。
- **スキップ**: 呼び出し元が `--no-confirm` を明示した場合（pipeline からの呼び出し用）は確認を省略する。
  ただし confidence: low の項目は結果として「確認推奨項目リスト」で呼び出し元に返す。
- **dialogue_policy 分岐**: 呼び出し元 pipeline から `dialogue_policy: auto_adopt` が渡された場合も
  この確認を省略し、確認推奨項目リストを作成した上で⭐推奨を採用して続行する
  （low は todo.md 登録 + 仮採用、採用一覧を完了報告に含める）。ユーザーへ提示して回答を待つのは
  `interactive` の場合のみ。

対話を省略して完了扱いにしてはならない（`--no-confirm` / `dialogue_policy: auto_adopt` 時を除く）。

---

## Phase4: RDRA フルビルド（dist-requirements へ委譲）

`docs/usdm/latest/requirements.yaml` を入力に、dist-requirements Step0 の手順 4〜6（RDRA フルビルド
Phase1-5 + docs 配置 + 一時ディレクトリ削除）を実行する。**dist-requirements スキル自体は呼ばない**
（Step0 の先頭で USDM 分解が二重に走るため）。代わりに RDRA フルビルドのタスクプロンプトを直接使う。

### 実行手順

1. `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/rdra-phases/rdra-fullbuild.md` に従い、
   Phase1〜5 + RDRA 統合をサブエージェントで実行する。入力は `初期要望.txt` ではなく
   `docs/usdm/latest/requirements.yaml`（下記サブエージェント指示の補足参照）。
2. 追加コンテキストとして `docs/harvest/latest/` の analysis ドキュメントを読み込ませ、コード由来の
   情報モデル・状態・バリエーション・条件の詳細が RDRA 生成に反映されるようにする。
3. `scripts/makeGraphData.js` / `makeZeroOneData.js` を実行して `関連データ.txt` / `ZeroOne.txt` を生成する。
4. `scripts/generateRdraMd.js 1_RDRA --lint` で整合性 lint を実行する（latest 確定前のゲート）。逆生成した RDRA は名前ゆれによる未定義参照が混入しやすい。エラー（未定義参照、exit 1）があれば `1_RDRA/` の TSV を修正し、エラー 0 件になるまで繰り返す。警告（未接続、exit 0）はブロックせずユーザーに報告する。
5. `1_RDRA/` → `docs/rdra/latest/` + `docs/rdra/events/{event_id}/`（初期構築は全ファイルをイベントに含める）。
6. `scripts/generateRdraMd.js docs/rdra/latest` を実行して `docs/rdra/latest/views/*.md`（Mermaid 図解つきの人間可読ビュー）を生成する。手順 4 の lint に合格していればエラーは 0 件のはずで、`views/00_不整合チェック.md` に残るのは許容済みの警告のみ。
7. 一時ディレクトリ（`0_RDRAZeroOne/`, `1_RDRA/`）を削除する。

### RDRA フルビルド Phase1 サブエージェント指示例（USDM YAML 入力 + analysis 補足）

```
あなたは RDRA フルビルドの実行エージェントです。

以下のファイルを読み込んで理解してください:
- ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/rdra-phases/rdra-knowledge.md
- docs/usdm/latest/requirements.yaml
- docs/harvest/latest/analysis/*.md（コード由来の情報・状態・バリエーション・条件の詳細）

※ requirements.yaml は USDM（要求・理由・仕様）形式で構造化された、既存プロジェクトから逆生成した
  as-is 要求です。requirement（要求）、reason（理由）、specifications[].specification（仕様）、
  affected_models（影響モデル）を初期要望の内容として解釈してください。confidence / evidence は
  補足情報であり、RDRA モデルには載せません。
※ analysis ドキュメントには、コードから読み取った情報モデル・状態遷移・区分・ビジネスルールの
  具体が含まれます。RDRA の情報/状態/バリエーション/条件シートの精度を高めるために活用してください。

次に、以下のタスクプロンプトを読み、その指示に従ってファイルを生成してください:
${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/rdra-phases/phase1/{タスク}.md

質問や確認は不要です。指示に従い即座に実行してください。
```

Phase2〜5 も同様に、`初期要望.txt` を `docs/usdm/latest/requirements.yaml` に置き換え、上記の補足
（USDM 入力 + analysis 補足）を付けて実行する。rdra-fullbuild.md の各 Phase の共通コンテキスト・
タスク表・出力チェックに従う。

### 出力チェック

- `docs/rdra/latest/` に 10 ファイルが揃うこと:
  `システム概要.json`, `アクター.tsv`, `外部システム.tsv`, `情報.tsv`, `状態.tsv`, `条件.tsv`,
  `バリエーション.tsv`, `BUC.tsv`, `関連データ.txt`, `ZeroOne.txt`
- `docs/rdra/latest/views/` に `README.md` と `00_不整合チェック.md` 〜 `07_条件・バリエーション.md` が生成されていること
- `views/00_不整合チェック.md` の検出件数を確認し、不整合があればユーザーに報告すること
- `docs/rdra/events/{event_id}/` に同ファイル群が記録されていること
- `システム概要.json` の `system_name` が USDM の `system_name` と一致すること

---

## 完了報告

以下をユーザーに報告する:

- 解析対象リポジトリ（パス・コミット）
- 生成した成果物: `docs/harvest/latest/`, `docs/usdm/latest/`, `docs/rdra/latest/`
- 逆生成した要求件数 / UC 数 / 情報数などのサマリ
- **`confidence: low` の項目一覧**（後段で検証・修正が望ましい推測項目）
- 次の一手の案内: 「`/distillery:dist-quality-attributes` 以降を実行すると、この as-is モデルを起点に
  非機能要求・アーキテクチャ・仕様を再設計できます。」

## 確認推奨項目の返却（dialogue-format 準拠）

pipeline から `--no-confirm` で呼ばれた場合も、`confidence: low` の項目があれば結果として
「確認推奨項目リスト」を返す。フォーマットは
`${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/references/dialogue-format.md` に従う
（**3 案以上 + ⭐推奨 + 一行説明 + 推奨理由**）。対象:

- 要求の理由（reason）を推測で補完した項目
- 推測で追加したアクター / 情報 / BUC / 状態 / 条件 / バリエーション
- 業務ドメイン一般論から補完した非機能要求

対話（または確認推奨項目の返却）を省略して completed としてはならない。

ただし、呼び出し元 pipeline から `dialogue_policy: auto_adopt` が指示された場合は、確認推奨項目リストを
同フォーマットで作成した上で⭐推奨を採用して続行し、採用一覧（low は todo.md 登録+仮採用）を完了報告に含める
（`skills/dist-pipeline/references/dialogue-format.md`「自動採用モード」参照）。
