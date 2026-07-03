# 03 システム外部環境

- 解析対象リポジトリ: `/Users/suwa_sh/src/github.com/suwa-sh/claude-code-rdra-rev/system-sekkei/library`
- 前提ドキュメント: `analysis/01-overview.md`, `analysis/02-value.md`（コミット: `f460a75b843c484908b95b82e6fdd84186b4b5f8`）
- 解析日: 2026-07-03
- ※ 根拠の path はリポジトリルートからの相対パスで記載する。
- ※ アクター名は Phase2（02-value.md）の定義に一致させる: 司書 / 図書館館長 / 会員 / 一般利用者（未会員）。
- ※ 主な証拠源: トップ画面のメニュー体系（src/main/resources/templates/top.html、画面タイトルは「業務体系」）、
  画面ナビゲーション（templates/_parts/navigation.html の loan / reservation / retention フラグメント）、
  application/scenario パッケージ（package-info.java:2 に「業務活動の流れ」と明記されたシナリオクラス群）、
  業務フローテスト（src/test/java/library/application/scenario/**/\*FlowTest.java）、
  業務仕様書（docs/specification.md）、README.md の対象業務一覧。

## 業務領域一覧

| 業務 | 概要 | 確度 | 根拠 |
|------|------|------|------|
| 貸出・返却 | カウンターでの資料の貸出（貸出制限ルールの判定を含む）と返却。本システムの中核業務（README の対象業務で「◎」） | high | 事実: docs/specification.md:3-15（「## 貸出・返却」章）、README.md:9（「貸出と返却 ◎」）、src/main/resources/templates/top.html:21（スタッフメニュー「貸出と返却」）、src/main/java/library/presentation/loan/・returns/、src/main/java/library/application/scenario/loan/・returns/ |
| 予約・取置 | 会員による所蔵品目の予約受付と、司書による取置（準備・受け渡し・期限切れ処理・取消）。予約の状態遷移（未準備→準備完了→解放/期限切れ/取消）が中核ビジネスルール | high | 事実: docs/specification.md:17-23（「### 予約・取置」）、src/main/resources/templates/top.html:17（「会員：本の予約」）・top.html:22-23（「予約の管理」「取置の管理」）、src/main/java/library/presentation/reservation/・retention/、src/main/java/library/application/scenario/reservation/・retention/、README.md:60（「予約の状態遷移」）。注: 仕様書上は「貸出・返却」章の下位節だが、メニュー・パッケージ・アクター（会員が起点）が独立しているため別業務として扱う（推測: 分割判断は top.html のメニュー構成と scenario パッケージ分割に基づく） |
| 延滞管理・督促 | 延滞の罰則（新規貸出不可・利用停止）の適用と、図書館館長による毎月末日の遅滞者把握・督促（窓口・電話・電子メール・はがき）。システム実装は貸出制限判定と期限切れチェック API のみの部分実装 | medium | 事実: docs/specification.md:25-37（「### 延滞の罰則」「### 督促」）、src/main/java/library/domain/model/loan/rule/RestrictionOfDelay.java（延滞による貸出制限）、src/main/java/library/presentation/api/ExpireCheck.java:14-31（期限切れチェック API）。推測: 督促の業務フロー（遅滞者一覧・通知）に対応する画面・UC は未実装のため、業務としての実装裏付けは部分的 |
| 会員管理 | 図書館カードの発行（市内在住・在学が条件、有効期限3年）。システムは未実装（会員データの参照のみ実装） | high | 事実: docs/specification.md:39-43（「## 会員管理」）、README.md:75（「会員管理（会員の登録）」は未実装）、src/main/resources/templates/top.html:24（「会員の管理 未実装」）、src/main/resources/schema.sql の会員テーブル（データとしては存在） |
| 蔵書管理 | 資料の注文と蔵書としての登録。システムは未実装で、仕様書の該当章も本文が空（FIXME: 01-overview から継続） | high | 事実: README.md:74（「蔵書管理（資料の注文と蔵書として登録する）」は未実装）、src/main/resources/templates/top.html:25（「所蔵品の管理 未実装」）、docs/specification.md:51（「## 蔵書管理」見出しのみで本文なし） |

