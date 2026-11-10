---
id: "0013"
title: "backend-api の層の依存は許可する 6 方向だけにし、それ以外の 14 方向をすべてアーキテストで禁止する"
status: accepted
date: "2026-11-04"
supersedes: ["0002"]
superseded_by: null
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
scope: [app]
confidence: medium
rules:
  - scope: tier:backend
    text: "backend-api の層は presentation / usecase / domain / repository / gateway の 5 つ (apps/backend-api/src/<層>/) とし、依存は presentation → usecase・domain、usecase → domain・repository、repository → domain・gateway の 6 方向だけにする。presentation → domain は業務のエラーの型とコード・値オブジェクトを読むためだけに許可する"
  - scope: tier:backend
    text: "gateway 層は外部とのやり取りだけを持つ最も外側の部品とし、他の層 (presentation・usecase・domain・repository) を import しない。gateway の実装は呼ぶ側が定めるインターフェイスを型の形で満たし、composition root (src/app.ts と src/test-app.ts) で渡す"
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
    text: "presentation は gateway を直接 import しない (トークンの検証器はインターフェイスで受け取る)"
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
    text: "usecase は gateway を直接 import しない (時計などはインターフェイスで受け取る)"
    arch_test:
      from: "apps/backend-api/src/usecase/**"
      to: "apps/backend-api/src/gateway/**"
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
    text: "repository は presentation へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/repository/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway は presentation へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway は usecase へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/usecase/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway は repository へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
      level: layer
  - scope: tier:backend
    text: "gateway は domain へ依存してはならない (外部の応答は素の型で返し、業務の値への変換は呼ぶ側で行う)"
    arch_test:
      from: "apps/backend-api/src/gateway/**"
      to: "apps/backend-api/src/domain/**"
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

基盤の段の第三者レビュー (課題 `docs/feedback/20261104_114542_foundation_foundation-refute-20261104T114333Z_adr-0002-arch-test-gaps.md`。UC からではなく基盤の段から出た課題で `from_uc` は無い) で、ADR 0002 の穴が 2 つ見つかった。

- ADR 0002 は「依存は許可した向きだけ」と書くが、アーキテストの禁止は 8 本だけだった。usecase → gateway、repository → presentation、gateway → 他の 4 層の 6 方向が禁止されておらず、実装者が足しても依存の検査を通ってしまう。
- presentation → domain は許可の列挙に無いのに禁止もされていなかった。一方 ADR 0010 は presentation が domain の業務のエラーのコードを契約のエラー型へ変換すると決めており、文と食い違っていた。

アーキテストの生成器は ADR の `arch_test` をそのまま写すため、直すのは ADR の側になる。

# 決定

- ADR 0002 を置き換える。層の構成 (5 層と frontend の 2 層)・composition root・domain の純粋さは ADR 0002 のまま引き継ぐ。
- backend-api で許可する依存は次の 6 方向だけにする。5 層の組み合わせ 20 方向のうち、残る 14 方向をすべて `effect: forbid` のアーキテストにする。

| from \ to | presentation | usecase | domain | repository | gateway |
|---|---|---|---|---|---|
| presentation | - | 許可 | 許可 (業務のエラーと値オブジェクト) | 禁止 | 禁止 |
| usecase | 禁止 | - | 許可 | 許可 | 禁止 |
| domain | 禁止 | 禁止 | - | 禁止 | 禁止 |
| repository | 禁止 | 禁止 | 許可 | - | 許可 |
| gateway | 禁止 | 禁止 | 禁止 | 禁止 | - |

- presentation → domain は、ADR 0010 のとおり業務のエラーのコードを契約のエラー型に変えるため、また値オブジェクトを組み立てるために許可する。
- gateway はどの層も import しない最も外側の部品にする。トークンの検証器 (ADR 0006) や時計の実装は、呼ぶ側 (presentation・usecase) が定めるインターフェイスを型の形で満たし、composition root で渡す。外部の応答は素の型で返し、業務の値への変換は呼ぶ側で行う。

# 却下した案

- ADR 0002 を残し、足りない禁止だけを別の ADR に足す: ADR 0002 の「許可した向きだけ」の文が presentation → domain を含まないまま残り、ADR 0010 との食い違いが解けない。
- presentation → domain を禁止する: presentation が業務のエラーのコードを読めず、ADR 0010 のエラーの変換を usecase に持たせることになる。usecase が HTTP の status を知ることになり、層の責務が崩れる。
- gateway → domain を許可する (gateway が業務の値を返す): gateway が業務の型に縛られ、外部の仕組みの差し替えのたびに domain の変更が波及しやすい。素の型で返せば足りる。
- アーキテストを「許可の列挙以外はすべて禁止」(allow の書き方) にする: 生成器は ADR の `arch_test` を規則 1 本ずつに写す作りで、禁止の網羅を ADR に明示するほうが規則と文の対応を追いやすい。

# 影響

- 層の間の依存の誤りは、許可の 6 方向を除いてすべて依存の検査で止まる。
- gateway の実装は呼ぶ側のインターフェイスを import できないため、型の形で合わせる (TypeScript の構造的な型で満たす)。合っているかは composition root の型検査で確かめる。
- 開発ルール (docs/rules/) とアーキテスト (.dependency-cruiser.cjs) は作り直しが要る (この ADR の受理後に行う)。
