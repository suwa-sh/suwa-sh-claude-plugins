# 共通の実行条件

<a id="TR-AUTH"></a>

## TR-AUTH 認証と参照範囲

[アーキテクチャ](../../../../arch/latest/arch-design.yaml)のSP-007・SP-009と[閲覧範囲](../../../../rdra/latest/条件.tsv)の利用状況閲覧範囲判定を参照する。

| 条件 | 処理結果 |
|---|---|
| 署名・有効期限・issuer・audienceが有効 | トークンの利用者番号とロールで処理する |
| 認証不成立 | 401。データを参照・更新しない |
| 館内専用経路への外部接続、許可外ロール | 403 |
| 本人用operation | トークンの利用者番号でSQLを絞る。要求値で主体を差し替えない |
| 指定予約が本人の所有外 | 404。予約者の情報を返さない |

<a id="TR-IDEMP"></a>

## TR-IDEMP 再送と結果の回復

適用対象はすべての更新operationと日次ジョブとする。

1. 主体・operation・X-Idempotency-Keyを結合したキーを使用する。本文・path・query・If-Matchなど結果を左右するheaderを正規化しSHA-256を求める。
2. RDB取引の先頭で主体・operation・キーのhashに対するtransaction-scoped advisory lockを取得し、取引完了まで保持する。異なる対象IDでも同じキーを直列化する。RDBで同じキーの確定イベントまたはnotification_request_receiptsを検索する。同じhashなら保存した応答を返し、異なるhashなら409を返す。
3. イベントのrequest_keyにはoperationとキーを結合した値を保存する。actor_id・対象IDとの一意制約で同じ対象の並行要求を排他する。新規対象IDは主体・operation・キーのHMAC-SHA256から決定的に生成し、同じ再送が別の対象を作らないようにする。
既存IDが同じ要求の成功記録なら再送応答を返す。別要求のID衝突は409 VERSION_CONFLICTでrollbackする。採番値を変えて続行しない。

4. 業務更新・イベント・確定応答を同じトランザクションで保存する。通知要求は同じ取引でoutboxへ保存する。
5. KVSは確定済み応答を24時間キャッシュする。障害・失効時はRDBを照合し、再実行の可否を判定する。

| 境界 | 再送時の結果 |
|---|---|
| commit前に中断 | rollbackし、同じキーで再実行できる |
| commit後に応答が消失 | 確定応答を返す。イベントと通知要求を増やさない |
| 同じキーの並行要求 | 先行取引の確定を待って照合する |
| RDBを照合できない | 503。更新処理を開始しない |

通知受付はnotification_request_receiptsへ主体・要求キー・hash・確定応答・通知IDを同一取引でINSERTする。自動要求のcause_keyが既存でも、新しいHTTP要求の受付記録を保存する。

日次処理はbusiness_dateと対象IDと通知種別から安定したキーを作る。
監査用イベントとrequest_keyは業務イベントと同じ寿命で保持し、KVS失効を再実行許可に使わない。

<a id="TR-TX"></a>

## TR-TX 状態変更の取引境界

| 対象 | 取得順と確定内容 |
|---|---|
| 全更新のlock順 | 再送キーのadvisory lock、必要な利用者行のuser_number昇順、書籍行のbook_id昇順、貸出行、予約行のreservation_id昇順、outboxの順とする |
| 新規貸出・新規予約・利用者削除 | 同じ利用者行をFOR UPDATEで取得する。lock後にdeletedを再確認し、新規取引はdeleted=trueなら404。削除は有効取引の存在を再確認する |
| 返却・取消・期限判定 | 対象書籍から上記の順に取得する。利用者行の取得が必要な処理は書籍lockの前に行う |
| 更新前条件 | lock取得後に現在状態、削除フラグ、version、業務条件を再評価する |
| 確定内容 | event追記、snapshot更新、予約順位更新、監査追記、必要なoutbox挿入を同一RDB取引に含める |
| 条件不成立・version不一致 | 全体をrollbackし、業務不成立422または競合409を返す |
| commit後 | 書籍キャッシュを無効化する。失敗したキャッシュは最大60秒で失効する。更新判定はRDBを読む |

