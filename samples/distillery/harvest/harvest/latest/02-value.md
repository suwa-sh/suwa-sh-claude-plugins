# 02 システム価値

- 解析対象リポジトリ: `/Users/suwa_sh/src/github.com/suwa-sh/claude-code-rdra-rev/system-sekkei/library`
- 前提ドキュメント: `analysis/01-overview.md`（コミット: `f460a75b843c484908b95b82e6fdd84186b4b5f8`）
- 解析日: 2026-07-03
- ※ 根拠の path はリポジトリルートからの相対パスで記載する。
- ※ 本システムには認証・認可機構が存在しないため（01-overview 参照）、アクター識別はロール定義ではなく
  トップ画面のメニュー分類（`src/main/resources/templates/top.html` の「利用者向け」「図書館スタッフ用」）と
  画面・業務単位の推定に依存する。
- ※ コミット履歴（`git log`）は本セッションの権限制約により参照できなかった。「なぜ（理由）」の証拠源は
  README.md / docs/specification.md に限定される。

## アクター一覧

| アクター群 | アクター | 説明 | 確度 | 根拠 |
|-----------|---------|------|------|------|
| 図書館スタッフ | 司書 | 本システムの主たる利用者。カウンターで「貸出と返却」「予約の管理」「取置の管理」の各画面を操作し、貸出登録・返却登録・取置登録・予約取消を行う | high | 事実: README.md:1（「図書館の司書業務を支援するソフトウェア」）、src/main/resources/templates/top.html:19-26（「図書館スタッフ用」メニュー: 貸出と返却/予約の管理/取置の管理）、src/main/java/library/presentation/loan/LoanRegisterController.java:22-27（貸出の登録画面）、src/main/java/library/presentation/returns/ReturnMaterialController.java:14-19（返却の登録画面）、src/main/java/library/presentation/retention/RetentionController.java:24-29（取置の管理画面） |
| 図書館スタッフ | 図書館館長 | 督促業務の主体。毎月末日に遅滞者の把握を行う。仕様書上の役割であり、専用画面・専用ロールは未実装（関連実装は期限切れチェック API のみ） | medium | 事実: docs/specification.md:32（「図書館館長は毎月末日に遅滞者の把握を行う」）。推測: 対応する UI・ロール定義がなく、src/main/java/library/presentation/api/ExpireCheck.java:14-31 の期限切れチェック API が唯一の関連実装であるため、システムのアクターとしての裏付けは部分的 |
| 図書館利用者 | 会員 | 図書館カードを持つ利用者。トップ画面の「利用者向け」メニューから所蔵品目の検索と本の予約を行う想定。会員種別（中学生以上/小学生以下）で貸出制限が異なる | high | 事実: src/main/resources/templates/top.html:15-18（「利用者向け」「会員：本の予約」メニュー）、src/main/java/library/presentation/reservation/EntrySearchController.java:15-20（所蔵品目の検索画面）、src/main/java/library/presentation/reservation/ReservationController.java:16-21（予約の登録画面）、src/main/resources/schema.sql:22-28（会員テーブル）、src/main/java/library/domain/model/member/MemberType.java:6-9（会員種別） |
| 図書館利用者 | 一般利用者（未会員） | 「ご利用案内」メニューの対象として想定される市民。画面は未実装であり、システム上の操作は存在しない | medium | 事実: src/main/resources/templates/top.html:16（「一般：ご利用案内 未実装」の記載）。推測: メニュー項目としての存在のみで、対応する機能・データは一切ない |

- 補足: 予約画面の操作主体について、トップ画面（top.html:17）では「利用者向け（会員）」に分類される一方、
  認証がなく会員番号を手入力する方式（src/main/java/library/presentation/reservation/ReservationController.java:41-65）のため、
  実運用では司書がカウンターで代行入力する形態も両立し得る（推測: 01-overview では司書代行と記載しており分類が揺れている。
  FIXME 参照）。
- バッチ・タイマー起動の処理（期限切れチェック等）はアクターに含めない（Phase4 のタイマーで扱う）。

## 外部システム一覧

