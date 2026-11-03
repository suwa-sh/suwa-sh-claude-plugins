# distillery2 の処理と入出力 (DFD)

> 生成物。手で直さない。正本は [dataflow.yaml](dataflow.yaml)、生成は `scripts/genDataflow.js`。
> 整合性は `tests/distillery2/integration/dataflow.test.js` が手順書と照合する。

凡例: 全体図は 箱 = 段階、矢印 = 受け渡し (ラベルはファイル群)。処理ごとの図は 箱 = 処理、円筒 = ファイル (またはファイル群)、矢印 = 読み (ファイル → 処理) / 書き (処理 → ファイル)。
`<run>` = `.distillery/runs/<slug>`。

## 目次

1. 全体図: ① 〜 ④ と起動時の移行
2. 全体図: ④ 実装まで (scenario 〜 integrate)
3. 全体図: ④ 検証と as-built
4. 処理ごとの図 (段階ごと。処理 1 つにつき 1 枚)
5. ファイルの一覧

## 全体図: ① 〜 ④ と起動時の移行

④ の中の段階は 1 つの箱にまとめた (中は次の図)。起動時の移行は UC の外の段階で、0.1.x の残り (課題ファイルにしていない課題・途中で止まった還流) を片付ける。どの段でも行う作業 (引き継ぎファイル・決めたことの記録・縦横レビュー) は処理ごとの図に回した。

```mermaid
flowchart LR
  st_requirements["① 要求"]
  st_decide["② 決定"]
  st_foundation["③ 基盤"]
  st_uc_all["④ UC の縦切り"]
  st_startup["起動時の移行 (UC の外。0.1.x の残りを片付ける)"]
  st_requirements -->|"要求・文書の入口と課題ファイル"| st_decide
  st_requirements -->|"要求・画面・実行の記録・文書の入口と課題ファイル"| st_foundation
  st_requirements -->|"要求・画面・実行の記録・文書の入口と課題ファイル"| st_uc_all
  st_requirements -->|"実行の記録・文書の入口と課題ファイル"| st_startup
  st_decide -->|"要求・決定 (NFR・ADR)・基盤の設定・実行の記録・文書の入口と課題ファイル"| st_foundation
  st_decide -->|"要求・決定 (NFR・ADR)・基盤の設定・実行の記録・文書の入口と課題ファイル"| st_uc_all
  st_decide -->|"文書の入口と課題ファイル"| st_startup
  st_foundation -->|"要求・基盤の設定・テスト基盤・契約・画面・実行の記録・文書の入口と課題ファイル"| st_uc_all
  st_foundation -->|"文書の入口と課題ファイル"| st_startup
  st_uc_all -->|"実行の記録・文書の入口と課題ファイル"| st_startup
```

