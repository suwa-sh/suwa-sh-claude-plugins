# 04 システム境界

- 解析対象リポジトリ: `/Users/suwa_sh/src/github.com/suwa-sh/claude-code-rdra-rev/system-sekkei/library`
- 前提ドキュメント: `analysis/01-overview.md`, `analysis/02-value.md`, `analysis/03-environment.md`（コミット: `f460a75b843c484908b95b82e6fdd84186b4b5f8`）
- 解析日: 2026-07-03
- ※ 根拠の path はリポジトリルートからの相対パスで記載する。
- ※ アクター名は Phase2（02-value.md）の定義に一致させる: 司書 / 図書館館長 / 会員 / 一般利用者（未会員）。
  BUC 名は Phase3（03-environment.md）の定義に一致させる。
- ※ 「操作する情報」「遷移させる状態」の名称は Phase5 の情報・状態モデルに向けた**仮置き**である。
  状態値は実装の列挙型（所蔵品状態: 未登録/在庫中/予約中/取置中/貸出中/その他 — 事実:
  src/main/java/library/domain/model/material/item/ItemStatus.java:6-13、予約状態: 未準備/消込済 — 事実:
  src/main/java/library/domain/model/reservation/ReservationStatus.java:6-8）に基づく。Phase5 で整合を取る。
- ※ 主な証拠源: presentation 層のコントローラ（`@RequestMapping` ルーティング定義）、application/scenario
  層のシナリオクラス、Thymeleaf テンプレート（src/main/resources/templates/）、REST API
  （src/main/java/library/presentation/api/ExpireCheck.java）。

## UC 一覧

### 実装済み UC