- 対象外の司書業務（参考）: README.md:13-20 に「このアプリケーションでは対象としない司書の業務」として
  レファレンスサービス（相談・記録）、イベント（企画・運営・評価）が明記されている（事実: README.md:18-20）。
  「書架の整理 △」「選書と受入 〇」は対象業務に挙がる（事実: README.md:10-11）が、対応する画面・コード・仕様記述が
  一切なく、業務領域としての内容を読み取れない（推測: 選書と受入は蔵書管理と同一領域の可能性があるが確証なし。
  確度: low。FIXME: 書架の整理・選書と受入の扱いは Phase3 ユーザー確認対象）。

## BUC 一覧

| 業務 | BUC | 価値（何を実現するか） | 主なアクター | 確度 | 根拠 |
|------|-----|---------------------|-------------|------|------|
| 貸出・返却 | 貸出 | 貸出制限ルール（会員種別×点数×視聴覚資料×延滞状態）を自動判定したうえで、カウンターで資料を貸し出す | 司書、会員 | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:22-70（貸出の登録画面）、src/main/java/library/application/scenario/loan/LoanScenario.java:16-21（「貸出可否を判定する。貸出を登録する。」）、docs/specification.md:5-10、src/test/java/library/application/scenario/loan/LoanFlowTest.java:47-192（貸出制限の業務フローテスト） |
| 貸出・返却 | 返却 | カウンター（閉館時は返却ポスト）で資料を返却し、貸出記録を消去する（個人情報保護） | 司書、会員 | high | 事実: src/main/java/library/presentation/returns/ReturnMaterialController.java:14-47（返却の登録画面）、src/main/java/library/application/scenario/returns/ReturnsScenario.java:7-24、docs/specification.md:12-15、docs/specification.md:47（貸出記録は返却時に消去）、src/test/java/library/application/scenario/returns/ReturnsFlowTest.java:37-50（返却で貸出記録が消去されるテスト） |
| 貸出・返却 | 貸出延長 | ほかの人の予約がなければ1回（15日間）だけ貸出を延長する。**未実装**（テストも @Disabled のみ） | 司書、会員 | medium | 事実: docs/specification.md:10（延長ルールの記述）、src/test/java/library/application/scenario/loan/LoanFlowTest.java:194-203（「予約がない資料の貸出を15日間延長できる」「二回目の貸出延長はできない」が @Disabled の空テスト）。推測: 対応する画面・シナリオクラスが存在せず、業務フローは仕様書からのみ導出 |
| 予約・取置 | 予約受付 | 所蔵品目をキーワード検索し、貸出中でも在庫中でも予約を登録できる（ひとり15点まで、うち視聴覚資料5点まで） | 会員（司書代行の可能性あり: FIXME） | high | 事実: src/main/resources/templates/top.html:17（「会員：本の予約」）、src/main/java/library/presentation/reservation/EntrySearchController.java:15-33（所蔵品目の検索画面）、src/main/java/library/presentation/reservation/ReservationController.java:16-65（予約の登録画面）、src/main/java/library/application/scenario/reservation/ReservationScenario.java:20-76（予約受付シナリオ）、docs/specification.md:19-20 |
| 予約・取置 | 取置準備 | 未準備の予約一覧から、書架の資料を確保して取置を登録し、会員に「準備できました」を連絡する（取置期限は連絡翌日から7開館日） | 司書 | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:13-42（予約の管理画面: 未準備の予約一覧と取置フォーム）、src/main/java/library/presentation/retention/RetentionController.java:45-80（取置の登録: 所蔵品状態・資料一致の検証）、src/main/java/library/application/service/retention/RetentionRecordService.java:40-48（取置登録と準備完了通知）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:16-23（「予約いただいた本が準備できました」）、docs/specification.md:21-23 |
| 予約・取置 | 予約取消（在庫なし連絡） | 用意できない予約を取り消し、会員に「在庫がありませんでした」を連絡する | 司書 | high | 事実: src/main/resources/templates/retention/requests.html:31-33（キャンセルボタン）、src/main/java/library/presentation/retention/ReservationController.java:44-48（取消処理）、src/main/java/library/application/scenario/reservation/ReservationCancellationScenario.java:9-28（予約キャンセルシナリオ）、src/main/java/library/application/service/reservation/ReservationRecordService.java:31-34（取消と在庫なし通知）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:26-33 |
| 予約・取置 | 取置の受け渡し（貸出） | 取置中の資料を、受け取りに来た会員へ貸し出す（取置→貸出への引き渡しで予約記録は消込） | 司書、会員 | high | 事実: src/main/resources/templates/retention/retentions.html:26-31（取置中一覧の「貸出」ボタン）、src/main/java/library/presentation/retention/RetentionController.java:82-86（取置の貸出）、src/main/java/library/application/scenario/retention/RetentionScenario.java:86-93（「取置を貸し出す」）、src/test/java/library/application/scenario/retention/RetentionFlowTest.java:69-82（予約→取置→貸出→返却の一連フローテスト）、docs/specification.md:49（予約記録は取置時に消去） |
| 予約・取置 | 取置期限切れ処理 | 取置期限（連絡翌日から7開館日）を過ぎた取置を解放し、予約を無効にして資料を次の予約者または書架に戻す | 司書 | high | 事実: src/main/resources/templates/retention/retentions.html:32-37（期限切れ表示と「期限切れ処理」ボタン）、src/main/java/library/presentation/retention/RetentionController.java:88-92、src/main/java/library/application/scenario/retention/RetentionExpireScenario.java:7-24（取置期限切れシナリオ）、src/main/java/library/application/service/retention/RetentionRecordService.java:53-58（解放と消込）、docs/specification.md:21-23 |
| 延滞管理・督促 | 督促（遅滞者の把握と通知） | 図書館館長が毎月末日に遅滞者を把握し、窓口・電話・電子メール・はがきで督促する（予約入り資料は期日超過で速やかに電話督促、60日以上経過で督促）。**大部分が未実装**（システム側は所蔵品単位の期限切れチェック API のみ） | 図書館館長、司書 | medium | 事実: docs/specification.md:30-37（督促の業務ルール）、src/main/java/library/presentation/api/ExpireCheck.java:14-31（`GET /expired` 期限切れチェック）、src/main/java/library/application/service/loan/LoanExpiredCheckService.java（期限切れ確認サービス）。推測: 遅滞者一覧・督促通知の画面/UC が存在せず、業務フローの大部分は仕様書からのみ導出 |
| 会員管理 | 会員登録（図書館カード発行） | 市内在住・在学の利用者に図書館カードを発行する（有効期限3年）。**未実装** | 司書、一般利用者（未会員） | medium | 事実: docs/specification.md:41-43（カード発行の条件と有効期限）、src/main/resources/templates/top.html:24（「会員の管理 未実装」）、README.md:75。推測: 実装・画面が存在しないため、業務フローは仕様書からのみ導出 |
| 蔵書管理 | 資料の注文・蔵書登録 | 資料を注文し、蔵書として登録する。**未実装**（仕様書の章も本文が空） | 司書 | low | 事実: README.md:74（未実装業務としての言及）、src/main/resources/templates/top.html:25（「所蔵品の管理 未実装」）、docs/specification.md:51（見出しのみ）。推測: BUC の内容（注文→受入→登録の流れ）は README の一文と図書館業務の一般論による補完で、アクターも司書と推定 |

