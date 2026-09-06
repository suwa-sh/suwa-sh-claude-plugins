# 利用者削除の司書画面仕様

## 責務

利用者の入力と確定操作をAPIへ接続し、その結果を表示する。

## 画面

| 項目 | 定義 |
|---|---|
| ルート | `/staff/users/:userId/delete`。[ScreenMapping](../../../../../design/latest/storybook-app/src/docs/ScreenMapping.mdx)の「利用者削除確認画面」 |
| 利用条件 | [TR-AUTH](../../../_cross-cutting/technical-rules.md#tr-auth-認証と参照範囲)。司書かつ館内経路 |
| 部品Story | [Users Stories](../../../../../design/latest/storybook-app/src/components/domain/Users.stories.tsx) |

## データの取得

| 操作 | 入力元 | 使用する応答 | 取得中と失敗時 |
|---|---|---|---|
| getUser | URLのuserIdを利用者番号として読む | 対象の表示値とversion | 完了まで入力または確定操作を表示しない |
| deleteUser | Pageの送信スナップショットとURLの識別子 | 成功応答 | submittingをtrueにし、結果不明時は同じ要求で照合 |

操作の型と応答コードは[_api-summary.yaml](_api-summary.yaml)の該当operationから分割契約を参照する。

## 部品への接続

| 部品と定義先 | 受取先 | 供給元または処理 |
|---|---|---|
| [ConfirmPanel](../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx) | summary | 取得した識別子と書籍タイトルまたは利用者氏名 |
| [ConfirmPanel](../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx) | blocked / blockedReason | 初回取得中と結果不明中は確定操作を停止。422受信後はtrueにして理由を表示する |
| [ConfirmPanel](../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx) | onConfirm / submitting | Pageが取得versionをIf-Matchへ渡して削除を実行する |
| [ConfirmPanel](../../../../../design/latest/storybook-app/src/components/domain/CounterPanels.tsx) | onCancel | 未送信なら元の一覧へ戻る。送信中は遷移しない |

## 状態の所有者

| 状態 | 所有者 | 更新契機 | 保持と破棄 |
|---|---|---|---|
| 確認対象とversion | Page | URL識別子での取得 | 取得後にConfirmPanelを表示。競合再取得後に要約を更新する |

## 操作後の接続

取得と失敗回復は[UI-READ](../../../_cross-cutting/ux-ui/ui-design.md#ui-read-取得状態と応答の採用)を適用する。
送信、連打防止、再読込後の結果確認は[UI-WRITE](../../../_cross-cutting/ux-ui/ui-design.md#ui-write-送信状態と結果確認)を適用する。

削除の成功応答204を受けたら一覧へ戻る。
422ではConfirmPanel.blocked=trueとして理由を表示する。
VERSION_CONFLICTでは対象を再取得し、最新の要約と版を確認してから再操作する。
成功後は利用者の一覧、対象詳細、対象の利用状況照会を無効化して再取得する。

## ティア完了条件

```gherkin
Feature: 利用者を削除するの画面接続
  Scenario: 送信結果を再確認する
    Given 要求キー550e8400-e29b-41d4-a716-446655440000で送信後に通信が切断された
    When 結果確認を選択する
    Then 同じ本文、対象、版、キーでdeleteUserを再送し、新しいキーで二重登録しない

  Scenario: 直リンクから編集対象を取得する
    Given URLのuserIdがU-001で画面状態が空である
    When 画面を再読込する
    Then URLの識別子で対象を取得し、取得前に確定操作を利用できない
```