| UC | 目的 | 操作する情報 | 遷移させる状態 | 対応 BUC | 確度 | 根拠 |
|----|------|-------------|--------------|---------|------|------|
| 貸出可否を判定する | 会員の有効性・所蔵品の貸出可否・貸出制限（点数×視聴覚資料×延滞）を3段階で判定し、不可理由を司書に提示する | 会員、所蔵品、貸出 | （判定のみ。状態遷移なし） | 貸出 | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:40-63（未登録会員→所蔵品貸出可否→貸出制限の3段階エラー提示）、src/main/java/library/application/scenario/loan/LoanScenario.java:45-56（会員番号の有効性確認・貸出制限判断）、LoanScenario.java:75-81（所蔵品の貸出可否を提示する） |
| 貸出を登録する | 会員番号・所蔵品番号・貸出日を入力して貸出を記録する | 貸出 | 所蔵品: 在庫中→貸出中（仮置き。Phase5 で検証） | 貸出 | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:26（`POST loan/register`）、LoanRegisterController.java:65（`coordinator.loan(loanRequest)`）、LoanRegisterController.java:78-85（入力項目: memberNumber/itemNumber/loanDate）、src/main/java/library/application/scenario/loan/LoanScenario.java:58-63（貸し出す） |
| 貸出状況を提示する | 貸出登録後に会員の貸出状況（貸出点数等）を司書に提示する | 貸出 | （参照のみ） | 貸出 | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:66-76（登録後に loanStatus を取得し完了画面へ）、src/main/java/library/application/scenario/loan/LoanScenario.java:65-70（貸出状況を提示する）、src/main/resources/templates/loan/completed.html:15（「貸出状況」見出し） |
| 返却を登録する | 所蔵品番号と返却日を入力して返却を記録する（返却に伴い貸出記録を消去: 個人情報保護） | 返却、貸出（消去） | 所蔵品: 貸出中→在庫中（仮置き。Phase5 で検証） | 返却 | high | 事実: src/main/java/library/presentation/returns/ReturnMaterialController.java:18（`POST returns`）、ReturnMaterialController.java:34-42（返却登録）、ReturnMaterialController.java:49-55（入力項目: itemNumber/returnDate）、src/main/java/library/application/scenario/returns/ReturnsScenario.java:18-23、src/test/java/library/application/scenario/returns/ReturnsFlowTest.java:37-50（貸出記録が消去されるテスト。03-environment.md より） |
| 所蔵品目を検索する | 借りたい本をキーワードで探し、在庫の有無を含む一覧を提示する | 所蔵品目、所蔵品（在庫状態の参照） | （参照のみ） | 予約受付 | high | 事実: src/main/java/library/presentation/reservation/EntrySearchController.java:19（`GET reservation/entries/search`）、EntrySearchController.java:27-33（キーワード検索と在庫リスト提示）、src/main/java/library/application/scenario/reservation/ReservationScenario.java:37-42（本を探す） |
| 予約を登録する | 検索結果から選んだ所蔵品目に対し、会員番号を検証したうえで予約を記録する | 予約、会員、所蔵品目 | 予約: （新規）→未準備 | 予約受付 | high | 事実: src/main/java/library/presentation/reservation/ReservationController.java:20（`POST reservation/register`）、ReservationController.java:41-64（未登録会員のエラー提示と予約登録）、src/main/java/library/application/scenario/reservation/ReservationScenario.java:70-76（予約を記録する）、src/main/java/library/domain/model/reservation/ReservationStatus.java:7（未準備） |
| 予約可否を判定する | 予約制限（ひとり15点まで・うち視聴覚資料5点まで）を判定する。**シナリオ実装はあるが画面フローから未接続** | 予約、会員、所蔵品目 | （判定のみ） | 予約受付 | medium | 事実: src/main/java/library/application/scenario/reservation/ReservationScenario.java:59-68（予約制限を判断する）、docs/specification.md:19。FIXME: src/main/java/library/presentation/reservation/ReservationController.java:41-65 の登録処理は reservationAvailability を呼び出しておらず、仕様の予約制限が画面から適用されない（03-environment.md の FIXME を継続。実装バグか意図的未接続かは Phase5 で精査） |
| 未準備の予約を一覧する | 未準備の予約を取置可否の表示つきで一覧し、取置・キャンセルの起点とする | 予約（待ち順序含む） | （参照のみ） | 取置準備、予約取消（在庫なし連絡） | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:17（`GET retentions/requests`）、ReservationController.java:27-32（未準備の予約一覧）、src/main/java/library/application/scenario/retention/RetentionScenario.java:44-49、src/main/resources/templates/retention/requests.html:11-41（一覧・取置/キャンセルボタン・取置可否列） |
| 取置を登録する | 予約に対して確保した所蔵品を取り置く。所蔵品の未登録・資料不一致・在庫中以外を検証し、登録に伴い会員へ準備完了を通知する | 取置、予約、所蔵品 | 所蔵品: 在庫中→取置中（仮置き）、予約: 未準備→（取置済）（仮置き。Phase5 で検証） | 取置準備 | high | 事実: src/main/java/library/presentation/retention/RetentionController.java:28（`POST retentions`）、RetentionController.java:45-80（3段階検証と登録）、RetentionController.java:94-100（入力項目: itemNumber/reservationNumber）、src/main/java/library/application/scenario/retention/RetentionScenario.java:71-76（取り置く）、src/main/java/library/application/service/retention/RetentionRecordService.java:40-48（登録と準備完了通知の呼び出し） |
| 準備完了を通知する | 取置登録に伴い、会員に「予約いただいた本が準備できました」と取置期限を連絡する（現実装はログ出力スタブ） | 取置、会員 | （通知のみ） | 取置準備 | medium | 事実: src/main/java/library/application/service/retention/RetentionRecordService.java:45-46（取置登録時に retentionNotification.retained を呼び出し）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:16-23（通知文面）。推測: 実配信チャネルが未実装（ログスタブ）のため、独立した UC としての実現度は部分的（02-value.md の FIXME を継続） |
| 予約を取り消す | 用意できない予約をキャンセルし、会員に「在庫がありませんでした」を通知する | 予約 | 予約: 未準備→（取消）（仮置き。Phase5 で検証） | 予約取消（在庫なし連絡） | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:44-48（`POST retentions/requests/canceled`）、src/main/resources/templates/retention/requests.html:31-33（キャンセルボタン）、src/main/java/library/application/scenario/reservation/ReservationCancellationScenario.java:22-28（予約を取り消す）、src/main/java/library/application/service/reservation/ReservationRecordService.java:28-34（取消と在庫なし通知） |
| 在庫なしを通知する | 予約取消に伴い、会員に「予約いただいた本は在庫がありませんでした」を連絡する（現実装はログ出力スタブ） | 予約、会員 | （通知のみ） | 予約取消（在庫なし連絡） | medium | 事実: src/main/java/library/application/service/reservation/ReservationRecordService.java:33（cancel 時に notAvailable を呼び出し）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:26-33（通知文面）。推測: 実配信チャネルが未実装（ログスタブ）のため実現度は部分的 |
| 取置中を一覧する | 取置中の資料を取置期限つきで一覧し、期限切れは強調（mark）表示する | 取置 | （参照のみ） | 取置の受け渡し（貸出）、取置期限切れ処理 | high | 事実: src/main/java/library/presentation/retention/RetentionController.java:38-43（`GET retentions`）、src/main/java/library/application/scenario/retention/RetentionScenario.java:78-83（準備完了を一覧する）、src/main/resources/templates/retention/retentions.html:11-43（一覧・isExpired 分岐・貸出/期限切れ処理ボタン） |
| 取置を貸し出す | 取置中の資料を受け取りに来た会員へ貸し出す（取置→貸出への引き渡し） | 取置、貸出 | 所蔵品: 取置中→貸出中（仮置き）、予約: →消込済 | 取置の受け渡し（貸出） | high | 事実: src/main/java/library/presentation/retention/RetentionController.java:82-86（`POST retentions/loans?loaned`）、src/main/resources/templates/retention/retentions.html:29（「貸出」ボタン）、src/main/java/library/application/scenario/retention/RetentionScenario.java:85-93（取置を貸し出す）、src/main/java/library/domain/model/reservation/ReservationStatus.java:8（消込済=「貸出または取置期限切れにより取置を解放」） |
| 取置を期限切れにする | 取置期限（連絡翌日から7開館日）を過ぎた取置を解放し、予約を消し込む | 取置、予約 | 予約: →消込済 | 取置期限切れ処理 | high | 事実: src/main/java/library/presentation/retention/RetentionController.java:88-92（`POST retentions/loans?expired`）、src/main/resources/templates/retention/retentions.html:32-37（期限切れ表示と「期限切れ処理」ボタン）、src/main/java/library/application/scenario/retention/RetentionExpireScenario.java:19-24、src/main/java/library/application/service/retention/RetentionRecordService.java:50-58（解放と消込済への ensureStatus）、docs/specification.md:22-23 |
| 貸出期限切れを確認する | 所蔵品番号を指定して貸出の期限切れを確認し、期限切れを通知リポジトリへ渡す（REST API。画面なし） | 貸出 | （判定・通知のみ） | 督促（遅滞者の把握と通知） | medium | 事実: src/main/java/library/presentation/api/ExpireCheck.java:14-31（`GET /expired`、RestController）、src/main/java/library/application/service/loan/LoanExpiredCheckService.java:14-20（貸出期限切れを確認する）。推測: 呼び出し元（外部スケジューラ/手動）が不明で、督促 BUC との対応も部分的（02/03 の FIXME を継続）。FIXME: LoanExpiredCheckService.java:12 の notificationRepository はコンストラクタ注入されておらず NotificationRepository（application/service/loan/NotificationRepository.java:8-10）の実装クラスもリポジトリ内に存在しないため、この API は実行時に NPE となる可能性が高い（未完成実装） |

