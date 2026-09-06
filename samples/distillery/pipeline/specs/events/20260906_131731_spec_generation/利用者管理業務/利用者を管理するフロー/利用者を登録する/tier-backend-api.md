# 利用者登録のBackend API仕様

## 責務

司書の登録操作に応じてサーバーが利用者番号を採番し、利用者情報を保存する。

## 契約

| 操作 | 契約 | 利用条件 |
|---|---|---|
| createUser | [分割OpenAPI](../../../_cross-cutting/api/paths/staff_users.yaml)のpost | 司書。契約のx-networkと[TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)を適用 |

## 処理と結果

処理順序は[シーケンス](spec.md#シーケンス)を参照する。

| 判断 | 処理 | 応答 | 永続化の結果 |
|---|---|---|---|
| BR-AUTH | サーバー側で主体、ロール、接続経路を検証 | 401 / 403 | 業務情報を取得、更新しない |
| BR-INPUT | 本文と要求キーヘッダーを契約に照合 | 400 INVALID_INPUT | 更新なし |
| 対象を利用可能 | 司書の登録操作に応じてサーバーが利用者番号を採番し、利用者情報を保存する。 | 201 | 対象操作を確定 |
| DBを利用不可 | 依存先の障害を返して処理を終了 | 503 DEPENDENCY_UNAVAILABLE | commit前はrollback。commit後の応答喪失は再送で確認 |

## データ操作

[_model-summary.yaml](_model-summary.yaml)の各table/operationを実行対象とする。

### 原子性

業務対象のsnapshot更新、変更イベントへの成功結果保存、監査ログ追記を、[TR-TX](../../../_cross-cutting/technical-rules.md#tr-tx-状態変更の取引境界)に従って同じRDBトランザクションで確定する。
保存済み成功結果の再送判定は、新規採番より先に行う。
競合や業務条件不成立では業務更新をrollbackする。

要求の識別と回復は[TR-IDEMP](../../../_cross-cutting/technical-rules.md#tr-idemp-再送と結果の回復)を適用する。
この操作では主体、createUser、対象パス、X-Idempotency-Key、UserInputを固定して再送する。
採番は新規要求だけに行い、同じ要求の再送には保存済みの識別子を返す。

### 採番と連絡先

司書の登録操作に応じてAPIが利用者番号を一意に採番する。
[TR-IDEMP](../../../_cross-cutting/technical-rules.md#TR-IDEMP)に従い利用者番号を決定する。
同じ要求の成功記録には保存済みの応答を返す。別要求のID衝突は409 VERSION_CONFLICTでrollbackし、別の番号へ再採番しない。
成功応答の利用者番号を以後の識別子とする。
空の任意連絡先はnullへ変換する。
メールアドレスが同じ利用者を番号の同一人物として統合しない。

## ティア完了条件

```gherkin
Feature: createUserのサーバー保証
  Scenario: commit後の応答喪失
    Given 要求キー550e8400-e29b-41d4-a716-446655440000の処理がcommit済みで応答が失われている
    When 同じキーと本文と対象でcreateUserを再送する
    Then 最初の成功結果を返し、業務更新を追加で実行しない

  Scenario: 競合時の原子性
    Given 対象更新を確定する前にDB処理が失敗する
    When createUserを実行する
    Then 503を返し、対象の変更と冪等成功結果の両方が保存されない
```
