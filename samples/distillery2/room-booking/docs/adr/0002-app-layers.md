---
id: "0002"
title: "backend-api は 5 層、frontend は画面と API 呼び出しの 2 層にし、依存は内側へ向ける"
status: superseded
date: "2026-11-04"
supersedes: []
superseded_by: "0013"
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
scope: [app]
confidence: medium
rules:
  - scope: tier:backend
    text: "backend-api の層は presentation / usecase / domain / repository / gateway の 5 つ (apps/backend-api/src/<層>/) とし、依存は presentation → usecase → domain、usecase → repository、repository → domain・gateway の向きだけにする"
  - scope: tier:backend
    text: "domain 層は他の層へ依存してはならない (usecase に依存しない)"
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
    text: "domain 層は presentation 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/presentation/**"
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
    text: "usecase は presentation へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/usecase/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "repository は usecase へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/repository/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "domain 層は外部ライブラリ (express・pg・pino など) を import しない。純粋な TypeScript で書く"
  - scope: tier:backend
    text: "usecase は repository と時計 (Clock) をインターフェイスで受け取り、composition root (src/app.ts と src/test-app.ts) で実装を渡す"
  - scope: tier:frontend
    text: "frontend の層は画面 (apps/frontend/src/screens/) と API 呼び出し (apps/frontend/src/api/) の 2 つにし、画面は API 呼び出しの層を通して backend-api を呼ぶ"
  - scope: tier:frontend
    text: "API 呼び出しの層は画面の層へ依存してはならない"
    arch_test:
      from: "apps/frontend/src/api/**"
      to: "apps/frontend/src/screens/**"
      effect: forbid
      level: layer
---

# 背景

業務のルールは、時間帯の重なりの判定・予約時刻の妥当性 (開始が終了より前・30 分刻み・過去でない)・取り消しの可否 (本人・開始前・予約済み) の 3 つの条件と、予約済み・取消済みの 2 状態の遷移にある。数は少ないが、「二重に予約できない」という破れてはいけない決まりがある。テスト基盤の計装は presentation / usecase / repository / gateway の層の名前で実行の記録を残す。UC は 4 件で、画面も 4 枚と少ない。

# 決定

- backend-api は presentation / usecase / domain / repository / gateway の 5 層にする。層の名前はテスト基盤の計装と同じにする。
  - presentation: HTTP の受け口。契約の形と業務の形を変換する。
  - usecase: UC 1 本の手順。トランザクションの境界。
  - domain: 業務のルール (時間帯・予約・取り消しの可否)。最も内側で、他の層にも外部ライブラリにも依存しない。
  - repository: 集約の保存と取得。
  - gateway: 外部とのやり取り (ID トークンの検証の鍵の取得など)。
- usecase は repository と時計をインターフェイスで受け取る (テストで pglite と固定の時計に差し替えるため)。
- frontend は画面と API 呼び出しの 2 層にする (UC 20 未満の目安)。
- 読み書きの分離 (CQRS) はしない。

# 却下した案

- backend-api を 3 層 (presentation / service / data) にする: 業務のルールがサービスの中に散り、二重予約の決まりをどこで守るかがぼやける。テスト基盤の計装の層の名前とも合わない。
- 2 層 (CRUD) にする: 重なりの判定と取り消しの可否は単純な CRUD ではない。
- frontend を 3 層 (画面 / 状態 / API 呼び出し) にする: 画面 4 枚では状態の層を分ける価値が小さい。
- CQRS: 読み書きの負荷は小さく対称に近い。複雑さだけが増える。

# 影響

- 業務のルールは domain の単体テストだけで確かめられる。
- 層の依存の向きはアーキテストで機械的に検査される。
- 小さなシステムとしては層が多めで、UC 1 本あたりのファイルが増える。
