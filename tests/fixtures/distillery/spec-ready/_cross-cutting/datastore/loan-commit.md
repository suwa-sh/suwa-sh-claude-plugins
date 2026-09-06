# 貸出登録の原子性・再送契約

## 採用した設計判断

既存出力のDB更新後のKVS保存には、更新済みなのに結果を再送できない停止区間があった。
このサンプルでは成功応答を業務更新と同じDBトランザクションで保存する。KVSは使わない。
元入力の24時間TTLを廃止し、成功記録を期限なしで保持する。返却後・翌日以降も同じキーは同じ貸出の結果を返す。
これは新しく採用した仕様であり、元のRDRAから確定していた事実ではない。保存量が増えるため、削除・匿名化が必要になれば再送保証と合わせた別設計が必要。

## 永続化

既存の型・制約は[rdb-schema.yaml](rdb-schema.yaml)。追加したapi_operation_resultsも同じファイルを正本とする。

api_operation_resultsの列型・主キー・CHECKはrdb-schema.yaml、保存する値は貸出登録の_model-summary.yamlを参照する。

複合主キーは(actor_sub, operation_id, idempotency_key)。外部キーなし。業務データ削除で連鎖削除しない。
失敗応答、トークン、氏名、連絡先は保存しない。業務更新前のin_progress行も保存しない。
冪等性の単位は同一操作者・同一操作・同一キー。別操作者の同じUUIDは別要求として通常の貸出可否を判定する。

fingerprint = SHA-256(UTF-8("POST\n/api/v1/loans\n" + canonicalBody))。
canonicalBodyは型検証済みの3文字列だけをbook_id, loan_period_type, user_noの順に並べた空白なしJSON。
文字列はJSONのエスケープ規則に従い、Unicode正規化・trim・値の補完はしない。未知のフィールドは400。
トークンやtraceparentは含めない。要求キーのUUID表記は小文字に正規化する。

## 実行順序と競合

1. 毎回認証・司書認可、ヘッダと本文の型検証を行う。失敗した要求はDB処理を開始しない。
2. PostgreSQL READ COMMITTEDで取引開始。取引スコープの排他ロックを試行する。
   ロック番号はUTF-8(JSON配列[actor_sub,"createLoan",小文字UUID])のSHA-256先頭8バイトをbig-endian符号付き64bit整数にしたもの。
   `pg_try_advisory_xact_lock(:lock_id)` がfalseならロールバックし409 IDEMPOTENCY_KEY_IN_PROGRESS / Retry-After: 1。
   ハッシュ衝突は余分な待ちを生むだけで、結果検索には必ず複合主キー全体を使う。
3. ロック獲得後の新しいSELECT文で成功記録を検索する。同じfingerprintなら保存済み201・body・Locationを返す。
   `Idempotency-Replayed: true`を加える。現在の貸出状態は再判定せず更新もしない。
   fingerprintが異なれば409 IDEMPOTENCY_KEY_CONFLICT。保存記録は変更しない。
4. 未処理ならbooks → users → 対象書籍のreservations（reservation_id昇順）の順に `FOR UPDATE NOWAIT` で取得する。
   booksがなければ404 BOOK_NOT_FOUND、次にusersがなければ404 USER_NOT_FOUND。ロック取得不可は409 CONFLICT。
   他UCが同じ書籍の予約を変更・挿入する際も最初にbooks行をロックすることを共有書込境界の要件とする。
5. ロック後の値でspec.mdのRULE-001〜004を再判定する。同時に複数不成立なら資料種別 → 書籍状態・取置き先 → 利用者状態 → 期間区分の順に1件を返す。
   借出中の本を読み取れた場合はBOOK_NOT_AVAILABLE。ロックできなかった場合だけCONFLICTであり、どちらでもよいとはしない。
   予約待ちだが順位1の取置き予約が無い場合もBOOK_ON_HOLD_FOR_OTHER。期限による独自判定は加えず予約状態を正本とする。
6. ロック取得後に1回取得した時刻を登録時刻とし、Asia/Tokyoの暦日をloan_dateとする。日数加算は暦日で行う。
   loan_idはUUID v4を小文字で採番する（失敗時の欠番を許容）。loans、books、users、該当reservationsを_model-summary.yamlの値で更新し、同じ取引で成功記録をINSERTする。
   取置き予約を貸出済みにした後、残る有効予約のpriorityをapplied_at ASC, reservation_id ASCで1から振り直す（元RDRAの予約順位決定条件）。
   books.versionは+1。利用者が既に取引進行中なら状態・updated_atは変更しない。
   reservation_idは取置き予約から貸し出した場合だけ応答に含める。書誌のNULL値はそのまま写す。
7. COMMIT成功後に201・保存済みbody・Locationを返す。初回応答にはIdempotency-Replayedを付けない。
   部分一意制約による有効貸出の重複は全体をロールバックしBOOK_NOT_AVAILABLE。その他のDB障害は503 TEMPORARILY_UNAVAILABLE。
   COMMIT結果が不明な場合も503（接続断なら応答なし）。クライアントは同一キー・本文で再送し、成功記録の有無から再開する。

業務更新・成功記録の片方だけのコミットは禁止。処理中の停止はDBがロールバックし取引ロックを解放する。
監査の確定事実はactor_sub、日時、応答内のloan_id/book_id/user_noとしてこの成功記録に残る。追加の診断ログは成否を左右しない。
4xxはこの要求が新しい業務更新を確定しなかったことを示す。ただし認証エラー・キー競合は過去要求の成功有無を否定しない。

## 障害時の受入条件

```gherkin
Feature: 貸出と成功応答の一括保存
  Scenario: 業務更新後かつ成功記録前に停止する
    Given 貸出登録取引がbooksとloansを更新済みで未コミットである
    When 成功記録INSERT前に接続を失う
    Then 業務更新と成功記録はどちらも残らない
    And 同じキーと本文の再送で貸出は1件だけ作成される

  Scenario: コミット後に応答を失う
    Given 貸出と成功記録が同じ取引でコミット済みである
    When 201を受信できず同じ操作者が同じキーと本文で再送する
    Then 保存済みのloan_idとdue_dateとLocationを201で返す
    And Idempotency-Replayedはtrueで業務更新は追加されない

  Scenario: 返却後も同じ要求の再送は貸出を作らない
    Given 同じキーの貸出が既に返却済みである
    When 24時間を超えてから元の本文を再送する
    Then 初回の保存済み201を返し新しい貸出を作らない

  Scenario: 操作者をまたいで成功記録を共有しない
    Given 司書Aがあるキーで貸出を作成済みである
    When 司書Bが同じキーで同じ書籍の貸出を要求する
    Then Aの成功記録を返さず現在の書籍状態からBOOK_NOT_AVAILABLEを返す
```

実装方式の参照: [PostgreSQLの取引スコープロック](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)、[READ COMMITTEDの文ごとの可視性](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)。
