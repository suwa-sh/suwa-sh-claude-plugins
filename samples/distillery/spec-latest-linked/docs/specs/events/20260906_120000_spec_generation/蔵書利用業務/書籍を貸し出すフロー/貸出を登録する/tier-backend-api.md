# Backend API — 貸出を登録する

`createLoan` の契約は [OpenAPI入口](../../../_cross-cutting/api/openapi.yaml)、業務分岐は [spec.md](spec.md)。型表・業務条件の再定義は置かない。
[Arch](../../../../../../arch/latest/arch-design.md) の tier-backend-api / usecase / repository、およびSP-024を適用する。

## T1 入口

認証を先に行い、司書の認可後にパス・ヘッダ・本文をOpenAPIで検証する。欠落/不正なら契約の4xx、DB更新もキーの確定保存もしない。
送信元の入力名変換はFrontendに置く。サーバーはAPI本文だけを受け取る。業務状態・期限はクライアント値から採用しない。
認証/共通エラーの共通規則は [参照索引](../../../_cross-cutting/technical-rules.md) AUTH-1 / ERROR-1。

## T2 競合

更新前にRDBの一取引で利用者1件→書籍1件→対象書籍の予約（予約ID昇順）の順に排他ロックを取得し、最新状態でB1–B3を評価する。
ロックは待機せず取得失敗時はrollbackし409 `CONFLICT`。存在しない書籍・利用者はrollbackして404。利用者ロックだけ取得後に書籍欠落が判明した場合もrollbackして全ロックを解放する。予約0件は欠落エラーにせずB2の入力として扱う。別要求が先に確定している場合は最新状態のB1/B2で判定する。
同じ書籍の新規予約/取消との競合も同じ書籍ロックを取得する共有規約 LOCK-1に従う。読取だけの事前可否確認は登録許可を保証しない。

## T3 更新境界

B1–B3確定後の [_model-summary.yaml](_model-summary.yaml) `mutation_set=register-loan` を一取引で処理する。
関連状態はRDRA latestの遷移参照から適用する。返却期限はB3だけを使用する。
UPDATE対象の消失・条件不一致、INSERTの一意制約違反は全rollback。競合は409 `CONFLICT`、接続障害等は応答可能なら503 `TEMPORARILY_UNAVAILABLE`。これは未更新を保証する応答ではなく、確定結果を返せないことを表す。
commit前に接続が失われ結果が確定できなければ未成功とは断定せずT4の照合へ進む。commit確定後のみ201応答を組み立てる。
途中成功を返さず、監査ログにトークンや氏名・連絡先を含めない。

## T4 再送と障害回復

OpenAPI `IdempotencyKeyHeader` はdraftとしてCR006を参照しており、保持期間・再送プロトコルはまだ確定していない。以下は満たすべき応答分岐の候補であり、実装可能な確定契約ではない。
CR006で契約化する候補: 同じキーの異なる本文は409 `IDEMPOTENCY_KEY_CONFLICT`、実行中は409 `IDEMPOTENCY_KEY_IN_PROGRESS`、完了は保存済みのステータス/本文/Locationを返す。
照合は現時点の貸出可否を再判定する前に行い、確定済み要求を再実行しない。キーの期限外自動再送は行わない。

**未確定（CR006）**: [Arch](../../../../../../arch/latest/arch-design.md) はKVS結果再送とRDB冪等列UNIQUEを要求するが、RDB commit後・KVS保存前の停止時に元の応答を復元するデータと期限処理を決めていない。
この出力では無期限receiptや新しい保持期間を採用しない。原子性・復元元・期限経過後の照合がarch latestで決まり次第、KVS操作とRDB補助列を生成する。
したがってT3は業務更新集合のみの定義であり、T4を含む登録処理全体は実装可能とは判定しない。

## ティア完了条件

```gherkin
Feature: 貸出登録の技術境界
  Scenario: ロック失敗で部分更新しない
    Given 書籍の更新ロックを別要求が保持している
    When 登録要求が同じ書籍のロックを試みる
    Then 409 CONFLICTを返す
    And 今回の貸出INSERTと他の全UPDATEは確定しない

  @blocked @CR006
  Scenario: 成功応答の再送は最新状態に依存しない
    Given 初回がcommit済みで保持期間内である
    And 書籍の状態はその後に変わっている
    When 同じキーと本文で再送する
    Then 初回のステータスと本文とLocationが返る
```
