# 利用者一覧のBackend API仕様

## 責務

削除されていない利用者を検索し、user_number昇順でページを返す。

## 契約

| 操作 | 契約 | 利用条件 |
|---|---|---|
| listUsers | [分割OpenAPI](../../../_cross-cutting/api/paths/staff_users.yaml)のget | 司書。契約のx-networkと[TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)を適用 |

## 処理と結果

処理順序は[シーケンス](spec.md#シーケンス)を参照する。

| 判断 | 処理 | 応答 | 永続化の結果 |
|---|---|---|---|
| BR-AUTH | サーバー側で主体、ロール、接続経路を検証 | 401 / 403 | 業務情報を取得、更新しない |
| BR-INPUT | 識別子または検索queryを契約に照合 | 400 INVALID_INPUT | 更新なし |
| 対象を利用可能 | 削除されていない利用者を検索し、user_number昇順でページを返す。 | 200 | 更新なし |
| 該当0件 | 空配列を返す | 200 / total=0 | 業務変更なし |
| DBを利用不可 | 依存先の障害を返して処理を終了 | 503 DEPENDENCY_UNAVAILABLE | 更新なし |

## データ操作

[_model-summary.yaml](_model-summary.yaml)の各table/operationを実行対象とする。

### 読取の整合性

一覧のitemsとtotalは一つの読取スナップショットから計算する。
ページ移動時のデータ増減は次の要求の結果として反映する。
検索文字列はバインド値で渡し、SQLの構造や列名として評価しない。
利用者情報の応答にはprivate, no-storeを適用し、本文や連絡先をアクセスログへ書かない。
[TR-AUDIT](../../../_cross-cutting/technical-rules.md#tr-audit-操作の追跡)に従い監査を保存してから応答し、保存できなければ503を返す。

## ティア完了条件

```gherkin
Feature: listUsersのサーバー保証
  Scenario: 認可されない照会
    Given 認証された主体に契約の許可ロールがない
    When listUsersを実行する
    Then 403を返し、対象データを返さない

  Scenario: 依存先障害
    Given DBが接続を受け付けない
    When listUsersを実行する
    Then 503を返し、0件の成功応答として扱わない
```

## 利用者の照合

queryを利用者番号の完全一致または氏名の部分一致でOR照合する。
空文字または省略時は全利用者を対象とし、メールや住所を検索条件へ拡張しない。
同じ検索条件でtotalを計算し、user_numberの昇順でページを切り出す。
