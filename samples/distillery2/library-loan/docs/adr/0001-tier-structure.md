---
id: "0001"
title: "frontend・backend-api・worker の 3 ティア構成とし、backend-api を業務モジュールで分けたモジュラモノリスにする"
status: accepted
date: 2026-09-26
supersedes: []
superseded_by: null
basis: "requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518"
nfr_refs: ["A.1.1.1", "B.1.1.1", "B.3.1.1", "F.2.2.1"]
scope: [system]
confidence: medium
tiers:
  - id: frontend
    dir: apps/frontend
    kind: frontend
    lang: typescript
    provides: []
    consumes: []
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
    provides: []
    consumes: []
  - id: worker
    dir: apps/worker
    kind: worker
    lang: typescript
    provides: []
    consumes: []
datastore_owner: backend-api
contexts:
  - id: catalog
    name: "蔵書コンテキスト"
    owner_tier: backend-api
    relations: []
  - id: patron
    name: "利用者コンテキスト"
    owner_tier: backend-api
    relations: []
  - id: loan
    name: "貸出コンテキスト"
    owner_tier: backend-api
    relations:
      - to: catalog
        kind: "Customer-Supplier"
      - to: patron
        kind: "Customer-Supplier"
      - to: reservation
        kind: "Partnership"
  - id: reservation
    name: "予約コンテキスト"
    owner_tier: backend-api
    relations:
      - to: catalog
        kind: "Customer-Supplier"
      - to: patron
        kind: "Customer-Supplier"
  - id: notification
    name: "通知コンテキスト"
    owner_tier: backend-api
    relations:
      - to: loan
        kind: "Customer-Supplier"
      - to: reservation
        kind: "Customer-Supplier"
      - to: patron
        kind: "Customer-Supplier"
  - id: analytics
    name: "蔵書分析コンテキスト"
    owner_tier: backend-api
    relations:
      - to: loan
        kind: "Conformist"
      - to: catalog
        kind: "Conformist"
rules:
  - scope: common
    text: "frontend は backend-api の内部実装へ直接依存してはならない (契約経由で呼ぶ)"
    arch_test:
      from: "apps/frontend/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "worker は backend-api の内部実装へ直接依存してはならない (ジョブ起動は契約した API 経由で行う)"
    arch_test:
      from: "apps/worker/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "frontend は worker に依存してはならない"
    arch_test:
      from: "apps/frontend/**"
      to: "apps/worker/**"
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
  - scope: tier:backend
    text: "backend-api は単一デプロイ単位のモジュラモノリスとし、業務モジュール (蔵書・利用者・貸出・予約・通知・蔵書分析) を跨ぐときは相手モジュールの公開 usecase を呼び、内部の domain や repository を直接 import しない"
  - scope: tier:backend
    text: "データストアへの読み書きと migration は backend-api だけが行い、frontend と worker はデータストアに接続しない"
  - scope: tier:worker
    text: "worker は冪等に実装し、同じ対象日のジョブを二重に起動しても副作用 (メール送信・状態変更) が重複しないようにする"
---

# 背景

利用者 (社外) が Web 画面で検索・予約・照会を行い、司書が窓口で登録・貸出・返却を行う。
期限管理フローにはタイマー「日次期限チェック」があり、リマインドと督促のメールを自動送信する。
運用は 1 館で、同時アクセスは 100 以下 (NFR B.1.1.1 Lv1)、拡張はスケールアップで足りる (NFR B.3.1.1 Lv1)。

# 決定

- ティアは次の 3 つにする。
  - frontend: 利用者向けと司書向けの画面を 1 つの SPA に集約し、ルートとロールで出し分ける。
  - backend-api: 業務ロジックとデータストアを持つ唯一の API。データストアの所有者 (migration を持つ) とする。
  - worker: 日次期限チェックと通知の送信を定期起動する。業務ロジックは持たず、backend-api のジョブ API を呼ぶ。
- backend-api は業務モジュールで分けたモジュラモノリスとし、分割デプロイはしない。
- 業務モジュールは情報モデルのコンテキストに合わせ、蔵書・利用者・貸出・予約・通知・蔵書分析の 6 つにする。
- API Gateway と BFF は置かない。frontend は backend-api を直接呼ぶ。

# 却下した案

- 利用者向けと司書向けで frontend を 2 つに分ける案: 認証経路を分ける要件が無く、UC ごとの実装コストが 2 倍になる。
- 業務ごとに API を分割する案: 1 館規模・小トラフィックでは運用コストが過大になる。
- worker を置かず backend-api 内のスケジューラで日次処理する案: API のスケールや再起動とジョブ実行が結び付き、二重起動の制御が難しくなる。
- worker が直接データストアへ接続する案: データストアの所有者が 2 つになり、業務ルール (延滞への状態変更・1 回だけのリマインド) が二重実装になる。
- API Gateway を置く案: 外部アクターは 1 種、frontend も 1 つで、WAF や IP 制限を Gateway で集約する要件も無い。

# 影響

- 業務ルールと状態遷移はすべて backend-api に集まり、単体テストと契約テストの対象が 1 か所にまとまる。
- worker は薄い起動役になり、失敗時は同じ対象日で再実行すればよい (冪等性は backend-api のジョブ側で担保する)。
- 将来複数館や電子書籍を扱うときは、業務モジュール単位で API を切り出せる。
- 契約 id (provides / consumes) は段階③の契約カタログ確定後に埋める。
