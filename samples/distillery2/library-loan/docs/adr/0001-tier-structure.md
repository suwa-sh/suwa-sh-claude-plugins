---
id: "0001"
title: "ティア構成は利用者向けフロント・司書向けフロント・backend-api・worker の 4 ティアとする"
status: accepted
date: "2026-09-24"
supersedes: []
superseded_by: null
basis: "requirements@ca8f7fb28b2dc8ef6b6abfcee29c0898fa879a12"
nfr_refs: ["A.1.1.1", "B.1.1.1", "B.2.2.1", "E.5.3.1", "F.2.2.1"]
scope: [system]
confidence: medium
tiers:
  - id: frontend-patron
    dir: apps/frontend-patron
    kind: frontend
    lang: typescript
    provides: []
    consumes: [api]
  - id: frontend-staff
    dir: apps/frontend-staff
    kind: frontend
    lang: typescript
    provides: []
    consumes: [api]
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
    provides: [api]
    consumes: [db, mail]
  - id: worker
    dir: apps/worker
    kind: worker
    lang: typescript
    provides: []
    consumes: [db, mail]
datastore_owner: backend-api
rules:
  - scope: common
    text: "利用者向けフロントは backend-api の内部実装へ直接依存してはならない (API 契約経由で呼ぶ)"
    arch_test:
      from: "apps/frontend-patron/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "司書向けフロントは backend-api の内部実装へ直接依存してはならない (API 契約経由で呼ぶ)"
    arch_test:
      from: "apps/frontend-staff/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "利用者向けフロントは司書向けフロントのコードを import してはならない (共通部品は packages/ui から取る)"
    arch_test:
      from: "apps/frontend-patron/**"
      to: "apps/frontend-staff/**"
      effect: forbid
      level: tier
  - scope: common
    text: "司書向けフロントは利用者向けフロントのコードを import してはならない (共通部品は packages/ui から取る)"
    arch_test:
      from: "apps/frontend-staff/**"
      to: "apps/frontend-patron/**"
      effect: forbid
      level: tier
  - scope: common
    text: "フロントは worker に依存してはならない"
    arch_test:
      from: "apps/frontend-*/**"
      to: "apps/worker/**"
      effect: forbid
      level: tier
  - scope: tier:backend
    text: "backend-api は worker に依存してはならない (定期処理の起動は worker 側の責務)"
    arch_test:
      from: "apps/backend-api/**"
      to: "apps/worker/**"
      effect: forbid
      level: tier
  - scope: tier:worker
    text: "worker は backend-api の usecase 層を入口として業務処理を呼び、presentation 層へ依存してはならない"
    arch_test:
      from: "apps/worker/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: tier
  - scope: tier:worker
    text: "worker は backend-api の repository 層へ直接依存してはならない (データ更新は usecase 経由で行う)"
    arch_test:
      from: "apps/worker/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: tier
  - scope: tier:worker
    text: "worker は backend-api の gateway 層へ直接依存してはならない (メール送信は usecase 経由で行う)"
    arch_test:
      from: "apps/worker/**"
      to: "apps/backend-api/src/gateway/**"
      effect: forbid
      level: tier
  - scope: common
    text: "backend-api は単一デプロイ単位のモジュラモノリスとし、業務モジュール (蔵書・利用者・貸出・予約・通知・分析) の境界を跨ぐ内部実装の直接 import を禁じる"
  - scope: tier:worker
    text: "worker は冪等に実装し、同一ジョブ (ジョブ種別と対象日) の二重実行で副作用が重複しないようにする"
---

# 背景

- 社外アクター「利用者」と社内アクター「司書」の 2 種が、それぞれ別の Web 画面を使う (条件「操作権限条件」)。
- 条件「リマインド送信条件」「延滞判定条件」は日次の期限チェック (タイマー) で動く。取置通知・リマインド・督促はメール配信サービスへ送る。
- 初期要望は「まずは 1 館での運用」であり、同時アクセスは 100 以下を見込む (NFR B.1.1.1 Lv1)。

# 決定

- 次の 4 ティアを置く。
  - `frontend-patron`: 利用者向け Web 画面 (検索・予約・自分の利用状況)。
  - `frontend-staff`: 司書向け Web 画面 (蔵書・利用者管理、貸出・返却、レポート)。
  - `backend-api`: 業務ロジックと API を持つ単一のモジュラモノリス。データストアの所有者 (migration を持つ)。
  - `worker`: 日次の期限チェックと、送信待ち通知のメール送信を行う定期実行プロセス。
- worker は backend-api の usecase 層を呼んで業務処理を行い、データストアへは backend-api の repository 実装を通してのみアクセスする。
- API Gateway は置かない。1 館規模で外部アクターは 1 種、フロントは 2 種だが同一の backend-api が直接受ける。
- 認証基盤 (IdP) の扱いは ADR-0006 で決める。フロントを 2 本に分ける理由と共通部品の方針は ADR-0008 で決める。

# 却下した案

- 単一フロント (利用者と司書で 1 本の画面アプリ): 権限と導線が大きく異なり、司書機能の接続元制限 (NFR E.5.3.1) もしにくいため却下。ADR-0008 で確認対象として残す。
- ドメイン別に分割した複数の API: 1 館規模・小トラフィックでは運用コストが過大なため却下。
- worker を置かず backend-api 内のタイマーで期限チェックする: API の再起動やスケールと定期処理が絡み、二重実行の制御が難しくなるため却下。
- worker が独自にドメインとデータアクセスを持つ: 業務ルール (延滞判定・予約順) が二重実装になるため却下。

# 影響

- 良い点: 定期処理と画面処理の障害が互いに波及しにくい。業務ルールは backend-api の domain 層に 1 か所で集まる。
- 悪い点: フロントが 2 本になり、ビルドとデプロイの単位が増える。
- 悪い点: worker は backend-api のコードを参照するため、両者は同じリリースで出す必要がある。
