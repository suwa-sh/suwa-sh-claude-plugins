# distillery2 の処理と入出力 (DFD)

> 生成物。手で直さない。正本は [dataflow.yaml](dataflow.yaml)、生成は `scripts/genDataflow.js`。
> 整合性は `tests/distillery2/integration/dataflow.test.js` が手順書と照合する。

凡例: 箱 = 処理 (スキル・d2-run・スクリプト)、円筒 = ファイル (store)、矢印 = 読み (store → 処理) / 書き (処理 → store)。
`<run>` = `.distillery/runs/<slug>`。

## 全体図 (段階のつながり)

```mermaid
flowchart LR
  st_requirements["① 要求"]
  st_decide["② 決定"]
  st_foundation["③ 基盤"]
  st_scenario["④ scenario"]
  st_contract["④ contract"]
  st_scaffold["④ scaffold"]
  st_tier["④ tier"]
  st_contract_gate["④ contract-gate"]
  st_integrate["④ integrate"]
  st_verify["④ verify"]
  st_review["④ review"]
  st_asbuilt["④ asbuilt"]
  st_feedback["④ feedback"]
  st_deliver["④ deliver"]
  st_uc["④ 段階をまたぐ d2-run の作業"]
  st_contract --> st_integrate
  st_contract --> st_scaffold
  st_contract --> st_tier
  st_contract --> st_uc
  st_contract --> st_verify
  st_decide --> st_foundation
  st_foundation --> st_contract
  st_foundation --> st_integrate
  st_foundation --> st_scaffold
  st_foundation --> st_scenario
  st_foundation --> st_tier
  st_foundation --> st_uc
  st_foundation --> st_verify
  st_integrate --> st_scaffold
  st_integrate --> st_uc
  st_integrate --> st_verify
  st_requirements --> st_contract
  st_requirements --> st_decide
  st_requirements --> st_foundation
  st_requirements --> st_integrate
  st_requirements --> st_scenario
  st_requirements --> st_tier
  st_requirements --> st_uc
  st_requirements --> st_verify
  st_scaffold --> st_asbuilt
  st_scaffold --> st_integrate
  st_scaffold --> st_tier
  st_scaffold --> st_uc
  st_scaffold --> st_verify
  st_scenario --> st_contract
  st_scenario --> st_integrate
  st_scenario --> st_scaffold
  st_scenario --> st_tier
  st_scenario --> st_uc
  st_scenario --> st_verify
  st_tier --> st_asbuilt
  st_tier --> st_integrate
  st_tier --> st_uc
  st_tier --> st_verify
  st_uc --> st_asbuilt
  st_uc --> st_contract
  st_uc --> st_decide
  st_uc --> st_foundation
  st_uc --> st_integrate
  st_uc --> st_scenario
  st_uc --> st_tier
  st_uc --> st_verify
  st_verify --> st_tier
  st_verify --> st_uc
```