| 外部システム群 | 外部システム | 連携内容 | 確度 | 根拠 |
|---------------|-------------|---------|------|------|
| （なし） | ランタイム連携する外部システムなし | 業務処理で連携する外部システム（決済・認証プロバイダ・外部 API・メッセージキュー・Webhook 等）は存在しない | high | 事実: build.gradle:22-39（依存は Web/Validation/Thymeleaf/MyBatis/DB ドライバ/Actuator/Tracing のみで外部 SDK なし）、src/main/java/library/infrastructure/ 配下に datasource と transfer（ログ出力）以外の連携実装なし |
| 会員向け通知手段（将来連携候補） | 通知サービス（電子メール・電話・はがき等） | 取置準備完了・在庫なしの会員への連絡、および督促通知。業務ルール上は「窓口、電話、電子メール、はがき等」で行うとされるが、実装は通知インターフェースをログ出力で代替したスタブのみで、外部通知システムとは未連携 | low | 事実: docs/specification.md:33（督促手段）、docs/specification.md:22（取置期限の起点は「連絡をした日」）、src/main/java/library/application/service/retention/RetentionNotification.java:6-9（通知インターフェース）、src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:35-37（`logger.info` によるスタブ実装）。推測: 本来の通知チャネル（メール基盤等）が何であるかはリポジトリから読み取れない |
| 運用監視 | 分散トレーシング収集基盤（Zipkin 互換） | アプリケーションのトレース送信（OpenTelemetry ブリッジ + Zipkin エクスポーター）。デフォルト無効のため、稼働環境での実連携は構成次第 | medium | 事実: build.gradle:35-36（micrometer-tracing-bridge-otel / opentelemetry-exporter-zipkin）、src/main/resources/application.yaml:14-18（`management.tracing.enabled: false`）。推測: 実際の収集先エンドポイントは未設定で、運用時に有効化される前提かは不明 |

- 開発・CI 基盤（GitHub Actions / GitHub Pages / SonarCloud / CircleCI。事実: .github/workflows/ci.yml:1-58、
  build.gradle:48-56、.circleci/config.yml）はシステムの業務価値に関与しないため、RDRA の外部システムには含めない。
- FIXME: 期限切れチェック API（`GET /expired`、事実: src/main/java/library/presentation/api/ExpireCheck.java:14-31）の
  呼び出し元（外部スケジューラ・バッチ・監視系のいずれか）がリポジトリ内に存在せず不明。外部システムまたは
  Phase4 タイマーの候補として Phase3 のユーザー確認対象とする。

## 機能要求

as-is 要求（現行システムがすでに実現している価値）として記述する。

