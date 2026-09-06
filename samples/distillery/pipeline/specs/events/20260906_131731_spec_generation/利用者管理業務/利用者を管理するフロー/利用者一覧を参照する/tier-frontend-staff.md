# 利用者一覧の司書画面仕様

## 責務

利用者の照会条件をAPIへ渡し、受け取った結果と次の操作を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| ルート | `/staff/users`。[ScreenMapping](../../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)の「利用者一覧画面」 |
| 利用条件 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)。司書かつ館内経路 |
| 部品Story | [Users Stories](../../../../../../design/latest/storybook-app/src/components/domain/Users.stories.tsx) のTable |

## データの取得

| 操作 | 入力元 | 使用する応答 | 取得中と失敗時 |
|---|---|---|---|
| listUsers | URLに確定した検索条件とpage/page_size | items、total、page | 初回はloading、失敗時は条件を保持して再取得 |

操作の型と応答コードは[_api-summary.yaml](_api-summary.yaml)の該当operationから分割契約を参照する。

## 部品への接続

| 部品と定義先 | 受取先 | 供給元または処理 |
|---|---|---|
| [UserTable](../../../../../../design/latest/storybook-app/src/components/domain/UserTable.tsx) | users | itemsのuser_number→number、registered_at→registeredAt。phone/addressのnullは空文字へ変換 |
| [UserTable](../../../../../../design/latest/storybook-app/src/components/domain/UserTable.tsx) | onEdit / onDelete / onOpenStatus | 選択利用者のnumberを/staff/users/:userId/edit、/delete、/statusへ渡す |
| [Input](../../../../../../design/latest/storybook-app/src/components/ui/Input.tsx) | value / onChange | Pageの検索文字列。確定操作でqueryとpage=1をURLへ保存 |
| [Pagination](../../../../../../design/latest/storybook-app/src/components/ui/Pagination.tsx) | page / pageSize / total / onChange | APIのpage、page_size→pageSize、totalから、同じ条件でページ移動 |

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
Feature: 利用者一覧を参照するの画面接続
  Scenario: 遅れて到着した結果を捨てる
    Given 1件目の要求の後に別条件の2件目を送信している
    When 2件目の成功後に1件目の成功が到着する
    Then 2件目の結果を保持し、1件目の結果に戻らない

  Scenario: 失敗から復帰する
    Given 画面の取得が503で失敗している
    When 再取得を選択する
    Then 元の取得条件を使い、成功後に表示を回復する
```