| 書く段階 | 読む段階 | 受け渡すファイル |
|---|---|---|
| ④ contract | ④ integrate | UC の契約 slice、契約からの codegen |
| ④ contract | ④ scaffold | UC の契約 slice |
| ④ contract | ④ tier | UC の契約 slice、契約からの codegen |
| ④ contract | ④ 段階をまたぐ d2-run の作業 | UC ごとの契約の索引、契約テスト (生成物)、DB migration、仕様起因の課題 |
| ④ contract | ④ verify | UC ごとの契約の索引、UC の契約 slice |
| ② 決定 | ③ 基盤 | 非機能要求グレード表、ADR |
| ③ 基盤 | ④ contract | 契約の分割ファイル |
| ③ 基盤 | ④ integrate | テスト基盤 (tracer・World)、Cucumber の support、実行設定 |
| ③ 基盤 | ④ scaffold | 開発ルール、テスト基盤 (tracer・World)、Cucumber の support、実行設定 |
| ③ 基盤 | ④ scenario | 開発ルール |
| ③ 基盤 | ④ tier | 開発ルール、テスト基盤 (tracer・World)、デザインシステム (Storybook アプリ)、画面部品 |
| ③ 基盤 | ④ 段階をまたぐ d2-run の作業 | 依存方向の検査設定、Cucumber の support、Cucumber 設定、実行設定、リポの骨格、qlty 設定、UC ごとの契約の索引、依存の lockfile、契約テスト (生成物) |
| ③ 基盤 | ④ verify | 開発ルール、UC ごとの契約の索引 |
| ④ integrate | ④ scaffold | step 定義、Cucumber の support |
| ④ integrate | ④ 段階をまたぐ d2-run の作業 | step 定義、Cucumber の support、ゲートの記録、計装トレース |
| ④ integrate | ④ verify | ゲートの記録、計装トレース |
| ① 要求 | ④ contract | RDRA モデル、UC 一覧 |
| ① 要求 | ② 決定 | 要求 (USDM)、RDRA モデル、UC 一覧、要求の確認材料 |
| ① 要求 | ③ 基盤 | RDRA モデル、UC 一覧 |
| ① 要求 | ④ integrate | UC 一覧 |
| ① 要求 | ④ scenario | 要求 (USDM)、RDRA モデル、UC 一覧 |
| ① 要求 | ④ tier | 要求 (USDM)、RDRA モデル、UC 一覧 |
| ① 要求 | ④ 段階をまたぐ d2-run の作業 | UC 一覧 |
| ① 要求 | ④ verify | 要求 (USDM)、RDRA モデル、UC 一覧 |
| ④ scaffold | ④ asbuilt | ティアの実装と単体テスト |
| ④ scaffold | ④ integrate | step 定義、ティアの実装と単体テスト |
| ④ scaffold | ④ tier | ティアの実装と単体テスト |
| ④ scaffold | ④ 段階をまたぐ d2-run の作業 | step 定義、ティアの実装と単体テスト、ゲートの記録 |
| ④ scaffold | ④ verify | ティアの実装と単体テスト、ゲートの記録 |
| ④ scenario | ④ contract | UC シナリオ |
| ④ scenario | ④ integrate | UC シナリオ |
| ④ scenario | ④ scaffold | UC シナリオ、受入シナリオ |
| ④ scenario | ④ tier | UC シナリオ |
| ④ scenario | ④ 段階をまたぐ d2-run の作業 | UC シナリオ、受入シナリオ |
| ④ scenario | ④ verify | UC シナリオ |
| ④ tier | ④ asbuilt | ティアの実装と単体テスト、実装者が補った前提 |
| ④ tier | ④ integrate | ティアの実装と単体テスト |
| ④ tier | ④ 段階をまたぐ d2-run の作業 | ティアの実装と単体テスト、実装者が補った前提、ティア実装者の課題、DB migration |
| ④ tier | ④ verify | ティアの実装と単体テスト、実装者が補った前提 |
| ④ 段階をまたぐ d2-run の作業 | ④ asbuilt | UC の as-built |
| ④ 段階をまたぐ d2-run の作業 | ④ contract | UC 一覧 |
| ④ 段階をまたぐ d2-run の作業 | ② 決定 | UC 一覧 |
| ④ 段階をまたぐ d2-run の作業 | ③ 基盤 | UC 一覧 |
| ④ 段階をまたぐ d2-run の作業 | ④ integrate | UC 一覧 |
| ④ 段階をまたぐ d2-run の作業 | ④ scenario | UC 一覧 |
| ④ 段階をまたぐ d2-run の作業 | ④ tier | UC 一覧 |
| ④ 段階をまたぐ d2-run の作業 | ④ verify | UC 一覧、ゲートの記録、計装トレース、システム横断の as-built |
| ④ verify | ④ tier | Verifier の指摘 |
| ④ verify | ④ 段階をまたぐ d2-run の作業 | Verifier の指摘 |

## 段階ごとの詳細

### ① 要求

```mermaid
flowchart LR
  s_request_text[("要望テキスト<br/>#lt;要望テキスト#gt;")]
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_req_review[("要求の確認材料<br/>docs/requirements/_review-summary.md")]
  p_requirements["要求の整理<br/>d2-requirements"]
  s_request_text --> p_requirements
  p_requirements --> s_req_usdm
  p_requirements --> s_req_rdra
  p_requirements --> s_use_cases
  p_requirements --> s_req_review
```

### ② 決定

