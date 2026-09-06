# 上流の再照合と本文維持の実演

現在の上流latestを読み直した結果、7件とも提案の採用を確認できない。
出力のreadinessは`needs-spec-change`を維持する。
照合対象の具体案と本文の対応は[提案の基準](../proposal-baseline.md)を参照する。

## 現在のlatestとの照合

| 変更要求 | 実際に確認した正本 | 確認した内容 | 判定 |
|---|---|---|---|
| CR-60d99956-001 | RDRAの条件.tsv「返却期限設定条件」、バリエーション.tsv「利用者区分」「貸出期間区分」 | 貸出日へ日数を加算する規則と区分名はある。具体的な日数と利用者区分への適用対応は定義されていない。 | 未採用 |
| CR-60d99956-002 | RDRAの条件.tsv「貸出可否条件」「取置き中書籍貸出条件」、状態.tsv「書籍状態」 | 予約待ちの拒否と取置き対象者の許可が併存する。予約待ちから貸出中への遷移はあるが、条件の優先順位は定義されていない。 | 未採用 |
| CR-60d99956-003 | RDRAの条件.tsv「貸出可否条件」、状態.tsv「利用者状態」 | 条件は「利用可能」を要求する。状態は登録済みと取引進行中で、利用可能への対応がない。 | 未採用 |
| CR-60d99956-004 | SubmitActionButton.tsx、SubmitActionButton.stories.tsx、Button.tsx | 部品はonSubmitを呼び、キーをdata属性へ渡す。送信中の表示はsubmittingで制御する。説明は部品自身によるキー送信と押下時の自動切替を約束している。 | 未採用 |
| CR-60d99956-005 | LoanConfirmation.tsxと同名のStory | todayは省略可能で、説明は当日を既定値とする。実装は返却期限を使う。Default Storyはtodayを明示する。 | 未採用 |
| CR-60d99956-006 | arch-design.mdのSR-013、SR-025、CTP-006、LP-007 | KVSによる前回応答とRDBの一意制約はある。貸出更新と応答保存の同一トランザクション、保存期限後の照合・応答方針はない。E-902のTTLは通知用で、貸出登録の保持契約にはならない。 | 未採用 |
| CR-60d99956-007 | UserProfileCard.tsx、窓口貸出受付画面.stories.tsx | emailとregisteredAtは必須。窓口Storyは固定値を渡しており、照会結果の最小情報だけで表示する部品契約を確認できない。 | 未採用 |

ファイルのSHA-256は[evidence.json](evidence.json)の`input_sha256`に記録する。
この表の判定は内容の読解によるものであり、hashやキーワードの存在だけから採用を判定したものではない。

## SubmitActionButtonの説明が提案どおり修正された場合

CR-60d99956-004のうち、部品とStoryの説明を合わせる変更を隔離した一時ディレクトリで実行した。
実際のdesign/latestは変更していない。

| 対象 | 仮に採用した内容 | 照合した接続 |
|---|---|---|
| 部品の説明 | 押下でonSubmitを呼ぶ。画面がHTTPとヘッダ送信を担当する。 | JSXの`onClick={onSubmit}`と`data-idempotency-key={idempotencyKey}` |
| 送信中の説明 | 画面がsubmittingを管理し、部品へ渡す。 | `loading={submitting}`からButtonのdisabled・aria-busyへ接続する。 |
| Storyの説明 | 部品と画面の責任を同じ内容で説明する。 | Submitting Storyの`submitting: true`を維持する。 |

1. 現在の正本から部品、Story、基底Buttonを一時ディレクトリへコピーした。
2. 部品のコメントとStoryの説明文字列だけを変更した。
3. 変更後の3ファイルを読み直し、説明以外の内容が変更前と一致することを確認した。
4. spec・tier・モデル要約・共通技術ルールのSHA-256が実行前後で一致することを確認した。
5. 実際のlatestのSHA-256が変わっていないことを確認した。

[貸出画面のtier仕様](../../蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/tier-frontend-staff.md)は、Pageが送信状態を所有し、onSubmitでPageのAPIクライアントを呼ぶ接続を定義している。
仮の説明修正はこの接続と一致し、本文に残した責任分担の変更を要しない。

変更内容は[説明修正の差分](submit-action-docs-adoption.patch)を参照する。
本文のhash一覧と各検証結果は[evidence.json](evidence.json)を参照する。

## 実演の範囲

| 項目 | 実施範囲 |
|---|---|
| 正本の照合 | 現在のlatestに対して7件を読解した。 |
| 仮の採用 | CR-004の説明修正だけを一時コピーへ適用した。 |
| 部品の振る舞い | ソースの接続と変更範囲を静的に確認した。ブラウザ操作やHTTP送信は試験していない。 |
| 仕様本文 | 実演前後でbyte単位の一致を確認した。hash一致だけで仕様全体の意味を検証したとは扱わない。 |
| pipeline実行 | 実行していない。受信packet、appliedのledger、上流変更イベントは作成していない。 |
| 昇格 | 実際の7件は未解決のため、specs/latestへ昇格していない。 |

## 再実行

リポジトリのルートから、対象イベントを指定して実行する。

```sh
python3 EVENT/_review/reconciliation/demonstrate.py --event EVENT --output EVENT/_review/reconciliation
```

`EVENT`はこのレビューを含むspec生成イベントのパスに置き換える。
このスクリプトは現在のサンプル用の限定的な実演であり、上流が変わった場合は内容を再確認してから更新する。
