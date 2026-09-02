# ティア構成の決定（UC パターン別ティア選定ルール）

> **読み込みタイミング**: Step1（オーケストレータ）で UC ごとの対象ティアと kind を確定するときに読む。
> Step3 の生成 subagent には確定済みの「対象ティア (kind)」を渡すので、subagent はこのファイルを読まない。

`_inputs-digest.md` を読み込み、生成対象のティアを決定する
（ファイル自体が無ければ `docs/arch/latest/arch-design.yaml` をフルロード。
チェックリストで `system_architecture.tiers` または `app_architecture.tier_layers` が
`元ファイル参照` の場合は、該当セクションだけを `arch-design.yaml` から読む）:

- `system_architecture.tiers` から全ティアの `id`, `name`, `description`, `technology_candidates` を取得する
- `app_architecture.tier_layers` から各ティアのレイヤー構成を取得する
- 各ティアの種別を判定する:
  - **Presentation 系**: `technology_candidates` に SPA, SSR, MPA, モバイルアプリ等の UI 技術が含まれる
  - **API / バックエンド系**: `technology_candidates` に REST, GraphQL, gRPC, API Gateway 等の API 技術が含まれる
  - **非同期処理 / ワーカー系**: `technology_candidates` に Worker, Consumer, Batch, FaaS 等の非同期処理技術が含まれる
  - **CLI 系**: `id` に `cli` / `command` / `tui` を含む、または `technology_candidates` に CLI, コマンドラインツール等が含まれる
- ティアの種別に応じて、`references/specs/tier-templates/{kind}.md` の該当フォーマットを使用する
- **design 無しモード**（`_inputs-digest.md` 冒頭の `design_available: false`）では、Presentation 系ティアの
  画面仕様・コンポーネント設計・デザイントークン参照を生成しない。design-event.yaml を読みに行かない

#### UC パターン別ティア選定ルール

すべての arch ティアを全 UC に生成するのではなく、UC の特性に応じて対象ティアを絞り込む。BUC.tsv の関連モデル列（画面、タイマー、イベント、外部システム）から UC パターンを判定する:

| UC パターン | 判定条件 | 対象ティア |
|------------|---------|-----------|
| **画面あり UC（外部アクター）** | 関連モデルに「画面」があり、アクターが社外 | Presentation 系（user 向け） + API 系 |
| **画面あり UC（社内アクター）** | 関連モデルに「画面」があり、アクターが社内 | Presentation 系（admin 向け） + API 系 |
| **タイマートリガー UC** | 関連モデルに「タイマー」がある（画面なし） | CronJob 系ワーカー + API 系 |
| **自動通知 UC** | UC の説明に「自動通知」「自動送信」等がある | FaaS 系ワーカー + API 系 |
| **バッチ + 画面 UC** | 関連モデルに「画面」があり、処理にバッチ実行が含まれる | Presentation 系 + API 系 + CronJob 系ワーカー |
| **外部連携 UC** | 関連モデルに「イベント」+「外部システム」がある | API 系 + 該当ワーカー系 |
| **コマンド UC（CLI プロダクト）** | 関連モデルに「画面」があるが arch に Presentation 系ティアが無く、CLI 系ティアがある（RDRA の「画面」がコマンド出力を表す。`システム概要.json` の `interface_kind: cli`） | CLI 系 + API 系（API 系が無ければ CLI 系のみ） |

**重要**: インフラティア（API Gateway, IdP, 認可サービス, データストア, Object Storage, KVS, 外部連携アダプタ）は UC 単位の Spec では生成しない。これらは全体横断（cross-cutting）の責務。

**Presentation 系ティアが複数ある場合**（例: user 向けと admin 向け）、アクターの社内外で使い分ける:
- 社外アクター（利用者、オーナー等） → user 向け Presentation ティア
- 社内アクター（運営担当者等） → admin 向け Presentation ティア
