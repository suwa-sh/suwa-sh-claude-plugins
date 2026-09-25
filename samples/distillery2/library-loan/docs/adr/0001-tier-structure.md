---
id: "0001"
title: "frontend・backend-api・worker の 3 ティア構成とし、backend-api をモジュラモノリスにする"
status: accepted
date: "2026-09-25"
supersedes: []
superseded_by: null
basis: "requirements@4422a431dd381e737d643e7055432ad4b2330c9d"
nfr_refs: ["A.1.1.1", "B.1.1.1", "B.1.1.4", "B.3.1.1", "F.2.2.1"]
scope: [system]
confidence: medium
tiers:
  - id: "frontend"
    dir: "apps/frontend"
    kind: frontend
    lang: typescript
    provides: []
    consumes: ["api"]
  - id: "backend-api"
    dir: "apps/backend-api"
    kind: backend
    lang: typescript
    provides: ["api"]
    consumes: ["db"]
  - id: "worker"
    dir: "apps/worker"
    kind: worker
    lang: typescript
    provides: []
    consumes: ["api"]
datastore_owner: "backend-api"
rules:
  - scope: common
    text: "frontend は backend-api の内部実装へ直接依存してはならない (契約経由で呼ぶ)"
    arch_test:
      from: "apps/frontend/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "worker は backend-api の内部実装へ直接依存してはならない (契約経由でジョブ API を呼ぶ)"
    arch_test:
      from: "apps/worker/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "backend-api は frontend に依存してはならない"
    arch_test:
      from: "apps/backend-api/**"
      to: "apps/frontend/**"
      effect: forbid
      level: tier
  - scope: common
    text: "backend-api は worker に依存してはならない"
    arch_test:
      from: "apps/backend-api/**"
      to: "apps/worker/**"
      effect: forbid
      level: tier
  - scope: common
    text: "backend-api は単一デプロイ単位のモジュラモノリスとし、業務モジュール境界を跨ぐ直接 import を禁じる"
  - scope: tier:backend
    text: "データストアを読み書きするのは backend-api だけとし、migration も backend-api が持つ"
  - scope: tier:worker
    text: "worker は定時ジョブの起動役に徹し、業務ルールを持たずに backend-api のジョブ API を呼ぶ"
  - scope: tier:worker
    text: "worker のジョブは冪等に実装し、同じ実行日・同じジョブの二重起動で副作用が重複しないようにする"
---

# 背景

要求は 1 館運用で、アクターは社外の「利用者」と社内の「司書」の 2 種である。
UC 23 本のうち 21 本が Web 画面操作を伴う。
タイマー「毎日のリマインド判定」「毎日の延滞判定」が定時起動の処理を要求する。
NFR は同時アクセス 100 以下 (B.1.1.1 Lv1)、スケールアップで足りる (B.3.1.1 Lv1) と見積もった。

# 決定

- ティアは frontend・backend-api・worker の 3 つにする。
- frontend は 1 つにまとめ、利用者向け画面と司書向け画面をルートとロールで出し分ける。
- backend-api は単一デプロイ単位のモジュラモノリスにする。業務モジュールの境界は ADR 0009 で決める。
- worker は定時ジョブ (返却期限リマインド・延滞督促・通知送信) の起動役にする。業務ルールは backend-api のジョブ API に置き、worker はそれを契約経由で呼ぶ。
- データストアの所有者は backend-api だけにする。
- API Gateway と独立した認可サービスは置かない。
- 用語はベンダーニュートラルに保つ。実行基盤 (FaaS / CaaS 等) はインフラ段階で決める。

# 却下した案

- frontend を利用者向けと司書向けの 2 ティアに分ける案: 認証経路を分ける要求 (NFR E.5.3) が無い。UC ごとの実装コストが 2 倍になる。
- backend-api を業務ごとの API に分割する案: 1 館・小トラフィックでは運用コストが過大になる。
- worker が DB を直接読み書きする案: データ所有者が 2 つになり、延滞判定などの業務ルールが 2 か所に散る。
- worker を置かず backend-api 内のタイマーで動かす案: API のスケールや再起動とジョブの実行が絡み、二重起動の制御が難しくなる。

# 影響

- 利点: 業務ルールとデータが backend-api 1 か所に集まり、テストと移行が単純になる。
- 利点: 将来の電子書籍対応 (F.2.2.1) は backend-api の業務モジュール追加で吸収できる。
- 欠点: worker のジョブが backend-api の可用性に依存する。ジョブは冪等にし、失敗時は次回起動で再実行する。
- 欠点: 司書画面と利用者画面が同じ配信単位になる。権限の出し分けを frontend と backend-api の両方で守る必要がある (ADR 0006)。
