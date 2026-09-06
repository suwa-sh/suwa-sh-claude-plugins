# 予約状況を参照する

## 概要

利用者は自分の予約状況を開き、予約中の書籍と順位、返却通知の到着状況を確認する。

## データフロー

```mermaid
flowchart LR
  Actor["利用者の照会"] --> API["listMyReservations"]
  Data[("reservations・books")] --> API
  API --> Result["権限範囲内の参照結果"]
  Result --> UI["ReservationTable"]
  API --> Audit[("audit_logs")]
```

## シーケンス

```mermaid
sequenceDiagram
  actor A as 利用者
  participant UI as 画面
  participant API as Backend API
  participant DB as RDB
  A->>UI: 画面を開く
  UI->>API: listMyReservations
  alt B-AUTH 認証・権限不成立
    API-->>UI: 401 / 403
  else B-AUTH 成立
    API->>API: トークンの本人範囲を確定する
    API->>DB: トークンの利用者番号でreservationsを限定し、予約中・通知済みだけをbooksと結合する
    API->>API: 受付日時降順・reservation_id昇順で有効予約のページと全件数を取得する
    API->>DB: 参照の監査を追記
    alt B-STORE 読取または監査が失敗
      API-->>UI: 503（取得した保護情報を返さない）
    else B-STORE 成功
      alt B-EMPTY 対象が0件
        API-->>UI: 200 空の一覧
        UI-->>A: 予約はありません
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
| B-AUTH | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)、[利用状況閲覧範囲判定](../../../../../rdra/latest/条件.tsv) | 不成立は401/403、成立は参照処理 |
| B-STORE | [TR-AUDIT](../../../_cross-cutting/technical-rules.md#TR-AUDIT)、[保存境界](tier-backend-api.md#read-transaction) | 失敗は503、成功は確定した参照結果 |
| B-EMPTY | [空結果](tier-backend-api.md#empty-result) | 0件は空状態、それ以外は一覧 |

## 関連 RDRA モデル

| 対象 | 参照 |
|---|---|
| 所属業務・UC | [BUC.tsv](../../../../../rdra/latest/BUC.tsv)の利用者サービス業務 / 自分の利用状況を確認するフロー / 予約状況を参照する |
| 業務条件 | [利用状況閲覧範囲判定](../../../../../rdra/latest/条件.tsv) |
| 情報 | [情報.tsv](../../../../../rdra/latest/情報.tsv)の利用者・貸出・予約・書籍 |
| 状態の表示 | [状態.tsv](../../../../../rdra/latest/状態.tsv)の予約の状態。参照操作による状態遷移はない |

## E2E完了条件

```gherkin
Feature: 予約状況を参照する
  Scenario: 本人の有効予約と順位を表示する
    Given U1の有効予約R1が順位2、U2の予約R2とU1の取消済みR3が存在する
    When U1が予約状況を開く
    Then U1の予約R1が順位2で表示され、U2の予約R2と取消済みR3は表示されない

  Scenario: 許可されない主体へ情報を返さない
    Given 認証が失効した利用者
    When listMyReservationsを要求する
    Then 401となり本人の履歴を返さない
```

## ティア別仕様

- [画面との接続](tier-frontend-user.md)
- [APIと参照処理](tier-backend-api.md)
