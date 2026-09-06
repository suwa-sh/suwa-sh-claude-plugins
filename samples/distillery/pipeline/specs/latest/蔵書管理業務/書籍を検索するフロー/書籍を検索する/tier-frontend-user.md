# 書籍検索の利用者画面仕様

## 責務

書籍の照会条件をAPIへ渡し、受け取った結果と次の操作を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| ルート | `/search`。[ScreenMapping](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)の「蔵書検索画面」 |
| 利用条件 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)。認証された利用者 |
| 部品Story | [Books Stories](../../../../../design/latest/storybook-app/src/components/domain/Books.stories.tsx) のSearchFilterPatron |

## データの取得

| 操作 | 入力元 | 使用する応答 | 取得中と失敗時 |
|---|---|---|---|
| searchBooks | URLに確定した検索条件とpage/page_size | items、total、page | 初回はloading、失敗時は条件を保持して再取得 |
| listGenres | page=1からpage_size=100でtotal件まで取得 | genre_idとgenre_nameの対応 | 全件取得前は検索を停止し、失敗時は再取得 |

操作の型と応答コードは[_api-summary.yaml](_api-summary.yaml)の該当operationから分割契約を参照する。

## 部品への接続

| 部品と定義先 | 受取先 | 供給元または処理 |
|---|---|---|
| [BookSearchFilter](../../../../../design/latest/storybook-app/src/components/domain/BookSearchFilter.tsx) | value / onChange | Pageの編集中検索条件。onChangeは未送信条件だけを変更する |
| [BookSearchFilter](../../../../../design/latest/storybook-app/src/components/domain/BookSearchFilter.tsx) | onSubmit / searching | 確定条件をURLへ保存しpageを1に戻してsearchBooksを実行する |
| [BookCard](../../../../../design/latest/storybook-app/src/components/domain/BookCard.tsx) | book(s) | itemsのbook_id→id、current_status→state、media_type→media、genre_name→genre、registered_at→registeredAt。isbn/publisherのnullは空文字へ変換 |
| [BookCard](../../../../../design/latest/storybook-app/src/components/domain/BookCard.tsx) | onSelect | book.idを`/books/:bookId`へ渡す。query keyを識別子として使わない |
| [Pagination](../../../../../design/latest/storybook-app/src/components/ui/Pagination.tsx) | page / pageSize / total / onChange | APIのpage、page_size→pageSize、totalを使い、選択pageで同じ検索を実行する |

## 状態の所有者

| 状態 | 所有者 | 更新契機 | 保持と破棄 |
|---|---|---|---|
| 編集中検索条件 | Page | 入力の変更 | 検索確定まで結果と分離する |

## 操作後の接続

取得と失敗回復は[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#ui-read-取得状態と応答の採用)を適用する。
選択行の識別子は部品のcallbackから取得し、対象が必要な画面のURLへ渡す。
条件変更とページ移動は確定条件を維持した照会として扱う。

## ティア完了条件

```gherkin
Feature: 書籍を検索するの画面接続
  Scenario: 遅れて到着した結果を捨てる
    Given 1件目の要求の後に別条件の2件目を送信している
    When 2件目の成功後に1件目の成功が到着する
    Then 2件目の結果を保持し、1件目の結果に戻らない

  Scenario: 失敗から復帰する
    Given 画面の取得が503で失敗している
    When 再取得を選択する
    Then 元の取得条件を使い、成功後に表示を回復する
```

## 検索条件の送信

| 画面値 | APIへの接続 |
|---|---|
| kind | 同名のkindへ渡す |
| query | 入力をqueryへ渡す。空欄は省略する |
| genres | listGenresで各表示名をgenre_idへ引き、genre_idsの反復queryへ渡す |
| states | statesの反復queryへ渡す |
| ページの選択 | pageへ渡し、page_sizeは現在のページサイズを維持する |

ジャンル名に対応するIDを取得できない場合は送信せず、候補の再取得を案内する。
検索条件を変えた確定操作ではpageを1へ戻す。