同時受付の予約は書籍lockの取得順で連続順位を採番する。
取消・終了した予約のqueue_positionはNULLとし、有効予約の順位を連番にする。

<a id="TR-DATE"></a>

## TR-DATE 業務日付

| 値 | 算出方法 |
|---|---|
| business_date | サーバの現在時刻をAsia/Tokyoへ変換した日付 |
| 貸出日 | 貸出確定時のbusiness_date |
| 期間の境界 | 開始日以上・終了日以下。日時検索は翌日00:00未満へ変換する |
| 日次処理 | 起動時のbusiness_dateを全対象に固定する。再実行でも同じ値を使う |

<a id="TR-PARAM"></a>

## TR-PARAM 業務パラメータ

[パラメータ](../../../../rdra/latest/情報.tsv)の貸出期間・リマインド日数を参照する。

| 条件 | 処理結果 |
|---|---|
| valid_from以上、valid_to未満にbusiness_dateがある世代が1件 | その値を使用する |
| 現行世代のvalid_toがNULL | 上限なしとして扱う |
| 有効な世代が0件または複数件 | 503 CONFIGURATION_UNAVAILABLE。貸出・日次通知の更新を停止する |

適用期間は`valid_from <= business_date AND (valid_to IS NULL OR business_date < valid_to)`とする。
loan_daysは1以上、remind_daysは0以上を要求する。
設定投入時に期間の重複を排他し、業務開始日に有効な設定を必須とする。

<a id="TR-MQ"></a>

## TR-MQ 通知要求と配信結果

[通知契約](api/asyncapi.yaml)と[保存責任](../../../../arch/latest/arch-design.yaml)のE-008を参照する。

| 局面 | 処理 |
|---|---|
| 要求確定 | 通知種別と対象IDのcause_keyを一意にし、同じ要求には既存notification_idを返す |
| 公開 | queued行を排他取得してMQへpublishする。成功後state=queuedの場合だけpublishedにする。既にsending以降へ進んだ行を上書きしない。publish後の中断では同じmessage_idで再公開する |
| 受信済み | sent/failed/unknownは再送せずACKする。sendingかつlease_untilが現在時刻より後なら別workerが実行中なのでACKし、送信しない |
| 復旧走査 | outbox公開workerは毎分sendingかつ期限切れの行を条件付きUPDATEでunknownへ変更する。再配信がなくても検出し、外部送信を再開しない |
| 期限切れlease | sendingかつlease_untilが現在時刻以下ならunknownを保存してACKする。新しい送信権を与えない |
| 送信権取得 | TR-TX順で対象とoutboxをlockし、現在状態と宛先を確認する。stateがqueuedまたはpublished、かつnext_attempt_atがNULLまたは現在時刻以下の場合だけsendingへ条件付きUPDATEし、attemptsを1増やしlease_untilを現在時刻+120秒としてcommitする。更新件数0なら外部送信しない |
| 送信権の識別 | 取得時のattemptsとlease_untilを保持し、配信後のUPDATEにもnotification_id・state=sending・同じattempts・同じlease_untilを条件にする。外部通信中はSQL lockを保持しない |
| 対象外 | 取消・返却などで対象外ならoutboxをfailed、lease_untilとnext_attempt_atをNULLにし、監査へTARGET_INACTIVEを保存してcommit後ACKする。実送信がないためnotificationsは作成しない。再配信もfailedとして抑止する |
| 配信成功 | 成功通知をINSERTしoutboxをsentへ条件付き更新する。claim条件でUPDATEした件数が1件でなければ通知INSERTと予約更新を含む取引全体をrollbackし、成功ACKしない。返却通知は予約の通知済み遷移と同一取引にする。確定後ACKする |
| 確実に未送信の一時障害 | 1、2、4、8、16秒を上限とするjitter付き待機で再試行時は同じclaimの条件でpublishedへ戻し、lease_until=NULLとnext_attempt_atを保存して再配信する。受信が予定時刻前なら予定時刻まで遅延する。attemptsが5に達した失敗はDLQとfailed |
| 宛先不正・認証拒否 | 再試行せず失敗通知を追記してfailed、ACKする |
| タイムアウト、送信受付後にDB確定失敗、sendingのlease切れ | unknownにして自動再送を止める。provider_message_idと配信事業者の履歴を運用者が照合する |
| HTTP受付状態 | outboxのqueued/published/sendingはqueued（受付済み・未確定）、sentはsent、failedはfailed、unknownはunknownへ投影する。対象外抑止のfailedは送信失敗の通知履歴を生成せず、受付結果だけに表示する |