- FIXME: 予約受付 BUC の操作主体が曖昧（top.html:17 は「利用者向け（会員）」だが認証がなく会員番号手入力のため
  司書のカウンター代行とも解釈できる。02-value.md の FIXME を継続。Phase3 ユーザー確認対象）。
- FIXME: 期限切れチェック API（`GET /expired`、事実: src/main/java/library/presentation/api/ExpireCheck.java:14-31）が
  督促 BUC のどのアクティビティに対応するか（外部スケジューラ起動か、館長/司書の手動確認か）が読み取れない。
  Phase4 のタイマー/UC 分析と Phase3 ユーザー確認に引き継ぐ。

## BUC 別アクティビティ

### 貸出

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 借りたい本と図書館カードをカウンターに出す | 会員 | （人手作業。システム利用なし） | high | 事実: docs/specification.md:7（「借りる本と図書カードをカウンターに出すと、本を借りることができる」） |
| 2 | 会員番号・所蔵品番号・貸出日を入力する | 司書 | UC候補: 貸出を登録する（貸出登録画面） | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:34-38（貸出フォーム表示）、LoanRegisterController.java:78-85（入力項目: memberNumber/itemNumber/loanDate）、src/main/resources/templates/loan/form.html |
| 3 | 会員番号の有効性と所蔵品・貸出制限の判定結果を確認する | 司書 | UC候補: 貸出可否を判定する（会員未登録・所蔵品貸出不可・冊数制限/延滞制限をエラー提示） | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:45-63（会員状態→所蔵品貸出可否→貸出制限の3段階判定）、src/main/java/library/application/scenario/loan/LoanScenario.java:45-56, 75-81、src/test/java/library/application/scenario/loan/LoanFlowTest.java:145-192（貸出中・冊数制限・延滞制限のテスト） |
| 4 | 貸出を登録し、会員の貸出状況を確認する | 司書 | UC候補: 貸出を登録する / 貸出状況を提示する | high | 事実: src/main/java/library/presentation/loan/LoanRegisterController.java:65-76（登録と完了画面での貸出状況表示）、src/main/java/library/application/scenario/loan/LoanScenario.java:61-70、src/main/resources/templates/loan/completed.html |
| 5 | 本を会員に渡す | 司書 | （人手作業。システム利用なし） | medium | 推測: カウンター貸出業務の一般的な流れによる補完。docs/specification.md:7 のカウンター受け渡し記述が傍証 |

