# 決定候補カタログ: アプリのレイヤ構成と依存方向

各ティアの内部レイヤと依存方向を決める。ADR の `scope: [app]`。
レイヤ構成 ADR には依存方向を守らせる `arch_test` を最低 1 つ付ける (プランの必須要件)。

---

## レイヤ段数

- **選択肢**: 5 層 / 3 層 / 2 層
- **向く条件 (5 層)**: 状態遷移 5 種以上、または条件が 10 件以上 (high)。ビジネスルールが濃い。
- **向く条件 (3 層)**: BUC は複雑だが 5 層ほどではない。
- **向く条件 (2 層)**: CRUD 中心。
- **frontend の目安**: UC 20 以上 → 3 層 (view / state / apiClient)、未満 → 2 層。
- **worker**: 状態遷移やビジネスルールを扱うなら backend-api と domain / repository / gateway を共有して 5 層。

## 標準 5 層と依存方向 (採用時)

内側ほど依存されない。`presentation → usecase → domain(最内層) `、`usecase → domain, repository`、`repository → domain, gateway`、`gateway → 外部 (依存なし)`。

- **domain は最内層**: 他レイヤへ依存しない。ログ出力もしない (ドメインイベント / 例外で通知する)。
- **gateway は Driven Side**: adapter はデータストアモデルと 1:1、client は SDK ラッパー。
- **派生するルール例 (arch_test 付き)**:
  ```yaml
  - scope: tier:backend
    text: "domain 層は他レイヤ・外部ライブラリへ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/infrastructure/**"
      effect: forbid
  - scope: tier:backend
    text: "presentation は usecase を経由し、repository を直接呼ばない"
    arch_test:
      from: "apps/backend-api/src/presentation/**"
      to: "apps/backend-api/src/repository/**"
      effect: forbid
  ```

## インターフェイス導入 (凹型 / 依存逆転)

段数とは独立の軸。IF を挟むか、直接依存で始めるか。

- **向く (IF 導入)**: 外部 API の変更が頻繁 / DB 製品を乗り換える予定 / チームをレイヤで分割 / gateway を mock してテストしたい。
- **向かない (IF なしで開始)**: 外部サービス・DB を乗り換えない、データモデルが安定、開発スピード優先。usecase API は増減するが変更は稀。
- **派生するルール例**:
  ```yaml
  - scope: tier:backend
    text: "gateway はポートインターフェイスを介して呼び、テストでは in-memory 実装に差し替える"
  ```

## 読み書き分離 (CQRS)

- **向く条件**: 検索系と更新系が混在し、読み書き負荷が非対称 (NFR B.1.1 Lv3 以上)。
- **向かない**: 単純 CRUD。早すぎる CQRS は複雑さだけ増える (アンチパターン)。
