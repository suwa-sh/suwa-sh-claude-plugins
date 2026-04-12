# 予約状況を確認する

## 概要

予約状況を確認するの処理を実行する。

## データフロー

```mermaid
graph LR
  subgraph BE["tier-backend-api"]
    BE_Pres["presentation\nRequest"]
    BE_UC["usecase\nCommand/Query"]
    BE_Domain["domain\nEntity"]
    BE_GW["gateway\nRepository"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_GW
  end
  subgraph DB["RDB"]
    DB_Table[("tables")]
  end
  BE_GW --> DB_Table
  DB_Table --> BE_GW --> BE_Domain --> BE_UC --> BE_Pres
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| BE presentation | Request/Response DTO | バリデーション + Command/Query 変換 |
| BE domain | Entity | ビジネスルール適用 |
| BE gateway | Repository | データ永続化 |

## 処理フロー

```mermaid
sequenceDiagram
  participant Client as クライアント
  box rgb(240,255,240) tier-backend-api
    participant Pres as presentation
    participant UC as usecase
    participant GW as gateway
  end
  participant DB as RDB

  Client->>Pres: リクエスト
  Pres->>UC: Command/Query
  UC->>GW: データ操作
  GW->>DB: SQL
  DB-->>GW: 結果
  GW-->>UC: ドメインモデル
  UC-->>Pres: レスポンス
  Pres-->>Client: HTTP レスポンス
```

## バリエーション一覧

該当なし

## 分岐条件一覧

該当なし

## 計算ルール一覧

該当なし

## 状態遷移一覧

該当なし

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 閲覧業務 | このUCが属する業務 |
| BUC | 利用者マイページフロー | このUCを含むBUC |
| アクター | 利用者 | 操作するアクター |
| 情報 | 予約 | 参照・更新する情報 |




## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 予約状況を確認する

  Scenario: 予約状況を確認するの正常実行
    Given 利用者「田中太郎」がログイン済み
    When 予約状況画面で操作を実行する
    Then 処理が正常に完了する
```

### 異常系

```gherkin
  Scenario: 未認証アクセスの拒否
    Given ユーザーが未ログイン状態
    When 予約状況画面にアクセスする
    Then ログイン画面にリダイレクトされる
```

## ティア別仕様

- [tier-frontend](tier-frontend.md)
- [tier-backend-api](tier-backend-api.md)