### 返却

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | カウンターで資料を返す（閉館時間中は返却ポストに入れる） | 会員 | （人手作業。システム利用なし） | high | 事実: docs/specification.md:14-15（カウンター返却・返却ポスト） |
| 2 | 所蔵品番号と返却日を入力し、返却を登録する | 司書 | UC候補: 返却を登録する（返却登録画面） | high | 事実: src/main/java/library/presentation/returns/ReturnMaterialController.java:27-42（返却フォームと登録）、ReturnMaterialController.java:49-55（入力項目: itemNumber/returnDate）、src/main/resources/templates/returns/form.html |
| 3 | （システム内）返却に伴い貸出記録を消去する | ― | UC候補: 返却を登録する の一部（個人情報保護要件） | high | 事実: src/test/java/library/application/scenario/returns/ReturnsFlowTest.java:37-50（「所蔵品を返却した際に貸出記録が消去される」）、docs/specification.md:47 |
| 4 | 資料を書架に戻す（次の予約があれば取置準備に回す） | 司書 | （人手作業。システム利用なし） | low | 推測: 図書館業務の一般論による補完。返却後の資料の扱い（書架戻し/予約者への回付）はコード・仕様書に記述がない |

### 貸出延長（未実装）

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 会員が貸出の延長を申し出る | 会員 | （人手作業。システム利用なし） | medium | 事実: docs/specification.md:10（「ほかの人の予約がなければ、1回（15日間）だけ延長できる」）。推測: 申出の手段（窓口・電話等）は記述なし |
| 2 | 予約の有無と延長回数を確認し、貸出を延長する | 司書 | UC候補: 貸出を延長する（**未実装**） | low | 推測: docs/specification.md:10 のルールと src/test/java/library/application/scenario/loan/LoanFlowTest.java:194-203 の @Disabled テスト名（「予約がない資料の貸出を15日間延長できる」「二回目の貸出延長はできない」）から導出。対応する画面・シナリオクラスは存在しない |

### 予約受付

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 借りたい本をキーワードで探し、在庫の有無を確認する | 会員（司書代行の可能性あり: FIXME） | UC候補: 所蔵品目を検索する（検索画面） | high | 事実: src/main/java/library/presentation/reservation/EntrySearchController.java:27-33（キーワード検索）、src/main/java/library/application/scenario/reservation/ReservationScenario.java:40-42（「本を探す」）、src/main/resources/templates/reservation/search.html、src/main/resources/templates/_parts/navigation.html:13（「本を探す」） |
| 2 | 検索結果から品目を選び、会員番号を入力して予約する | 会員（司書代行の可能性あり: FIXME） | UC候補: 予約を登録する（予約登録画面。会員番号の有効性を検証） | high | 事実: src/main/java/library/presentation/reservation/ReservationController.java:33-65（品目選択→会員番号入力→予約登録。未登録会員はエラー）、src/main/java/library/application/scenario/reservation/ReservationScenario.java:73-76、src/main/resources/templates/reservation/form.html |
| 3 | （システム内）予約制限（15点まで・視聴覚資料5点まで）を判定する | ― | UC候補: 予約可否を判定する（シナリオ実装はあるが画面フローからは未接続） | medium | 事実: src/main/java/library/application/scenario/reservation/ReservationScenario.java:62-68（予約制限の判断）、docs/specification.md:19、src/test/java/library/application/scenario/reservation/ReservationFlowTest.java:54-125（制限のテストが @Disabled）。FIXME: ReservationController.java:41-65 の登録処理は reservationAvailability を呼び出しておらず、仕様の予約制限が画面フローで適用されない不整合がある |

