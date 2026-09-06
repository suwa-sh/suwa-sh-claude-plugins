# 利用者の利用状況を参照する

## 概要

司書は窓口で利用者番号を指定し、その利用者の貸出履歴と有効な予約をまとめて確認する。

## データフロー

```mermaid
flowchart LR
  Actor["司書の照会"] --> API["getUserActivity"]
  Data[("users・loans・reservations・books")] --> API
  API --> Result["権限範囲内の参照結果"]
  Result --> UI["LoanTable / ReservationTable"]
  API --> Audit[("audit_logs")]
```

## シーケンス

```mermaid
sequenceDiagram
  actor A as 司書
  participant UI as 画面
  participant API as Backend API
  participant DB as RDB
  A->>UI: 画面を開く
  UI->>API: getUserActivity
  alt B-AUTH 認証・権限不成立
    API-->>UI: 401 / 403
  else B-AUTH 成立
    API->>API: 館内接続と司書ロールを検証する
    API->>DB: 指定利用者の存在を確認し、同じ利用者番号のloansと有効なreservationsをbooksと結合する
    break B-USER 利用者が存在しない
      API-->>UI: 404 NOT_FOUND
    end
    API->>DB: 指定利用者の貸出・有効予約を同一snapshotで取得
    API->>API: user・loans・reservationsを同じRDB読取スナップショットで取得する
    API->>DB: 参照の監査を追記
    alt B-STORE 読取または監査が失敗
      API-->>UI: 503（取得した保護情報を返さない）
    else B-STORE 成功
      alt B-EMPTY 対象が0件
        API-->>UI: 200 空の一覧
        UI-->>A: 貸出と予約のそれぞれに空状態を表示する
      else B-EMPTY 対象あり
        API-->>UI: 200 対象一覧
        UI-->>A: 対象の属性と状態
      end
    end
  end
```

## 分岐条件の接続

| 分岐ID | 条件の正本 | 行先 |
|---|---|---|
| B-AUTH | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)、[利用状況閲覧範囲判定](../../../../../../rdra/latest/条件.tsv) | 不成立は401/403、成立は参照処理 |
| B-STORE | [TR-AUDIT](../../../_cross-cutting/technical-rules.md#TR-AUDIT)、[保存境界](tier-backend-api.md#read-transaction) | 失敗は503、成功は確定した参照結果 |
| B-EMPTY | [空結果](tier-backend-api.md#empty-result) | 0件は空状態、それ以外は一覧 |
| B-USER | [対象存在](tier-backend-api.md#user-exists) | 不在は404で終了 |

## 関連 RDRA モデル

| 対象 | 参照 |
|---|---|
| 所属業務・UC | [BUC.tsv](../../../../../../rdra/latest/BUC.tsv)の利用者サービス業務 / 自分の利用状況を確認するフロー / 利用者の利用状況を参照する |
| 業務条件 | [利用状況閲覧範囲判定](../../../../../../rdra/latest/条件.tsv) |
| 情報 | [情報.tsv](../../../../../../rdra/latest/情報.tsv)の利用者・貸出・予約・書籍 |
| 状態の表示 | [状態.tsv](../../../../../../rdra/latest/状態.tsv)の貸出の状態・予約の状態。参照操作による状態遷移はない |

## E2E完了条件

```gherkin
Feature: 利用者の利用状況を参照する
  Scenario: 指定利用者の利用状況をまとめて表示する
    Given 司書S1が館内接続しており、利用者U2に貸出L2と予約R2がある
    When S1が利用者番号U2を指定する
    Then U2の氏名・貸出L2・予約R2を表示し、U1の履歴は混在しない

  Scenario: 許可されない主体へ情報を返さない
    Given 利用者ロールのU1が館外からアクセスしている
    When getUserActivityを要求する
    Then 403となり本人の履歴を返さない
```

## ティア別仕様

- [画面との接続](tier-frontend-staff.md)
- [APIと参照処理](tier-backend-api.md)