### 未実装 UC（仕様書・README・@Disabled テスト由来の候補）

as-is のシステム境界には存在しないが、Phase3 のアクティビティから UC 候補として引き継ぐ。

| UC（候補） | 目的 | 操作する情報 | 遷移させる状態 | 対応 BUC | 確度 | 根拠 |
|-----------|------|-------------|--------------|---------|------|------|
| 貸出を延長する | 予約がなければ1回（15日間）だけ貸出を延長する | 貸出 | （不明） | 貸出延長 | low | 推測: docs/specification.md:10（延長ルール）と src/test/java/library/application/scenario/loan/LoanFlowTest.java:194-203 の @Disabled テスト名（03-environment.md より）から導出。対応する画面・ルーティング・シナリオクラスは存在しない |
| 遅滞者を把握する | 毎月末日に遅滞者を一覧・把握する | 貸出、会員 | （参照のみ） | 督促（遅滞者の把握と通知） | low | 推測: docs/specification.md:32（「図書館館長は毎月末日に遅滞者の把握を行う」）から導出。遅滞者一覧の画面・API は存在せず、既存の `GET /expired`（ExpireCheck.java:26-31）は所蔵品1件単位のため月末の一括把握には使えない |
| 督促を通知する | 返却期日から60日以上経過する遅滞者に督促する（通知内容はカード番号・資料番号・返却期限日のみ） | 貸出、会員 | （通知のみ） | 督促（遅滞者の把握と通知） | low | 推測: docs/specification.md:33-37（督促の業務ルール）から導出。対応する画面・処理は存在しない。NotificationRepository.expired（application/service/loan/NotificationRepository.java:9）が唯一のインターフェース痕跡だが実装なし |
| 利用停止を登録する | 2か月以上の延滞者について図書館カードの利用を1ヶ月間停止する | 会員、貸出 | 会員: →利用停止（仮置き） | 督促（遅滞者の把握と通知） | low | 推測: docs/specification.md:28 から導出。貸出可否判定に「貸出停止」区分（src/main/java/library/domain/model/loan/rule/RestrictionOfDelay.java、03-environment.md より）はあるが、停止の登録操作・停止期間（1ヶ月）の管理機能は存在しない |
| 会員を登録する | 市内在住・在学の利用者に図書館カードを発行する（有効期限3年） | 会員 | 会員: （新規）→登録済（仮置き） | 会員登録（図書館カード発行） | low | 推測: docs/specification.md:41-43 と src/main/resources/templates/top.html:24（「会員の管理 未実装」）から導出。登録画面・登録処理は存在しない（application/service/member/ は照会系のみ） |
| 資料を注文する / 蔵書を登録する | 資料を注文し、蔵書（所蔵品目・所蔵品）として登録する | 所蔵品目、所蔵品 | （不明） | 資料の注文・蔵書登録 | low | 推測: README.md:74 と src/main/resources/templates/top.html:25（「所蔵品の管理 未実装」）から導出。docs/specification.md:51 の蔵書管理章は本文が空。登録画面・登録処理は存在しない |