### 取置準備

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 未準備の予約一覧を確認する（取置可否の表示つき） | 司書 | UC候補: 未準備の予約を一覧する（予約の管理画面） | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:27-32、src/main/java/library/application/scenario/retention/RetentionScenario.java:44-49、src/main/resources/templates/retention/requests.html:11-41（一覧・取置可否列）、src/test/java/library/application/scenario/retention/RetentionFlowTest.java:69-103（取置可能/取置不可の判定テスト） |
| 2 | 書架から予約された本を確保する | 司書 | （人手作業。システム利用なし） | medium | 推測: 取置登録で所蔵品番号（現物のバーコード相当）を入力する方式（RetentionController.java:94-99 の入力項目）から、現物確保が先行する人手作業として補完。仕様書に直接の記述なし |
| 3 | 予約を選んで所蔵品番号を入力し、取置を登録する（資料一致・在庫状態を検証） | 司書 | UC候補: 取置を登録する（未登録・資料不一致・在庫中以外はエラー） | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:34-42（取置フォーム）、src/main/java/library/presentation/retention/RetentionController.java:45-80（3段階の検証と登録）、src/main/java/library/application/scenario/retention/RetentionScenario.java:58-76 |
| 4 | 会員に「準備できました」と取置期限を連絡する | 司書 | UC候補: 準備完了を通知する（現実装は取置登録に伴うログ出力スタブ。実チャネルは窓口・電話・メール等と推定） | medium | 事実: src/main/java/library/application/service/retention/RetentionRecordService.java:40-48（取置登録時に通知を呼び出し）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:16-23（通知文面「予約いただいた本が準備できました。取置期限:…」）、docs/specification.md:22（取置期限の起点は「連絡をした日」）。推測: 実際の連絡手段は不明（02-value.md の FIXME を継続） |

### 予約取消（在庫なし連絡）

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 未準備の予約一覧から、用意できない予約をキャンセルする | 司書 | UC候補: 予約を取り消す（予約の管理画面のキャンセルボタン） | high | 事実: src/main/resources/templates/retention/requests.html:31-33、src/main/java/library/presentation/retention/ReservationController.java:44-48、src/main/java/library/application/scenario/reservation/ReservationCancellationScenario.java:22-28 |
| 2 | 会員に「在庫がありませんでした」と連絡する | 司書 | UC候補: 在庫なしを通知する（現実装は取消に伴うログ出力スタブ） | medium | 事実: src/main/java/library/application/service/reservation/ReservationRecordService.java:31-34（取消時に notAvailable 通知）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:26-33（通知文面）。推測: 実際の連絡手段は不明（02-value.md の FIXME を継続） |
| 3 | 会員自身の希望による予約取消の受付 | 会員 | UC候補: 予約を取り消す（同上の機能を流用と推定） | low | 推測: 画面上の取消は「予約の管理（スタッフ用）」のみに存在し、会員起点の取消依頼（窓口・電話等）の業務フローはコード・仕様書に記述がない。ReservationFlowTest.java:144-148 の @Disabled テスト「予約を取り消すことができる」が傍証 |

