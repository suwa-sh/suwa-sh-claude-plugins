# 貸出を登録する — 司書ポータル

## 変更概要・画面仕様

ルートstaff-loan-new、URL /staff/loans/new。司書・館内ネットワーク限定。
[共通UI](../../../_cross-cutting/ux-ui/ui-design.md)と[共通コンポーネント](../../../_cross-cutting/ux-ui/common-components.md)の見た目・アクセシビリティ規則に従う。
このUCの送信状態・再取得は本書を正本とし、共通の一般例からキーの所有者を増やさない。

| 表示 | 入力・動作 |
|---|---|
| BookCard / UserProfileCard | 書籍のタイトル・著者・ジャンル・資料種別・状態、利用者の氏名・区分・状態。APIにない連絡先は取得・表示しない |
| Input 2つ | book_idとuser_no。必須・形式は契約schema。引継ぎがあれば初期値として使う |
| ToggleGroup | spec.md RULE-004の既定/選択可能集合を適用。一般の長期はdisabled / aria-disabled |
| DueDateIndicator | 登録前はAsia/Tokyoの本日+規定日数の見込み。登録後はAPIのdue_dateに置換。YYYY年M月D日（あとN日）。日跨ぎで見込みを再計算 |
| SubmitActionButton | 登録中はdisabled / aria-busy、LoadingState(kind=action)。再送も二重押下不可 |
| Alert / LoanConfirmation | 確定したloan_id・返却期限またはエラー理由を表示。resultがnullなら完了表示なし |

入力IDが変わったら過去の照会結果を無効にし、形式が有効なIDだけでgetBookAvailability/getLoanTargetを取得する。
両方の取得が成功したらcheckLoanEligibilityを呼ぶ。入力変更前の遅い応答は捨てる。
取得中はAsyncSection経由のLoadingState(kind=detail、delayMs=300、label=貸出対象を読み込み中)。
空の直リンクは入力待ちであり、空IDでAPIを呼ばない。照会失敗・eligible=false・入力エラー中は登録を無効化する。
再取得は入力変更時と再判定操作時に行い、継承したeligibleを恒久的な許可には使わない。登録APIは常に業務可否を再判定する。
利用者変更時は期間の既定値を選び直す。入力形式以外の貸出可否はフロントで独自判定しない。

## 所有権と受け渡し

| 所有者 | 保持する値・責務 | 境界 |
|---|---|---|
| LoanRegistrationPageのuseIdempotentMutation | 操作状態、キー、凍結した本文、結果、APIエラー、送信・再送、保存、再取得 | createLoanを呼ぶ唯一の主体 |
| LoanRegistrationForm | bookId/userNo/loanPeriodType、項目別エラー | onSubmit({bookId,userNo,loanPeriodType})。キーを発行・保持せずAPIを呼ばない |
| LoanConfirmation | 状態なし | result: LoanResponse、onContinue()。結果を別stateへ写さない |
| DueDatePreview | 状態なし | dueDate/todayを受け取り表示する |

LoanResponse等の型は_contract-slice.jsonから生成する。フォームはcamelCaseを受け渡し、ページがAPIのsnake_caseへ一度だけ写す。

## 操作の状態遷移

| 現在 / 入力 | キー・本文 | 結果 / 次に可能な操作 |
|---|---|---|
| editing / 登録 | UUID v4を新規発行し本文を凍結。ネットワーク送信前に保存 | submitting。編集・別操作・二重送信を禁止 |
| submitting / 201 | 成功として確定し保存した未完了操作を削除 | succeeded。結果表示と下記再取得を1回実行 |
| submitting / 通信断、タイムアウト、5xx、429、IN_PROGRESS | 同じ組を維持 | unknown。結果不明と表示、手動「同じ操作を再送」のみ。IN_PROGRESSはRetry-After秒（欠落時1秒）後に有効 |
| unknown / 再送 | キーも本文も変更しない | submitting。一般の自動POST再試行は無効 |
| submitting / 確定業務4xx | 保存した未完了操作を削除 | editing。理由と修正箇所を表示。次の送信で新キー |
| submitting / 401・403 | 未完了の組を維持 | 認証を回復し同じsub・司書ロールでのみ再送可能。別操作者へ引継がない |
| submitting / IDEMPOTENCY_KEY_CONFLICT | 未完了の組を維持 | blocked。自動で新キーを発行しない。操作情報を保ったまま管理者に不整合調査を依頼 |
| succeeded / 続けて貸し出す | 前の結果と入力・照会結果をクリア | 同じルートでもeditingへ戻る。次の送信が新しい操作 |

確定業務4xxはBackend本文の400、404、USER_NOT_LOANABLE、BOOK_NOT_AVAILABLE、BOOK_ON_HOLD_FOR_OTHER、MATERIAL_TYPE_NOT_SUPPORTED、LOAN_PERIOD_TYPE_MISMATCH、CONFLICT。
未知の応答や壊れた201本文は結果不明として扱う。BOOK_NOT_AVAILABLE等は理由と再判定への導線、期間不一致はToggleGroup直下のエラーと既定区分へ戻す操作を表示する。
401は再ログイン導線、403は権限不足を表示。AuthorizationはBearerのみ。識別用の独自ヘッダは送らない。

## 再読込・ログアウト