## 画面一覧

Thymeleaf テンプレート（サーバーサイドレンダリング）単位で抽出する。URL はコントローラの
`@RequestMapping` に基づく。

| 画面 | 説明 | アクター | 関連 UC | 確度 | 根拠 |
|------|------|---------|--------|------|------|
| トップ（業務体系） `GET /` | 「利用者向け」（ご利用案内=未実装、本の予約）と「図書館スタッフ用」（貸出と返却、予約の管理、取置の管理、会員の管理=未実装、所蔵品の管理=未実装）のメニュー画面 | 司書、会員 | （ナビゲーションのみ。UC なし） | high | 事実: src/main/java/library/presentation/TopController.java:7-13、src/main/resources/templates/top.html:13-26（メニュー構成と「未実装」表記） |
| 貸出の登録画面 `GET/POST /loan/register` | 会員番号・所蔵品番号・貸出日を入力し、判定エラー（会員未登録・貸出不可・貸出制限）をインラインで提示する | 司書 | 貸出可否を判定する、貸出を登録する | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:22-27（クラスコメント「貸出の登録画面」）、src/main/resources/templates/loan/form.html:5（タイトル「本の貸出」）、src/main/resources/templates/top.html:21（スタッフメニュー「貸出と返却」） |
| 貸出完了画面 `GET /loan/register/completed` | 貸出登録の完了と会員の貸出状況を表示する | 司書 | 貸出状況を提示する | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:72-76、src/main/resources/templates/loan/completed.html:5-15（「貸出完了」「貸出状況」） |
| 返却の登録画面 `GET/POST /returns` | 所蔵品番号と返却日を入力して返却を登録する | 司書 | 返却を登録する | high | 事実: src/main/java/library/presentation/returns/ReturnMaterialController.java:14-19（クラスコメント「返却の登録画面」）、src/main/resources/templates/returns/form.html:5-13（「本の返却」） |
| 返却完了画面 `GET /returns/completed` | 返却登録の完了を表示する | 司書 | 返却を登録する（完了確認） | high | 事実: src/main/java/library/presentation/returns/ReturnMaterialController.java:44-47、src/main/resources/templates/returns/completed.html:5-13（「返却完了」） |
| 所蔵品目の検索画面 `GET /reservation/entries/search` | キーワードで所蔵品目を検索し、在庫の有無つきで一覧表示する。予約フォームへの起点 | 会員（司書代行の可能性あり: FIXME） | 所蔵品目を検索する | high | 事実: src/main/java/library/presentation/reservation/EntrySearchController.java:15-33（クラスコメント「所蔵品目の検索画面」）、src/main/resources/templates/reservation/search.html:5（「本の検索」）、src/main/resources/templates/top.html:17（「会員：本の予約」）、src/main/resources/templates/_parts/navigation.html:13（「本を探す」） |
| 予約の登録画面 `GET/POST /reservation/register?entry=` | 選択した所蔵品目に対し会員番号を入力して予約する（未登録会員はエラー） | 会員（司書代行の可能性あり: FIXME） | 予約を登録する | high | 事実: src/main/java/library/presentation/reservation/ReservationController.java:16-21（クラスコメント「予約の登録画面」）、ReservationController.java:33-65、src/main/resources/templates/reservation/form.html:5-12（「予約フォーム」「予約する本」） |
| 予約完了画面 `GET /reservation/register/completed` | 予約登録の完了を表示する | 会員（司書代行の可能性あり: FIXME） | 予約を登録する（完了確認） | high | 事実: src/main/java/library/presentation/reservation/ReservationController.java:67-70、src/main/resources/templates/reservation/completed.html:5（「予約完了」） |
| 予約の管理画面 `GET /retentions/requests` | 未準備の予約を取置可否つきで一覧し、「取置」（取置登録フォームへ遷移）と「キャンセル」（予約取消）を実行する | 司書 | 未準備の予約を一覧する、予約を取り消す | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:13-18（クラスコメント「予約の管理画面」、`@Controller("予約の管理")`）、src/main/resources/templates/retention/requests.html:5-37（タイトル・取置/キャンセルボタン・取置可否列）、src/main/resources/templates/top.html:22（「予約の管理」） |
| 取置の登録画面 `GET /retentions/requests/{reservationNumber}` → `POST /retentions` | 予約に対して所蔵品番号を入力して取置を登録する（未登録・資料不一致・在庫中以外はエラー） | 司書 | 取置を登録する（登録に伴い準備完了を通知する） | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:34-42（取置フォーム表示）、src/main/java/library/presentation/retention/RetentionController.java:45-80（登録と検証）、src/main/resources/templates/retention/form.html:5（「取置の登録」） |
| 取置の管理画面 `GET /retentions` | 取置中の資料を取置期限つきで一覧し、「貸出」（受け渡し）と「期限切れ処理」を実行する | 司書 | 取置中を一覧する、取置を貸し出す、取置を期限切れにする | high | 事実: src/main/java/library/presentation/retention/RetentionController.java:24-43（クラスコメント「取置の管理画面」、`@Controller("取置の管理")`）、src/main/resources/templates/retention/retentions.html:11-43（取置中一覧・貸出/期限切れ処理ボタン）、src/main/resources/templates/top.html:23（「取置の管理」）。FIXME: retention/retentions.html:5 の `<title>` が「本の貸出」となっており画面内容（取置中一覧）と不一致（タイトルの記載ミスと推測） |

