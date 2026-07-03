# 01 システム概要

- 解析対象リポジトリ: `/Users/suwa_sh/src/github.com/suwa-sh/claude-code-rdra-rev/system-sekkei/library`
- コミットハッシュ: `f460a75b843c484908b95b82e6fdd84186b4b5f8`（事実: .git/modules/system-sekkei/library/HEAD 解決値、ブランチ: master）
- 解析日: 2026-07-03
- ※ 以下、根拠の path はリポジトリルートからの相対パスで記載する。

## システム概要

- システム名: **図書館システム（library）**
  - 確度: high / 根拠: 事実: README.md:1（タイトル「図書館の司書業務を支援するソフトウェア」）、README.md:38（「RDRA 2.0 ハンドブックのサンプル『図書館システム』」）、settings.gradle:1（`rootProject.name = 'library'`）
  - 後段の USDM `system_name` / RDRA `システム概要.json` の `system_name` には「図書館システム」を使用する。
- 目的:
  公立図書館の司書業務（カウンター業務）を支援するソフトウェアである。主な対象業務は「貸出と返却」「予約・取置」であり、ビジネスルール（貸出制限ルール、予約の状態遷移）を中心に実装している（事実: README.md:5-11, README.md:57-61）。本リポジトリは RDRA 2.0 ハンドブックのサンプル「図書館システム」の実装例であり、要件定義（RDRA）・仕様化・実装の継ぎ目をなくす CCSR 開発手法の実践例・学習教材として公開されている（事実: README.md:44-46, README.md:104-108）。
  - 確度: high / 根拠: 事実: README.md:5, README.md:38, README.md:44-46
- システムの位置づけ（補足）:
  - 学習用サンプル実装であり、本番運用を想定した認証・認可やユーザー管理は実装されていない（確度: medium / 根拠: 推測: build.gradle:22-39 に spring-security 等の認証系依存がない。src/main/java/library/presentation/ 配下にログイン・認可処理が存在しない）。
  - 未実装業務: 蔵書管理（資料の注文・蔵書登録）、会員管理（会員の登録）は明示的に未実装（確度: high / 根拠: 事実: README.md:72-75）。

## 技術スタック

| 層 | 技術 | 確度 | 根拠 |
|----|------|------|------|
| 言語 | Java 17 | high | 事実: build.gradle:10（`sourceCompatibility = '17'`）、.github/workflows/ci.yml:24 |
| フレームワーク | Spring Boot 3.1.1（Spring MVC + Bean Validation） | high | 事実: build.gradle:3, build.gradle:23-24 |
| フロントエンド | Thymeleaf によるサーバーサイドレンダリング（SPA なし、静的 CSS: MVP.css 系） | high | 事実: build.gradle:25、src/main/resources/templates/（loan/retention/reservation/returns 画面）、src/main/resources/static/css/mvp/ |
| O/R マッピング | MyBatis（mybatis-spring-boot-starter 3.0.2） | high | 事実: build.gradle:27、src/main/resources/mybatis.xml、src/main/resources/application.yaml:20-21 |
| データストア | H2（開発時、インメモリ・PostgreSQL 互換モード）/ PostgreSQL（CI・本番想定） | high | 事実: build.gradle:31-32、src/main/resources/application.yaml:7（`jdbc:h2:mem:testdb;MODE=PostgreSQL`）、.github/workflows/ci.yml:9-14（postgres:14.1-alpine サービス） |
| スキーマ管理 | `schema.sql` / `data.sql` による起動時初期化（マイグレーションツールなし、テーブル名・スキーマ名は日本語） | high | 事実: src/main/resources/schema.sql:1-161、src/main/resources/data.sql、src/main/resources/application.yaml:2-5（`sql.init.mode: always`） |
| アプリケーション構造 | 三層（presentation / application / infrastructure）+ ドメインモデル（domain）の DDD 風構成 | high | 事実: src/main/java/library/{presentation,application,domain,infrastructure}/、README.md:81-88 |
| 監視・トレーシング | Spring Boot Actuator + Micrometer Tracing（OpenTelemetry ブリッジ）+ Zipkin エクスポーター（デフォルト無効） | high | 事実: build.gradle:34-36、src/main/resources/application.yaml:14-18（`tracing.enabled: false`） |
| 設計可視化 | JIG（jig-gradle-plugin 2023.6.3、Graphviz 必須）+ jig-erd | high | 事実: build.gradle:5, build.gradle:29、README.md:50-52 |
| 品質管理 | SonarCloud + JaCoCo カバレッジ | high | 事実: build.gradle:6-7, build.gradle:48-62 |
| CI | GitHub Actions（PostgreSQL でのテスト + JIG ドキュメントの gh-pages 公開）、CircleCI 設定も併存 | high | 事実: .github/workflows/ci.yml:1-58、.github/workflows/sonar.yml、.circleci/config.yml |
| デプロイ | 本番デプロイ定義なし。ローカルで Gradle `bootRun` により起動（`http://localhost:8080`）。docker/Dockerfile.circleci は CI ビルド用イメージでありアプリ配布用ではない | low | 推測: README.md:31, README.md:42 にローカル起動手順のみ。Dockerfile.circleci:1-3 は openjdk+graphviz の CI 用途。k8s/IaC/本番用 Dockerfile が存在しないため、デプロイ形態は不明（FIXME: 本番デプロイ形態は Phase3 でユーザー確認） |

## ビジネスドメイン