```mermaid
flowchart LR
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_req_review[("要求の確認材料<br/>docs/requirements/_review-summary.md")]
  s_nfr[("非機能要求グレード表<br/>docs/nfr/**")]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_adr_review[("決定の確認材料<br/>docs/adr/_review-summary.md")]
  s_docs_readme[("文書の入口<br/>docs/README.md")]
  p_decide["品質特性と設計の決定<br/>d2-decide"]
  p_run_review_early["d2-run (① ② の確認と入口の更新)<br/>d2-run"]
  s_req_usdm --> p_decide
  s_req_rdra --> p_decide
  s_use_cases --> p_decide
  p_decide --> s_nfr
  p_decide --> s_adr
  p_decide --> s_adr_review
  s_req_review --> p_run_review_early
  s_adr_review --> p_run_review_early
  p_run_review_early --> s_docs_readme
```

### ③ 基盤

```mermaid
flowchart LR
  s_rule_templates[("ルールのひな形 (同梱)<br/>skills/d2-foundation/references/rule-templates/**")]
  s_support_templates[("テスト基盤のひな形 (同梱)<br/>skills/d2-foundation/templates/**")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_nfr[("非機能要求グレード表<br/>docs/nfr/**")]
  s_adr[("ADR<br/>docs/adr/*.md")]
  s_adr_architecture[("C4 図 (決定から)<br/>docs/adr/architecture.md")]
  s_rules[("開発ルール<br/>docs/rules/**")]
  s_depcruise_config[("依存方向の検査設定<br/>.dependency-cruiser.cjs")]
  s_test_support[("テスト基盤 (tracer・World)<br/>packages/test-support/**")]
  s_features_support[("Cucumber の support<br/>features/support/**")]
  s_cucumber_config[("Cucumber 設定<br/>cucumber.js")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_skeleton[("リポの骨格<br/>apps/*/")]
  s_lockfile[("依存の lockfile<br/>package-lock.json")]
  s_ci[("CI<br/>.github/workflows/**")]
  s_qlty_config[("qlty 設定<br/>.qlty/qlty.toml")]
  s_contracts_catalog[("契約カタログ<br/>contracts/contracts.json")]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_contract_tests[("契約テスト (生成物)<br/>apps/*/test/contract/**")]
  s_design[("デザインシステム (Storybook アプリ)<br/>docs/design/**")]
  s_ui[("画面部品<br/>packages/ui/**")]
  s_docs_readme[("文書の入口<br/>docs/README.md")]
  p_foundation["基盤の生成 (F1〜F5)<br/>d2-foundation"]
  p_contract_skeleton["契約の骨格<br/>d2-contract mode=skeleton"]
  p_design["デザインシステムの生成<br/>d2-design"]
  p_run_foundation["d2-run (③ の直接作業)<br/>d2-run"]
  s_adr --> p_foundation
  s_rule_templates --> p_foundation
  s_support_templates --> p_foundation
  s_contracts_catalog --> p_foundation
  p_foundation --> s_rules
  p_foundation --> s_depcruise_config
  p_foundation --> s_test_support
  p_foundation --> s_features_support
  p_foundation --> s_cucumber_config
  p_foundation --> s_config
  p_foundation --> s_skeleton
  p_foundation --> s_ci
  p_foundation --> s_qlty_config
  s_adr --> p_contract_skeleton
  p_contract_skeleton --> s_contracts_catalog
  p_contract_skeleton --> s_contracts_src
  p_contract_skeleton --> s_uc_index
  s_req_rdra --> p_design
  s_use_cases --> p_design
  s_adr --> p_design
  s_nfr --> p_design
  p_design --> s_design
  s_adr --> p_run_foundation
  s_contracts_catalog --> p_run_foundation
  s_req_rdra --> p_run_foundation
  s_design --> p_run_foundation
  p_run_foundation --> s_lockfile
  p_run_foundation --> s_config
  p_run_foundation --> s_ci
  p_run_foundation --> s_adr_architecture
  p_run_foundation --> s_qlty_config
  p_run_foundation --> s_ui
  p_run_foundation --> s_contract_tests
  p_run_foundation --> s_docs_readme
```