| 分類 | アクター | 機能要求 | 説明 | 確度 | 根拠 |
|------|---------|---------|------|------|------|
| 貸出・返却 | 司書 | 貸出制限ルールに基づいて資料の貸出可否を判定し、貸出を登録できること | 会員種別ごとの点数制限（中学生以上20点/小学生以下15点、うち視聴覚資料5点）と延滞状態による制限（新規貸出不可/貸出停止）を自動判定し、判定エラーを画面に提示したうえで貸出を記録する。理由: 司書のカウンター業務（貸出）を支援するため（事実: README.md:5-9） | high | 事実: docs/specification.md:7-9（貸出ルール）、src/main/java/library/domain/model/loan/rule/RestrictionOfQuantityMap.java:19-22（点数制限の表条件）、src/main/java/library/domain/model/loan/rule/RestrictionOfDelay.java:6-10（遅延による制限）、src/main/java/library/presentation/loan/LoanRegisterController.java:40-70（貸出可否判定と登録） |
| 貸出・返却 | 司書 | 資料の返却を登録できること | 所蔵品番号と返却日を入力して返却を記録する。理由: 司書のカウンター業務（返却）を支援するため（事実: README.md:5-9） | high | 事実: docs/specification.md:13-15（返却ルール）、src/main/java/library/presentation/returns/ReturnMaterialController.java:34-42（返却登録）、src/main/resources/templates/returns/form.html |
| 予約 | 会員（司書代行の可能性あり） | 所蔵品目をキーワード検索し、貸出予約を登録できること | 在庫の有無を含む検索結果から品目を選び、会員番号を指定して予約する。貸出中でも在庫中でも予約できる。理由: 利用者向けサービス「本の予約」の提供（事実: top.html:17） | high | 事実: docs/specification.md:19-20（予約ルール）、src/main/java/library/presentation/reservation/EntrySearchController.java:27-33（キーワード検索）、src/main/java/library/presentation/reservation/ReservationController.java:41-65（予約登録） |
| 予約・取置 | 司書 | 未準備の予約一覧を確認し、取置の登録・取消・期限切れ処理・貸出への引き渡しができること | 予約の状態遷移（未準備→準備完了→解放/期限切れ/取消）を管理する。取置登録時には予約と所蔵品の資料一致・在庫状態を検証する。理由: RDRA 2.0 で可視化した中核ビジネスルール「予約の状態遷移」の実装（事実: README.md:57-60, README.md:68） | high | 事実: src/main/java/library/presentation/retention/ReservationController.java:27-48（未準備の予約一覧・取消）、src/main/java/library/presentation/retention/RetentionController.java:38-92（取置登録・貸出・期限切れ）、src/main/resources/schema.sql（予約・取置スキーマの状態テーブル群） |
| 通知・延滞管理 | 司書 / 図書館館長 | 取置準備完了・在庫なしを会員に通知し、返却期限切れを確認できること | 取置成立時「準備できました」・予約資料の在庫なし時「在庫がありませんでした」を会員宛に通知する（現実装はログ出力のスタブ）。また所蔵品番号を指定して貸出の期限切れチェックを行う API を提供する。理由: 取置連絡（取置期限の起点）と督促業務（毎月末日の遅滞者把握）の支援（事実: docs/specification.md:22, docs/specification.md:31-36） | medium | 事実: src/main/java/library/infrastructure/transfer/SimpleRetentionNotification.java:16-37（通知内容とログ出力実装）、src/main/java/library/presentation/api/ExpireCheck.java:26-31（期限切れチェック API）。推測: 通知の実配信手段と API の呼び出し元が実装されておらず、業務としての実現度は部分的 |

- 未実装のため機能要求に含めないもの: 蔵書管理（資料の注文・蔵書登録）、会員管理（会員の登録）
  （事実: README.md:72-75、src/main/resources/templates/top.html:24-25 の「未実装」表記）。
  延滞の罰則のうち「2か月以上延滞での利用停止（1ヶ月）」・督促の通知内容規定（docs/specification.md:27-36）も
  仕様書のみで対応実装を確認できていない（Phase5 のドメインルール分析で精査）。

## 非機能要求

後段 quality-attributes の入力として、読めた範囲を記録する。

