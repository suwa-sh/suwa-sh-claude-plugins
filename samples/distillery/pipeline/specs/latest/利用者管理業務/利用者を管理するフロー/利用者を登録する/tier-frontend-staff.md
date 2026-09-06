# 利用者登録の司書画面仕様

## 責務

利用者の入力と確定操作をAPIへ接続し、その結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| ルート | `/staff/users/new`。[ScreenMapping](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)の「利用者登録画面」 |
| 利用条件 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)。司書かつ館内経路 |
| 部品Story | [Users Stories](../../../../../design/latest/storybook-app/src/components/domain/Users.stories.tsx) のFormCreate |

## データの取得

| 操作 | 入力元 | 使用する応答 | 取得中と失敗時 |
|---|---|---|---|
| createUser | Pageの送信スナップショット | 成功応答と採番ID | submittingをtrueにし、結果不明時は同じ要求で照合 |

操作の型と応答コードは[_api-summary.yaml](_api-summary.yaml)の該当operationから分割契約を参照する。

## 部品への接続

| 部品と定義先 | 受取先 | 供給元または処理 |
|---|---|---|
| [UserForm](../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | initial / userNumber | 氏名と連絡先は空欄。userNumberは渡さず、成功応答のuser_numberを完了表示へ供給 |
| [UserForm](../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | onSubmit | name/emailを渡し、空phone/addressはnullに変換。Pageが保持するuser_typeを結合する |
| [Select](../../../../../design/latest/storybook-app/src/components/ui/Input.tsx) | value / onChange | Pageで既存Selectを合成し、RDRA利用者区分を選択肢とする。初期値は利用者とする |
| [UserForm](../../../../../design/latest/storybook-app/src/components/domain/Forms.tsx) | errors / submitting / onCancel | Pageの検証結果と保存状態を渡す。取消は利用者一覧へ戻る |

## 状態の所有者

| 状態 | 所有者 | 更新契機 | 保持と破棄 |
|---|---|---|---|
| 編集値 | UserForm、利用者区分はPage | 入力操作 | 400/422では保持する。成功または取消で破棄する |

## 操作後の接続

取得と失敗回復は[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#ui-read-取得状態と応答の採用)を適用する。
送信、連打防止、再読込後の結果確認は[UI-WRITE](../../../_cross-cutting/ux-ui/ui-design.md#ui-write-送信状態と結果確認)を適用する。

登録操作はIf-Matchを送信しない。
成功応答のuser_numberをこの画面の完了状態へ表示し、識別子を確認してから一覧へ戻る。
409ではError.codeを表示し、要求キーの不一致と採番衝突を区別する。
存在しない新規対象の再取得や自動再採番は行わない。
成功後は利用者の一覧、対象詳細、対象の利用状況照会を無効化して再取得する。

## ティア完了条件

```gherkin
Feature: 利用者を登録するの画面接続
  Scenario: 送信結果を再確認する
    Given 要求キー550e8400-e29b-41d4-a716-446655440000で送信後に通信が切断された
    When 結果確認を選択する
    Then 同じ本文、対象、キーでcreateUserを再送し、新しいキーで二重登録しない

  Scenario: 失敗から復帰する
    Given 画面の取得が503で失敗している
    When 再取得を選択する
    Then 元の取得条件を使い、成功後に表示を回復する
```