| 内訳 | 読む | 書く |
|---|---|---|
| F1 ルール | ADR、ルールのひな形 (同梱) | 開発ルール |
| F2 依存方向の検査 | ADR | 依存方向の検査設定 |
| F3 テスト基盤 | テスト基盤のひな形 (同梱) | テスト基盤 (tracer・World)、Cucumber の support、Cucumber 設定 |
| F4 契約テスト (d2-contract に委譲) | (契約の差分 に委譲) | — |
| F5 設定・骨格・CI・qlty | ADR、契約カタログ | 実行設定、リポの骨格、CI、qlty 設定 |
| F6 画面部品の取り込み | デザインシステム (Storybook アプリ) | 画面部品 |

### ④ scenario

```mermaid
flowchart LR
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_rules[("開発ルール<br/>docs/rules/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_acceptance[("受入シナリオ<br/>features/acceptance/**")]
  p_implement_scenario["UC シナリオの執筆<br/>d2-implement mode=scenario"]
  s_use_cases --> p_implement_scenario
  s_req_usdm --> p_implement_scenario
  s_req_rdra --> p_implement_scenario
  s_rules --> p_implement_scenario
  s_feature --> p_implement_scenario
  p_implement_scenario --> s_feature
  p_implement_scenario --> s_acceptance
```

### ④ contract

```mermaid
flowchart LR
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_contracts_src[("契約の分割ファイル<br/>contracts/**")]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_contract_slice[("UC の契約 slice<br/>contracts/generated/slices/#lt;slug#gt;/**")]
  s_contract_tests[("契約テスト (生成物)<br/>apps/*/test/contract/**")]
  s_migrations[("DB migration<br/>apps/#lt;datastore_owner#gt;/migrations/**")]
  s_contracts_code[("契約からの codegen<br/>packages/contracts/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_issues[("仕様起因の課題<br/>#lt;run#gt;/issues/**")]
  p_contract_uc["契約の差分<br/>d2-contract mode=uc"]
  s_use_cases --> p_contract_uc
  s_feature --> p_contract_uc
  s_req_rdra --> p_contract_uc
  s_contracts_src --> p_contract_uc
  p_contract_uc --> s_contracts_src
  p_contract_uc --> s_uc_index
  p_contract_uc --> s_contract_slice
  p_contract_uc --> s_contract_tests
  p_contract_uc --> s_migrations
  p_contract_uc --> s_contracts_code
  p_contract_uc --> s_issues
```

### ④ scaffold

```mermaid
flowchart LR
  s_rules[("開発ルール<br/>docs/rules/**")]
  s_test_support[("テスト基盤 (tracer・World)<br/>packages/test-support/**")]
  s_features_support[("Cucumber の support<br/>features/support/**")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_contract_slice[("UC の契約 slice<br/>contracts/generated/slices/#lt;slug#gt;/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_acceptance[("受入シナリオ<br/>features/acceptance/**")]
  s_steps[("step 定義<br/>features/step_definitions/**")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  p_implement_scaffold["テスト足場の生成<br/>d2-implement mode=scaffold"]
  s_feature --> p_implement_scaffold
  s_acceptance --> p_implement_scaffold
  s_steps --> p_implement_scaffold
  s_features_support --> p_implement_scaffold
  s_test_support --> p_implement_scaffold
  s_contract_slice --> p_implement_scaffold
  s_rules --> p_implement_scaffold
  s_config --> p_implement_scaffold
  p_implement_scaffold --> s_steps
  p_implement_scaffold --> s_tier_src
  p_implement_scaffold --> s_reports
```

### ④ tier

