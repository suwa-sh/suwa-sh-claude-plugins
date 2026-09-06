# 予約一覧を参照する

## 概要

司書が書籍を選び、その書籍の予約者と現在の順位を確認する。先頭から順に予約状況を表示する。

## データフロー

```mermaid
flowchart LR
  UI["入力: listReservations"] --> API["予約一覧を参照する"]
  DB[("reservations, books, users")] --> API
  API --> OUT["200 Reservation一覧"]
```

## シーケンス

```mermaid
sequenceDiagram
  participant UI as 画面
  participant API as バックエンドAPI
  participant DB as RDB
  UI->>API: listReservations（book_id）
  API->>API: T-01 TR-AUTHで司書と館内経路を確認
  alt T-01 権限外
    API-->>UI: 401 または403
  else 許可
    API->>DB: 同一snapshotで書籍と有効予約と利用者名を取得
    alt T-02 書籍なし
      API-->>UI: 404
    else B-01 有効予約が0件
      API-->>UI: 200 空配列、total=0
    else 有効予約あり
      API->>API: B-02 順位順に整列
      API-->>UI: 200 予約一覧とtotal
    end
  end
```

## 分岐条件の接続

| 分岐ID | 条件の正本 | 結果 |
|---|---|---|
| B-01 | [対象](tier-backend-api.md) | 有効予約0件→200の空配列 |
| B-02 | [予約順位決定](../../../../../rdra/latest/条件.tsv) | 有効予約を現在順位の昇順に表示 |
| T-01 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH) | 許可→照会、認証不成立401/権限外403 |
| T-02 | [TR-ERROR](../../../_cross-cutting/technical-rules.md#TR-ERROR) | 書籍なし→404 |

## 関連 RDRA モデル

| モデル | 要素 | 適用箇所 |
|---|---|---|
| [BUC](../../../../../rdra/latest/BUC.tsv) | 貸出業務 / 書籍を予約するフロー / 予約一覧を参照する | 所属と入力契機 |
| [アクター](../../../../../rdra/latest/アクター.tsv) | 司書 | 操作主体 |
| [情報](../../../../../rdra/latest/情報.tsv) | 予約, 書籍, 利用者 | データ操作と契約 |

## E2E 完了条件（BDD）

```gherkin
Feature: 予約一覧を参照する
  Scenario: 順位順で確認する
    Given B-000101に順位2のR-002と順位1のR-001がある
    When 司書が書籍別予約一覧を開く
    Then R-001、R-002の順に利用者番号と予約状態を表示する

  Scenario: 有効予約がない
    Given B-000101に有効予約がない
    When 司書が書籍別予約一覧を開く
    Then 200の空配列を返し、予約なしと表示する
```

## ティア別仕様

- [tier-backend-api.md](tier-backend-api.md)
- [tier-frontend-staff.md](tier-frontend-staff.md)
- [API索引](_api-summary.yaml)のlistReservations