- 画面ナビゲーション: 業務ごとに3系統のナビゲーションフラグメント（reservation: 本を探す/本の貸出予約、
  loan: 本の貸出/本の返却、retention: 予約の管理/取置の管理）が定義され、Phase3 の業務分割と一致する
  （事実: src/main/resources/templates/_parts/navigation.html:8-36）。
- REST API `GET /expired`（期限切れチェック）は画面を持たない（事実:
  src/main/java/library/presentation/api/ExpireCheck.java:14-31。イベント一覧・タイマー一覧を参照）。

## イベント一覧

ランタイムに連携する外部システムは存在しない（02-value.md、high）ため、実装されたイベントは
「通知インターフェース（ログ出力スタブ）」と「呼び出し元不明の受信 API」に限られる。

| イベント | 説明 | 外部システム | 関連 UC | 確度 | 根拠 |
|---------|------|-------------|--------|------|------|
| 取置準備完了の連絡（送信） | 取置登録に伴い「予約いただいた本が準備できました。取置期限:…」を会員宛に送る。実装は `logger.info` のスタブで外部システム未連携 | 通知サービス（将来連携候補。02-value.md では low） | 取置を登録する / 準備完了を通知する | medium | 事実: src/main/java/library/application/service/retention/RetentionNotification.java:6-9（通知インターフェース）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:15-23, 35-37（文面と logger.info 実装）。推測: 実配信チャネル（窓口・電話・メール・はがき, docs/specification.md:33）との対応は読み取れない |
| 予約在庫なしの連絡（送信） | 予約取消に伴い「予約いただいた本は在庫がありませんでした」を会員宛に送る。実装は `logger.info` のスタブ | 通知サービス（将来連携候補） | 予約を取り消す / 在庫なしを通知する | medium | 事実: src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:25-33、src/main/java/library/application/service/reservation/ReservationRecordService.java:31-34。推測: 同上 |
| 貸出期限切れの通知（送信） | 期限切れチェックの結果を通知リポジトリへ渡す。インターフェースのみ存在し、実装クラスがリポジトリ内に存在しない | （不明。通知サービス想定） | 貸出期限切れを確認する | low | 事実: src/main/java/library/application/service/loan/NotificationRepository.java:8-10（`void expired(Loan loan)`）、src/main/java/library/application/service/loan/LoanExpiredCheckService.java:19（`notificationRepository.expired(loan)`）。推測: 実装クラスが存在せず（`grep NotificationRepository` の該当は宣言箇所のみ）、通知先・手段は完全に不明。FIXME: DI もされないため呼び出すと NPE |
| 期限切れチェック要求（受信） `GET /expired?itemNumber=` | 所蔵品番号を指定した貸出期限切れチェックの受信 API。呼び出し元（外部スケジューラ・監視系・手動）がリポジトリ内に存在せず不明 | （不明） | 貸出期限切れを確認する | low | 事実: src/main/java/library/presentation/api/ExpireCheck.java:14-31（API 定義自体は事実）。推測: 画面から一切リンクされておらず、呼び出し元の定義（cron 設定・CI・スクリプト）もリポジトリ内に皆無のため、外部イベントかタイマー起動かを確定できない（02/03 の FIXME を継続。Phase3 ユーザー確認対象） |

