# Frontend staff — 貸出を登録する

画面ルートは [窓口貸出受付画面 Stories](../../../../../../design/latest/storybook-app/src/stories/Pages/司書ポータル/窓口貸出受付画面.stories.tsx) の `/staff/loans/new`。APIは [対応表](_api-summary.yaml) の `createLoan`。
Props型・tokens・部品内の描画はdesign latestを正本とし、ここでは画面との接続だけを定義する。

## 部品とStoryへの接続

| 正本 | 使用するexport / 接続 |
|---|---|
| [SubmitActionButton 実装](../../../../../../design/latest/storybook-app/src/components/common/SubmitActionButton.tsx) / [SubmitActionButton Stories](../../../../../../design/latest/storybook-app/src/stories/forms/SubmitActionButton.stories.tsx) | `SubmitActionButton`、Stories `Default` / `Submitting` / `Disabled`。onSubmitはPageの送信開始処理。submitting/disabledはPageから供給 |
| [LoanConfirmation 実装](../../../../../../design/latest/storybook-app/src/components/domain/LoanConfirmation.tsx) / [LoanConfirmation Stories](../../../../../../design/latest/storybook-app/src/components/domain/LoanConfirmation.stories.tsx) | `LoanConfirmation`、Stories `Default` / `NotYetSubmitted`。resultへ201本文を供給。onLoanSucceededは次の貸出の開始処理。todayは省略しない |
| [窓口貸出受付画面 Stories](../../../../../../design/latest/storybook-app/src/stories/Pages/司書ポータル/窓口貸出受付画面.stories.tsx) | `Default` / `Submitting` / `Success` / `Conflict` / `PeriodMismatch`。構成参照。固定日数や一般利用者の制限を業務規則として採用しない |

CR004: ボタン説明はHTTP送信を行うとしているが、実装はdata属性とcallbackだけ。HTTP呼出とヘッダ付与はPageのAPIクライアントが行う設計をdesign正本へ反映する。
CR005: LoanConfirmationのtoday既定の説明と実装が不一致。暫定回避を正本の仕様として扱わず還流する。

## 画面が所有する状態・API接続

Pageのみが入力、凍結済み送信本文、操作キー、送信状態、確定応答、エラーを所有する。子部品は渡された値を表示しcallbackを呼ぶ。
bookId→book_id、userNo→user_no、loanPeriodType→loan_period_typeへ変換し、キーをヘッダへ渡す。期限や状態は送信しない。
入力段階では業務期間を推測しない。B3の区分対応が確定するまで選択肢制限/期限見込みの実装はblocked。

| 画面状態 | イベント | 処理と次状態 |
|---|---|---|
| editing | 登録 | 入力検証後UUIDv4を一度発行し本文を凍結、保存完了後に送信してsubmitting |
| submitting | 再押下 | 追加HTTPを発行しない |
| submitting | 201 | responseをresultへ設定しsucceeded |
| submitting | 契約上の確定4xx | エラーを表示しediting。業務入力を修正した次回は新しい操作キー |
| submitting | 処理中409 / ネットワーク切断 / 5xx | 成否未確定としてunknown。本文とキーを変更しない |
| unknown | 再試行 | 同じ本文・同じキーで送信。T4確定待ちのため自動再送は未実装 |
| succeeded | 続けて貸し出す | result/入力/キーを消去しediting。次の登録で新しいキーを生成 |

要求の永続化場所と再読込時の復元・期限切れ時の回復はCR006と合わせて決定する。未解決の操作を単なる編集状態に戻し、新しいキーで再実行しない。
成功後は対象書籍、対象利用者、対象書籍の予約、および貸出一覧のキャッシュを無効化し、表示中の照会を再取得する。取得失敗は登録失敗に戻さず、確定結果を保持して再取得を案内する。

## 照会の呼出と結果の接続

照会は [API対応表](_api-summary.yaml) の3操作を使い、いずれも業務更新しない。

| 契機 | operationと入力 | 採用する結果 |
|---|---|---|
| 書籍ID入力のblur、またはID付き初期表示 | getBookAvailability、pathのbook_idへ入力bookId | bookはBookCard、reservation_countはreservationCountへ |
| 利用者番号入力のblur、または番号付き初期表示 | getLoanTarget、pathのuser_noへ入力userNo | user_no/name/user_category/user_statusを選択利用者として保持。表示部品への最終接続はCR007 |
| 上記2照会が同じ入力世代で成功した直後 | checkLoanEligibility、bodyへbook_id/user_no | eligibleとreasonsを確認表示へ接続。falseなら登録操作を無効化。server登録時に再判定する |

BookCardへはbook_id→bookId、material_type→materialType、book_status→state、title/author/publisher/genreを同名で渡す。isbnのnull/欠落は表示上の未記入として空文字へ変換し、架空の番号を作らない。
入力変更のたびに世代番号を増やし、前の照会を中断して確認結果を未取得へ戻す。遅れて返った別世代の応答は採用しない。
取得中は確認が未完了であることを表示し登録を無効化する。404は対象なしとして該当選択を解除、その他の取得失敗は再取得を案内する。再取得は現在の入力世代だけを使う。
事前照会成功後もB1–B3の意味は還流解決待ちであり、この表で業務判定を補完しない。期間日数を返す操作は存在しないため、期限見込みを照会結果から捏造しない。

## 未接続の表示入力

既存ページStoryのBookCard/UserProfileCardは固定データである。照会APIのLoanTargetResponseはUserProfileCard必須のemail/registeredAtを含まない。
不足を空文字や別APIの推測で埋めない。最小情報表示に合わせる部品接続の見直しをCR007でdesignへ要求する。
既存Storyにない結果不明/再試行/続けて貸し出す操作は、共通部品を変えず後段spec-storiesでページシナリオを追加する。

## ティア完了条件

```gherkin
Feature: 貸出画面の接続
  Scenario: 送信中に重ねて押しても要求は増えない
    Given 初回の登録HTTPが未完了である
    When 登録操作を繰り返す
    Then 同じ操作から追加のHTTPを発行しない

  @blocked @CR006
  Scenario: 応答喪失を新しい貸出として送り直さない
    Given 送信後の応答が失われている
    When 再試行する
    Then 初回と同じ本文とキーを使う

  @blocked @CR001 @CR003 @CR005
  Scenario: 確定結果から続けて貸し出す
    Given 登録が成功しLoanConfirmationに確定応答が渡っている
    When 続けて貸し出すを押す
    Then 入力と結果を初期化する
    And 次の登録では前回のキーを再利用しない
```