```mermaid
flowchart LR
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_rules[("開発ルール<br/>docs/rules/**")]
  s_test_support[("テスト基盤 (tracer・World)<br/>packages/test-support/**")]
  s_contract_slice[("UC の契約 slice<br/>contracts/generated/slices/#lt;slug#gt;/**")]
  s_migrations[("DB migration<br/>apps/#lt;datastore_owner#gt;/migrations/**")]
  s_contracts_code[("契約からの codegen<br/>packages/contracts/**")]
  s_design[("デザインシステム (Storybook アプリ)<br/>docs/design/**")]
  s_ui[("画面部品<br/>packages/ui/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_assumptions[("実装者が補った前提<br/>#lt;run#gt;/attempt-#lt;n#gt;/assumptions.#lt;tier#gt;.yaml")]
  s_findings[("Verifier の指摘<br/>#lt;run#gt;/attempt-#lt;n#gt;/findings.#lt;tier#gt;.yaml")]
  s_issues_tier[("ティア実装者の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_#lt;tier#gt;_#lt;slug#gt;.md")]
  p_implement_tier["ティアの実装<br/>d2-implement mode=tier<br/>(ティアごとに並列)"]
  s_rules --> p_implement_tier
  s_feature --> p_implement_tier
  s_contract_slice --> p_implement_tier
  s_contracts_code --> p_implement_tier
  s_use_cases --> p_implement_tier
  s_req_usdm --> p_implement_tier
  s_req_rdra --> p_implement_tier
  s_design --> p_implement_tier
  s_ui --> p_implement_tier
  s_tier_src --> p_implement_tier
  s_test_support --> p_implement_tier
  s_findings --> p_implement_tier
  p_implement_tier --> s_tier_src
  p_implement_tier --> s_assumptions
  p_implement_tier --> s_issues_tier
  p_implement_tier --> s_migrations
```

### ④ integrate

```mermaid
flowchart LR
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_test_support[("テスト基盤 (tracer・World)<br/>packages/test-support/**")]
  s_features_support[("Cucumber の support<br/>features/support/**")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_contract_slice[("UC の契約 slice<br/>contracts/generated/slices/#lt;slug#gt;/**")]
  s_contracts_code[("契約からの codegen<br/>packages/contracts/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_steps[("step 定義<br/>features/step_definitions/**")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_traces[("計装トレース<br/>#lt;run#gt;/traces/**")]
  p_implement_integrate["結合<br/>d2-implement mode=integrate"]
  s_feature --> p_implement_integrate
  s_steps --> p_implement_integrate
  s_features_support --> p_implement_integrate
  s_test_support --> p_implement_integrate
  s_contract_slice --> p_implement_integrate
  s_tier_src --> p_implement_integrate
  s_contracts_code --> p_implement_integrate
  s_use_cases --> p_implement_integrate
  s_config --> p_implement_integrate
  p_implement_integrate --> s_steps
  p_implement_integrate --> s_features_support
  p_implement_integrate --> s_reports
  p_implement_integrate --> s_traces
```

### ④ verify

```mermaid
flowchart LR
  s_skill_docs[("スキルの手順書 (同梱)<br/>${CLAUDE_PLUGIN_ROOT}/skills/**")]
  s_req_usdm[("要求 (USDM)<br/>docs/requirements/requirements.yaml")]
  s_req_rdra[("RDRA モデル<br/>docs/requirements/rdra/**")]
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_rules[("開発ルール<br/>docs/rules/**")]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_contract_slice[("UC の契約 slice<br/>contracts/generated/slices/#lt;slug#gt;/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_assumptions[("実装者が補った前提<br/>#lt;run#gt;/attempt-#lt;n#gt;/assumptions.#lt;tier#gt;.yaml")]
  s_findings[("Verifier の指摘<br/>#lt;run#gt;/attempt-#lt;n#gt;/findings.#lt;tier#gt;.yaml")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_traces[("計装トレース<br/>#lt;run#gt;/traces/**")]
  s_asbuilt_system[("システム横断の as-built<br/>docs/as-built/_system/**")]
  p_verify["独立検証<br/>d2-verify<br/>(ティアごとに並列)"]
  s_reports --> p_verify
  s_traces --> p_verify
  s_assumptions --> p_verify
  s_feature --> p_verify
  s_use_cases --> p_verify
  s_req_usdm --> p_verify
  s_req_rdra --> p_verify
  s_rules --> p_verify
  s_contract_slice --> p_verify
  s_tier_src --> p_verify
  s_uc_index --> p_verify
  s_asbuilt_system --> p_verify
  s_skill_docs --> p_verify
  p_verify --> s_findings
```

### ④ asbuilt

```mermaid
flowchart LR
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_assumptions[("実装者が補った前提<br/>#lt;run#gt;/attempt-#lt;n#gt;/assumptions.#lt;tier#gt;.yaml")]
  s_asbuilt_uc[("UC の as-built<br/>docs/as-built/#lt;業務#gt;/#lt;UC#gt;/**")]
  p_asbuilt["as-built の要約<br/>d2-asbuilt"]
  s_asbuilt_uc --> p_asbuilt
  s_assumptions --> p_asbuilt
  s_tier_src --> p_asbuilt
  p_asbuilt --> s_asbuilt_uc
```