### 取置の受け渡し（貸出）

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 会員が取置期限内に資料を受け取りに来る | 会員 | （人手作業。システム利用なし） | high | 事実: docs/specification.md:21-22（取置期限内に受け取らない場合は予約無効） |
| 2 | 取置中の一覧で会員の取置を確認する | 司書 | UC候補: 取置中を一覧する（取置の管理画面。期限切れは強調表示） | high | 事実: src/main/java/library/presentation/retention/RetentionController.java:38-43、src/main/java/library/application/scenario/retention/RetentionScenario.java:79-83、src/main/resources/templates/retention/retentions.html:11-43 |
| 3 | 取置資料を貸出登録して会員に渡す（予約記録は消込） | 司書 | UC候補: 取置を貸し出す | high | 事実: src/main/resources/templates/retention/retentions.html:29（「貸出」ボタン）、src/main/java/library/presentation/retention/RetentionController.java:82-86、src/main/java/library/application/scenario/retention/RetentionScenario.java:86-93、docs/specification.md:49（予約記録は取置時に消去）、src/test/java/library/application/scenario/retention/RetentionFlowTest.java:79-81（取置→貸出→返却の一連フロー） |

### 取置期限切れ処理

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 取置中の一覧で期限切れ（連絡翌日から7開館日超過）の取置を確認する | 司書 | UC候補: 取置中を一覧する（期限切れは `mark` 表示） | high | 事実: src/main/resources/templates/retention/retentions.html:32-37（isExpired 分岐と期限切れ表示）、docs/specification.md:22-23（取置期限と休館日: 月曜・年末年始）、src/main/java/library/domain/model/retention/ExpireDate.java |
| 2 | 期限切れ処理を実行し、予約を無効（解放・消込）にする | 司書 | UC候補: 取置を期限切れにする | high | 事実: src/main/resources/templates/retention/retentions.html:35（「期限切れ処理」ボタン）、src/main/java/library/presentation/retention/RetentionController.java:88-92、src/main/java/library/application/scenario/retention/RetentionExpireScenario.java:19-24、src/main/java/library/application/service/retention/RetentionRecordService.java:53-58 |
| 3 | 資料を書架に戻す、または次の予約者の取置準備に回す | 司書 | （人手作業。システム利用なし） | low | 推測: RetentionFlowTest.java:126-129 の @Disabled テスト「取置中の所蔵品を在庫に戻すことができる」から意図を推定。実装・仕様書に処理後の資料の扱いの記述がない |

### 督促（遅滞者の把握と通知）（大部分が未実装）

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 毎月末日に遅滞者を把握する | 図書館館長 | UC候補: 遅滞者を把握する（**未実装**。関連実装は所蔵品単位の期限切れチェック API `GET /expired` のみで、遅滞者一覧機能はない） | medium | 事実: docs/specification.md:32（「図書館館長は毎月末日に遅滞者の把握を行う」）、src/main/java/library/presentation/api/ExpireCheck.java:26-31。推測: API は所蔵品番号を1件指定する形式で月末の一括把握には使えず、業務との対応が不明（FIXME 継続） |
| 2 | 予約が入っている資料は返却期日超過時点で速やかに電話で督促する | 司書 | （人手作業。システム利用なし: 督促対象の抽出機能は**未実装**） | medium | 事実: docs/specification.md:34。推測: 実施主体は明記されておらず、窓口業務の担い手である司書と推定 |
| 3 | 返却期日から60日以上経過する遅滞者に、窓口・電話・電子メール・はがき等で督促する（通知内容はカード番号・資料番号・返却期限日のみ。書名・著者名は本人希望時のみ） | 司書、図書館館長 | UC候補: 督促を通知する（**未実装**） | medium | 事実: docs/specification.md:33-37。推測: 通知手段・実施主体の分担はシステム外の運用であり、コード上の裏付けなし |
| 4 | 2か月以上の延滞者について図書館カードの利用を1ヶ月間停止する | 司書 | UC候補: 利用停止を登録する（**部分実装**: 貸出可否判定に「貸出停止」区分あり） | medium | 事実: docs/specification.md:28、src/main/java/library/domain/model/loan/rule/RestrictionOfDelay.java・RestrictionOfDelayMap.java（延滞期間による貸出停止の区分）。推測: 「予約など図書館カードが必要なサービス」全体の停止や停止期間（1ヶ月）の管理は実装で確認できない |

