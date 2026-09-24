---
id: "0003"
title: "backend-api は 5 層、フロントは 2 層とし、依存は内側 (domain) に向ける"
status: accepted
date: "2026-09-24"
supersedes: []
superseded_by: null
basis: "requirements@ca8f7fb28b2dc8ef6b6abfcee29c0898fa879a12"
nfr_refs: ["F.2.2.1", "C.4.1.1"]
scope: [app]
confidence: medium
rules:
  - scope: tier:backend
    text: "domain 層は presentation 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は usecase 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は repository 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は gateway 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/gateway/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "presentation 層は usecase 層を経由し、repository 層を直接呼ばない"
    arch_test:
      from: "apps/backend-api/src/presentation/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "presentation 層は gateway 層を直接呼ばない"
    arch_test:
      from: "apps/backend-api/src/presentation/**"
      to: "apps/backend-api/src/gateway/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "usecase 層は presentation 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/usecase/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "repository 層は usecase 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/repository/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway 層は domain 層へ依存してはならない (データストアモデルと外部 SDK だけを扱う)"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/domain/**"
      effect: forbid
      level: layer
  - scope: tier:frontend
    text: "フロントの api-client 層は view 層へ依存してはならない"
    arch_test:
      from: "apps/frontend-*/src/api-client/**"
      to: "apps/frontend-*/src/view/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層はログを出力せず、ドメインイベントと例外で結果を通知する"
  - scope: tier:backend
    text: "外部サービス (メール配信) はポートインターフェイスを介して呼び、テストでは in-memory 実装に差し替える"
  - scope: tier:worker
    text: "worker の src はジョブの起動と引数の組み立てだけを行い、業務ルールを書かない (業務ルールは backend-api の domain 層に置く)"
---

# 背景

- 状態モデルは 5 種 (書籍状態・貸出状態・予約状態・利用者状態・通知状態) あり、条件は 23 件ある。貸出可否・予約順・延滞判定などのビジネスルールが濃い。
- 画面を伴う UC は利用者向けが約 9 本、司書向けが約 15 本で、どちらのフロントも 20 本未満である。
- 外部システムはメール配信サービスで、テストでは実際に送信したくない。

# 決定

- backend-api は 5 層 (presentation / usecase / domain / repository / gateway) とし、依存方向は次のとおりにする。
  - presentation → usecase → domain
  - usecase → domain, repository
  - repository → domain, gateway
  - gateway → 外部 (データストア・メール配信) のみ
- domain は最内層で、他レイヤに依存しない。
- メール配信の呼び出しはポートインターフェイスを挟み、テストでは in-memory 実装に差し替える。データストアはインターフェイスを挟まず repository から直接使う。
- フロントは 2 層 (view / api-client) とする。
- worker は独自のレイヤを持たず、backend-api の usecase を呼ぶ薄い入口とする (ADR-0001)。
- 読み書き分離 (CQRS) は採らない。

# 却下した案

- backend-api を 3 層や 2 層にする: 状態遷移と条件が多く、業務ルールが presentation や repository に散るため却下。
- データストアにもインターフェイスを挟む: データストア製品を乗り換える予定が無く、組み込み DB でテストできるため却下。
- 読み書き分離 (CQRS): 同時アクセス 100 以下で読み書きの負荷差も小さく、複雑さだけが増えるため却下。
- フロントを 3 層 (view / state / api-client) にする: UC が 20 本未満のため過剰と判断して却下。

# 影響

- 良い点: 依存方向を機械検証でき、業務ルールが domain 層に集まる。
- 悪い点: 単純な参照系の UC でも usecase 層を経由するため、コード量が増える。
