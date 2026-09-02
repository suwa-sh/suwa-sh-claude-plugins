---
schema_version: distillery.feedback-request/v1
feedback_id: 20260902_213000_impl_feedback_d0f57ea2
created_at: 2026-09-02T21:30:00+09:00
source: distillery-impl
uc_id: d0f57ea2
supersedes: 20260902_184257_impl_feedback_d0f57ea2
---

# 実装からの変更要求

## CR-d0f57ea2-002: AsyncAPI payloadが匿名型として生成される

- severity: improvement
- related_ids: [ASYNCAPI-CONTRACT]
- related_files: [docs/specs/latest/_cross-cutting/api/asyncapi.yaml]

### 観測した事実

AsyncAPI message payloadにtitleが無く、型生成物が`AnonymousSchema_1`などの名前になった。

### 現在の仕様と問題

生成型の名前から業務イベントを識別できず、複数messageの保守時に誤用しやすい。

### 変更してほしいこと

各message payloadへ業務上安定したschema titleを付与する。

### 完了条件

生成型が業務イベントを表す安定名を持ち、匿名schema名が残らない。

## CR-d0f57ea2-006: 必要なSkeletonとSpinnerがUI資産に存在しない

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md, packages/ui/.imported.yaml]

### 観測した事実

画面仕様がloading表示に要求するSkeletonとSpinnerを、取り込み済みStorybook componentsから参照できなかった。

### 現在の仕様と問題

frontendはdesign systemの生成物だけを使う規則だが、要求された状態を表すcomponentが生成されていない。

### 変更してほしいこと

loading状態を表現する共通componentと利用条件をdesign成果物に追加する。

### 完了条件

画面実装が独自UIを追加せず、指定componentだけでloading状態を再現できる。

