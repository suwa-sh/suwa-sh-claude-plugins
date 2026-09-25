---
id: "0003"
title: "backend-api は 5 層、frontend は 3 層、worker は 2 層にし、依存方向を内向きに固定する"
status: accepted
date: "2026-09-25"
supersedes: []
superseded_by: null
basis: "requirements@4422a431dd381e737d643e7055432ad4b2330c9d"
nfr_refs: ["F.2.2.1", "C.4.1.1"]
scope: [app]
confidence: high
rules:
  - scope: tier:backend
    text: "domain 層は presentation 層に依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は usecase 層に依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は repository 層に依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は gateway 層に依存してはならない"
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
    text: "usecase は presentation に依存してはならない"
    arch_test:
      from: "apps/backend-api/src/usecase/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "repository は usecase に依存してはならない"
    arch_test:
      from: "apps/backend-api/src/repository/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway は usecase に依存せず、外部システムとデータストアへの接続だけを担う"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層はログを出力せず、業務上の失敗はドメイン例外またはドメインイベントで上位へ伝える"
  - scope: tier:backend
    text: "メール配信などの外部システムはポートインターフェイス越しに呼び、テストでは in-memory 実装に差し替える"
  - scope: tier:backend
    text: "現在時刻は Clock ポート経由で取得し、domain と usecase で直接システム時刻を読まない"
  - scope: tier:frontend
    text: "view は state を経由してデータを得て、api-client を直接呼ばない"
    arch_test:
      from: "apps/frontend/src/view/**"
      to: "apps/frontend/src/api-client/**"
      effect: forbid
      level: layer
  - scope: tier:frontend
    text: "api-client は view に依存してはならない"
    arch_test:
      from: "apps/frontend/src/api-client/**"
      to: "apps/frontend/src/view/**"
      effect: forbid
      level: layer
  - scope: tier:worker
    text: "worker の api-client は jobs に依存してはならない"
    arch_test:
      from: "apps/worker/src/api-client/**"
      to: "apps/worker/src/jobs/**"
      effect: forbid
      level: layer
---

# 背景

RDRA には状態モデルが 4 種 (書籍の状態・貸出の状態・予約の状態・通知の状態) ある。
条件は 21 件あり、貸出可否・予約順位付与・返却後の書籍状態決定のような業務ルールが濃い。
UC は 23 本で、そのうち画面を伴うものが 21 本ある。
worker は定時ジョブの起動役で、業務ルールを持たない (ADR 0001)。

# 決定

- backend-api は presentation / usecase / domain / repository / gateway の 5 層にする。
  - 依存は presentation → usecase → domain、usecase → repository、repository → domain・gateway の向きだけにする。
  - domain は最内層とし、他のレイヤにも外部ライブラリにも依存しない。
  - ディレクトリはレイヤ優先 (`src/<layer>/<業務モジュール>/`) にする。業務モジュールは ADR 0009 の境界に従う。
  - 外部システム (メール配信サービス) と時刻は、ポートインターフェイス越しに使う。テストで差し替えるためである。
  - データストアへのアクセスは repository に置く。DB 製品を乗り換える予定は無いため、repository のインターフェイス化は必須にしない。
- frontend は view / state / api-client の 3 層にする (UC 20 本以上の目安)。
- worker は jobs / api-client の 2 層にする。
- 読み書き分離 (CQRS) は採らない。

# 却下した案

- backend-api を 3 層にする案: 状態遷移と条件の判定を usecase とデータアクセスに混ぜることになり、単体テストで業務ルールを切り出せない。
- すべての依存をインターフェイスで逆転させる案: DB を乗り換える予定が無く、実装コストに見合わない。外部システムと時刻だけに絞る。
- CQRS 案: 読み書き負荷の非対称が小さく (B.1.1.1 Lv1)、複雑さだけが増える。

# 影響

- 利点: 条件 (貸出可否・予約可否など) を domain の単体テストで直接検証できる。
- 利点: 時刻を差し替えられるため、返却期限リマインドや延滞判定を固定日時でテストできる。
- 欠点: 単純な CRUD の UC (書籍情報の編集など) でも 5 層を通るため、記述量が増える。