外部メールサービスのexactly-onceは仮定しない。
送信の成功が確認できたunknownは結果を確定し、未受付と確認できた要求だけを同じ通知IDで再処理する。
監視はunknown・DLQ・未公開outboxの滞留を検知する。

<a id="TR-ERROR"></a>

## TR-ERROR エラーと画面回復

エラーの型とコードは[OpenAPI](api/openapi.yaml)のErrorを参照する。

| 結果 | 画面の処理 |
|---|---|
| 400/422 | 入力を保持し、理由を表示する |
| 401 | 再認証へ進む。認証後に状態を再取得する |
| 403/404 | 操作を終了し、個人情報を含まない理由を表示する |
| 409 | 最新状態を再取得する。編集内容を確認して新しいキーで再操作する |
| 503/通信切断 | 結果を成功と扱わない。更新は同じキーで照合・再送する |

<a id="TR-READ"></a>

## TR-READ 一覧と参照モデル

| 対象 | 条件 |
|---|---|
| ページ | 1始まり、標準20件、最大100件。totalは同じ検索条件の件数 |
| 一覧順 | 主な日付の降順、同値はID昇順。蔵書・利用者はID昇順 |
| 結合表示 | APIが権限内の書籍名・著者・利用者名を結合して返す |
| 書籍詳細 | my_reservationはトークン本人の有効予約。本人予約なしはNULL。予約者の一覧は返さない |
| 履歴 | 削除済み書籍・利用者の参照キーを維持する。通常の検索一覧はdeleted=false |

<a id="TR-DELETE"></a>

## TR-DELETE 削除後の参照

書籍・利用者の削除は削除イベントを追記し、snapshotのdeletedをtrueにする。
イベント・貸出・予約の参照キーを保持する。
削除済みの対象は新規取引と通常の詳細取得で404として扱う。
個人情報の消去と保存期間は[NFR](../../../../nfr/latest/nfr-grade.yaml)を参照する。

<a id="TR-AUDIT"></a>

## TR-AUDIT 操作の追跡

[NFR](../../../../nfr/latest/nfr-grade.yaml)のE.7.1.1と[ログ方針](../../../../arch/latest/arch-design.yaml)のCLP-004を参照する。
監査ログには主体、対象ID、操作、結果、時刻を記録する。
業務更新の監査は同一取引で追記し、記録できない場合は更新をrollbackする。
参照の監査を記録できない場合は503を返し、保護対象の情報を返さない。

<a id="TR-SEARCH"></a>

## TR-SEARCH 検索条件の結合

[検索条件](../../../../rdra/latest/条件.tsv)の書籍検索条件判定を参照する。

| 条件 | 照合 |
|---|---|
| 検索式 | 書籍検索条件判定の正規化、一致方法、OR/AND結合を適用する |

<a id="TR-STATS"></a>

## TR-STATS 集計と順位

[集計条件](../../../../rdra/latest/条件.tsv)の人気書籍ランキング判定・集計期間判定を参照する。
期間内の貸出イベントをloan_idで重複排除して集計する。
同じ期間の再集計は既存投影を同じ結果へ更新する。
順位と同数時の表示順は上記の人気書籍ランキング判定を参照する。