| 分類 | 非機能要求 | 説明 | 検証方法 | 確度 | 根拠 |
|------|-----------|------|---------|------|------|
| セキュリティ（個人情報保護） | 貸出・予約の記録を必要最小限の期間のみ保持すること | 貸出記録は返却時に消去、予約記録は取置時に消去する。督促通知には図書館カード番号・資料番号・返却期限日のみを含め、書名・著者名は本人が希望しない限り通知しない | 返却登録後に貸出記録が参照不能になること、取置登録後に予約記録が参照不能になることをデータストアで確認する | medium | 事実: docs/specification.md:36-37, docs/specification.md:45-49（業務ルールとして明記）。推測: コード上の消去処理の実装有無は本フェーズ未確認（Phase5 のデータ分析で検証） |
| 運用・監視 | 稼働状態の監視と分散トレーシングが可能であること | Spring Boot Actuator によるヘルスチェック・メトリクス公開と、OpenTelemetry/Zipkin 形式のトレース送信（デフォルト無効、サンプリング率 1.0）を備える | Actuator エンドポイントの応答確認。`management.tracing.enabled: true` でトレースが収集基盤に送信されることの確認 | high | 事実: build.gradle:34-36、src/main/resources/application.yaml:14-18 |
| 保守性 | 実装コードから設計ドキュメントを自動生成でき、要件（RDRA モデル）と実装の対応を追跡できること | JIG による設計可視化（ユースケース複合図・区分図等）と CCSR 手法により、要件定義・仕様化・実装の継ぎ目をなくす。SonarCloud + JaCoCo で品質・カバレッジを継続計測する | `gradlew jigReports` の実行で設計ドキュメントが build/jig に生成されること。CI での Sonar 解析結果の確認 | high | 事実: README.md:50-52, README.md:104-143、build.gradle:5-7, build.gradle:48-62、.github/workflows/ci.yml:33-58 |
| 移植性（データストア） | 開発環境と本番想定環境で異なる RDBMS 上で動作すること | H2（インメモリ・PostgreSQL 互換モード）と PostgreSQL の両方で同一スキーマ・同一テストが動作する | CI 上の PostgreSQL でのテスト実行（`SPRING_DATASOURCE_URL` 差し替え）が成功すること | high | 事実: src/main/resources/application.yaml:7、build.gradle:31-32、.github/workflows/ci.yml:8-32 |
| 性能・可用性 | カウンター業務に支障のないオンライン応答性能（明示要件なし） | 性能目標・SLA・冗長化に関する記述はドキュメント・設定のいずれにも存在しない。窓口業務のためオンライン応答は必要だが、大量トラフィックを想定する性質ではないと推定 | FIXME: 検証基準が定義できない。Phase3 でユーザーに目標値（応答時間・同時利用数・稼働時間帯）を確認する | low | 推測: 学習用サンプルであり性能・可用性要件の記述が皆無（リポジトリ全体で言及なし）。業務内容（窓口業務）からの一般論による補完 |
| セキュリティ（認証・認可） | 認証・認可要件は存在しない（as-is） | ログイン・ロール・アクセス制御は実装されておらず、全画面・API が無認証で操作可能。学習用サンプルのため意図的に省略されたと推定 | FIXME: 実運用時に必要な認証・認可要件は Phase3 でユーザーに確認する | low | 事実: build.gradle:22-39（spring-security 等の認証系依存なし）、src/main/java/library/presentation/ 配下に認証・認可処理なし。推測: 「省略が意図的」であることの明示的記述はどこにもない |

## FIXME / 特記事項

- FIXME: 予約 UC の操作主体が曖昧。top.html:17 は「利用者向け（会員）」と分類するが、認証がなく会員番号を
  手入力する方式のため司書によるカウンター代行とも解釈できる（01-overview は司書代行と記載しており不整合）。
  Phase3 のユーザー確認対象とする（会員セルフサービス想定か、司書代行か）。
- FIXME: 期限切れチェック API（`GET /expired`）の呼び出し元が不明。外部スケジューラ/タイマー起動（Phase4）の
  候補として引き継ぐ。
- FIXME: 通知（取置連絡・督促）の実配信チャネルが未実装（SimpleRetentionNotification はログ出力のみ）。
  業務ルール上のチャネル（窓口・電話・電子メール・はがき、docs/specification.md:33）との対応付けは Phase3 で確認。
- FIXME: 性能・可用性・認証認可の非機能要求はリポジトリから読み取れない。Phase3 で確認する。
- 図書館館長の督促業務（毎月末日の遅滞者把握、docs/specification.md:31-36）は要求としては仕様書に存在するが、
  実装は期限切れチェック API のみで大部分が未実装。as-is 機能要求では「延滞管理」として部分実現扱い（medium）とした。

## 確度サマリ

| 確度 | 件数 | 該当項目 |
|------|------|----------|
| high | 10 | アクター: 司書・会員、外部システム: ランタイム連携なし、機能要求: 貸出・返却・予約・予約取置管理、非機能要求: 運用監視・保守性・移植性 |
| medium | 5 | アクター: 図書館館長・一般利用者（未会員）、外部システム: 分散トレーシング収集基盤、機能要求: 通知・延滞管理、非機能要求: 個人情報保護 |
| low | 3 | 外部システム: 通知サービス（将来連携候補）、非機能要求: 性能・可用性、非機能要求: 認証・認可 |

- 上記のほか、表外の FIXME 5 件（予約 UC の操作主体、期限切れチェック API 呼び出し元、通知チャネル、性能・可用性・認証認可の要件、督促業務の未実装範囲）を Phase3 のユーザー確認対象として引き継ぐ。
