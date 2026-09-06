# 窓口貸出受付画面

司書が書籍と利用者を確認して貸出を登録し、返却期限を確認する。
画面構成は[窓口貸出受付画面のStory](../../../../../../design/latest/storybook-app/src/stories/Pages/司書ポータル/窓口貸出受付画面.stories.tsx)の`/staff/loans/new`を参照する。

## 部品への接続

| 部品の参照 | 入力元 | 接続する値または操作 |
|---|---|---|
| [SubmitActionButton](../../../../../../design/latest/storybook-app/src/components/common/SubmitActionButton.tsx) | Pageの送信状態 | submittingとdisabledを設定。onSubmitでPageのAPIクライアントを呼ぶ |
| [LoanConfirmation](../../../../../../design/latest/storybook-app/src/components/domain/LoanConfirmation.tsx) | 201本文とPageの基準日 | resultへ確定本文、todayへAsia/Tokyoの当日を渡す。onLoanSucceededで次の貸出へ進む |
| [UserProfileCard](../../../../../../design/latest/storybook-app/src/components/domain/UserProfileCard.tsx) | getLoanTargetの応答 | user_no→user.userNumber、name→user.name、user_category→user.category、user_status→user.state。emailとregisteredAtは省略 |
| [BookCard](../../../../../../design/latest/storybook-app/src/components/domain/BookCard.tsx) | getBookAvailabilityのbook | book_id→book.bookId、material_type→book.materialType、book_status→book.state。title、author、publisher、genreはbook内の同名項目。isbnのnullと欠落はbook.isbnへ空文字。reservation_count→reservationCount |
| [ToggleGroup](../../../../../../design/latest/storybook-app/src/components/ui/ToggleGroup.tsx) | 選択中の期間区分 | onChangeの配列から選択した1要素を受け取る |

## 入力と照会

| 契機 | 操作と入力 | 応答の用途 |
|---|---|---|
| 書籍IDのblurまたはID付き初期表示 | `getBookAvailability(book_id)` | 書籍カードと予約件数 |
| 利用者番号のblurまたは番号付き初期表示 | `getLoanTarget(user_no)` | 利用者カード |
| 両照会が同じ入力世代で成功 | `checkLoanEligibility(book_id, user_no)` | 登録可否と拒否理由 |

1. 入力変更時に世代番号を増やし、前の照会を中断する。
2. 現在の世代に一致する応答だけを採用する。
3. 読込中は登録を無効化する。404は対象選択を解除し、その他の失敗は再取得を表示する。
4. 期間の選択肢と初期値は[RDRAバリエーション](../../../../../../rdra/latest/バリエーション.tsv)の利用者区分と貸出期間区分を参照する。
5. 入力をbook_id、user_no、loan_period_typeへ変換する。貸出日、期限、業務状態は送信しない。

## 送信状態

Pageは入力、凍結した要求、キー、送信状態、確定応答を所有する。
操作キーと要求は認証主体別のsessionStorageに保存し、保存に失敗した場合は送信しない。

| 現在の状態 | 契機 | 処理 | 次状態 |
|---|---|---|---|
| editing | 登録 | UUIDv7を生成し、本文とキーを保存してHTTPを発行 | submitting |
| submitting | 再押下 | 追加HTTPを発行しない | submitting |
| submitting | 401、403 | 要求とキーを保持し、同じ認証主体の再認証または権限回復後に同じキーで照合 | unknown |
| submitting | 201 | 応答をresultへ設定 | succeeded |
| submitting | 400、404、業務409、ロック競合の`CONFLICT` | 理由を表示し確定済み失敗の要求保存を解除 | editing |
| submitting | IDEMPOTENCY_KEY_IN_PROGRESS、5xx、通信切断 | 要求とキーを維持 | unknown |
| unknown | 再試行 | 同じ本文とキーでHTTPを発行 | submitting |
| submitting | IDEMPOTENCY_KEY_CONFLICT | 操作不一致を表示し追加送信を停止 | recovery |
| submitting | IDEMPOTENCY_KEY_EXPIRED | 期限切れを表示し追加送信を停止 | recovery |
| succeeded | 続けて貸し出す | 結果、入力、キー、保存済み要求を削除 | editing |

| 回復の契機 | 処理 |
|---|---|
| 再読込時に保存要求あり | unknownへ戻し、同じキーの再試行を案内 |
| ログアウト | 送信を停止し未確定要求を保持。同じ認証主体の再ログイン後に回復。他の認証主体へ要求を渡さない |
| 期限切れまたはキー不一致 | 書籍と利用者の貸出記録を司書が確認するまで新しいキーでの登録を無効化 |
| 司書が未登録と確認 | 確認操作で保存要求を削除してeditingへ戻す |
| 司書が登録済みと確認 | 貸出記録を表示し、保存要求を削除して次の貸出へ進む |

todayは初期表示、日付境界、画面への復帰時に更新する。
成功後は書籍、利用者、予約、貸出一覧のキャッシュを無効化して再取得する。
再取得の失敗時も確定済みの貸出結果を表示する。

## ティア完了条件

```gherkin
Feature: 窓口貸出受付
  Scenario: 応答喪失後に再読込する
    Given 送信した要求とキーがsessionStorageにある
    When 再読込して再試行する
    Then 初回と同じ本文とキーを送信する

  Scenario: 利用者の最小情報を表示する
    Given getLoanTargetがuser_noとnameとuser_categoryとuser_statusを返す
    When 利用者カードを表示する
    Then emailとregisteredAtの表示欄は存在しない

  Scenario: 続けて貸し出す
    Given 確定した貸出結果を表示している
    When 続けて貸し出すを押す
    Then 入力と結果を初期化する
    And 次の登録では新しいキーを発行する
```

タブを閉じるとsessionStorageが消えるため、未確定操作を閉じる前に警告する。保存要求を失った場合は、新規登録の前に司書が貸出記録を確認する。
