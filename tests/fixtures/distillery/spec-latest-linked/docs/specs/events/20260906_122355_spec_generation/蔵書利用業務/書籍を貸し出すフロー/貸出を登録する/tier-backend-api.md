# 貸出登録のBackend API

司書の登録要求から貸出を確定し、再送時には同じ確定結果を返す。
APIの型と応答形式は[OpenAPI](../../../_cross-cutting/api/openapi.yaml)の`createLoan`を参照する。

## T1 入口

| 順序 | 判定 | 不成立時 |
|---|---|---|
| 1 | 認証トークンが有効 | 401。DB更新なし |
| 2 | 司書ロールを持つ | 403。DB更新なし |
| 3 | ヘッダと本文が契約に適合 | 400。DB更新なし |
| 4 | キーの発行時刻が未来5分以内かつ発行から24時間未満 | 未来5分超は400、期限切れは410 |
| 5 | 認証主体、operationId、キーで応答を照合 | [T4](#t4-再送と障害回復)を適用 |

貸出日と返却期限はサーバーが決定する。
貸出日は処理開始時点のAsia/Tokyoの暦日とし、日数加算は暦日単位で行う。

## T2 競合

1. RDBの取引を開始し、認証主体とoperationIdとキーをUNIQUEとするreceipt仮行をINSERTする。request_hashとexpires_atを設定し、応答の3列はNULLとする。
   UNIQUE競合の待機上限は100ミリ秒とし、超過時は全rollbackしてIN_PROGRESSを返す。既存行の一意違反なら全rollbackし、T4で確定receiptを再照合する。
2. [共通規則](../../../_cross-cutting/technical-rules.md)のLOCK-1に従い、利用者、書籍、予約をロックする。
3. 対象書籍の有効予約をすべて予約ID昇順でロックした後、現在値に対して[分岐表](spec.md#分岐の接続表)のB1、B2、B3を順に判定する。
4. 条件成立時は[T3](#t3-更新境界)へ進む。

| 条件 | 応答 | 取引の処理 |
|---|---|---|
| 利用者または書籍が存在しない | 404 `NOT_FOUND` | 全rollback |
| 同一キーの取引が進行中 | 409 `IDEMPOTENCY_KEY_IN_PROGRESS` | 全rollback |
| 業務対象のロックを取得できない | 409 `CONFLICT` | 全rollback |
| B1、B2、B3が不成立 | 分岐表の409 | 全rollback |
| 予約が0件 | B2の通常在庫分岐を評価 | 取引を継続 |

## T3 更新境界

| 順序 | 処理 | 保存先 |
|---|---|---|
| 1 | [モデル操作一覧](_model-summary.yaml)の`register-loan`の業務テーブル更新を実行 | 同一RDB取引 |
| 2 | 201本文とLocationを構築し、仮行の応答3列をUPDATE | 同一取引の`idempotency_receipts` |
| 3 | 業務更新とreceiptをcommit | RDB |
| 4 | 確定したreceiptを期限までキャッシュ | KVS |
| 5 | 保存済み201本文とLocationを返す | HTTP |

| 障害 | 結果 |
|---|---|
| UPDATE対象消失、条件不一致、一意制約違反 | 全rollback、409 `CONFLICT` |
| commit前に失敗しrollbackを確認 | 業務更新とreceiptは未確定。503 |
| commit応答を取得できない | 成否不明。応答可能なら503。次の同一キー要求でreceiptを照合 |
| commit後にKVSへ保存できない | RDBのreceiptから201を返す |
| HTTP応答が失われる | 次の同一キー要求でreceiptから復元 |

応答3列が埋まった場合だけcommitする。仮行のINSERTから最終UPDATEまでは同じ取引に含め、未完了行をcommitしない。

## T4 再送と障害回復

共通方式は[architecture](../../../../../../arch/latest/arch-design.md)のSR-013、SR-025、CTP-006を参照する。

| 対象 | 規則 |
|---|---|
| キー | 暗号学的乱数によるUUIDv7。埋込時刻を発行時刻とする |
| 有効範囲 | 認証主体ID、`createLoan`、キーの組 |
| 要求hash | 検証済みbook_id、user_no、loan_period_typeを固定順JSONでUTF-8化しSHA-256 |
| 期限 | キーの発行時刻+24時間。サーバー現在時刻が期限以上なら410 |
| 復元元 | 同一RDB取引で保存した応答receipt。KVSは期限内のキャッシュ |
| 保持 | receiptとKVSは期限まで保持し、期限以降に削除できる |

| 照合結果 | 処理 |
|---|---|
| キー期限切れ | キャッシュとRDBの有無にかかわらず410 `IDEMPOTENCY_KEY_EXPIRED` |
| 同一キーで要求hashが異なる | 409 `IDEMPOTENCY_KEY_CONFLICT` |
| 同一キーとhashで確定receiptあり | 初回の201、本文、Locationを返す。現在の貸出可否を再評価しない |
| 同一キーの取引が進行中 | 409 `IDEMPOTENCY_KEY_IN_PROGRESS` |
| キー期限内でreceiptなし | T2から実行する |

KVS取得に失敗した場合はRDBを照会する。
receiptに到達できなければ503を返し、新しい業務取引を開始しない。
期限到達後の要求はDB行を削除済みでも拒否するため、期限切れキーから新しい貸出を作成しない。

## ティア完了条件

```gherkin
Feature: 貸出登録の技術境界
  Scenario: ロック失敗で部分更新しない
    Given 別要求が書籍ロックを保持している
    When 貸出を登録する
    Then 409 CONFLICTを返す
    And 業務更新とreceiptは確定しない

  Scenario: 同一キーに異なる本文を渡す
    Given キーに対応する確定receiptが存在する
    When 同じキーで異なるbook_idを送る
    Then 409 IDEMPOTENCY_KEY_CONFLICTを返す
    And 貸出件数は変わらない

  Scenario: 期限境界を越えた再送
    Given キー発行から正確に24時間が経過している
    When 同じ要求を再送する
    Then 410 IDEMPOTENCY_KEY_EXPIREDを返す
```

