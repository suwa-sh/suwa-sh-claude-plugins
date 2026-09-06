# 予約を取り消す

## 概要

利用者が自分の予約を選んで取り消す。後続の予約順位を繰り上げ、先頭の取消による書籍状態と次の通知要求を確定する。

## データフロー

```mermaid
flowchart LR
  UI["入力: cancelReservation"] --> API["予約を取り消す"]
  DB[("reservations, books, notifications, notification_outbox")] --> API
  API --> OUT["200 Reservation（取消結果）"]
  API --> DB
```

## シーケンス

```mermaid
sequenceDiagram
  participant UI as 画面
  participant API as バックエンドAPI
  participant DB as RDB
  UI->>API: cancelReservation（reservation_id、version）
  API->>API: TR-AUTH / TR-IDEMP
  API->>DB: 本人予約を確認し書籍→予約をlock
  alt B-01 本人の対象がない
    API-->>UI: 404
  else T-01 既に取消
    API-->>UI: 200 現在の取消結果（追加更新なし）
  else T-02 version不一致または終了
    API-->>UI: 409 または422
  else 取消可能
    rect rgb(238,245,255)
      API->>DB: 予約取消、B-02 後続順位の繰上げ
      alt B-03 予約待ち書籍の有効予約が0件
        API->>DB: 書籍を在庫ありに更新
      else B-04 予約待ち書籍の先頭が交代
        API->>DB: 次の先頭への通知要求とoutboxを保存
      else その他
        Note over API,DB: 書籍状態と通知要求は変えない
      end
      API->>DB: イベント、監査、確定応答を保存
      alt T-03 commit失敗
        DB-->>API: 全変更rollback
        API-->>UI: 503
      else commit成功
        API-->>UI: 200 取消結果
      end
    end
  end
```

## 分岐条件の接続

| 分岐ID | 条件の正本 | 結果 |
|---|---|---|
| B-01 | [利用状況閲覧範囲判定](../../../../../../rdra/latest/条件.tsv) | 本人→取消判定、本人外→404 |
| B-02 | [予約順位決定](../../../../../../rdra/latest/条件.tsv) | 有効な後続予約を繰り上げる |
| B-03 | [書籍の状態、遷移UC「予約を取り消す」](../../../../../../rdra/latest/状態.tsv) | 予約待ちの有効予約0件→在庫あり |
| B-04 | [予約の状態、通知済みから取消](../../../../../../rdra/latest/状態.tsv) | 先頭交代→次の先頭へ通知要求、交代なし→要求なし |
| T-01 | [TR-IDEMP](../../../_cross-cutting/technical-rules.md#TR-IDEMP) | 取消済み→200で現在値、追加更新なし |
| T-02 | [TR-TX](../../../_cross-cutting/technical-rules.md#TR-TX) | version不一致→409、終了→422 |
| T-03 | [TR-TX](../../../_cross-cutting/technical-rules.md#TR-TX) | 成功→200、失敗→rollbackして503 |

## 状態遷移参照

[状態](../../../../../../rdra/latest/状態.tsv)の予約の状態、書籍の状態、遷移UC「予約を取り消す」を参照する。
原子的な更新は[_model-summary.yaml](_model-summary.yaml)の操作を参照する。

## 関連 RDRA モデル

| モデル | 要素 | 適用箇所 |
|---|---|---|
| [BUC](../../../../../../rdra/latest/BUC.tsv) | 貸出業務 / 書籍を予約するフロー / 予約を取り消す | 所属と入力契機 |
| [アクター](../../../../../../rdra/latest/アクター.tsv) | 利用者 | 操作主体 |
| [情報](../../../../../../rdra/latest/情報.tsv) | 予約, 書籍 | データ操作と契約 |

## E2E 完了条件（BDD）

```gherkin
Feature: 予約を取り消す
  Scenario: 通知済みの先頭を取り消す
    Given 予約待ち書籍B-000101の先頭R-001が本人の通知済み予約で、R-002が後続にある
    When 利用者がR-001を取り消す
    Then R-001は取消、R-002は順位1になり、R-002の返却通知要求が1件保存される

  Scenario: 最後の予約を取り消す
    Given 書籍が予約待ちで、本人のR-001だけが有効予約である
    When 本人がR-001を取り消す
    Then R-001は取消になり、書籍は在庫ありになる

  Scenario: 他人の予約を指定する
    Given R-001はU-000124の予約である
    When U-000123がR-001の取消を要求する
    Then 404を返し、予約の存在や個人情報を返さず、順位も変えない
```

## ティア別仕様

- [tier-backend-api.md](tier-backend-api.md)
- [tier-frontend-user.md](tier-frontend-user.md)
- [API索引](_api-summary.yaml)のcancelReservation
