# 貸出を登録する

## 概要

司書が窓口で書籍と利用者を指定し、貸出を確定する。UC ID: `60d99956`。
生成結果は **needs-spec-change / draft**。業務分岐 B1–B3 と障害回復 T4 が未確定のため実装着手の完了仕様ではない。
参照先は常に前段の latest。本文内の `docs/...` はこのサンプルのプロジェクトルート相対。過去イベントは生成記録であり、現在の業務定義の正本にしない。

## データフロー

```mermaid
flowchart LR
  Staff[司書: 書籍ID・利用者番号・期間区分] --> Page[窓口貸出受付]
  Page -->|createLoan: 契約の要求| API[Backend API]
  API -->|判定用の現在値| DB[(RDB: 書籍・利用者・予約)]
  DB -->|ロック後の現在値| API
  API -->|一取引の更新集合| Records[(RDB: 貸出・書籍・利用者・予約)]
  API -->|重複照会・結果記録 T4未確定| KVS[(KVS)]
  API -->|契約の成功またはエラー| Page
  Page -->|確定結果のみ| Staff
```

型・必須項目・HTTPコードは [API対応表](_api-summary.yaml) の `createLoan` と [分割OpenAPI入口](../../../_cross-cutting/api/openapi.yaml) を参照する。
上図の更新集合は [_model-summary.yaml](_model-summary.yaml)。業務データと冪等結果の二重書込については T4 を参照する。

## シーケンス

```mermaid
sequenceDiagram
  actor S as 司書
  participant P as Page（要求とキーの所有者）
  participant A as Backend API
  participant D as RDB
  participant K as KVS
  S->>P: 入力を確認して登録
  P->>A: createLoan（凍結した要求+同じ操作のキー）
  alt T1: 認証/契約検証に不成立
    A-->>P: 契約の4xx、業務更新なし
  else T1成立
    A->>K: T4 重複照会
    alt T4: 処理済み
      A-->>P: 保存済み結果（障害回復の正本はCR006）
    else 未処理
      A->>D: BEGIN / 利用者→書籍→予約順に排他取得
      D-->>A: 現在値（不足対象は404）
      alt T2: 排他取得失敗
        A->>D: ROLLBACK
        A-->>P: 409 CONFLICT、更新なし
      else T2成立
        A->>A: B1 利用者 / B2 貸出可否 / B3 期限
        alt B1またはB2不成立
          A->>D: ROLLBACK
          A-->>P: 契約の業務エラー、更新なし
        else 業務条件成立（CR001–003で確定待ち）
          A->>D: _model-summaryの更新集合を実行
          alt T3: COMMIT前に失敗
            A->>D: ROLLBACK
            A-->>P: 技術エラー、確定更新なし
          else COMMIT成功
            A->>K: T4 結果保存（途中障害時の回復未確定）
            A-->>P: 201（応答喪失時は結果不明）
            P-->>S: LoanConfirmationへ応答を接続
          end
        end
      end
    end
  end
```

これは生成時の設計ドラフトであり、未確定の分岐を実行時に「仕様不足エラー」に変える指示ではない。還流で解決するまで昇格しない。

## 分岐の接続表

| ID | 条件の正本・要素 | 成立／不成立の接続 | 生成時判定 |
|---|---|---|---|
| B1 | [RDRA 条件](../../../../../../rdra/latest/条件.tsv)：貸出管理／貸出可否条件、[RDRA 状態](../../../../../../rdra/latest/状態.tsv)：利用者状態 | 許可ならB2、拒否なら更新なしで業務エラー | CR003: 「利用可能」と業務状態の対応未定義 |
| B2 | [RDRA 条件](../../../../../../rdra/latest/条件.tsv)：貸出可否条件・取置き中書籍貸出条件 | 許可ならB3、拒否なら更新なしで業務エラー | CR002: 予約待ちの拒否と取置き優先の優先順位が不明 |
| B3 | [RDRA 条件](../../../../../../rdra/latest/条件.tsv)：返却期限設定条件、[RDRA バリエーション](../../../../../../rdra/latest/バリエーション.tsv)：利用者区分・貸出期間区分 | 適用可能なら期限を得て更新集合へ、不適合は期間エラー | CR001: 日数と区分対応が未定義 |
| T1 | [Backend T1](tier-backend-api.md#t1-入口) | 認証・契約検証後T4、失敗は4xx | 定義済み |
| T2 | [Backend T2](tier-backend-api.md#t2-競合) | 取得後B1、失敗はrollback | 定義済み |
| T3 | [Backend T3](tier-backend-api.md#t3-更新境界) | commit後T4、不成立は全rollback | 定義済み |
| T4 | [Arch](../../../../../../arch/latest/arch-design.md)：SR-013 / SR-025 / CTP-006、[Backend T4](tier-backend-api.md#t4-再送と障害回復) | 同じ要求への前回結果再送、異なる要求は拒否 | CR006: DBcommit後のKVS書込失敗からの回復未確定 |

## 状態遷移参照・関連 RDRA モデル

[RDRA 状態](../../../../../../rdra/latest/状態.tsv) の `遷移UC=貸出を登録する` にある書籍状態・貸出状態・利用者状態・予約状態を適用する。状態表をここへ転記しない。
同時永続化する操作はモデル操作一覧が正本。B1/B2の未確定箇所を、表の遷移だけから推測して補完しない。
[RDRA BUC](../../../../../../rdra/latest/BUC.tsv) の業務=蔵書利用業務／BUC=書籍を貸し出すフロー／UC=貸出を登録するが範囲の正本。

## E2E 完了条件

以下は受入仕様。`@blocked` は今回実行できない期待値であり合格扱いにしない。

```gherkin
Feature: 貸出を登録する
  Scenario: 認証されていない登録要求は更新しない
    Given 認証ヘッダのない契約に適合する貸出要求
    When createLoanを呼び出す
    Then 401を返す
    And 貸出・書籍・利用者・予約に変更はない

  @blocked @CR001 @CR003
  Scenario: RDRAで許可された利用者と期間で貸出を確定する
    Given RDRA latestで貸出可能と確定した利用者と在庫書籍
    And RDRA latestで対応する期間区分と日数が確定している
    When 有効なUUIDの冪等キーで登録する
    Then RDRAの計算で得られる返却期限を201応答で返す
    And 遷移UCが貸出を登録する状態変更が一取引で確定する

  @blocked @CR002 @CR003
  Scenario: 取置き対象者への貸出の分岐を一意に選べる
    Given 予約待ちの書籍と予約順1位の取置き対象者
    When 貸出を登録する
    Then RDRA latestで確定した条件の優先順位により許可または拒否の一方に決まる

  @blocked @CR006
  Scenario: commit後に応答が失われても重複貸出しない
    Given 初回のDB更新はcommit済みでKVS結果保存前にプロセスが停止した
    When 保持期間内に同じキーと要求を再送する
    Then 初回と同じ貸出IDと応答を返し貸出件数を増やさない
```

## ティア別仕様

- [Backend API](tier-backend-api.md)：処理順序・排他・更新境界・再送。
- [Frontend staff](tier-frontend-staff.md)：Storybook接続・画面状態・API呼出。
- [レビュー結果](../../../_review/implementation-readiness.md) と [還流要求](../../../feedback-requests/20260906_120000_spec_feedback_60d99956.md)。