### 会員登録（図書館カード発行）（未実装）

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | はじめて借りる利用者がカード作成を申し込む（市内在住または市内の学校に在席が条件） | 一般利用者（未会員） | （人手作業。システム利用なし） | medium | 事実: docs/specification.md:41-42。推測: 申込手続きの詳細（本人確認等）は記述なし |
| 2 | 資格を確認し、図書館カードを発行・会員を登録する（有効期限3年） | 司書 | UC候補: 会員を登録する（**未実装**。会員テーブルと会員種別のデータ定義のみ存在） | low | 推測: docs/specification.md:41-43 と top.html:24（「会員の管理 未実装」）から導出。登録画面・登録処理は存在せず（src/main/java/library/application/service/member/ は照会系のみ）、業務フローは仕様書と一般論による補完 |

### 資料の注文・蔵書登録（未実装）

| 順 | アクティビティ | アクター | システム利用（UC候補） | 確度 | 根拠 |
|----|--------------|---------|----------------------|------|------|
| 1 | 資料を選定し、注文する | 司書 | UC候補: 資料を注文する（**未実装**） | low | 推測: README.md:74（「蔵書管理（資料の注文と蔵書として登録する）」）と README.md:11（「選書と受入 〇」）からの補完。docs/specification.md:51 の蔵書管理章は本文が空で、業務ルールを読み取れない |
| 2 | 受け入れた資料を蔵書（所蔵品目・所蔵品）として登録する | 司書 | UC候補: 蔵書を登録する（**未実装**。所蔵品目・所蔵品のデータ定義のみ存在） | low | 推測: README.md:74、top.html:25（「所蔵品の管理 未実装」）、src/main/resources/schema.sql の所蔵品目・所蔵品テーブル（データ構造のみ事実）からの補完。登録画面・登録処理は存在しない |

## FIXME / 特記事項

- FIXME: 予約受付 BUC の操作主体（会員セルフサービスか司書のカウンター代行か）が確定できない（02-value.md から継続。Phase3 ユーザー確認対象）。
- FIXME: 予約登録の画面フロー（reservation/ReservationController.java:41-65）が ReservationScenario.reservationAvailability（予約制限判定、ReservationScenario.java:62-68）を呼び出しておらず、仕様（docs/specification.md:19 の15点/5点制限）が画面から適用されない。定義済みだが未参照のロジックであり、実装バグか意図的未接続かを Phase4/Phase5 で精査する。
- FIXME: 期限切れチェック API（`GET /expired`）が督促業務のどのアクティビティに対応するか、および呼び出し元（外部スケジューラ/手動）が不明（02-value.md から継続。Phase4 タイマー分析と Phase3 ユーザー確認に引き継ぐ）。
- FIXME: 「書架の整理」「選書と受入」（README.md:10-11 で対象業務に挙がる）に対応する実装・仕様が皆無で、業務領域としての内容を確定できない。Phase3 ユーザー確認対象。
- FIXME: 通知（準備完了・在庫なし・督促）の実配信チャネルが未実装（ログ出力スタブのみ。02-value.md から継続）。
- 蔵書管理・会員管理・貸出延長・督促の各 BUC は「仕様書・README に記述があるがシステム未実装」の as-is 状態として記録した。RDRA フルビルド時には未実装 BUC の扱い（スコープ外とするか、to-be 要求とするか）を確認する必要がある。

## 確度サマリ

| 確度 | 件数 | 該当項目 |
|------|------|----------|
| high | 25 | 業務: 貸出・返却/予約・取置/会員管理/蔵書管理、BUC: 貸出/返却/予約受付/取置準備/予約取消/取置の受け渡し/取置期限切れ処理、アクティビティ: 貸出1-4、返却1-3、予約受付1-2、取置準備1・3、予約取消1、受け渡し1-3、期限切れ1-2 |
| medium | 14 | 業務: 延滞管理・督促、BUC: 貸出延長/督促/会員登録、アクティビティ: 貸出5、取置準備2・4、予約取消2、予約受付3、貸出延長1、督促1-4、会員登録1 |
| low | 9 | 業務領域: 書架の整理・選書と受入の扱い、BUC: 資料の注文・蔵書登録、アクティビティ: 返却4（書架戻し）、貸出延長2（延長登録）、予約取消3（会員起点の取消）、期限切れ3（資料の戻し）、会員登録2（カード発行・会員登録）、蔵書1（資料の注文）、蔵書2（蔵書登録） |

- confidence low の項目（計 9 件）は Phase3 のユーザー確認で必ず一覧提示する（evidence-rules.md 準拠）。