### ④ 段階をまたぐ d2-run の作業

```mermaid
flowchart LR
  s_use_cases[("UC 一覧<br/>docs/requirements/use-cases.yaml")]
  s_depcruise_config[("依存方向の検査設定<br/>.dependency-cruiser.cjs")]
  s_features_support[("Cucumber の support<br/>features/support/**")]
  s_cucumber_config[("Cucumber 設定<br/>cucumber.js")]
  s_config[("実行設定<br/>.distillery/config.yaml")]
  s_skeleton[("リポの骨格<br/>apps/*/")]
  s_lockfile[("依存の lockfile<br/>package-lock.json")]
  s_qlty_config[("qlty 設定<br/>.qlty/qlty.toml")]
  s_uc_index[("UC ごとの契約の索引<br/>contracts/uc-index.yaml")]
  s_contract_tests[("契約テスト (生成物)<br/>apps/*/test/contract/**")]
  s_migrations[("DB migration<br/>apps/#lt;datastore_owner#gt;/migrations/**")]
  s_feature[("UC シナリオ<br/>features/#lt;業務#gt;/#lt;slug#gt;.feature")]
  s_acceptance[("受入シナリオ<br/>features/acceptance/**")]
  s_steps[("step 定義<br/>features/step_definitions/**")]
  s_tier_src[("ティアの実装と単体テスト<br/>apps/#lt;tier#gt;/src/**")]
  s_run_events[("実行の記録 (events / done)<br/>#lt;run#gt;/events.jsonl")]
  s_assumptions[("実装者が補った前提<br/>#lt;run#gt;/attempt-#lt;n#gt;/assumptions.#lt;tier#gt;.yaml")]
  s_findings[("Verifier の指摘<br/>#lt;run#gt;/attempt-#lt;n#gt;/findings.#lt;tier#gt;.yaml")]
  s_issues[("仕様起因の課題<br/>#lt;run#gt;/issues/**")]
  s_issues_tier[("ティア実装者の課題<br/>#lt;run#gt;/issues/#lt;ts#gt;_#lt;tier#gt;_#lt;slug#gt;.md")]
  s_reports[("ゲートの記録<br/>#lt;run#gt;/reports/**")]
  s_traces[("計装トレース<br/>#lt;run#gt;/traces/**")]
  s_asbuilt_uc[("UC の as-built<br/>docs/as-built/#lt;業務#gt;/#lt;UC#gt;/**")]
  s_asbuilt_system[("システム横断の as-built<br/>docs/as-built/_system/**")]
  s_docs_readme[("文書の入口<br/>docs/README.md")]
  s_github[("GitHub (PR / issue)<br/>(GitHub)")]
  p_run_uc["d2-run (④ の直接作業)<br/>d2-run"]
  s_config --> p_run_uc
  s_use_cases --> p_run_uc
  s_run_events --> p_run_uc
  s_reports --> p_run_uc
  s_traces --> p_run_uc
  s_assumptions --> p_run_uc
  s_findings --> p_run_uc
  s_issues --> p_run_uc
  s_issues_tier --> p_run_uc
  s_uc_index --> p_run_uc
  s_asbuilt_system --> p_run_uc
  s_depcruise_config --> p_run_uc
  s_skeleton --> p_run_uc
  s_lockfile --> p_run_uc
  s_cucumber_config --> p_run_uc
  s_qlty_config --> p_run_uc
  s_tier_src --> p_run_uc
  s_contract_tests --> p_run_uc
  s_migrations --> p_run_uc
  s_feature --> p_run_uc
  s_acceptance --> p_run_uc
  s_steps --> p_run_uc
  s_features_support --> p_run_uc
  p_run_uc --> s_run_events
  p_run_uc --> s_use_cases
  p_run_uc --> s_reports
  p_run_uc --> s_traces
  p_run_uc --> s_asbuilt_uc
  p_run_uc --> s_asbuilt_system
  p_run_uc --> s_docs_readme
  p_run_uc --> s_github
  p_run_uc --> s_qlty_config
```

