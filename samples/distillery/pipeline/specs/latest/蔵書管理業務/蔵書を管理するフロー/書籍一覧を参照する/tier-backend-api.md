# 蔵書一覧のBackend API仕様

## 責務

queryと確定済みページから検索し、削除されていない書籍をbook_id昇順で返す。

## 契約

| 操作 | 契約 | 利用条件 |
|---|---|---|
| listBooks | [分割OpenAPI](../../../_cross-cutting/api/paths/staff_books.yaml)のget | 司書。契約のx-networkと[TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)を適用 |

| listGenres | [ジャンル契約](../../../_cross-cutting/api/paths/genres.yaml)のget | 契約の許可ロールとTR-AUTHを適用 |

## 処理と結果

処理順序は[シーケンス](spec.md#シーケンス)を参照する。

| 判断 | 処理 | 応答 | 永続化の結果 |
|---|---|---|---|
| BR-AUTH | サーバー側で主体、ロール、接続経路を検証 | 401 / 403 | 業務情報を取得、更新しない |
| BR-INPUT | 識別子または検索queryを契約に照合 | 400 INVALID_INPUT | 更新なし |
| 対象を利用可能 | queryと確定済みページから検索し、削除されていない書籍をbook_id昇順で返す。 | 200 | 更新なし |
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
Feature: listBooksのサーバー保証
  Scenario: 認可されない照会
    Given 認証された主体に契約の許可ロールがない
    When listBooksを実行する
    Then 403を返し、対象データを返さない

  Scenario: 依存先障害
    Given DBが接続を受け付けない
    When listBooksを実行する
    Then 503を返し、0件の成功応答として扱わない
```

## 検索と在庫状態

[TR-SEARCH](../../../_cross-cutting/technical-rules.md#tr-search-検索条件の結合)を適用し、未指定の絞り込み条件は制限を加えない。
表示する状態は照会したcurrent_statusを使用し、画面のキャッシュ値から推測しない。
ジャンル名はgenresと結合し、有効予約数と本人予約は同じ読取snapshotで求める。

## ジャンル候補の取得

listGenresはgenresをgenre_id昇順でページ取得する。
genre_id、genre_name、descriptionを同じ行から返し、descriptionがない場合はnullとする。
ページの切出とtotalは同じ読取snapshotで計算する。
呼出元は候補をすべて取得してから表示名とIDの変換に使う。
一覧結果のジャンル名は書籍APIのgenre_nameから取得する。
