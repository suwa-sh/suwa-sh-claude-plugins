# 利用者編集のBackend API仕様

## 責務

user_numberで現行行を取得し、版を照合して編集可能項目だけを保存する。

## 契約

| 操作 | 契約 | 利用条件 |
|---|---|---|
| updateUser | [分割OpenAPI](../../../_cross-cutting/api/openapi/paths/staff_users__user_number_.yaml)のput | 司書。契約のx-networkと[TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)を適用 |

## 処理と結果

処理順序は[シーケンス](spec.md#シーケンス)を参照する。

| 判断 | 処理 | 応答 | 永続化の結果 |
|---|---|---|---|
| BR-AUTH | サーバー側で主体、ロール、接続経路を検証 | 401 / 403 | 業務情報を取得、更新しない |
| BR-INPUT | 対象パス、本文、要求キー、If-Matchを契約に照合 | 400 INVALID_INPUT | 更新なし |
| 対象を利用可能 | user_numberで現行行を取得し、版を照合して編集可能項目だけを保存する。 | 200 | 対象操作を確定 |
| 単体対象なしまたは論理削除済み | 他の対象へ代替しない | 404 NOT_FOUND | 更新なし |
| DBを利用不可 | 依存先の障害を返して処理を終了 | 503 DEPENDENCY_UNAVAILABLE | commit前はrollback。commit後の応答喪失は再送で確認 |

## データ操作

[_model-summary.yaml](_model-summary.yaml)の各table/operationを実行対象とする。

### 原子性

業務対象のsnapshot更新、変更イベントへの成功結果保存、監査ログ追記を、[TR-TX](../../../_cross-cutting/technical-rules.md#tr-tx-状態変更の取引境界)に従って同じRDBトランザクションで確定する。
保存済み成功結果の再送判定は、対象不在や版照合より先に行う。
競合や業務条件不成立では業務更新をrollbackする。

要求の識別と回復は[TR-IDEMP](../../../_cross-cutting/technical-rules.md#tr-idemp-再送と結果の回復)を適用する。
この操作では主体、updateUser、対象パス、X-Idempotency-Key、UserInput、If-Matchを固定して再送する。
取得時のversionをIf-Matchと照合し、不一致は409 VERSION_CONFLICTとする。

### 更新する範囲

更新は契約のUserInputで指定した項目に限定する。
識別子、登録日時、貸出と予約の参照先を保持し、versionを1増やす。
画面が受け取った値以外を上書きせず、未知の項目は入力エラーにする。

## ティア完了条件

```gherkin
Feature: updateUserのサーバー保証
  Scenario: commit後の応答喪失
    Given 要求キー550e8400-e29b-41d4-a716-446655440000の処理がcommit済みで応答が失われている
    When 同じキーと本文と対象でupdateUserを再送する
    Then 最初の成功結果を返し、業務更新を追加で実行しない

  Scenario: 競合時の原子性
    Given 対象更新を確定する前にDB処理が失敗する
    When updateUserを実行する
    Then 503を返し、対象の変更と冪等成功結果の両方が保存されない
```