sessionStorageのキー `loan-pending:v1:{sub}` にschemaVersion=1、key、body、startedAtをJSONで保存する。1タブ・1操作者につき未完了操作は1件。
保存に失敗したら送信せず保存エラーを表示する。再読込時に同一subの有効な保存内容があればunknownとして復元する。自動送信しない。
ログアウトではメモリと表示を消すが未完了の保存内容は残す。同じsubで再ログインしたときだけ復元する。別subの保存内容は読まない。
保存内容が壊れていたら新規送信を止め、不整合調査を案内する。タブを閉じた場合や保存領域を手動削除した場合の自動復元は保証しない。
閉じ直した画面は入力待ちから始め、過去の操作を自動生成しない。貸出中の同じ書籍はBackendの規則により二重登録できない。
サーバーの成功記録は期限なしなので、有効な保存内容に時間による自動削除・キー更新を行わない。

## 成功後の再取得

query keyは配列の先頭を情報名とする。成功時に以下のprefixで一致する全クエリを無効化する。

| prefix | 影響 |
|---|---|
| ["loans"] | 貸出一覧・詳細・集計 |
| ["books"] | 蔵書一覧・詳細・在庫 |
| ["users"] | 利用者一覧・詳細・状態 |
| ["reservations"] | 予約一覧・詳細・取置き状態 |
| ["loanEligibility"] | この画面を含む過去の貸出可否判定 |

getBookAvailabilityはbooks、getLoanTargetはusers、checkLoanEligibilityはloanEligibilityに格納する。末尾のID/フィルタは各呼出側が付ける。
表示中は再取得、非表示は次回表示時に取得。失敗時は成功の無効化をせず、再判定操作で対象を取得し直す。
無効化や再取得の失敗は貸出の成功を取り消さない。成功表示を保持し、情報更新の再試行だけを案内する。
遷移はuseAppNavigationでstaff-loan-eligibilityへ。続けて貸し出す操作は上の状態リセットを先に行う。

## ティア完了条件（BDD）

```gherkin
Feature: 貸出を登録する - 司書ポータル

  Scenario: 判定画面からの引き継ぎ値が初期表示される
    Given 司書「山田花子」が貸出可否判定画面で書籍ID "B-000001" と利用者番号 "U-000123"（利用者区分 "一般"）の「貸出可」判定を受けている
    When 司書が窓口貸出受付画面（/staff/loans/new）へ進む
    Then 書籍ID "B-000001" と利用者番号 "U-000123" が入力欄に初期表示される
    And 貸出期間区分の ToggleGroup で「標準」が初期選択される

  Scenario: 貸出期間区分の変更で返却期限の表示が更新される
    Given 司書「山田花子」が窓口貸出受付画面を開いており、本日が 2026-09-02 である
    When 司書が貸出期間区分を「短期」（7 日）に変更する
    Then DueDateIndicator の返却期限が「2026年9月9日」と表示される
    And 残日数が「あと7日」と文言で表示される

  Scenario: 選択できない貸出期間区分は押下できない
    Given 司書「山田花子」が利用者区分 "一般" の利用者について窓口貸出受付画面を開いている
    When 司書が貸出期間区分の ToggleGroup を確認する
    Then 「長期」は disabled で aria-disabled が true である
    And 「標準」「短期」は選択できる

  Scenario: 登録中は二重送信を防止する
    Given 司書「山田花子」が書籍ID "B-000001"、利用者番号 "U-000123"、貸出期間区分「標準」を指定している
    When 司書が「貸出を登録する」を連続で 2 回押す
    Then SubmitActionButton は disabled で aria-busy が true になり、LoadingState（kind="action"）が表示される
    And API リクエストは同一の X-Idempotency-Key で 1 回だけ送信される

  Scenario: 対象の再取得中は LoadingState が表示される
    Given 司書「山田花子」が引き継ぎ状態を持たずに画面を開き、有効な書籍IDと利用者番号を入力する
    When 対象書籍と対象利用者の取得が300ms経過しても完了していない
    Then LoadingState（kind="detail"、label "貸出対象を読み込み中"）が表示され aria-busy が true になる
    And 画面独自のスピナー・Skeleton は表示されない

  Scenario: 登録成功時に貸出IDと返却期限が表示される
    Given 司書「山田花子」が窓口貸出受付画面で貸出情報を入力している
    And API が貸出ID "L-000001"、返却期限 "2026-09-16" を返す
    When 司書が「貸出を登録する」を押す
    Then LoanRegistrationPage の result に LoanResponse が保持され、LoanConfirmation へ確定値として渡される
    And Alert(success) に貸出ID "L-000001" と返却期限「2026年9月16日（あと14日）」が表示される
    And 次の行動導線（続けて貸し出す）が 1 つ表示され、押下で useAppNavigation().navigate("staff-loan-new") が呼ばれる

  Scenario: 貸出中の書籍への登録失敗時に理由と再判定導線を表示する
    Given 司書「山田花子」が書籍ID "B-000003"、利用者番号 "U-000123" を指定している
    And API が HTTP 409（code "BOOK_NOT_AVAILABLE"）を返す
    When 司書が「貸出を登録する」を押す
    Then Alert(destructive) に「この書籍は貸出中のため貸し出せません」が表示される
    And 貸出可否判定画面へ戻る導線が表示される
```

```gherkin
Scenario: 結果不明の再読込は同じ操作として復元する
  Given 送信前に同じsubのキーと本文がsessionStorageへ保存されている
  When 通信断後にページを再読込して再送を押す
  Then 元のキーと本文でcreateLoanを呼び編集も別操作も許可しない

Scenario: 同じ画面で次の貸出を始める
  Given 貸出登録が201で完了している
  When 続けて貸し出すを押して別の貸出を送る
  Then 前回と異なるUUID v4を使い前回の結果を表示しない

Scenario: 成功したが関連情報の再取得に失敗する
  Given createLoanが201を返している
  When キャッシュの再取得が失敗する
  Then 貸出IDと成功表示を保持しcreateLoanを再実行しない
```