| 内訳 | 読む | 書く |
|---|---|---|
| ゲートの実行 (runGates) | 実行設定、リポの骨格、依存の lockfile、Cucumber 設定、qlty 設定、ティアの実装と単体テスト、契約テスト (生成物)、DB migration、UC シナリオ、受入シナリオ、step 定義、Cucumber の support | ゲートの記録、計装トレース |

## ファイル (store) の一覧

| ファイル | パス | 由来 | 書く処理 | 読む処理 |
|---|---|---|---|---|
| 要望テキスト | `<要望テキスト>` | 外部入力 | — | 要求の整理 |
| ルールのひな形 (同梱) | `skills/d2-foundation/references/rule-templates/**` | プラグイン同梱 | — | 基盤の生成 (F1〜F5)、F1 ルール |
| テスト基盤のひな形 (同梱) | `skills/d2-foundation/templates/**` | プラグイン同梱 | — | 基盤の生成 (F1〜F5)、F3 テスト基盤 |
| スキルの手順書 (同梱) | `${CLAUDE_PLUGIN_ROOT}/skills/**` | プラグイン同梱 | — | 独立検証 |
| 要求 (USDM) | `docs/requirements/requirements.yaml` | 生成 | 要求の整理 | 品質特性と設計の決定、UC シナリオの執筆、ティアの実装、独立検証 |
| RDRA モデル | `docs/requirements/rdra/**` | 生成 | 要求の整理 | 品質特性と設計の決定、デザインシステムの生成、d2-run (③ の直接作業)、UC シナリオの執筆、契約の差分、ティアの実装、独立検証 |
| UC 一覧 | `docs/requirements/use-cases.yaml` | 生成 | 要求の整理、d2-run (④ の直接作業) | 品質特性と設計の決定、デザインシステムの生成、UC シナリオの執筆、契約の差分、ティアの実装、結合、独立検証、d2-run (④ の直接作業) |
| 要求の確認材料 | `docs/requirements/_review-summary.md` | 生成 | 要求の整理 | d2-run (① ② の確認と入口の更新) |
| 非機能要求グレード表 | `docs/nfr/**` | 生成 | 品質特性と設計の決定 | デザインシステムの生成 |
| ADR | `docs/adr/*.md` | 生成 | 品質特性と設計の決定 | 基盤の生成 (F1〜F5)、F1 ルール、F2 依存方向の検査、F5 設定・骨格・CI・qlty、契約の骨格、デザインシステムの生成、d2-run (③ の直接作業) |
| C4 図 (決定から) | `docs/adr/architecture.md` | 生成 (最終成果物) | d2-run (③ の直接作業) | — |
| 決定の確認材料 | `docs/adr/_review-summary.md` | 生成 | 品質特性と設計の決定 | d2-run (① ② の確認と入口の更新) |
| 開発ルール | `docs/rules/**` | 生成 | 基盤の生成 (F1〜F5)、F1 ルール | UC シナリオの執筆、テスト足場の生成、ティアの実装、独立検証 |
| 依存方向の検査設定 | `.dependency-cruiser.cjs` | 生成 | 基盤の生成 (F1〜F5)、F2 依存方向の検査 | d2-run (④ の直接作業) |
| テスト基盤 (tracer・World) | `packages/test-support/**` | 生成 | 基盤の生成 (F1〜F5)、F3 テスト基盤 | テスト足場の生成、ティアの実装、結合 |
| Cucumber の support | `features/support/**` | 生成 | 基盤の生成 (F1〜F5)、F3 テスト基盤、結合 | テスト足場の生成、結合、ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| Cucumber 設定 | `cucumber.js` | 生成 | 基盤の生成 (F1〜F5)、F3 テスト基盤 | ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| 実行設定 | `.distillery/config.yaml` | 生成 | 基盤の生成 (F1〜F5)、F5 設定・骨格・CI・qlty、d2-run (③ の直接作業) | テスト足場の生成、結合、ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| リポの骨格 | `apps/*/` | 生成 | 基盤の生成 (F1〜F5)、F5 設定・骨格・CI・qlty | ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| 依存の lockfile | `package-lock.json` | 生成 | d2-run (③ の直接作業) | ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| CI | `.github/workflows/**` | 生成 (最終成果物) | 基盤の生成 (F1〜F5)、F5 設定・骨格・CI・qlty、d2-run (③ の直接作業) | — |
| qlty 設定 | `.qlty/qlty.toml` | 生成 | 基盤の生成 (F1〜F5)、F5 設定・骨格・CI・qlty、d2-run (③ の直接作業)、d2-run (④ の直接作業) | ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| 契約カタログ | `contracts/contracts.json` | 生成 | 契約の骨格 | 基盤の生成 (F1〜F5)、F5 設定・骨格・CI・qlty、d2-run (③ の直接作業) |
| 契約の分割ファイル | `contracts/**` | 生成 | 契約の骨格、契約の差分 | 契約の差分 |
| UC ごとの契約の索引 | `contracts/uc-index.yaml` | 生成 | 契約の骨格、契約の差分 | 独立検証、d2-run (④ の直接作業) |
| UC の契約 slice | `contracts/generated/slices/<slug>/**` | 生成 | 契約の差分 | テスト足場の生成、ティアの実装、結合、独立検証 |
| 契約テスト (生成物) | `apps/*/test/contract/**` | 生成 | d2-run (③ の直接作業)、契約の差分 | ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| DB migration | `apps/<datastore_owner>/migrations/**` | 生成 | 契約の差分、ティアの実装 | ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| 契約からの codegen | `packages/contracts/**` | 生成 | 契約の差分 | ティアの実装、結合 |
| デザインシステム (Storybook アプリ) | `docs/design/**` | 生成 | デザインシステムの生成 | F6 画面部品の取り込み、d2-run (③ の直接作業)、ティアの実装 |
| 画面部品 | `packages/ui/**` | 生成 | F6 画面部品の取り込み、d2-run (③ の直接作業) | ティアの実装 |
| UC シナリオ | `features/<業務>/<slug>.feature` | 生成 | UC シナリオの執筆 | UC シナリオの執筆、契約の差分、テスト足場の生成、ティアの実装、結合、独立検証、ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| 受入シナリオ | `features/acceptance/**` | 生成 | UC シナリオの執筆 | テスト足場の生成、ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| step 定義 | `features/step_definitions/**` | 生成 | テスト足場の生成、結合 | テスト足場の生成、結合、ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| ティアの実装と単体テスト | `apps/<tier>/src/**` | 生成 | テスト足場の生成、ティアの実装 | ティアの実装、結合、独立検証、as-built の要約、ゲートの実行 (runGates)、d2-run (④ の直接作業) |
| 実行の記録 (events / done) | `<run>/events.jsonl` | 生成 | d2-run (④ の直接作業) | d2-run (④ の直接作業) |
| 実装者が補った前提 | `<run>/attempt-<n>/assumptions.<tier>.yaml` | 生成 | ティアの実装 | 独立検証、as-built の要約、d2-run (④ の直接作業) |
| Verifier の指摘 | `<run>/attempt-<n>/findings.<tier>.yaml` | 生成 | 独立検証 | ティアの実装、d2-run (④ の直接作業) |
| 仕様起因の課題 | `<run>/issues/**` | 生成 | 契約の差分 | d2-run (④ の直接作業) |
| ティア実装者の課題 | `<run>/issues/<ts>_<tier>_<slug>.md` | 生成 | ティアの実装 | d2-run (④ の直接作業) |
| ゲートの記録 | `<run>/reports/**` | 生成 | テスト足場の生成、結合、ゲートの実行 (runGates)、d2-run (④ の直接作業) | 独立検証、d2-run (④ の直接作業) |
| 計装トレース | `<run>/traces/**` | 生成 | 結合、ゲートの実行 (runGates)、d2-run (④ の直接作業) | 独立検証、d2-run (④ の直接作業) |
| UC の as-built | `docs/as-built/<業務>/<UC>/**` | 生成 | as-built の要約、d2-run (④ の直接作業) | as-built の要約 |
| システム横断の as-built | `docs/as-built/_system/**` | 生成 | d2-run (④ の直接作業) | 独立検証、d2-run (④ の直接作業) |
| 文書の入口 | `docs/README.md` | 生成 (最終成果物) | d2-run (① ② の確認と入口の更新)、d2-run (③ の直接作業)、d2-run (④ の直接作業) | — |
| GitHub (PR / issue) | `(GitHub)` | 生成 (最終成果物) | d2-run (④ の直接作業) | — |
