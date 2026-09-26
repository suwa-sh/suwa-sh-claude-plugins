---
id: "0003"
title: "backend-api は 5 層、frontend は 3 層、worker は 2 層とし、内側へ向かう依存だけを許す"
status: accepted
date: 2026-09-26
supersedes: []
superseded_by: null
basis: "requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518"
nfr_refs: ["F.2.2.1", "C.1.3.1"]
scope: [app]
confidence: medium
rules:
  - scope: tier:backend
    text: "domain 層は他レイヤへ依存してはならない (presentation へ依存しない)"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は他レイヤへ依存してはならない (usecase へ依存しない)"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は他レイヤへ依存してはならない (repository へ依存しない)"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は他レイヤへ依存してはならない (gateway へ依存しない)"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/gateway/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "presentation は usecase を経由し、repository を直接呼ばない"
    arch_test:
      from: "apps/backend-api/src/presentation/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "presentation は gateway を直接呼ばない"
    arch_test:
      from: "apps/backend-api/src/presentation/**"
      to: "apps/backend-api/src/gateway/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "usecase は presentation に依存しない"
    arch_test:
      from: "apps/backend-api/src/usecase/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "repository は usecase に依存しない"
    arch_test:
      from: "apps/backend-api/src/repository/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway は usecase に依存しない"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層はログを出力せず、ドメインイベントか例外で結果を伝える"
  - scope: tier:backend
    text: "メール配信システムなど外部への呼び出しは usecase が定義するポートインターフェイス越しに行い、テストでは in-memory 実装に差し替える"
  - scope: tier:frontend
    text: "view は state を経由して api-client を呼び、api-client を直接呼ばない"
    arch_test:
      from: "apps/frontend/src/view/**"
      to: "apps/frontend/src/api-client/**"
      effect: forbid
      level: layer
  - scope: tier:frontend
    text: "api-client は view に依存しない"
    arch_test:
      from: "apps/frontend/src/api-client/**"
      to: "apps/frontend/src/view/**"
      effect: forbid
      level: layer
  - scope: tier:worker
    text: "worker の job 層は backend-api を client 層経由で呼び、client 層は job 層に依存しない"
    arch_test:
      from: "apps/worker/src/client/**"
      to: "apps/worker/src/job/**"
      effect: forbid
      level: layer
---

# 背景

状態モデルが 3 つ (書籍状態・貸出状態・予約状態) あり、遷移は合計 19 本ある。
条件も 7 つ (貸出可否・予約可否・返却期限算出・リマインド送信・督促送信など) あり、業務ルールが濃い。
UC は 27 本で、画面数が多い。外部システム (メール配信システム) をテストで差し替える必要がある。

# 決定

- backend-api は 5 層 (presentation / usecase / domain / repository / gateway) にする。
  - 依存方向は presentation → usecase → domain、usecase → repository、repository → domain・gateway とする。
  - domain は最内層で、どのレイヤにも依存しない。
  - 業務モジュール (ADR 0001) はレイヤの下にモジュール名のディレクトリを切って表す (例: `src/domain/loan/`)。
  - 外部呼び出しはポートインターフェイス越しにし、テストでは in-memory 実装に差し替える。
- frontend は 3 層 (view / state / api-client) にする (UC が 20 本以上のため)。
- worker は 2 層 (job / client) にする。業務ロジックを持たないため。
- 読み書き分離 (CQRS) は採らない。レポートは RDB への集計クエリで作る。

# 却下した案

- backend-api を 3 層や 2 層にする案: 状態遷移と条件が多く、業務ルールがコントローラや SQL に散らばる。
- すべての repository にもインターフェイスを挟む案: データストアを乗り換える予定が無く、pglite で実 DB に近いテストができるため、抽象化の保守コストが上回る。
- CQRS を採る案: 同時アクセス 100 以下 (NFR B.1.1.1 Lv1) で読み書き負荷の非対称性が無く、複雑さだけが増える。

# 影響

- 依存方向は段階③でアーキテストとして機械検証される。
- 業務ルールが domain に集まり、単体テストをデータストアなしで書ける。
- メール配信システムの障害や遅延をテストで再現できる。
