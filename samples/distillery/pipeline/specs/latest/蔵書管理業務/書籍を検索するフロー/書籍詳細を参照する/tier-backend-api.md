# 書籍詳細のBackend API仕様

## 責務

book_idで現存書籍を読み、書誌情報と現時点の状態を返す。

## 契約

| 操作 | 契約 | 利用条件 |
|---|---|---|
| getBook | [分割OpenAPI](../../../_cross-cutting/api/openapi/paths/books__book_id_.yaml)のget | 利用者。契約のx-networkと[TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)を適用 |

## 処理と結果

処理順序は[シーケンス](spec.md#シーケンス)を参照する。

| 判断 | 処理 | 応答 | 永続化の結果 |
|---|---|---|---|
| BR-AUTH | サーバー側で主体、ロール、接続経路を検証 | 401 / 403 | 業務情報を取得、更新しない |
| BR-INPUT | 識別子または検索queryを契約に照合 | 400 INVALID_INPUT | 更新なし |
| 対象を利用可能 | book_idで現存書籍を読み、書誌情報と現時点の状態を返す。 | 200 | 更新なし |
| 単体対象なしまたは論理削除済み | 他の対象へ代替しない | 404 NOT_FOUND | 更新なし |
| DBを利用不可 | 依存先の障害を返して処理を終了 | 503 DEPENDENCY_UNAVAILABLE | 更新なし |

## データ操作

[_model-summary.yaml](_model-summary.yaml)の各table/operationを実行対象とする。

### 読取の整合性

書籍、ジャンル、有効予約総数と本人予約を一つの読取スナップショットから取得する。
本人予約を含む応答にはprivate, no-storeを適用する。
書籍IDの照合はバインド値を使い、他人の予約情報を応答へ含めない。
[TR-AUDIT](../../../_cross-cutting/technical-rules.md#tr-audit-操作の追跡)に従い監査を保存してから応答し、保存できなければ503を返す。

## ティア完了条件

```gherkin
Feature: getBookのサーバー保証
  Scenario: 認可されない照会
    Given 認証された主体に契約の許可ロールがない
    When getBookを実行する
    Then 403を返し、対象データを返さない

  Scenario: 依存先障害
    Given DBが接続を受け付けない
    When getBookを実行する
    Then 503を返し、0件の成功応答として扱わない
```