| 書く段階 | 読む段階 | 受け渡すファイル群 | 受け渡すファイル |
|---|---|---|---|
| ① 要求 | ② 決定 | 要求、文書の入口と課題ファイル | 要求 (USDM)、RDRA モデル、UC 一覧 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ① 要求 | ③ 基盤 | 要求、画面、実行の記録、文書の入口と課題ファイル | RDRA モデル、UC 一覧 / デザインシステム (Storybook アプリ) / ゲートの記録 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ① 要求 | ④ UC の縦切り | 要求、画面、実行の記録、文書の入口と課題ファイル | 要求 (USDM)、RDRA モデル、UC 一覧 / デザインシステム (Storybook アプリ)、画面部品 / 実行の記録 (events / done / 退避した done)、やり直した UC の前の run (runState.js reopen が移す。0.1.35)、ゲートの記録 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ① 要求 | 起動時の移行 (UC の外。0.1.x の残りを片付ける) | 実行の記録、文書の入口と課題ファイル | 実行の記録 (events / done / 退避した done) / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ② 決定 | ③ 基盤 | 要求、決定 (NFR・ADR)、基盤の設定、実行の記録、文書の入口と課題ファイル | UC 一覧 / 非機能要求グレード表、ADR / 依存方向の検査設定 / ゲートの記録 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ② 決定 | ④ UC の縦切り | 要求、決定 (NFR・ADR)、基盤の設定、実行の記録、文書の入口と課題ファイル | UC 一覧 / ADR / 開発ルール、依存方向の検査設定 / やり直した UC の前の run (runState.js reopen が移す。0.1.35)、ゲートの記録 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ② 決定 | 起動時の移行 (UC の外。0.1.x の残りを片付ける) | 文書の入口と課題ファイル | 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ③ 基盤 | ④ UC の縦切り | 要求、基盤の設定、テスト基盤、契約、画面、実行の記録、文書の入口と課題ファイル | UC 一覧 / 開発ルール、依存方向の検査設定、Cucumber 設定、Cucumber の ESM ローダ (cucumber.js が読む)、実行設定、リポの骨格 (package.json・apps/*・packages/*)、依存の lockfile、qlty 設定 / テスト基盤 (tracer・World)、Cucumber の support / 契約の分割ファイル、UC ごとの契約の索引、契約テスト (生成物)、契約からの codegen / デザインシステム (Storybook アプリ)、画面部品 / やり直した UC の前の run (runState.js reopen が移す。0.1.35)、ゲートの記録 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ③ 基盤 | 起動時の移行 (UC の外。0.1.x の残りを片付ける) | 文書の入口と課題ファイル | 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ④ UC の縦切り | 起動時の移行 (UC の外。0.1.x の残りを片付ける) | 実行の記録、文書の入口と課題ファイル | 実行の記録 (events / done / 退避した done)、仕様起因の課題、ティア実装者の課題、as-built の要約役の課題、作業用の worktree (上流で止めるときの一時のもの。0.1.x の還流の worktree は片付けるだけ。gitignore) / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |

後ろ向きの受け渡し (後の段階が書き戻し、次の UC や再実行で前の段階が読む。図には描かない):

| 書く段階 | 読む段階 | 受け渡すファイル群 | 受け渡すファイル |
|---|---|---|---|
| ② 決定 | ① 要求 | 要求、文書の入口と課題ファイル | UC 一覧 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ③ 基盤 | ① 要求 | 要求、画面、文書の入口と課題ファイル | UC 一覧 / デザインシステム (Storybook アプリ) / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ③ 基盤 | ② 決定 | 要求、基盤の設定、文書の入口と課題ファイル | UC 一覧 / 依存方向の検査設定、実行設定、リポの骨格 (package.json・apps/*・packages/*)、依存の lockfile、qlty 設定 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ④ UC の縦切り | ① 要求 | 要求、実行の記録、文書の入口と課題ファイル | UC 一覧 / 実行の記録 (events / done / 退避した done) / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ④ UC の縦切り | ② 決定 | 要求、決定 (NFR・ADR)、基盤の設定、ティアの実装、文書の入口と課題ファイル | UC 一覧 / ADR / 依存方向の検査設定、qlty 設定 / ティアの実装と単体テスト / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| ④ UC の縦切り | ③ 基盤 | 要求、決定 (NFR・ADR)、基盤の設定、契約、実行の記録、文書の入口と課題ファイル | UC 一覧 / ADR / 依存方向の検査設定、qlty 設定 / 契約の分割ファイル、契約テスト (生成物) / ゲートの記録 / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| 起動時の移行 (UC の外。0.1.x の残りを片付ける) | ① 要求 | 実行の記録、文書の入口と課題ファイル | 実行の記録 (events / done / 退避した done) / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| 起動時の移行 (UC の外。0.1.x の残りを片付ける) | ② 決定 | 文書の入口と課題ファイル | 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| 起動時の移行 (UC の外。0.1.x の残りを片付ける) | ③ 基盤 | 文書の入口と課題ファイル | 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |
| 起動時の移行 (UC の外。0.1.x の残りを片付ける) | ④ UC の縦切り | 実行の記録、文書の入口と課題ファイル | 実行の記録 (events / done / 退避した done) / 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) |

## 全体図: ④ 実装まで (scenario 〜 integrate)

④ の実装の段階どうしで受け渡すファイル群。後ろ向きの受け渡しは次の図の表にまとめた。① 〜 ③ から来るものは前の図。段階をまたぐ d2-run の作業 (ゲートの実行・as-built の抽出・main マージなど) はほぼ全部のファイル群に触れるので、この図から外して処理ごとの図に回した。

```mermaid
flowchart LR
  st_scenario["④ scenario"]
  st_contract["④ contract"]
  st_scaffold["④ scaffold"]
  st_tier["④ tier"]
  st_integrate["④ integrate"]
  st_scenario -->|"シナリオと step"| st_contract
  st_scenario -->|"シナリオと step"| st_scaffold
  st_scenario -->|"シナリオと step"| st_tier
  st_scenario -->|"シナリオと step"| st_integrate
  st_contract -->|"契約"| st_scaffold
  st_contract -->|"契約"| st_tier
  st_contract -->|"契約"| st_integrate
  st_scaffold -->|"ティアの実装"| st_tier
  st_scaffold -->|"シナリオと step・ティアの実装"| st_integrate
  st_tier -->|"ティアの実装"| st_integrate
```

| 書く段階 | 読む段階 | 受け渡すファイル群 | 受け渡すファイル |
|---|---|---|---|
| ④ scenario | ④ contract | シナリオと step | UC シナリオ |
| ④ scenario | ④ scaffold | シナリオと step | UC シナリオ、受入シナリオ |
| ④ scenario | ④ tier | シナリオと step | UC シナリオ |
| ④ scenario | ④ integrate | シナリオと step | UC シナリオ |
| ④ contract | ④ scaffold | 契約 | UC の契約 slice |
| ④ contract | ④ tier | 契約 | UC の契約 slice、契約からの codegen |
| ④ contract | ④ integrate | 契約 | UC の契約 slice、契約からの codegen |
| ④ scaffold | ④ tier | ティアの実装 | ティアの実装と単体テスト |
| ④ scaffold | ④ integrate | シナリオと step、ティアの実装 | step 定義 / ティアの実装と単体テスト |
| ④ tier | ④ integrate | ティアの実装 | ティアの実装と単体テスト |

## 全体図: ④ 検証と as-built

実装までの段階が書き、検証 (verify) と as-built の要約 (asbuilt) が読むファイル群。表の後ろ向きの受け渡しは ④ の段階すべてが対象。① 〜 ③ から来るものは前の図。段階をまたぐ d2-run の作業 (ゲートの実行・as-built の抽出・main マージなど) はほぼ全部のファイル群に触れるので、この図から外して処理ごとの図に回した。

```mermaid
flowchart LR
  st_scenario["④ scenario"]
  st_contract["④ contract"]
  st_scaffold["④ scaffold"]
  st_tier["④ tier"]
  st_integrate["④ integrate"]
  st_verify["④ verify"]
  st_asbuilt["④ asbuilt"]
  st_scenario -->|"シナリオと step"| st_verify
  st_scenario -->|"シナリオと step"| st_asbuilt
  st_contract -->|"契約"| st_verify
  st_contract -->|"契約・実行の記録"| st_asbuilt
  st_scaffold -->|"ティアの実装・実行の記録"| st_verify
  st_scaffold -->|"ティアの実装・実行の記録"| st_asbuilt
  st_tier -->|"ティアの実装・実行の記録"| st_verify
  st_tier -->|"ティアの実装・実行の記録"| st_asbuilt
  st_integrate -->|"実行の記録"| st_verify
  st_integrate -->|"実行の記録"| st_asbuilt
  st_verify -->|"実行の記録"| st_asbuilt
```

| 書く段階 | 読む段階 | 受け渡すファイル群 | 受け渡すファイル |
|---|---|---|---|
| ④ scenario | ④ verify | シナリオと step | UC シナリオ |
| ④ scenario | ④ asbuilt | シナリオと step | UC シナリオ |
| ④ contract | ④ verify | 契約 | UC ごとの契約の索引、UC の契約 slice |
| ④ contract | ④ asbuilt | 契約、実行の記録 | 契約の分割ファイル、UC の契約 slice / 仕様起因の課題 |
| ④ scaffold | ④ verify | ティアの実装、実行の記録 | ティアの実装と単体テスト / ゲートの記録 |
| ④ scaffold | ④ asbuilt | ティアの実装、実行の記録 | ティアの実装と単体テスト / ゲートの記録 |
| ④ tier | ④ verify | ティアの実装、実行の記録 | ティアの実装と単体テスト / 実装者が補った前提 |
| ④ tier | ④ asbuilt | ティアの実装、実行の記録 | ティアの実装と単体テスト / 実装者が補った前提、ティア実装者の課題 |
| ④ integrate | ④ verify | 実行の記録 | ゲートの記録、計装トレース |
| ④ integrate | ④ asbuilt | 実行の記録 | ゲートの記録、計装トレース |
| ④ verify | ④ asbuilt | 実行の記録 | Verifier の指摘 |

後ろ向きの受け渡し (後の段階が書き戻し、次の UC や再実行で前の段階が読む。図には描かない):

| 書く段階 | 読む段階 | 受け渡すファイル群 | 受け渡すファイル |
|---|---|---|---|
| ④ integrate | ④ scaffold | テスト基盤、シナリオと step | Cucumber の support / step 定義 |
| ④ verify | ④ tier | 実行の記録 | Verifier の指摘 |
| ④ asbuilt | ④ verify | 実行の記録、as-built | ゲートの記録 / システム横断の as-built |

## 処理ごとの図

ファイルが 8 を超える処理は、図ではファイル群にまとめた。正確なパスは図の下の表にある。

### ① 要求

#### 要求の整理

```mermaid
flowchart LR
  p_requirements["要求の整理<br/>d2-requirements"]
  s_request_text[("要望テキスト<br/>#lt;要望テキスト#gt;")]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_req_review[("要求の確認材料<br/>docs/requirements/_review-summary.md")]
  s_request_text --> p_requirements
  s_feedback_docs --> p_requirements
  p_requirements --> s_req_usdm
  p_requirements --> s_req_rdra
  p_requirements --> s_use_cases
  p_requirements --> s_req_review
```

| 読む | 書く |
|---|---|
| `<要望テキスト>`<br>`docs/feedback/**` | `docs/requirements/requirements.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/use-cases.yaml`<br>`docs/requirements/_review-summary.md` |

#### 要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)

```mermaid
flowchart LR
  p_run_req_diff["要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)<br/>importUi.js / validateScreens.js / runGates.js / genUseCases.js / runState.js"]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_run_events[("実行の記録 (events / done / 退避した done)<br/>#lt;run#gt;/events.jsonl")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_design[("デザインシステム (Storybook アプリ)<br/>docs/design/**")]
  s_ui[("画面部品<br/>packages/ui/**")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_run_archive[("やり直した UC の前の run (runState.js reopen が移す。0.1.35)<br/>.distillery/archive/runs/#lt;slug#gt;/**")]
  s_feedback_docs --> p_run_req_diff
  s_run_events --> p_run_req_diff
  s_use_cases --> p_run_req_diff
  s_design --> p_run_req_diff
  p_run_req_diff --> s_feedback_docs
  p_run_req_diff --> s_use_cases
  p_run_req_diff --> s_run_events
  p_run_req_diff --> s_ui
  p_run_req_diff --> s_reports
  p_run_req_diff --> s_run_archive
```

| 読む | 書く |
|---|---|
| `docs/feedback/**`<br>`<run>/events.jsonl`<br>`docs/requirements/use-cases.yaml`<br>`docs/design/**` | `docs/feedback/**`<br>`docs/requirements/use-cases.yaml`<br>`<run>/events.jsonl`<br>`packages/ui/**`<br>`<run>/reports/**`<br>`.distillery/archive/runs/<slug>/**` |

#### 要求の差分の画面の見本 (項目のファイル (stories と部品) だけを直す)

```mermaid
flowchart LR
  p_design_feedback["要求の差分の画面の見本 (項目のファイル (stories と部品) だけを直す)<br/>d2-design mode=feedback"]
  s_design[("デザインシステム (Storybook アプリ)<br/>docs/design/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_design --> p_design_feedback
  s_use_cases --> p_design_feedback
  p_design_feedback --> s_design
```

| 読む | 書く |
|---|---|
| `docs/design/**`<br>`docs/requirements/use-cases.yaml` | `docs/design/**` |

### ② 決定

#### 品質特性と設計の決定

```mermaid
flowchart LR
  p_decide["品質特性と設計の決定<br/>d2-decide"]
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_nfr[("非機能要求グレード表<br/>docs/nfr/**")]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_adr_review[("決定の確認材料<br/>docs/adr/_review-summary.md")]
  s_req_usdm --> p_decide
  s_req_rdra --> p_decide
  s_use_cases --> p_decide
  p_decide --> s_nfr
  p_decide --> s_adr
  p_decide --> s_adr_review
```

| 読む | 書く |
|---|---|
| `docs/requirements/requirements.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/use-cases.yaml` | `docs/nfr/**`<br>`docs/adr/*.md`<br>`docs/adr/_review-summary.md` |

#### d2-run (① ②)

```mermaid
flowchart LR
  p_run_early["d2-run (① ②)<br/>d2-run"]
  s_req_review[("要求の確認材料<br/>docs/requirements/_review-summary.md")]
  s_adr_review[("決定の確認材料<br/>docs/adr/_review-summary.md")]
  s_req_review --> p_run_early
  s_adr_review --> p_run_early
```

| 読む | 書く |
|---|---|
| `docs/requirements/_review-summary.md`<br>`docs/adr/_review-summary.md` | — |

#### 文書の入口の更新 (① ②)

```mermaid
flowchart LR
  p_run_early_docs_readme["文書の入口の更新 (① ②)<br/>genDocsReadme.js"]
  g_settings[("基盤の設定<br/>実行設定・開発ルール")]
  g_requirements[("要求<br/>RDRA モデル・要求 (USDM)・UC 一覧")]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ")]
  g_contracts[("契約<br/>契約カタログ・UC ごとの契約の索引")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)")]
  g_asbuilt[("as-built<br/>システム横断の as-built・UC の as-built")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR・非機能要求グレード表")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)・文書の入口・課題の一覧 (genDocsReadme が課題ファイルから生成。0 件なら消す)")]
  g_settings --> p_run_early_docs_readme
  g_requirements --> p_run_early_docs_readme
  g_scenarios --> p_run_early_docs_readme
  g_contracts --> p_run_early_docs_readme
  g_design --> p_run_early_docs_readme
  g_asbuilt --> p_run_early_docs_readme
  g_decisions --> p_run_early_docs_readme
  g_docs --> p_run_early_docs_readme
  p_run_early_docs_readme --> g_docs
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/use-cases.yaml`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`contracts/contracts.json`<br>`contracts/uc-index.yaml`<br>`docs/design/**`<br>`docs/as-built/_system/**`<br>`docs/as-built/<業務>/<UC>/**`<br>`docs/adr/*.md`<br>`docs/nfr/**`<br>`docs/rules/**`<br>`docs/feedback/**` | `docs/README.md`<br>`docs/feedback/README.md` |

#### 決定の差分の ADR

```mermaid
flowchart LR
  p_decide_feedback["決定の差分の ADR<br/>d2-decide mode=feedback"]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_decide_result[("決定の差分の派遣の結果 (applied / blocked。gitignore)<br/>.distillery/logs/decide-#lt;issue#gt;.result.json")]
  s_feedback_docs --> p_decide_feedback
  s_adr --> p_decide_feedback
  p_decide_feedback --> s_adr
  p_decide_feedback --> s_decide_result
```

| 読む | 書く |
|---|---|
| `docs/feedback/**`<br>`docs/adr/*.md` | `docs/adr/*.md`<br>`.distillery/logs/decide-<issue>.result.json` |

#### 決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)

```mermaid
flowchart LR
  p_run_decide_diff["決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)<br/>validateAdr.js / genAdrIndex.js / genRules.js / genArchTests.js / runGates.js / feedbackBatch.js / runState.js"]
  g_run[("実行の記録<br/>決定の差分の派遣の結果 (applied / blocked。gitignore)・ゲートの記録・やり直した UC の前の run (runState.js reopen が移す。0.1.35)")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR")]
  g_packaged[("同梱のひな形と手順書<br/>ルールのひな形 (同梱)")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)")]
  g_settings[("基盤の設定<br/>実行設定・リポの骨格 (package.json・apps/*・packages/*)・依存の lockfile・qlty 設定・依存方向の検査設定・開発ルール")]
  g_code[("ティアの実装<br/>ティアの実装と単体テスト")]
  g_requirements[("要求<br/>UC 一覧")]
  g_run --> p_run_decide_diff
  g_decisions --> p_run_decide_diff
  g_packaged --> p_run_decide_diff
  g_docs --> p_run_decide_diff
  g_settings --> p_run_decide_diff
  g_code --> p_run_decide_diff
  g_requirements --> p_run_decide_diff
  p_run_decide_diff --> g_decisions
  p_run_decide_diff --> g_settings
  p_run_decide_diff --> g_run
  p_run_decide_diff --> g_docs
  p_run_decide_diff --> g_requirements
```

| 読む | 書く |
|---|---|
| `.distillery/logs/decide-<issue>.result.json`<br>`docs/adr/*.md`<br>`<skills>/d2-foundation/references/rule-templates/**`<br>`docs/feedback/**`<br>`.distillery/config.yaml`<br>`package.json`<br>`package-lock.json`<br>`.qlty/qlty.toml`<br>`apps/<tier>/src/**`<br>`.dependency-cruiser.cjs`<br>`docs/requirements/use-cases.yaml` | `docs/adr/*.md`<br>`docs/rules/**`<br>`.dependency-cruiser.cjs`<br>`<run>/reports/**`<br>`docs/feedback/**`<br>`docs/requirements/use-cases.yaml`<br>`.distillery/archive/runs/<slug>/**` |

### ③ 基盤

#### 基盤の生成 (F1→F2→F3→F5→F7)

```mermaid
flowchart LR
  p_foundation["基盤の生成 (F1→F2→F3→F5→F7)<br/>d2-foundation"]
  g_decisions[("決定 (NFR・ADR)<br/>ADR")]
  g_packaged[("同梱のひな形と手順書<br/>ルールのひな形 (同梱)・テスト基盤のひな形 (同梱)")]
  g_contracts[("契約<br/>契約カタログ")]
  g_settings[("基盤の設定<br/>実行設定・リポの骨格 (package.json・apps/*・packages/*)・依存の lockfile・qlty 設定・開発ルール・依存方向の検査設定・Cucumber 設定・Cucumber の ESM ローダ (cucumber.js が読む)・CI")]
  g_test_infra[("テスト基盤<br/>テスト基盤 (tracer・World)・Cucumber の support")]
  g_decisions --> p_foundation
  g_packaged --> p_foundation
  g_contracts --> p_foundation
  g_settings --> p_foundation
  p_foundation --> g_settings
  p_foundation --> g_test_infra
```

| 読む | 書く |
|---|---|
| `docs/adr/*.md`<br>`<skills>/d2-foundation/references/rule-templates/**`<br>`<skills>/d2-foundation/templates/**`<br>`contracts/contracts.json`<br>`.distillery/config.yaml`<br>`package.json`<br>`package-lock.json`<br>`.qlty/qlty.toml` | `docs/rules/**`<br>`.dependency-cruiser.cjs`<br>`packages/test-support/**`<br>`features/support/**`<br>`cucumber.js`<br>`tsx-register.js`<br>`.distillery/config.yaml`<br>`package.json`<br>`.github/workflows/**`<br>`.qlty/qlty.toml`<br>`package-lock.json` |

| 内訳 | 読む | 書く |
|---|---|---|
| F1 ルール | ADR、ルールのひな形 (同梱) | 開発ルール |
| F2 依存方向の検査 | ADR | 依存方向の検査設定 |
| F3 テスト基盤 | テスト基盤のひな形 (同梱) | テスト基盤 (tracer・World)、Cucumber の support、Cucumber 設定、Cucumber の ESM ローダ (cucumber.js が読む) |
| F5 設定・骨格・CI・qlty | ADR、契約カタログ、実行設定 | 実行設定、リポの骨格 (package.json・apps/*・packages/*)、CI、qlty 設定 |
| F7 依存の導入 (npm install・qlty の提案) | リポの骨格 (package.json・apps/*・packages/*)、依存の lockfile、qlty 設定 | 依存の lockfile、qlty 設定 |

#### 契約の骨格

```mermaid
flowchart LR
  p_contract_skeleton["契約の骨格<br/>d2-contract mode=skeleton"]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_contracts_catalog[("契約カタログ<br/>contracts/contracts.json")]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_adr --> p_contract_skeleton
  p_contract_skeleton --> s_contracts_catalog
  p_contract_skeleton --> s_contracts_src
  p_contract_skeleton --> s_uc_index
```

| 読む | 書く |
|---|---|
| `docs/adr/*.md` | `contracts/contracts.json`<br>`contracts/**`<br>`contracts/uc-index.yaml` |

#### デザインシステムの生成

```mermaid
flowchart LR
  p_design["デザインシステムの生成<br/>d2-design"]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_nfr[("非機能要求グレード表<br/>docs/nfr/**")]
  s_design[("デザインシステム (Storybook アプリ)<br/>docs/design/**")]
  s_req_rdra --> p_design
  s_use_cases --> p_design
  s_adr --> p_design
  s_nfr --> p_design
  p_design --> s_design
```

| 読む | 書く |
|---|---|
| `docs/requirements/rdra/**`<br>`docs/requirements/use-cases.yaml`<br>`docs/adr/*.md`<br>`docs/nfr/**` | `docs/design/**` |

#### 基盤の仕上げ (F8→F6→F7→F4→F9)

```mermaid
flowchart LR
  p_foundation_finish["基盤の仕上げ (F8→F6→F7→F4→F9)<br/>d2-foundation"]
  g_decisions[("決定 (NFR・ADR)<br/>ADR・C4 図 (決定から)")]
  g_contracts[("契約<br/>契約カタログ・契約の分割ファイル・契約テスト (生成物)・契約からの codegen")]
  g_requirements[("要求<br/>RDRA モデル")]
  g_settings[("基盤の設定<br/>実行設定・リポの骨格 (package.json・apps/*・packages/*)・依存の lockfile・qlty 設定・依存方向の検査設定・CI")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)・画面部品")]
  g_run[("実行の記録<br/>ゲートの記録")]
  g_decisions --> p_foundation_finish
  g_contracts --> p_foundation_finish
  g_requirements --> p_foundation_finish
  g_settings --> p_foundation_finish
  g_design --> p_foundation_finish
  g_run --> p_foundation_finish
  p_foundation_finish --> g_settings
  p_foundation_finish --> g_decisions
  p_foundation_finish --> g_design
  p_foundation_finish --> g_contracts
  p_foundation_finish --> g_run
```

| 読む | 書く |
|---|---|
| `docs/adr/*.md`<br>`contracts/contracts.json`<br>`docs/requirements/rdra/**`<br>`.distillery/config.yaml`<br>`docs/design/**`<br>`package.json`<br>`package-lock.json`<br>`.qlty/qlty.toml`<br>`contracts/**`<br>`apps/*/test/contract/**`<br>`.dependency-cruiser.cjs`<br>`<run>/reports/**` | `.distillery/config.yaml`<br>`.github/workflows/**`<br>`docs/adr/architecture.md`<br>`packages/ui/**`<br>`package-lock.json`<br>`.qlty/qlty.toml`<br>`apps/*/test/contract/**`<br>`packages/contracts/**`<br>`<run>/reports/**` |

| 内訳 | 読む | 書く |
|---|---|---|
| F8 契約込みの再生成 (設定・CI・C4 図) | ADR、契約カタログ、RDRA モデル、実行設定 | 実行設定、CI、C4 図 (決定から) |
| F6 画面部品の取り込み | デザインシステム (Storybook アプリ) | 画面部品 |
| F7 依存の導入 (F6 の後) | リポの骨格 (package.json・apps/*・packages/*)、依存の lockfile、qlty 設定 | 依存の lockfile、qlty 設定 |
| F4 契約テストの生成 (骨格分) | 契約の分割ファイル、実行設定 | 契約テスト (生成物)、契約からの codegen |
| F9 基盤のチェックポイント | 実行設定、リポの骨格 (package.json・apps/*・packages/*)、qlty 設定、契約テスト (生成物)、依存方向の検査設定、ゲートの記録 | ゲートの記録 |

#### d2-run (③)

```mermaid
flowchart LR
  p_run_foundation["d2-run (③)<br/>d2-run"]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_config --> p_run_foundation
  s_reports --> p_run_foundation
  p_run_foundation --> s_reports
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`<run>/reports/**` | `<run>/reports/**` |

#### 骨格分の契約テストの鮮度 (受理時の検査)

```mermaid
flowchart LR
  p_run_foundation_check_contract_tests["骨格分の契約テストの鮮度 (受理時の検査)<br/>genContractTests.js"]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_contract_tests[("契約テスト (生成物)<br/>apps/*/test/contract/**")]
  s_contracts_code[("契約からの codegen<br/>packages/contracts/**")]
  s_contracts_src --> p_run_foundation_check_contract_tests
  s_config --> p_run_foundation_check_contract_tests
  s_contract_tests --> p_run_foundation_check_contract_tests
  s_contracts_code --> p_run_foundation_check_contract_tests
```

| 読む | 書く |
|---|---|
| `contracts/**`<br>`.distillery/config.yaml`<br>`apps/*/test/contract/**`<br>`packages/contracts/**` | — |

#### 文書の入口の更新 (③)

```mermaid
flowchart LR
  p_run_foundation_docs_readme["文書の入口の更新 (③)<br/>genDocsReadme.js"]
  g_settings[("基盤の設定<br/>実行設定・開発ルール")]
  g_requirements[("要求<br/>RDRA モデル・要求 (USDM)・UC 一覧")]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ")]
  g_contracts[("契約<br/>契約カタログ・UC ごとの契約の索引")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)")]
  g_asbuilt[("as-built<br/>システム横断の as-built・UC の as-built")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR・非機能要求グレード表")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)・文書の入口・課題の一覧 (genDocsReadme が課題ファイルから生成。0 件なら消す)")]
  g_settings --> p_run_foundation_docs_readme
  g_requirements --> p_run_foundation_docs_readme
  g_scenarios --> p_run_foundation_docs_readme
  g_contracts --> p_run_foundation_docs_readme
  g_design --> p_run_foundation_docs_readme
  g_asbuilt --> p_run_foundation_docs_readme
  g_decisions --> p_run_foundation_docs_readme
  g_docs --> p_run_foundation_docs_readme
  p_run_foundation_docs_readme --> g_docs
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/use-cases.yaml`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`contracts/contracts.json`<br>`contracts/uc-index.yaml`<br>`docs/design/**`<br>`docs/as-built/_system/**`<br>`docs/as-built/<業務>/<UC>/**`<br>`docs/adr/*.md`<br>`docs/nfr/**`<br>`docs/rules/**`<br>`docs/feedback/**` | `docs/README.md`<br>`docs/feedback/README.md` |

#### 基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避)

```mermaid
flowchart LR
  p_run_foundation_diff["基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避)<br/>runState.js"]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_run_archive[("やり直した UC の前の run (runState.js reopen が移す。0.1.35)<br/>.distillery/archive/runs/#lt;slug#gt;/**")]
  s_feedback_docs --> p_run_foundation_diff
  s_config --> p_run_foundation_diff
  s_reports --> p_run_foundation_diff
  s_use_cases --> p_run_foundation_diff
  p_run_foundation_diff --> s_feedback_docs
  p_run_foundation_diff --> s_reports
  p_run_foundation_diff --> s_use_cases
  p_run_foundation_diff --> s_run_archive
```

| 読む | 書く |
|---|---|
| `docs/feedback/**`<br>`.distillery/config.yaml`<br>`<run>/reports/**`<br>`docs/requirements/use-cases.yaml` | `docs/feedback/**`<br>`<run>/reports/**`<br>`docs/requirements/use-cases.yaml`<br>`.distillery/archive/runs/<slug>/**` |

### ④ scenario

#### UC シナリオの執筆

```mermaid
flowchart LR
  p_implement_scenario["UC シナリオの執筆<br/>d2-implement mode=scenario"]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_rules[("開発ルール<br/>docs/rules/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_acceptance[("受入シナリオ<br/>features/acceptance/**")]
  s_use_cases --> p_implement_scenario
  s_req_usdm --> p_implement_scenario
  s_req_rdra --> p_implement_scenario
  s_rules --> p_implement_scenario
  s_feature --> p_implement_scenario
  p_implement_scenario --> s_feature
  p_implement_scenario --> s_acceptance
```

| 読む | 書く |
|---|---|
| `docs/requirements/use-cases.yaml`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/rdra/**`<br>`docs/rules/**`<br>`features/<業務>/<slug>.feature` | `features/<業務>/<slug>.feature`<br>`features/acceptance/**` |

### ④ contract

#### 契約の差分

```mermaid
flowchart LR
  p_contract_uc["契約の差分<br/>d2-contract mode=uc"]
  g_requirements[("要求<br/>UC 一覧・RDRA モデル")]
  g_scenarios[("シナリオと step<br/>UC シナリオ")]
  g_contracts[("契約<br/>契約の分割ファイル・UC ごとの契約の索引・UC の契約 slice・契約テスト (生成物)・DB migration (datastore_owner のティア)・契約からの codegen")]
  g_run[("実行の記録<br/>仕様起因の課題")]
  g_requirements --> p_contract_uc
  g_scenarios --> p_contract_uc
  g_contracts --> p_contract_uc
  p_contract_uc --> g_contracts
  p_contract_uc --> g_run
```

| 読む | 書く |
|---|---|
| `docs/requirements/use-cases.yaml`<br>`features/<業務>/<slug>.feature`<br>`docs/requirements/rdra/**`<br>`contracts/**` | `contracts/**`<br>`contracts/uc-index.yaml`<br>`contracts/generated/slices/<slug>/**`<br>`apps/*/test/contract/**`<br>`apps/<tier>/migrations/**`<br>`packages/contracts/**`<br>`<run>/issues/**` |

### ④ scaffold

#### テスト足場の生成

```mermaid
flowchart LR
  p_implement_scaffold["テスト足場の生成<br/>d2-implement mode=scaffold"]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ・step 定義")]
  g_test_infra[("テスト基盤<br/>Cucumber の support・テスト基盤 (tracer・World)")]
  g_contracts[("契約<br/>UC の契約 slice")]
  g_settings[("基盤の設定<br/>開発ルール・実行設定")]
  g_code[("ティアの実装<br/>ティアの実装と単体テスト")]
  g_run[("実行の記録<br/>ゲートの記録")]
  g_scenarios --> p_implement_scaffold
  g_test_infra --> p_implement_scaffold
  g_contracts --> p_implement_scaffold
  g_settings --> p_implement_scaffold
  p_implement_scaffold --> g_scenarios
  p_implement_scaffold --> g_code
  p_implement_scaffold --> g_run
```

| 読む | 書く |
|---|---|
| `features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`features/step_definitions/**`<br>`features/support/**`<br>`packages/test-support/**`<br>`contracts/generated/slices/<slug>/**`<br>`docs/rules/**`<br>`.distillery/config.yaml` | `features/step_definitions/**`<br>`apps/<tier>/src/**`<br>`<run>/reports/**` |

### ④ tier

#### ティアの実装

```mermaid
flowchart LR
  p_implement_tier["ティアの実装<br/>d2-implement mode=tier<br/>(ティアごとに並列)"]
  g_settings[("基盤の設定<br/>開発ルール")]
  g_scenarios[("シナリオと step<br/>UC シナリオ")]
  g_contracts[("契約<br/>UC の契約 slice・契約からの codegen・DB migration (datastore_owner のティア)")]
  g_requirements[("要求<br/>UC 一覧・要求 (USDM)・RDRA モデル")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)・画面部品")]
  g_code[("ティアの実装<br/>ティアの実装と単体テスト")]
  g_test_infra[("テスト基盤<br/>テスト基盤 (tracer・World)")]
  g_run[("実行の記録<br/>Verifier の指摘・実装者が補った前提・ティア実装者の課題")]
  g_settings --> p_implement_tier
  g_scenarios --> p_implement_tier
  g_contracts --> p_implement_tier
  g_requirements --> p_implement_tier
  g_design --> p_implement_tier
  g_code --> p_implement_tier
  g_test_infra --> p_implement_tier
  g_run --> p_implement_tier
  p_implement_tier --> g_code
  p_implement_tier --> g_run
  p_implement_tier --> g_contracts
```

| 読む | 書く |
|---|---|
| `docs/rules/**`<br>`features/<業務>/<slug>.feature`<br>`contracts/generated/slices/<slug>/**`<br>`packages/contracts/**`<br>`docs/requirements/use-cases.yaml`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/rdra/**`<br>`docs/design/**`<br>`packages/ui/**`<br>`apps/<tier>/src/**`<br>`packages/test-support/**`<br>`<run>/attempt-<n>/findings.<tier>.yaml` | `apps/<tier>/src/**`<br>`<run>/attempt-<n>/assumptions.<tier>.yaml`<br>`<run>/issues/<ts>_<tier>_<slug>.md`<br>`apps/<tier>/migrations/**` |

### ④ integrate

#### 結合

```mermaid
flowchart LR
  p_implement_integrate["結合<br/>d2-implement mode=integrate"]
  g_scenarios[("シナリオと step<br/>UC シナリオ・step 定義")]
  g_test_infra[("テスト基盤<br/>Cucumber の support・テスト基盤 (tracer・World)")]
  g_contracts[("契約<br/>UC の契約 slice・契約からの codegen")]
  g_code[("ティアの実装<br/>ティアの実装と単体テスト")]
  g_requirements[("要求<br/>UC 一覧")]
  g_settings[("基盤の設定<br/>実行設定")]
  g_run[("実行の記録<br/>ゲートの記録・計装トレース")]
  g_scenarios --> p_implement_integrate
  g_test_infra --> p_implement_integrate
  g_contracts --> p_implement_integrate
  g_code --> p_implement_integrate
  g_requirements --> p_implement_integrate
  g_settings --> p_implement_integrate
  p_implement_integrate --> g_scenarios
  p_implement_integrate --> g_test_infra
  p_implement_integrate --> g_run
```

| 読む | 書く |
|---|---|
| `features/<業務>/<slug>.feature`<br>`features/step_definitions/**`<br>`features/support/**`<br>`packages/test-support/**`<br>`contracts/generated/slices/<slug>/**`<br>`apps/<tier>/src/**`<br>`packages/contracts/**`<br>`docs/requirements/use-cases.yaml`<br>`.distillery/config.yaml` | `features/step_definitions/**`<br>`features/support/**`<br>`<run>/reports/**`<br>`<run>/traces/**` |

### ④ verify

#### 独立検証

```mermaid
flowchart LR
  p_verify["独立検証<br/>d2-verify<br/>(ティアごとに並列)"]
  g_run[("実行の記録<br/>ゲートの記録・計装トレース・実装者が補った前提・Verifier の指摘")]
  g_scenarios[("シナリオと step<br/>UC シナリオ")]
  g_requirements[("要求<br/>UC 一覧・要求 (USDM)・RDRA モデル")]
  g_settings[("基盤の設定<br/>開発ルール")]
  g_contracts[("契約<br/>UC の契約 slice・UC ごとの契約の索引")]
  g_code[("ティアの実装<br/>ティアの実装と単体テスト")]
  g_asbuilt[("as-built<br/>システム横断の as-built")]
  g_packaged[("同梱のひな形と手順書<br/>スキルの手順書 (同梱)")]
  g_run --> p_verify
  g_scenarios --> p_verify
  g_requirements --> p_verify
  g_settings --> p_verify
  g_contracts --> p_verify
  g_code --> p_verify
  g_asbuilt --> p_verify
  g_packaged --> p_verify
  p_verify --> g_run
```

| 読む | 書く |
|---|---|
| `<run>/reports/**`<br>`<run>/traces/**`<br>`<run>/attempt-<n>/assumptions.<tier>.yaml`<br>`features/<業務>/<slug>.feature`<br>`docs/requirements/use-cases.yaml`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/rdra/**`<br>`docs/rules/**`<br>`contracts/generated/slices/<slug>/**`<br>`apps/<tier>/src/**`<br>`contracts/uc-index.yaml`<br>`docs/as-built/_system/**`<br>`<skills>/**` | `<run>/attempt-<n>/findings.<tier>.yaml` |

### ④ asbuilt

#### as-built の抽出と要約

d2-asbuilt の派遣 1 回分。1 枚では大きすぎるので、内訳ごとに描く。派遣の単位の読み書きは内訳の和。

##### 依存グラフの実態

```mermaid
flowchart LR
  p_asbuilt_depcruise["依存グラフの実態<br/>script"]
  s_depcruise_config[("依存方向の検査設定<br/>.dependency-cruiser.cjs")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_depcruise_config --> p_asbuilt_depcruise
  s_tier_src --> p_asbuilt_depcruise
  p_asbuilt_depcruise --> s_reports
```

| 読む | 書く |
|---|---|
| `.dependency-cruiser.cjs`<br>`apps/<tier>/src/**` | `<run>/reports/**` |

##### as-built の抽出

```mermaid
flowchart LR
  p_asbuilt_extract["as-built の抽出<br/>extractAsBuilt.js"]
  g_settings[("基盤の設定<br/>実行設定")]
  g_requirements[("要求<br/>UC 一覧・要求 (USDM)")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR")]
  g_run[("実行の記録<br/>ゲートの記録・計装トレース・実装者が補った前提・Verifier の指摘・実行の記録 (events / done / 退避した done)・仕様起因の課題・ティア実装者の課題・as-built の抽出の集計 (計装の有無)")]
  g_contracts[("契約<br/>UC の契約 slice・契約の分割ファイル")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)")]
  g_scenarios[("シナリオと step<br/>UC シナリオ")]
  g_asbuilt[("as-built<br/>UC の as-built・UC の as-built の index.md (要約ブロックを含む)・システム横断の as-built")]
  g_settings --> p_asbuilt_extract
  g_requirements --> p_asbuilt_extract
  g_decisions --> p_asbuilt_extract
  g_run --> p_asbuilt_extract
  g_contracts --> p_asbuilt_extract
  g_design --> p_asbuilt_extract
  g_scenarios --> p_asbuilt_extract
  g_asbuilt --> p_asbuilt_extract
  p_asbuilt_extract --> g_asbuilt
  p_asbuilt_extract --> g_run
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`docs/requirements/use-cases.yaml`<br>`docs/requirements/requirements.yaml`<br>`docs/adr/*.md`<br>`<run>/reports/**`<br>`<run>/traces/**`<br>`<run>/attempt-<n>/assumptions.<tier>.yaml`<br>`<run>/attempt-<n>/findings.<tier>.yaml`<br>`<run>/events.jsonl`<br>`<run>/issues/**`<br>`<run>/issues/<ts>_<tier>_<slug>.md`<br>`contracts/generated/slices/<slug>/**`<br>`contracts/**`<br>`docs/design/**`<br>`features/<業務>/<slug>.feature`<br>`docs/as-built/<業務>/<UC>/**`<br>`docs/as-built/<業務>/<UC>/index.md`<br>`docs/as-built/_system/**` | `docs/as-built/<業務>/<UC>/**`<br>`docs/as-built/<業務>/<UC>/index.md`<br>`docs/as-built/_system/**`<br>`<run>/reports/asbuilt.json` |

##### 要約ブロックを埋める (LLM)

```mermaid
flowchart LR
  p_asbuilt_summarize["要約ブロックを埋める (LLM)<br/>d2-asbuilt"]
  s_asbuilt_index[("UC の as-built の index.md (要約ブロックを含む)<br/>docs/as-built/#lt;業務#gt;/#lt;UC#gt;/index.md")]
  s_assumptions[("実装者が補った前提<br/>#lt;run#gt;/attempt-#lt;n#gt;/assumptions.#lt;tier#gt;.yaml")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_issues_asbuilt[("as-built の要約役の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_asbuilt_#lt;slug#gt;.md")]
  s_asbuilt_index --> p_asbuilt_summarize
  s_assumptions --> p_asbuilt_summarize
  s_tier_src --> p_asbuilt_summarize
  p_asbuilt_summarize --> s_asbuilt_index
  p_asbuilt_summarize --> s_issues_asbuilt
```

| 読む | 書く |
|---|---|
| `docs/as-built/<業務>/<UC>/index.md`<br>`<run>/attempt-<n>/assumptions.<tier>.yaml`<br>`apps/<tier>/src/**` | `docs/as-built/<業務>/<UC>/index.md`<br>`<run>/issues/<ts>_asbuilt_<slug>.md` |

##### 要約の書式の検査

```mermaid
flowchart LR
  p_asbuilt_check["要約の書式の検査<br/>checkAsBuilt.js"]
  s_asbuilt_index[("UC の as-built の index.md (要約ブロックを含む)<br/>docs/as-built/#lt;業務#gt;/#lt;UC#gt;/index.md")]
  s_asbuilt_index --> p_asbuilt_check
```

| 読む | 書く |
|---|---|
| `docs/as-built/<業務>/<UC>/index.md` | — |

### 起動時の移行 (UC の外。0.1.x の残りを片付ける)

#### 次に何をするかを決める (起動時の自動選択。読むだけ)

```mermaid
flowchart LR
  p_run_next_action["次に何をするかを決める (起動時の自動選択。読むだけ)<br/>nextAction.js"]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_run_events[("実行の記録 (events / done / 退避した done)<br/>#lt;run#gt;/events.jsonl")]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_decisions_upstream[("決めたことの記録 (上流の段)<br/>.distillery/decisions.jsonl")]
  s_resume_journal[("写し直しの処理の記録 (gitignore。途中で止まったら続きから行う)<br/>.distillery/logs/resume-#lt;slug#gt;.json")]
  s_run_archive[("やり直した UC の前の run (runState.js reopen が移す。0.1.35)<br/>.distillery/archive/runs/#lt;slug#gt;/**")]
  s_use_cases --> p_run_next_action
  s_adr --> p_run_next_action
  s_config --> p_run_next_action
  s_run_events --> p_run_next_action
  s_feedback_docs --> p_run_next_action
  s_decisions_upstream --> p_run_next_action
  s_resume_journal --> p_run_next_action
  s_run_archive --> p_run_next_action
```

| 読む | 書く |
|---|---|
| `docs/requirements/use-cases.yaml`<br>`docs/adr/*.md`<br>`.distillery/config.yaml`<br>`<run>/events.jsonl`<br>`docs/feedback/**`<br>`.distillery/decisions.jsonl`<br>`.distillery/logs/resume-<slug>.json`<br>`.distillery/archive/runs/<slug>/**` | — |

#### 旧形式の run の課題を課題ファイルにする (起動時の移行)

```mermaid
flowchart LR
  p_run_migrate_issues["旧形式の run の課題を課題ファイルにする (起動時の移行)<br/>feedbackBatch.js"]
  s_issues[("仕様起因の課題<br/>#lt;run#gt;/issues/**")]
  s_issues_tier[("ティア実装者の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_#lt;tier#gt;_#lt;slug#gt;.md")]
  s_issues_asbuilt[("as-built の要約役の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_asbuilt_#lt;slug#gt;.md")]
  s_run_events[("実行の記録 (events / done / 退避した done)<br/>#lt;run#gt;/events.jsonl")]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_issues --> p_run_migrate_issues
  s_issues_tier --> p_run_migrate_issues
  s_issues_asbuilt --> p_run_migrate_issues
  s_run_events --> p_run_migrate_issues
  p_run_migrate_issues --> s_feedback_docs
  p_run_migrate_issues --> s_run_events
```

| 読む | 書く |
|---|---|
| `<run>/issues/**`<br>`<run>/issues/<ts>_<tier>_<slug>.md`<br>`<run>/issues/<ts>_asbuilt_<slug>.md`<br>`<run>/events.jsonl` | `docs/feedback/**`<br>`<run>/events.jsonl` |

#### 文書の入口の更新 (起動時の移行)

```mermaid
flowchart LR
  p_run_migrate_readme["文書の入口の更新 (起動時の移行)<br/>genDocsReadme.js"]
  g_settings[("基盤の設定<br/>実行設定・開発ルール")]
  g_requirements[("要求<br/>RDRA モデル・要求 (USDM)・UC 一覧")]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ")]
  g_contracts[("契約<br/>契約カタログ・UC ごとの契約の索引")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)")]
  g_asbuilt[("as-built<br/>システム横断の as-built・UC の as-built")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR・非機能要求グレード表")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)・文書の入口・課題の一覧 (genDocsReadme が課題ファイルから生成。0 件なら消す)")]
  g_settings --> p_run_migrate_readme
  g_requirements --> p_run_migrate_readme
  g_scenarios --> p_run_migrate_readme
  g_contracts --> p_run_migrate_readme
  g_design --> p_run_migrate_readme
  g_asbuilt --> p_run_migrate_readme
  g_decisions --> p_run_migrate_readme
  g_docs --> p_run_migrate_readme
  p_run_migrate_readme --> g_docs
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/use-cases.yaml`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`contracts/contracts.json`<br>`contracts/uc-index.yaml`<br>`docs/design/**`<br>`docs/as-built/_system/**`<br>`docs/as-built/<業務>/<UC>/**`<br>`docs/adr/*.md`<br>`docs/nfr/**`<br>`docs/rules/**`<br>`docs/feedback/**` | `docs/README.md`<br>`docs/feedback/README.md` |

#### 途中で止まった還流のバッチの片付け (起動時の移行)

```mermaid
flowchart LR
  p_run_migrate_batch["途中で止まった還流のバッチの片付け (起動時の移行)<br/>feedbackBatch.js"]
  s_feedback_batch[("0.1.x の還流のバッチの状態 (途中で止まったものを起動時に片付けるだけ。gitignore)<br/>.distillery/logs/feedback/#lt;b#gt;/**")]
  s_worktrees[("作業用の worktree (上流で止めるときの一時のもの。0.1.x の還流の worktree は片付けるだけ。gitignore)<br/>.distillery/worktrees/**")]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_feedback_batch --> p_run_migrate_batch
  s_worktrees --> p_run_migrate_batch
  s_feedback_docs --> p_run_migrate_batch
  p_run_migrate_batch --> s_feedback_batch
  p_run_migrate_batch --> s_worktrees
```

| 読む | 書く |
|---|---|
| `.distillery/logs/feedback/<b>/**`<br>`.distillery/worktrees/**`<br>`docs/feedback/**` | `.distillery/logs/feedback/<b>/**`<br>`.distillery/worktrees/**` |

### どの段でも (引き継ぎファイル・決めたことの記録・縦横レビュー)

#### 引き継ぎファイルを書く (派遣したすべての担当。検証役は findings が代わり)

```mermaid
flowchart LR
  p_handoff_write["引き継ぎファイルを書く (派遣したすべての担当。検証役は findings が代わり)<br/>派遣した担当"]
  s_skill_docs[("スキルの手順書 (同梱)<br/>#lt;skills#gt;/**")]
  s_handoff_run[("引き継ぎファイル (機能の中。人に聞くこと・前のステップの課題・反証)<br/>#lt;run#gt;/handoff/**")]
  s_handoff_upstream[("引き継ぎファイル (上流の段: ①②③・上流の差分)<br/>.distillery/handoff/**")]
  s_skill_docs --> p_handoff_write
  p_handoff_write --> s_handoff_run
  p_handoff_write --> s_handoff_upstream
```

| 読む | 書く |
|---|---|
| `<skills>/**` | `<run>/handoff/**`<br>`.distillery/handoff/**` |

#### レビューの指摘を反証して直す (レビューした場所の担当を派遣し直す)

```mermaid
flowchart LR
  p_refute["レビューの指摘を反証して直す (レビューした場所の担当を派遣し直す)<br/>subagent"]
  s_reviews_run[("縦・横レビューの依頼文と結果 (機能の中)<br/>#lt;run#gt;/reviews/**")]
  s_reviews_upstream[("縦・横レビューの依頼文と結果 (上流の段)<br/>.distillery/reviews/**")]
  s_reviews_run --> p_refute
  s_reviews_upstream --> p_refute
```

| 読む | 書く |
|---|---|
| `<run>/reviews/**`<br>`.distillery/reviews/**` | — |

#### 引き継ぎファイルの検査・振り分け・課題の下書き

```mermaid
flowchart LR
  p_run_handoff["引き継ぎファイルの検査・振り分け・課題の下書き<br/>handoff.js"]
  s_handoff_run[("引き継ぎファイル (機能の中。人に聞くこと・前のステップの課題・反証)<br/>#lt;run#gt;/handoff/**")]
  s_handoff_upstream[("引き継ぎファイル (上流の段: ①②③・上流の差分)<br/>.distillery/handoff/**")]
  s_findings[("Verifier の指摘<br/>#lt;run#gt;/attempt-#lt;n#gt;/findings.#lt;tier#gt;.yaml")]
  s_issues[("仕様起因の課題<br/>#lt;run#gt;/issues/**")]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_handoff_run --> p_run_handoff
  s_handoff_upstream --> p_run_handoff
  s_findings --> p_run_handoff
  p_run_handoff --> s_issues
  p_run_handoff --> s_feedback_docs
```

| 読む | 書く |
|---|---|
| `<run>/handoff/**`<br>`.distillery/handoff/**`<br>`<run>/attempt-<n>/findings.<tier>.yaml` | `<run>/issues/**`<br>`docs/feedback/**` |

#### 決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと)

```mermaid
flowchart LR
  p_run_decisions["決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと)<br/>decisionLog.js"]
  s_handoff_run[("引き継ぎファイル (機能の中。人に聞くこと・前のステップの課題・反証)<br/>#lt;run#gt;/handoff/**")]
  s_handoff_upstream[("引き継ぎファイル (上流の段: ①②③・上流の差分)<br/>.distillery/handoff/**")]
  s_decisions_run[("決めたことの記録 (機能の中)<br/>#lt;run#gt;/decisions.jsonl")]
  s_decisions_upstream[("決めたことの記録 (上流の段)<br/>.distillery/decisions.jsonl")]
  s_run_archive[("やり直した UC の前の run (runState.js reopen が移す。0.1.35)<br/>.distillery/archive/runs/#lt;slug#gt;/**")]
  s_handoff_run --> p_run_decisions
  s_handoff_upstream --> p_run_decisions
  s_decisions_run --> p_run_decisions
  s_decisions_upstream --> p_run_decisions
  s_run_archive --> p_run_decisions
  p_run_decisions --> s_decisions_run
  p_run_decisions --> s_decisions_upstream
```

| 読む | 書く |
|---|---|
| `<run>/handoff/**`<br>`.distillery/handoff/**`<br>`<run>/decisions.jsonl`<br>`.distillery/decisions.jsonl`<br>`.distillery/archive/runs/<slug>/**` | `<run>/decisions.jsonl`<br>`.distillery/decisions.jsonl` |

#### 縦・横レビュー (上流の段: 要求・決定・基盤)

```mermaid
flowchart LR
  p_run_review_upstream["縦・横レビュー (上流の段: 要求・決定・基盤)<br/>reviewStep.js"]
  g_packaged[("同梱のひな形と手順書<br/>スキルの手順書 (同梱)")]
  g_requirements[("要求<br/>要求 (USDM)・RDRA モデル・UC 一覧")]
  g_decisions[("決定 (NFR・ADR)<br/>非機能要求グレード表・ADR")]
  g_settings[("基盤の設定<br/>開発ルール・実行設定")]
  g_contracts[("契約<br/>契約の分割ファイル")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)")]
  g_records[("進行の記録 (引き継ぎ・決めたこと・レビュー)<br/>縦・横レビューの依頼文と結果 (上流の段)")]
  g_packaged --> p_run_review_upstream
  g_requirements --> p_run_review_upstream
  g_decisions --> p_run_review_upstream
  g_settings --> p_run_review_upstream
  g_contracts --> p_run_review_upstream
  g_design --> p_run_review_upstream
  g_records --> p_run_review_upstream
  p_run_review_upstream --> g_records
```

| 読む | 書く |
|---|---|
| `<skills>/**`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/use-cases.yaml`<br>`docs/nfr/**`<br>`docs/adr/*.md`<br>`docs/rules/**`<br>`contracts/**`<br>`docs/design/**`<br>`.distillery/config.yaml`<br>`.distillery/reviews/**` | `.distillery/reviews/**` |

#### 縦・横レビュー (機能の中: シナリオ・契約・実装・as-built)

```mermaid
flowchart LR
  p_run_review_run["縦・横レビュー (機能の中: シナリオ・契約・実装・as-built)<br/>reviewStep.js"]
  s_skill_docs[("スキルの手順書 (同梱)<br/>#lt;skills#gt;/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_acceptance[("受入シナリオ<br/>features/acceptance/**")]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_asbuilt_uc[("UC の as-built<br/>docs/as-built/#lt;業務#gt;/#lt;UC#gt;/**")]
  s_asbuilt_system[("システム横断の as-built<br/>docs/as-built/_system/**")]
  s_reviews_run[("縦・横レビューの依頼文と結果 (機能の中)<br/>#lt;run#gt;/reviews/**")]
  s_skill_docs --> p_run_review_run
  s_feature --> p_run_review_run
  s_acceptance --> p_run_review_run
  s_contracts_src --> p_run_review_run
  s_tier_src --> p_run_review_run
  s_asbuilt_uc --> p_run_review_run
  s_asbuilt_system --> p_run_review_run
  s_reviews_run --> p_run_review_run
  p_run_review_run --> s_reviews_run
```

| 読む | 書く |
|---|---|
| `<skills>/**`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`contracts/**`<br>`apps/<tier>/src/**`<br>`docs/as-built/<業務>/<UC>/**`<br>`docs/as-built/_system/**`<br>`<run>/reviews/**` | `<run>/reviews/**` |

### ④ 段階をまたぐ d2-run の作業

#### d2-run (④)

```mermaid
flowchart LR
  p_run_uc["d2-run (④)<br/>d2-run"]
  g_settings[("基盤の設定<br/>実行設定")]
  g_requirements[("要求<br/>UC 一覧")]
  g_run[("実行の記録<br/>実行の記録 (events / done / 退避した done)・ゲートの記録・as-built の抽出の集計 (計装の有無)・Verifier の指摘・実装者が補った前提・仕様起因の課題・ティア実装者の課題・as-built の要約役の課題・やり直した UC の前の run (runState.js reopen が移す。0.1.35)・作業用の worktree (上流で止めるときの一時のもの。0.1.x の還流の worktree は片付けるだけ。gitignore)・その場で巻き戻して直した課題の下書き (runState.js rewind が移す。課題ファイルにしない)")]
  g_contracts[("契約<br/>UC ごとの契約の索引")]
  g_asbuilt[("as-built<br/>システム横断の as-built")]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)")]
  g_settings --> p_run_uc
  g_requirements --> p_run_uc
  g_run --> p_run_uc
  g_contracts --> p_run_uc
  g_asbuilt --> p_run_uc
  g_scenarios --> p_run_uc
  p_run_uc --> g_run
  p_run_uc --> g_requirements
  p_run_uc --> g_docs
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`docs/requirements/use-cases.yaml`<br>`<run>/events.jsonl`<br>`<run>/reports/**`<br>`<run>/reports/asbuilt.json`<br>`<run>/attempt-<n>/findings.<tier>.yaml`<br>`<run>/attempt-<n>/assumptions.<tier>.yaml`<br>`<run>/issues/**`<br>`<run>/issues/<ts>_<tier>_<slug>.md`<br>`<run>/issues/<ts>_asbuilt_<slug>.md`<br>`contracts/uc-index.yaml`<br>`docs/as-built/_system/**`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`.distillery/archive/runs/<slug>/**` | `<run>/events.jsonl`<br>`docs/requirements/use-cases.yaml`<br>`<run>/reports/asbuilt.json`<br>`<run>/issues/<ts>_asbuilt_<slug>.md`<br>`docs/feedback/**`<br>`.distillery/worktrees/**`<br>`<run>/issues/consumed/**`<br>`.distillery/archive/runs/<slug>/**` |

#### シナリオの静的確認

```mermaid
flowchart LR
  p_run_uc_check_scenario["シナリオの静的確認<br/>checkScenario.js"]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_acceptance[("受入シナリオ<br/>features/acceptance/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_feature --> p_run_uc_check_scenario
  s_acceptance --> p_run_uc_check_scenario
  s_use_cases --> p_run_uc_check_scenario
  s_req_usdm --> p_run_uc_check_scenario
```

| 読む | 書く |
|---|---|
| `features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`docs/requirements/use-cases.yaml`<br>`docs/requirements/requirements.yaml` | — |

#### 契約の bundle の鮮度 (--check)

```mermaid
flowchart LR
  p_run_uc_compile_contracts["契約の bundle の鮮度 (--check)<br/>compileContracts.js"]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_contracts_src --> p_run_uc_compile_contracts
```

| 読む | 書く |
|---|---|
| `contracts/**` | — |

#### RDB スキーマの鮮度 (--check)

```mermaid
flowchart LR
  p_run_uc_compile_rdb["RDB スキーマの鮮度 (--check)<br/>compileRdbSchema.js"]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_contracts_src --> p_run_uc_compile_rdb
```

| 読む | 書く |
|---|---|
| `contracts/**` | — |

#### UC の契約の索引の検査

```mermaid
flowchart LR
  p_run_uc_validate_uc_index["UC の契約の索引の検査<br/>validateUcIndex.js"]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_uc_index --> p_run_uc_validate_uc_index
  s_contracts_src --> p_run_uc_validate_uc_index
```

| 読む | 書く |
|---|---|
| `contracts/uc-index.yaml`<br>`contracts/**` | — |

#### 契約の変更の分類

```mermaid
flowchart LR
  p_run_uc_classify["契約の変更の分類<br/>classifyContractChanges.js"]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_contract_tests[("契約テスト (生成物)<br/>apps/*/test/contract/**")]
  s_contracts_code[("契約からの codegen<br/>packages/contracts/**")]
  s_migrations[("DB migration (datastore_owner のティア)<br/>apps/#lt;tier#gt;/migrations/**")]
  s_contract_slice[("UC の契約 slice<br/>contracts/generated/slices/#lt;slug#gt;/**")]
  s_uc_index --> p_run_uc_classify
  s_contract_tests --> p_run_uc_classify
  s_contracts_code --> p_run_uc_classify
  s_migrations --> p_run_uc_classify
  s_contract_slice --> p_run_uc_classify
```

| 読む | 書く |
|---|---|
| `contracts/uc-index.yaml`<br>`apps/*/test/contract/**`<br>`packages/contracts/**`<br>`apps/<tier>/migrations/**`<br>`contracts/generated/slices/<slug>/**` | — |

#### ゲートの実行

```mermaid
flowchart LR
  p_run_uc_gates["ゲートの実行<br/>runGates.js"]
  g_settings[("基盤の設定<br/>実行設定・リポの骨格 (package.json・apps/*・packages/*)・依存の lockfile・Cucumber 設定・Cucumber の ESM ローダ (cucumber.js が読む)・qlty 設定・依存方向の検査設定")]
  g_code[("ティアの実装<br/>ティアの実装と単体テスト")]
  g_contracts[("契約<br/>契約テスト (生成物)・DB migration (datastore_owner のティア)")]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ・step 定義")]
  g_test_infra[("テスト基盤<br/>Cucumber の support")]
  g_run[("実行の記録<br/>ゲートの記録・計装トレース")]
  g_settings --> p_run_uc_gates
  g_code --> p_run_uc_gates
  g_contracts --> p_run_uc_gates
  g_scenarios --> p_run_uc_gates
  g_test_infra --> p_run_uc_gates
  g_run --> p_run_uc_gates
  p_run_uc_gates --> g_run
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`package.json`<br>`package-lock.json`<br>`cucumber.js`<br>`tsx-register.js`<br>`.qlty/qlty.toml`<br>`apps/<tier>/src/**`<br>`apps/*/test/contract/**`<br>`apps/<tier>/migrations/**`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`features/step_definitions/**`<br>`features/support/**`<br>`.dependency-cruiser.cjs`<br>`<run>/reports/**` | `<run>/reports/**`<br>`<run>/traces/**` |

#### qlty の提案を足す (④)

```mermaid
flowchart LR
  p_run_uc_qlty["qlty の提案を足す (④)<br/>genQlty.js"]
  s_skeleton[("リポの骨格 (package.json・apps/*・packages/*)<br/>package.json")]
  s_lockfile[("依存の lockfile<br/>package-lock.json")]
  s_qlty_config[("qlty 設定<br/>.qlty/qlty.toml")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_skeleton --> p_run_uc_qlty
  s_lockfile --> p_run_uc_qlty
  s_qlty_config --> p_run_uc_qlty
  s_tier_src --> p_run_uc_qlty
  p_run_uc_qlty --> s_qlty_config
```

| 読む | 書く |
|---|---|
| `package.json`<br>`package-lock.json`<br>`.qlty/qlty.toml`<br>`apps/<tier>/src/**` | `.qlty/qlty.toml` |

#### as-built の書式の検査

```mermaid
flowchart LR
  p_run_uc_check_asbuilt["as-built の書式の検査<br/>checkAsBuilt.js"]
  s_asbuilt_index[("UC の as-built の index.md (要約ブロックを含む)<br/>docs/as-built/#lt;業務#gt;/#lt;UC#gt;/index.md")]
  s_asbuilt_index --> p_run_uc_check_asbuilt
```

| 読む | 書く |
|---|---|
| `docs/as-built/<業務>/<UC>/index.md` | — |

#### 文書の入口の更新 (④)

```mermaid
flowchart LR
  p_run_uc_docs_readme["文書の入口の更新 (④)<br/>genDocsReadme.js"]
  g_settings[("基盤の設定<br/>実行設定・開発ルール")]
  g_requirements[("要求<br/>RDRA モデル・要求 (USDM)・UC 一覧")]
  g_scenarios[("シナリオと step<br/>UC シナリオ・受入シナリオ")]
  g_contracts[("契約<br/>契約カタログ・UC ごとの契約の索引")]
  g_design[("画面<br/>デザインシステム (Storybook アプリ)")]
  g_asbuilt[("as-built<br/>システム横断の as-built・UC の as-built")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR・非機能要求グレード表")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)・文書の入口・課題の一覧 (genDocsReadme が課題ファイルから生成。0 件なら消す)")]
  g_settings --> p_run_uc_docs_readme
  g_requirements --> p_run_uc_docs_readme
  g_scenarios --> p_run_uc_docs_readme
  g_contracts --> p_run_uc_docs_readme
  g_design --> p_run_uc_docs_readme
  g_asbuilt --> p_run_uc_docs_readme
  g_decisions --> p_run_uc_docs_readme
  g_docs --> p_run_uc_docs_readme
  p_run_uc_docs_readme --> g_docs
```

| 読む | 書く |
|---|---|
| `.distillery/config.yaml`<br>`docs/requirements/rdra/**`<br>`docs/requirements/requirements.yaml`<br>`docs/requirements/use-cases.yaml`<br>`features/<業務>/<slug>.feature`<br>`features/acceptance/**`<br>`contracts/contracts.json`<br>`contracts/uc-index.yaml`<br>`docs/design/**`<br>`docs/as-built/_system/**`<br>`docs/as-built/<業務>/<UC>/**`<br>`docs/adr/*.md`<br>`docs/nfr/**`<br>`docs/rules/**`<br>`docs/feedback/**` | `docs/README.md`<br>`docs/feedback/README.md` |

#### main マージ (squash して main へ取り込む)

```mermaid
flowchart LR
  p_run_uc_deliver["main マージ (squash して main へ取り込む)<br/>prTrailers.js"]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_run_events[("実行の記録 (events / done / 退避した done)<br/>#lt;run#gt;/events.jsonl")]
  s_use_cases --> p_run_uc_deliver
  s_reports --> p_run_uc_deliver
  s_run_events --> p_run_uc_deliver
  p_run_uc_deliver --> s_reports
  p_run_uc_deliver --> s_use_cases
```

| 読む | 書く |
|---|---|
| `docs/requirements/use-cases.yaml`<br>`<run>/reports/**`<br>`<run>/events.jsonl` | `<run>/reports/**`<br>`docs/requirements/use-cases.yaml` |

#### UC の課題を課題ファイルにする (main マージの squash の前)

```mermaid
flowchart LR
  p_run_uc_file_issues["UC の課題を課題ファイルにする (main マージの squash の前)<br/>feedbackBatch.js"]
  s_issues[("仕様起因の課題<br/>#lt;run#gt;/issues/**")]
  s_issues_tier[("ティア実装者の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_#lt;tier#gt;_#lt;slug#gt;.md")]
  s_issues_asbuilt[("as-built の要約役の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_asbuilt_#lt;slug#gt;.md")]
  s_run_events[("実行の記録 (events / done / 退避した done)<br/>#lt;run#gt;/events.jsonl")]
  s_feedback_docs[("課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)<br/>docs/feedback/**")]
  s_issues --> p_run_uc_file_issues
  s_issues_tier --> p_run_uc_file_issues
  s_issues_asbuilt --> p_run_uc_file_issues
  s_run_events --> p_run_uc_file_issues
  p_run_uc_file_issues --> s_feedback_docs
  p_run_uc_file_issues --> s_run_events
```

| 読む | 書く |
|---|---|
| `<run>/issues/**`<br>`<run>/issues/<ts>_<tier>_<slug>.md`<br>`<run>/issues/<ts>_asbuilt_<slug>.md`<br>`<run>/events.jsonl` | `docs/feedback/**`<br>`<run>/events.jsonl` |

#### 上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)

```mermaid
flowchart LR
  p_run_resume["上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)<br/>resumeAfterUpstream.js"]
  g_run[("実行の記録<br/>実行の記録 (events / done / 退避した done)・写し直しの処理の記録 (gitignore。途中で止まったら続きから行う)・写し直しで統合できなかった機能側の差分 (担当が反映するか取り下げる)")]
  g_docs[("文書の入口と課題ファイル<br/>課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成)・文書の入口・課題の一覧 (genDocsReadme が課題ファイルから生成。0 件なら消す)")]
  g_records[("進行の記録 (引き継ぎ・決めたこと・レビュー)<br/>引き継ぎファイル (機能の中。人に聞くこと・前のステップの課題・反証)・縦・横レビューの依頼文と結果 (機能の中)")]
  g_contracts[("契約<br/>契約の分割ファイル・契約テスト (生成物)")]
  g_settings[("基盤の設定<br/>開発ルール・依存方向の検査設定")]
  g_decisions[("決定 (NFR・ADR)<br/>ADR")]
  g_run --> p_run_resume
  g_docs --> p_run_resume
  g_records --> p_run_resume
  p_run_resume --> g_run
  p_run_resume --> g_records
  p_run_resume --> g_contracts
  p_run_resume --> g_settings
  p_run_resume --> g_decisions
  p_run_resume --> g_docs
```

| 読む | 書く |
|---|---|
| `<run>/events.jsonl`<br>`docs/feedback/**`<br>`.distillery/logs/resume-<slug>.json`<br>`<run>/resume/**`<br>`<run>/handoff/**` | `<run>/events.jsonl`<br>`<run>/resume/**`<br>`.distillery/logs/resume-<slug>.json`<br>`<run>/reviews/**`<br>`contracts/**`<br>`apps/*/test/contract/**`<br>`docs/rules/**`<br>`.dependency-cruiser.cjs`<br>`docs/adr/*.md`<br>`docs/README.md`<br>`docs/feedback/README.md` |

## ファイルの一覧

| ファイル | ファイル群 | パス | 由来 | 書く処理 | 読む処理 |
|---|---|---|---|---|---|
| 要望テキスト | 要望 (外部入力) | `<要望テキスト>` | 外部入力 | — | 要求の整理 |
| ルールのひな形 (同梱) | 同梱のひな形と手順書 | `<skills>/d2-foundation/references/rule-templates/**` | プラグイン同梱 | — | 基盤の生成 (F1→F2→F3→F5→F7)、F1 ルール、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避) |
| テスト基盤のひな形 (同梱) | 同梱のひな形と手順書 | `<skills>/d2-foundation/templates/**` | プラグイン同梱 | — | 基盤の生成 (F1→F2→F3→F5→F7)、F3 テスト基盤 |
| スキルの手順書 (同梱) | 同梱のひな形と手順書 | `<skills>/**` | プラグイン同梱 | — | 独立検証、引き継ぎファイルを書く (派遣したすべての担当。検証役は findings が代わり)、縦・横レビュー (上流の段: 要求・決定・基盤)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| 要求 (USDM) | 要求 | `docs/requirements/requirements.yaml` | 生成 | 要求の整理 | 品質特性と設計の決定、UC シナリオの執筆、ティアの実装、独立検証、as-built の抽出と要約、as-built の抽出、文書の入口の更新 (① ②)、文書の入口の更新 (③)、シナリオの静的確認、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| RDRA モデル | 要求 | `docs/requirements/rdra/**` | 生成 | 要求の整理 | 品質特性と設計の決定、デザインシステムの生成、基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図)、UC シナリオの執筆、契約の差分、ティアの実装、独立検証、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| UC 一覧 | 要求 | `docs/requirements/use-cases.yaml` | 生成 | 要求の整理、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、d2-run (④)、main マージ (squash して main へ取り込む)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避) | 品質特性と設計の決定、デザインシステムの生成、UC シナリオの執筆、契約の差分、ティアの実装、結合、独立検証、as-built の抽出と要約、as-built の抽出、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、要求の差分の画面の見本 (項目のファイル (stories と部品) だけを直す)、文書の入口の更新 (① ②)、文書の入口の更新 (③)、d2-run (④)、シナリオの静的確認、文書の入口の更新 (④)、main マージ (squash して main へ取り込む)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避)、次に何をするかを決める (起動時の自動選択。読むだけ)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| 要求の確認材料 | 要求 | `docs/requirements/_review-summary.md` | 生成 | 要求の整理 | d2-run (① ②) |
| 非機能要求グレード表 | 決定 (NFR・ADR) | `docs/nfr/**` | 生成 | 品質特性と設計の決定 | デザインシステムの生成、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| ADR | 決定 (NFR・ADR) | `docs/adr/*.md` | 生成 | 品質特性と設計の決定、決定の差分の ADR、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | 基盤の生成 (F1→F2→F3→F5→F7)、F1 ルール、F2 依存方向の検査、F5 設定・骨格・CI・qlty、契約の骨格、デザインシステムの生成、基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図)、as-built の抽出と要約、as-built の抽出、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、決定の差分の ADR、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、次に何をするかを決める (起動時の自動選択。読むだけ)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| C4 図 (決定から) | 決定 (NFR・ADR) | `docs/adr/architecture.md` | 生成 (最終成果物) | 基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図) | — |
| 決定の確認材料 | 決定 (NFR・ADR) | `docs/adr/_review-summary.md` | 生成 | 品質特性と設計の決定 | d2-run (① ②) |
| 開発ルール | 基盤の設定 | `docs/rules/**` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F1 ルール、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | UC シナリオの執筆、テスト足場の生成、ティアの実装、独立検証、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| 依存方向の検査設定 | 基盤の設定 | `.dependency-cruiser.cjs` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F2 依存方向の検査、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | 基盤の仕上げ (F8→F6→F7→F4→F9)、F9 基盤のチェックポイント、as-built の抽出と要約、依存グラフの実態、ゲートの実行、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避) |
| テスト基盤 (tracer・World) | テスト基盤 | `packages/test-support/**` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F3 テスト基盤 | テスト足場の生成、ティアの実装、結合 |
| Cucumber の support | テスト基盤 | `features/support/**` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F3 テスト基盤、結合 | テスト足場の生成、結合、ゲートの実行 |
| Cucumber 設定 | 基盤の設定 | `cucumber.js` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F3 テスト基盤 | ゲートの実行 |
| Cucumber の ESM ローダ (cucumber.js が読む) | 基盤の設定 | `tsx-register.js` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F3 テスト基盤 | ゲートの実行 |
| 実行設定 | 基盤の設定 | `.distillery/config.yaml` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F5 設定・骨格・CI・qlty、基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図) | 基盤の生成 (F1→F2→F3→F5→F7)、F5 設定・骨格・CI・qlty、基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図)、F4 契約テストの生成 (骨格分)、F9 基盤のチェックポイント、テスト足場の生成、結合、as-built の抽出と要約、as-built の抽出、文書の入口の更新 (① ②)、d2-run (③)、骨格分の契約テストの鮮度 (受理時の検査)、文書の入口の更新 (③)、d2-run (④)、ゲートの実行、文書の入口の更新 (④)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避)、次に何をするかを決める (起動時の自動選択。読むだけ)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| リポの骨格 (package.json・apps/*・packages/*) | 基盤の設定 | `package.json` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F5 設定・骨格・CI・qlty | 基盤の生成 (F1→F2→F3→F5→F7)、F7 依存の導入 (npm install・qlty の提案)、基盤の仕上げ (F8→F6→F7→F4→F9)、F7 依存の導入 (F6 の後)、F9 基盤のチェックポイント、ゲートの実行、qlty の提案を足す (④)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避) |
| 依存の lockfile | 基盤の設定 | `package-lock.json` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F7 依存の導入 (npm install・qlty の提案)、基盤の仕上げ (F8→F6→F7→F4→F9)、F7 依存の導入 (F6 の後) | 基盤の生成 (F1→F2→F3→F5→F7)、F7 依存の導入 (npm install・qlty の提案)、基盤の仕上げ (F8→F6→F7→F4→F9)、F7 依存の導入 (F6 の後)、ゲートの実行、qlty の提案を足す (④)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避) |
| CI | 基盤の設定 | `.github/workflows/**` | 生成 (最終成果物) | 基盤の生成 (F1→F2→F3→F5→F7)、F5 設定・骨格・CI・qlty、基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図) | — |
| qlty 設定 | 基盤の設定 | `.qlty/qlty.toml` | 生成 | 基盤の生成 (F1→F2→F3→F5→F7)、F5 設定・骨格・CI・qlty、F7 依存の導入 (npm install・qlty の提案)、基盤の仕上げ (F8→F6→F7→F4→F9)、F7 依存の導入 (F6 の後)、qlty の提案を足す (④) | 基盤の生成 (F1→F2→F3→F5→F7)、F7 依存の導入 (npm install・qlty の提案)、基盤の仕上げ (F8→F6→F7→F4→F9)、F7 依存の導入 (F6 の後)、F9 基盤のチェックポイント、ゲートの実行、qlty の提案を足す (④)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避) |
| 契約カタログ | 契約 | `contracts/contracts.json` | 生成 | 契約の骨格 | 基盤の生成 (F1→F2→F3→F5→F7)、F5 設定・骨格・CI・qlty、基盤の仕上げ (F8→F6→F7→F4→F9)、F8 契約込みの再生成 (設定・CI・C4 図)、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行) |
| 契約の分割ファイル | 契約 | `contracts/**` | 生成 | 契約の骨格、契約の差分、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | 基盤の仕上げ (F8→F6→F7→F4→F9)、F4 契約テストの生成 (骨格分)、契約の差分、as-built の抽出と要約、as-built の抽出、骨格分の契約テストの鮮度 (受理時の検査)、契約の bundle の鮮度 (--check)、RDB スキーマの鮮度 (--check)、UC の契約の索引の検査、縦・横レビュー (上流の段: 要求・決定・基盤)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| UC ごとの契約の索引 | 契約 | `contracts/uc-index.yaml` | 生成 | 契約の骨格、契約の差分 | 独立検証、文書の入口の更新 (① ②)、文書の入口の更新 (③)、d2-run (④)、UC の契約の索引の検査、契約の変更の分類、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行) |
| UC の契約 slice | 契約 | `contracts/generated/slices/<slug>/**` | 生成 | 契約の差分 | テスト足場の生成、ティアの実装、結合、独立検証、as-built の抽出と要約、as-built の抽出、契約の変更の分類 |
| 契約テスト (生成物) | 契約 | `apps/*/test/contract/**` | 生成 | 基盤の仕上げ (F8→F6→F7→F4→F9)、F4 契約テストの生成 (骨格分)、契約の差分、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | 基盤の仕上げ (F8→F6→F7→F4→F9)、F9 基盤のチェックポイント、骨格分の契約テストの鮮度 (受理時の検査)、契約の変更の分類、ゲートの実行 |
| DB migration (datastore_owner のティア) | 契約 | `apps/<tier>/migrations/**` | 生成 | 契約の差分、ティアの実装 | 契約の変更の分類、ゲートの実行 |
| 契約からの codegen | 契約 | `packages/contracts/**` | 生成 | 基盤の仕上げ (F8→F6→F7→F4→F9)、F4 契約テストの生成 (骨格分)、契約の差分 | ティアの実装、結合、骨格分の契約テストの鮮度 (受理時の検査)、契約の変更の分類 |
| デザインシステム (Storybook アプリ) | 画面 | `docs/design/**` | 生成 | デザインシステムの生成、要求の差分の画面の見本 (項目のファイル (stories と部品) だけを直す) | 基盤の仕上げ (F8→F6→F7→F4→F9)、F6 画面部品の取り込み、ティアの実装、as-built の抽出と要約、as-built の抽出、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、要求の差分の画面の見本 (項目のファイル (stories と部品) だけを直す)、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| 画面部品 | 画面 | `packages/ui/**` | 生成 | 基盤の仕上げ (F8→F6→F7→F4→F9)、F6 画面部品の取り込み、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避) | ティアの実装 |
| UC シナリオ | シナリオと step | `features/<業務>/<slug>.feature` | 生成 | UC シナリオの執筆 | UC シナリオの執筆、契約の差分、テスト足場の生成、ティアの実装、結合、独立検証、as-built の抽出と要約、as-built の抽出、文書の入口の更新 (① ②)、文書の入口の更新 (③)、d2-run (④)、シナリオの静的確認、ゲートの実行、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| 受入シナリオ | シナリオと step | `features/acceptance/**` | 生成 | UC シナリオの執筆 | テスト足場の生成、文書の入口の更新 (① ②)、文書の入口の更新 (③)、d2-run (④)、シナリオの静的確認、ゲートの実行、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| step 定義 | シナリオと step | `features/step_definitions/**` | 生成 | テスト足場の生成、結合 | テスト足場の生成、結合、ゲートの実行 |
| ティアの実装と単体テスト | ティアの実装 | `apps/<tier>/src/**` | 生成 | テスト足場の生成、ティアの実装 | ティアの実装、結合、独立検証、as-built の抽出と要約、依存グラフの実態、要約ブロックを埋める (LLM)、ゲートの実行、qlty の提案を足す (④)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| 実行の記録 (events / done / 退避した done) | 実行の記録 | `<run>/events.jsonl` | 生成 | 要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、d2-run (④)、UC の課題を課題ファイルにする (main マージの squash の前)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、旧形式の run の課題を課題ファイルにする (起動時の移行) | as-built の抽出と要約、as-built の抽出、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、d2-run (④)、main マージ (squash して main へ取り込む)、UC の課題を課題ファイルにする (main マージの squash の前)、次に何をするかを決める (起動時の自動選択。読むだけ)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、旧形式の run の課題を課題ファイルにする (起動時の移行) |
| やり直した UC の前の run (runState.js reopen が移す。0.1.35) | 実行の記録 | `.distillery/archive/runs/<slug>/**` | 生成 | 要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、d2-run (④)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避) | d2-run (④)、次に何をするかを決める (起動時の自動選択。読むだけ)、決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) |
| 実装者が補った前提 | 実行の記録 | `<run>/attempt-<n>/assumptions.<tier>.yaml` | 生成 | ティアの実装 | 独立検証、as-built の抽出と要約、as-built の抽出、要約ブロックを埋める (LLM)、d2-run (④) |
| Verifier の指摘 | 実行の記録 | `<run>/attempt-<n>/findings.<tier>.yaml` | 生成 | 独立検証 | ティアの実装、as-built の抽出と要約、as-built の抽出、d2-run (④)、引き継ぎファイルの検査・振り分け・課題の下書き |
| 仕様起因の課題 | 実行の記録 | `<run>/issues/**` | 生成 | 契約の差分、引き継ぎファイルの検査・振り分け・課題の下書き | as-built の抽出と要約、as-built の抽出、d2-run (④)、UC の課題を課題ファイルにする (main マージの squash の前)、旧形式の run の課題を課題ファイルにする (起動時の移行) |
| ティア実装者の課題 | 実行の記録 | `<run>/issues/<ts>_<tier>_<slug>.md` | 生成 | ティアの実装 | as-built の抽出と要約、as-built の抽出、d2-run (④)、UC の課題を課題ファイルにする (main マージの squash の前)、旧形式の run の課題を課題ファイルにする (起動時の移行) |
| as-built の要約役の課題 | 実行の記録 | `<run>/issues/<ts>_asbuilt_<slug>.md` | 生成 | as-built の抽出と要約、要約ブロックを埋める (LLM)、d2-run (④) | d2-run (④)、UC の課題を課題ファイルにする (main マージの squash の前)、旧形式の run の課題を課題ファイルにする (起動時の移行) |
| その場で巻き戻して直した課題の下書き (runState.js rewind が移す。課題ファイルにしない) | 実行の記録 | `<run>/issues/consumed/**` | 生成 (最終成果物) | d2-run (④) | — |
| 決定の差分の派遣の結果 (applied / blocked。gitignore) | 実行の記録 | `.distillery/logs/decide-<issue>.result.json` | 生成 | 決定の差分の ADR | 決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避) |
| 0.1.x の還流のバッチの状態 (途中で止まったものを起動時に片付けるだけ。gitignore) | 実行の記録 | `.distillery/logs/feedback/<b>/**` | 生成 | 途中で止まった還流のバッチの片付け (起動時の移行) | 途中で止まった還流のバッチの片付け (起動時の移行) |
| 作業用の worktree (上流で止めるときの一時のもの。0.1.x の還流の worktree は片付けるだけ。gitignore) | 実行の記録 | `.distillery/worktrees/**` | 生成 (最終成果物) | d2-run (④)、途中で止まった還流のバッチの片付け (起動時の移行) | 途中で止まった還流のバッチの片付け (起動時の移行) |
| ゲートの記録 | 実行の記録 | `<run>/reports/**` | 生成 | 基盤の仕上げ (F8→F6→F7→F4→F9)、F9 基盤のチェックポイント、テスト足場の生成、結合、as-built の抽出と要約、依存グラフの実態、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、d2-run (③)、ゲートの実行、main マージ (squash して main へ取り込む)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避) | 基盤の仕上げ (F8→F6→F7→F4→F9)、F9 基盤のチェックポイント、独立検証、as-built の抽出と要約、as-built の抽出、d2-run (③)、d2-run (④)、ゲートの実行、main マージ (squash して main へ取り込む)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避) |
| as-built の抽出の集計 (計装の有無) | 実行の記録 | `<run>/reports/asbuilt.json` | 生成 | as-built の抽出と要約、as-built の抽出、d2-run (④) | d2-run (④) |
| 計装トレース | 実行の記録 | `<run>/traces/**` | 生成 | 結合、ゲートの実行 | 独立検証、as-built の抽出と要約、as-built の抽出 |
| UC の as-built | as-built | `docs/as-built/<業務>/<UC>/**` | 生成 | as-built の抽出と要約、as-built の抽出 | as-built の抽出と要約、as-built の抽出、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| UC の as-built の index.md (要約ブロックを含む) | as-built | `docs/as-built/<業務>/<UC>/index.md` | 生成 | as-built の抽出と要約、as-built の抽出、要約ブロックを埋める (LLM) | as-built の抽出と要約、as-built の抽出、要約ブロックを埋める (LLM)、要約の書式の検査、as-built の書式の検査 |
| システム横断の as-built | as-built | `docs/as-built/_system/**` | 生成 | as-built の抽出と要約、as-built の抽出 | 独立検証、as-built の抽出と要約、as-built の抽出、文書の入口の更新 (① ②)、文書の入口の更新 (③)、d2-run (④)、文書の入口の更新 (④)、文書の入口の更新 (起動時の移行)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| 文書の入口 | 文書の入口と課題ファイル | `docs/README.md` | 生成 (最終成果物) | 文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、文書の入口の更新 (起動時の移行) | — |
| 課題ファイルと一覧 (取り込む段階が反映したら削除する。一覧 README.md は genDocsReadme が生成) | 文書の入口と課題ファイル | `docs/feedback/**` | 生成 | 要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、d2-run (④)、UC の課題を課題ファイルにする (main マージの squash の前)、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避)、旧形式の run の課題を課題ファイルにする (起動時の移行)、引き継ぎファイルの検査・振り分け・課題の下書き | 要求の整理、要求の差分の取り込み (課題ファイルの削除と feature の退避。残った作業の宛先: 画面の見本の取り込み直し・前提の記録を閉じる。やり直す UC の run の退避)、文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、決定の差分の ADR、決定の差分の取り込み (結果ファイルで受理・索引と開発ルールとアーキテストの作り直し・static・課題ファイルの削除・やり直す UC の run の退避)、基盤の差分の取り込み (受理は ③ と同じ。課題ファイルの削除・やり直す UC の run の退避)、次に何をするかを決める (起動時の自動選択。読むだけ)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、文書の入口の更新 (起動時の移行)、途中で止まった還流のバッチの片付け (起動時の移行) |
| 課題の一覧 (genDocsReadme が課題ファイルから生成。0 件なら消す) | 文書の入口と課題ファイル | `docs/feedback/README.md` | 生成 (最終成果物) | 文書の入口の更新 (① ②)、文書の入口の更新 (③)、文書の入口の更新 (④)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、文書の入口の更新 (起動時の移行) | — |
| 引き継ぎファイル (機能の中。人に聞くこと・前のステップの課題・反証) | 進行の記録 (引き継ぎ・決めたこと・レビュー) | `<run>/handoff/**` | 生成 | 引き継ぎファイルを書く (派遣したすべての担当。検証役は findings が代わり) | 上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、引き継ぎファイルの検査・振り分け・課題の下書き、決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) |
| 引き継ぎファイル (上流の段: ①②③・上流の差分) | 進行の記録 (引き継ぎ・決めたこと・レビュー) | `.distillery/handoff/**` | 生成 | 引き継ぎファイルを書く (派遣したすべての担当。検証役は findings が代わり) | 引き継ぎファイルの検査・振り分け・課題の下書き、決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) |
| 決めたことの記録 (機能の中) | 進行の記録 (引き継ぎ・決めたこと・レビュー) | `<run>/decisions.jsonl` | 生成 (最終成果物) | 決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) | 決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) |
| 決めたことの記録 (上流の段) | 進行の記録 (引き継ぎ・決めたこと・レビュー) | `.distillery/decisions.jsonl` | 生成 (最終成果物) | 決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) | 次に何をするかを決める (起動時の自動選択。読むだけ)、決めたことの記録 (推奨で決めた答え・人の答え・規則で決めたこと) |
| 縦・横レビューの依頼文と結果 (機能の中) | 進行の記録 (引き継ぎ・決めたこと・レビュー) | `<run>/reviews/**` | 生成 (最終成果物) | 上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) | レビューの指摘を反証して直す (レビューした場所の担当を派遣し直す)、縦・横レビュー (機能の中: シナリオ・契約・実装・as-built) |
| 縦・横レビューの依頼文と結果 (上流の段) | 進行の記録 (引き継ぎ・決めたこと・レビュー) | `.distillery/reviews/**` | 生成 (最終成果物) | 縦・横レビュー (上流の段: 要求・決定・基盤) | レビューの指摘を反証して直す (レビューした場所の担当を派遣し直す)、縦・横レビュー (上流の段: 要求・決定・基盤) |
| 写し直しで統合できなかった機能側の差分 (担当が反映するか取り下げる) | 実行の記録 | `<run>/resume/**` | 生成 | 上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | 上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) |
| 写し直しの処理の記録 (gitignore。途中で止まったら続きから行う) | 実行の記録 | `.distillery/logs/resume-<slug>.json` | 生成 | 上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) | 次に何をするかを決める (起動時の自動選択。読むだけ)、上流で止めた機能の写し直し (新しい main の上へ統合して続きの段から) |