- 分散トレーシング送信（Zipkin 互換、デフォルト無効。事実: build.gradle:35-36、
  src/main/resources/application.yaml:14-18）は運用監視の連携であり、業務イベントには含めない
  （02-value.md の整理を踏襲）。

## タイマー一覧

| タイマー | タイミング | 起動 UC | 確度 | 根拠 |
|---------|-----------|--------|------|------|
| （実装されたタイマーなし） | ― | ― | high | 事実: `@Scheduled` / `@EnableScheduling` / cron / Quartz が src・build.gradle・.github・.circleci のいずれにも存在しない（grep 結果 0 件）。バッチジョブ・ジョブスケジューラの定義もリポジトリ内に皆無 |
| 遅滞者把握（業務上のタイマー。システム未実装） | 毎月末日 | 遅滞者を把握する（未実装 UC）。関連する既存実装は貸出期限切れを確認する（`GET /expired`）のみ | medium | 事実: docs/specification.md:32（「図書館館長は毎月末日に遅滞者の把握を行う」）。推測: システム化されておらず、運用（人手）タイマーとしてのみ存在。既存 API との対応は不明（FIXME 継続） |
| 期限切れチェックの定期起動（候補） | 不明（日次等と推定） | 貸出期限切れを確認する | low | 推測: `GET /expired`（ExpireCheck.java:26-31）が画面から呼ばれない受信専用 API であることから、外部スケジューラによる定期起動を想定した口と推定。ただし呼び出し元・起動間隔の定義はリポジトリ内に存在しない（Phase3 ユーザー確認対象） |

