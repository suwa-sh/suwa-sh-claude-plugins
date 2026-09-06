# 書籍登録の司書画面仕様

## 責務

書籍の入力と確定操作をAPIへ接続し、その結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| ルート | `/staff/books/new`。[ScreenMapping](../../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)の「書籍登録画面」 |
| 利用条件 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)。司書かつ館内経路 |
| 部品Story | [Books Stories](../../../../../../design/latest/storybook-app/src/components/domain/Books.stories.tsx) のFormCreate |

## データの取得

| 操作 | 入力元 | 使用する応答 | 取得中と失敗時 |
|---|---|---|---|
| listGenres | page=1からpage_size=100でtotal件まで取得 | genre_idとgenre_nameの対応 | 全件取得前は保存を停止し、失敗時は再取得 |
| createBook | Pageの送信スナップショット | 成功応答と採番ID | submittingをtrueにし、結果不明時は同じ要求で照合 |

操作の型と応答コードは[_api-summary.yaml](_api-summary.yaml)の該当operationから分割契約を参照する。

## 部品への接続

| 部品と定義先 | 受取先 | 供給元または処理 |
|---|---|---|
| [BookForm](../../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | initial | 新規登録用の初期値を使う。書誌文字列は空、genreは文学、mediaは紙 |
| [BookForm](../../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | onSubmit | genreをlistGenresのgenre_nameで一意に引きgenre_idへ変換し、media→media_type。空isbn/publisherはnull。値が解決しなければ送信せず再取得 |
| [BookForm](../../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | errors / submitting | クライアント検証のフィールドエラーを渡す。APIのErrorはmessageをPageのAlertへ表示し、submittingはPageが供給する |
| [BookForm](../../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | onCancel | 未送信なら蔵書一覧へ戻る |

## 状態の所有者

| 状態 | 所有者 | 更新契機 | 保持と破棄 |
|---|---|---|---|
| 編集値 | BookForm | 入力操作 | 400/422では保持する。成功または取消で破棄する |

## 操作後の接続

取得と失敗回復は[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#ui-read-取得状態と応答の採用)を適用する。
送信、連打防止、再読込後の結果確認は[UI-WRITE](../../../_cross-cutting/ux-ui/ui-design.md#ui-write-送信状態と結果確認)を適用する。

登録操作はIf-Matchを送信しない。
成功応答のbook_idをこの画面の完了状態へ表示し、識別子を確認してから一覧へ戻る。
409は要求キーの不一致として扱い、存在しない新規対象の再取得は行わない。
成功後は書籍の一覧、検索、対象詳細を無効化して再取得する。

## ティア完了条件

```gherkin
Feature: 書籍を登録するの画面接続
  Scenario: 送信結果を再確認する
    Given 要求キー550e8400-e29b-41d4-a716-446655440000で送信後に通信が切断された
    When 結果確認を選択する
    Then 同じ本文、対象、キーでcreateBookを再送し、新しいキーで二重登録しない

  Scenario: 失敗から復帰する
    Given 画面の取得が503で失敗している
    When 再取得を選択する
    Then 元の取得条件を使い、成功後に表示を回復する
```