- ドメイン: **公立図書館の司書業務（貸出・返却・予約・取置を中心とするカウンター業務）**
  - 確度: high / 根拠: 事実: README.md:5-11、docs/specification.md:1-49（貸出・返却・予約・取置・延滞罰則・督促・会員管理の業務ルール）、src/main/java/library/domain/model/{loan,reservation,retention,returned,delay,member,material}/
- ステークホルダー:

| ステークホルダー | 区分 | 説明 | 確度 | 根拠 |
|------------------|------|------|------|------|
| 司書 | 直接 | 本システムの主たる利用者。カウンターで貸出・返却・予約・取置の登録操作を行う | high | 事実: README.md:1, README.md:5-11、src/main/java/library/presentation/ 配下の業務画面（loan/register, returns, retentions 等） |
| 図書館会員（利用者） | 間接 | 資料を借りる市民。会員種別（中学生以上/小学生以下）で貸出制限が異なる。システムを直接操作する画面は存在せず司書が代行する | high | 事実: src/main/resources/schema.sql:22-28（会員テーブル）、src/main/java/library/domain/model/member/MemberType.java:6-9（中学生以上/小学生以下）、docs/specification.md:7-9 |
| 図書館館長 | 直接（督促業務） | 毎月末日に遅滞者の把握を行う。督促業務の主体 | medium | 事実: docs/specification.md:32（記述あり）。ただし督促業務の画面・UC は未実装で、期限切れ確認 API（src/main/java/library/presentation/api/ExpireCheck.java:15）のみ存在するため実装上の裏付けは部分的 |
| 市・自治体 | 間接 | 公立図書館の設置者。会員資格（市内在住・在学）の条件を規定する | low | 推測: docs/specification.md:42（「市内に住んでいる、もしくは市内の学校に在席している場合作成可能」）から設置自治体の存在を推定。コード・設定上の直接の証拠なし |
| 開発者・学習者 | 間接（本リポジトリ特有） | RDRA 2.0 / CCSR / JIG の学習教材としてこのリポジトリを利用する | medium | 事実: README.md:34-35（チュートリアルへの誘導）、README.md:104-112（CCSR 実践例としての位置づけ） |

- ドメイン特性:

| 特性 | 内容 | 確度 | 根拠 |
|------|------|------|------|
| 公共性 | 公立図書館の業務であり、市民サービスとして提供される | high | 事実: README.md:5、docs/specification.md:42 |
| 個人情報保護 | 貸出記録は返却時に消去、予約記録は取置時に消去。督促通知でも本人が希望しない限り書名・著者名を通知しない | medium | 事実: docs/specification.md:36-37, docs/specification.md:45-49（業務ルールとして明記）。推測: コード上での消去処理の実装は本フェーズでは未確認のため medium に留める |
| 業務ルールの複雑さ | 貸出制限（会員種別×点数×DVD/CD 上限×延滞状態）、予約の状態遷移（未準備→準備完了→解放/期限切れ/取消）が中核 | high | 事実: docs/specification.md:5-28、src/main/java/library/domain/model/loan/rule/（RestrictionOfQuantity, RestrictionOfDelay, Loanability 等）、src/main/resources/schema.sql:95-137（予約・取置の状態テーブル群） |
| 時間・暦への依存 | 返却期限（15日）、取置期限（連絡翌日から7開館日、休館日=月曜・年末年始）、延滞判定（15日/2か月）、月末の遅滞者把握など暦・営業日計算が業務の要 | high | 事実: docs/specification.md:8-10, docs/specification.md:22-23, docs/specification.md:27-28, docs/specification.md:32、src/main/java/library/domain/type/date/（日付型パッケージ） |
| リアルタイム性 | 窓口カウンター業務のためオンライン応答は必要だが、大量トラフィックや秒単位の同時実行制御を要する性質ではないと推定 | low | 推測: サンプル実装であり性能要件の記述がドキュメント・設定のいずれにもない。業務内容（窓口業務）からの一般論による補完 |
| 法規制 | 図書館法・個人情報保護法等の公共図書館関連規制の影響下にあると推定されるが、リポジトリ内に明示的言及なし | low | 推測: 公立図書館というドメインからの一般論。docs/specification.md:37 の個人情報保護記述が傍証 |

## FIXME / 特記事項

- FIXME: デプロイ形態（本番運用先・コンテナ化の有無）がリポジトリから読み取れない。Phase3 のユーザー確認対象とする。
- FIXME: docs/specification.md:50 の「蔵書管理」見出しは本文が空であり、業務ルールが未記述（README.md:72-75 の未実装宣言と整合）。
- FIXME: 督促・延滞罰則の業務ルール（docs/specification.md:25-37）は仕様書に存在するが、対応する画面・UC の実装は期限切れ確認 API（presentation/api/ExpireCheck.java）のみで大部分が未実装。実装済み範囲との差分は Phase2 以降のレイヤー分析で精査する。
- 認証・認可機構は存在しない（依存・コードともに証拠なし）。アクター識別はロール定義ではなく画面・業務単位の推定に依存することになる。

## 確度サマリ

| 確度 | 件数 | 該当項目 |
|------|------|----------|
| high | 18 | システム名、目的、未実装業務、技術スタック 12 項目（デプロイ除く）、ドメイン、ステークホルダー: 司書・図書館会員、ドメイン特性: 公共性・業務ルール複雑さ・時間依存 |
| medium | 4 | システムの位置づけ（認証なし）、ステークホルダー: 図書館館長・開発者/学習者、ドメイン特性: 個人情報保護 |
| low | 4 | デプロイ形態、ステークホルダー: 市・自治体、ドメイン特性: リアルタイム性・法規制 |