- 取置期限（連絡翌日から7開館日）の経過判定はタイマーではなく、取置の管理画面の表示時に
  オンデマンドで判定される（事実: src/main/resources/templates/retention/retentions.html:25-37 の
  `retained.isExpired()` 分岐、src/main/java/library/domain/model/retention/ExpireDate.java）。
  期限切れ処理の実行はあくまで司書の画面操作（`POST /retentions/loans?expired`）である。

## FIXME / 特記事項

- FIXME: `GET /expired`（期限切れチェック API）は実行時に NPE となる可能性が高い。
  LoanExpiredCheckService（src/main/java/library/application/service/loan/LoanExpiredCheckService.java:12）の
  `notificationRepository` フィールドはコンストラクタ注入も `@Autowired` もなく、かつ
  NotificationRepository インターフェースの実装クラスがリポジトリ内に存在しない。未完成実装として記録する
  （RDRA フルビルド時、この UC の as-is 扱いを確認）。
- FIXME: 予約登録の画面フロー（src/main/java/library/presentation/reservation/ReservationController.java:41-65）が
  予約制限判定（ReservationScenario.java:62-68）を呼び出しておらず、仕様（docs/specification.md:19 の
  15点/5点制限）が画面から適用されない（03-environment.md から継続。Phase5 で精査）。
- FIXME: `GET /expired` の呼び出し元（外部スケジューラ/手動/監視系）が不明。イベントともタイマーとも
  確定できないため両方の一覧に low で記載した（02/03 から継続。Phase3 ユーザー確認対象）。
- FIXME: 予約系画面（所蔵品目の検索・予約の登録・予約完了）のアクターが曖昧（会員セルフサービスか
  司書のカウンター代行か。02/03 から継続。Phase3 ユーザー確認対象）。
- FIXME: src/main/resources/templates/retention/retentions.html:5 の `<title>` が「本の貸出」で
  画面内容（取置中一覧）と不一致（記載ミスと推測。実害は軽微）。
- 通知系イベント（準備完了・在庫なし・期限切れ）はすべて外部未連携（ログスタブ or 実装なし）。
  外部システム「通知サービス」は 02-value.md で low とされており、イベントの連携先確定は Phase3 の
  ユーザー確認に依存する。
- 状態遷移の仮置き（所蔵品: 在庫中/予約中/取置中/貸出中、予約: 未準備/消込済）は実装列挙型に基づくが、
  UC ごとの遷移の正確な対応（特に「予約中」の位置づけ、予約取消後の状態）は Phase5 の情報・状態分析で
  検証する。

## 確度サマリ

| 確度 | 件数 | 該当項目 |
|------|------|----------|
| high | 25 | 実装済み UC 13 件（貸出可否判定/貸出登録/貸出状況提示/返却登録/検索/予約登録/未準備予約一覧/取置登録/予約取消/取置中一覧/取置貸出/取置期限切れ）、画面 11 件（全画面）、タイマー: 実装タイマーなしの事実 |
| medium | 7 | UC: 予約可否を判定する（未接続）・準備完了を通知する・在庫なしを通知する・貸出期限切れを確認する、イベント: 取置準備完了の連絡・予約在庫なしの連絡、タイマー: 遅滞者把握（業務タイマー・未実装） |
| low | 9 | 未実装 UC 6 件（貸出延長/遅滞者把握/督促通知/利用停止登録/会員登録/資料注文・蔵書登録）、イベント: 貸出期限切れの通知・期限切れチェック要求の受信、タイマー: 期限切れチェックの定期起動（候補） |

- confidence low の項目（計 9 件）は Phase3 のユーザー確認で必ず一覧提示する（evidence-rules.md 準拠）。
