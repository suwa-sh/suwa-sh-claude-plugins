# RDRA + NFR → アーキテクチャ推論ルール

RDRA モデルと NFR グレードからアーキテクチャ設計を推論するためのルール定義。
全てのテクノロジー記述はベンダーニュートラルとし、特定クラウドベンダーのサービス名は使用しない。

## 推論の基本方針

1. RDRA モデルと NFR グレードから読み取れる情報を最大限活用し、可能な限り自動で設計判断を推定する
2. 推論には confidence（確信度）を付与し、対話ステップでの確認優先度を決定する
3. 推論不能な項目は一般的なベストプラクティスを適用し、confidence: "default" とする
4. テクノロジー候補はベンダーニュートラルな用語のみ使用する（arch-schema.md のベンダーニュートラル用語ガイド参照）
5. クラウドデザインパターンの適用判断には `arch-design-patterns.md` を参照し、RDRA/NFR シグナルとパターンの対応を確認する

## 入力ファイル

| ファイル | 主な推論先 |
|---------|-----------|
| `docs/rdra/latest/BUC.tsv` | ティア構成、バッチ/ワーカー判定、API 粒度 |
| `docs/rdra/latest/アクター.tsv` | フロントエンドティア要否、認証方式 |
| `docs/rdra/latest/外部システム.tsv` | 外部連携ティア、統合パターン |
| `docs/rdra/latest/情報.tsv` | 概念データモデル、エンティティ、リレーション |
| `docs/rdra/latest/状態.tsv` | 状態管理戦略、ドメインイベント |
| `docs/rdra/latest/条件.tsv` | ビジネスルール層の複雑さ、バリデーション方針 |
| `docs/rdra/latest/バリエーション.tsv` | ストラテジーパターンの要否 |
| `docs/rdra/latest/システム概要.json` | システム全体像、対象ユーザー |
| `docs/nfr/latest/nfr-grade.yaml` | 冗長構成、性能戦略、セキュリティ、運用方針 |

---

## Part 1: システムアーキテクチャ推論ルール

### ティア識別ルール

#### フロントエンドティア

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| アクター.tsv に「社内外」=「外」のアクターが存在 | フロントエンドティアが必要 | high |
| BUC.tsv に画面操作を伴う UC が存在 | フロントエンドティアが必要 | high |
| アクター種別が2種以上かつ異なるロール | 利用者向け・管理向けの UI 分離を検討 | medium |
| アクターが内部ユーザーのみ | 管理画面のみのシンプルフロントエンド | medium |

テクノロジー候補の推論:

| 条件 | 候補 | confidence |
|------|------|-----------|
| NFR F（環境）でモバイル対応要件あり | SPA + レスポンシブ | medium |
| NFR B（性能）で初回表示速度が重要 | SSR or SSG | medium |
| SEO が必要な公開ページあり | SSR | medium |
| 上記なし | SPA | low |

#### API Gateway ティア

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 外部アクター2種以上 + OAuth2/OIDC 認証 | API Gateway が必要（トークン検証の一元化） | medium |
| フロントエンド2種以上（利用者向け + 管理者向け） | API Gateway で経路制御・粗粒度 RBAC | medium |
| NFR E.5.3 IP制限要件あり | API Gateway でアクセス制御を集約 | medium |
| NFR E.10 WAF 要件あり | API Gateway 前段で WAF を統合 | medium |
| 上記いずれにも該当しない | API Gateway 不要（Backend API で直接処理） | medium |

テクノロジー候補:

| 条件 | 候補 | confidence |
|------|------|-----------|
| 外部アクター + 認証/認可の集約 | API Gateway / リバースプロキシ（Envoy, Kong, Traefik 等） | medium |

IdP ティアとの連携: API Gateway は IdP ティアが発行したトークンを検証する。

#### IdP ティア

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 外部アクター + OAuth2/OIDC 認証 | IdP ティアが必要 | high |
| 社内アクターのみ + 簡易認証 | IdP ティア不要（Backend API で処理） | medium |

テクノロジー候補:

| 条件 | 候補 | confidence |
|------|------|-----------|
| 外部アクター向け + ソーシャルログイン要件あり | マネージド IdP | medium |
| 社内アクターのみ or 既存ディレクトリ連携 | セルフホスト IdP（Keycloak 等） | medium |
| 外部 + 社内の組み合わせ | マネージド IdP + セルフホスト IdP の併用 | low |

IdP はトークン発行・ユーザー登録・パスワードリセット・MFA 管理を担う独立サービス。API Gateway はこのティアが発行したトークンを検証する。

#### 認可サービスティア

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 認可モデル選定で ReBAC（パターン C or D）を選択 | 認可サービスティアが必要 | high |
| 認可モデル選定で Policy Engine（パターン B）を選択 | 認可サービスティアが必要（OPA/Cedar） | high |
| RBAC + Backend 作り込み（パターン A）を選択 | 認可サービスティア不要 | high |

テクノロジー候補:

| 条件 | 候補 | confidence |
|------|------|-----------|
| ReBAC 選択時 | ReBAC サービス（OpenFGA / SpiceDB / Ory Keto） | medium |
| Policy Engine 選択時 | Policy Engine サイドカー（OPA / Cedar） | medium |

認可サービスは全認可判定の可用性に直結するため、Backend API と同等以上の可用性が必要。

#### バックエンド API ティア

常に必要。BUC の特性からAPI粒度を判断する。

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| BUC が5業務以下でドメインが単一 | モノリシック API | medium |
| BUC が6業務以上で独立したドメイン境界がある | API モジュール分割を検討 | low |
| 外部システムとの同期連携がある | API ゲートウェイ or BFF パターン | low |

テクノロジー候補:

| 条件 | 候補 | confidence |
|------|------|-----------|
| NFR A（可用性）グレード >= 3 | CaaS(k8s) or FaaS | medium |
| NFR B（性能）同時接続 >= Lv3 | CaaS(k8s)（スケールアウト容易） | medium |
| 小規模・低トラフィック | FaaS or 単一コンテナ | low |

#### バックエンドワーカーティア

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| BUC に「タイマー」「自動」「定期」「バッチ」「一括」を含むアクティビティ | ワーカーティアが必要 | high |
| BUC に「通知」「メール送信」を含むアクティビティ | 非同期ワーカーが必要 | medium |
| 状態.tsv にタイマー起動の状態遷移がある | ワーカーティアが必要 | high |
| 上記なし | ワーカーティア不要 | high |

テクノロジー候補:

| 条件 | 候補 | confidence |
|------|------|-----------|
| 定期実行のみ | CronJob(k8s) or FaaS + スケジューラ | medium |
| 非同期メッセージ処理あり | MQ + ワーカー（→ Queue-Based Load Leveling + Competing Consumers パターン参照: arch-design-patterns.md） | medium |
| 両方 | MQ + CronJob | medium |

#### データストアティア

常に必要。情報.tsv の特性から判断する。

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 情報.tsv にトランザクション整合性が必要なエンティティ | RDB | high |
| 情報.tsv に非構造化データ（ファイル、画像） | Object Storage | medium |
| NFR B（性能）でキャッシュが有効な参照系 | KVS キャッシュ | medium |
| NFR B（性能）で全文検索要件 | Search Engine | medium |

#### 外部連携ティア

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 外部システム.tsv にシステムが1つ以上 | 外部連携層/アダプタが必要 | high |
| 外部システムが3つ以上 | 統合レイヤー or API ゲートウェイ | medium |
| 外部システムに決済系が含まれる | 冪等性確保の方針が必要（→ Retry + Circuit Breaker パターン参照: arch-design-patterns.md） | high |

### ティア共通方針（cross_tier_policies）推論ルール

| 推論元 | 推論先 | ルール | confidence |
|--------|--------|--------|-----------|
| アクターに外部ユーザー + NFR E（セキュリティ）E.5 >= Lv2 | 認証方式: OAuth2/OIDC | 外部アクターの安全な認証 | high |
| アクター種別が3以上 + 条件.tsv に「権限」「ロール」 | 認可方式: 下記「認可モデル選定ルール」参照 | 多段階のアクセス制御 | high |
| NFR B（性能）B.2.1.1 >= Lv3 | API スタイル: REST + キャッシュ | レスポンス改善 | medium |
| NFR C（運用）C.6 >= Lv2 | 構造化ログと相関ID: 下記「トレーサビリティ推論ルール」参照 | 横断トレーサビリティ | medium |
| NFR A（可用性）A.1.1.1 >= Lv3 | ヘルスチェック: 全ティアに実装（→ Health Endpoint Monitoring パターン参照: arch-design-patterns.md） | 高可用性の基盤 | medium |
| 外部アクター + OAuth2/OIDC 認証 | IdP 方式: 外部 IdP サービス or セルフホスト IdP | 外部アクターの認証基盤として IdP が必要。ユーザー数・運用負荷・セキュリティ要件から方式を選定 | medium |
| NFR E.5.1 認証方式 >= Lv2 + アクター種別 >= 3 | IdP: マルチテナント対応 IdP | 複数ロールの認証を一元管理 | medium |
| 状態遷移を伴う操作 + 外部連携 or 金銭取引 | 冪等性方針: 下記「冪等性推論ルール」参照 | 重複処理防止 | medium |
| アクターに外国語名 or BUC/バリエーションに多言語関連キーワード or システム概要に海外/グローバル | i18n 方針: 下記「i18n 推論ルール」参照 | 多言語対応 | medium |

#### 認可モデル選定ルール

認可方式は RDRA モデルの認可パターンを分析して選定する。

##### 認可パターンの分析

| パターン | 判定条件 | 例 |
|---------|---------|-----|
| ロールベース | アクター種別が2以上で操作権限が分離 | 運営のみ: オーナー審査、利用状況分析 |
| 所有権ベース | 情報.tsv にアクターIDを外部キーに持つエンティティがある | オーナーは自分の会議室のみ操作可能 |
| 条件ベース | 条件.tsv にアクターの属性値による判定条件がある | 利用者の評価スコアによる使用許諾 |
| 状態ベース | 状態.tsv の特定状態でのみ許可される操作がある | 予約状態が「確定」の場合のみ変更可能 |

##### 認可モデルの選定

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| ロールベースのみ（所有権・条件パターンなし） | RBAC（API Gateway + Backend 作り込み） | high |
| 所有権ベースが3パターン以上 | ReBAC 外部サービス（OpenFGA/SpiceDB 等）を推奨 | medium |
| 条件ベースが3パターン以上 | Policy Engine（OPA/Cedar）を推奨 | medium |
| 所有権 + 条件の両方が多い | ReBAC + ABAC ハイブリッドを検討 | low |
| 上記いずれも少数 | RBAC + Backend 作り込みで十分 | medium |

##### 認可アーキテクチャのバリエーション

| パターン | 構成 | 適合条件 | トレードオフ |
|---------|------|---------|------------|
| A: RBAC + Backend 作り込み | Gateway で粗粒度 RBAC、Backend API で if 文作り込み | 小規模、認可パターンが少ない | 初期コスト低、ポリシー変更 = コード変更 |
| B: RBAC + Policy Engine | Gateway で粗粒度 RBAC、OPA/Cedar サイドカーで宣言的ポリシー | 条件ベースの認可が多い | ポリシー分離、学習コスト中 |
| C: ReBAC 外部サービス | Gateway で粗粒度 RBAC、OpenFGA/SpiceDB でリソースアクセス制御 | 所有権ベースの認可が多い | 関係性の表現が自然、外部サービス追加 |
| D: ReBAC + ABAC ハイブリッド | Gateway で粗粒度 RBAC、ReBAC + OPA/Cedar の併用 | 所有権 + 条件の両方が多い、大規模 | 最も柔軟、運用コスト高 |

状態ベースの認可は認可モデルに含めず、Domain 層のビジネスルールとして実装する。

#### トレーサビリティ推論ルール

NFR C.6（ログ管理）>= Lv2 または NFR C.1.3（監視範囲）>= Lv3 の場合、構造化ログとトレーサビリティ ID の方針を cross_tier_policies に追加する。

分散トレーシングは OpenTelemetry 標準（trace_id + span_id）に統一する。span はティア単位で発行し、レイヤー内の処理詳細はログの context フィールドで表現する。詳細は `arch-logging-patterns.md` のトレーサビリティ ID 体系を参照。

リクエストの全処理経路を追跡できるよう、以下の設計方針を含めること:

| 対象 | 方針 | 根拠 |
|------|------|------|
| フロントエンド | リクエストごとに trace_id を生成し、リクエストヘッダー（W3C Trace Context）に付与する。冪等キー（後述）と共に送信する | リクエストの起点を一意に特定 |
| API Gateway / Backend API | trace_id をヘッダーから取得し、新たな span_id を発行する。後続ティアへの内部通信・MQ メッセージにも trace_id + parent span_id を伝播する | 全ティア横断のトレーサビリティ |
| ワーカー（CronJob/FaaS） | MQ メッセージまたはジョブパラメータから trace_id を取得し、新たな span_id を発行する。CronJob はジョブ実行ごとに新規 trace_id を生成する | 非同期処理のトレーサビリティ |
| 全ティア共通 | JSON 構造化ログに trace_id, span_id, service, timestamp を必須フィールドとして含める | ログ集約時の横断検索 |
| 全ティア共通 | 認証済みリクエストのログには session_id, user_id を context に含める。業務処理のログには業務エンティティ ID（予約 ID 等）を context に含める | 監査証跡の充実・業務単位の横断検索 |

追加条件:

| 判定条件 | 推論先 | confidence |
|---------|--------|-----------|
| 外部アクター + NFR E.7.1（監査ログ）>= Lv2 | session_id / user_id / 業務エンティティ ID をログ context に含める | high |

#### 冪等性推論ルール

以下の条件のいずれかに該当する場合、全ティア共通の冪等性方針を cross_tier_policies に追加する:

| 条件 | 判定元 |
|------|--------|
| 状態モデルに金銭取引関連の状態遷移がある | 状態.tsv に「決済」「精算」「支払」等の状態モデルが存在 |
| 外部システムに決済機関が含まれる | 外部システム.tsv に決済系の外部システムが存在 |
| 外部ユーザーがアクターに含まれる | アクター.tsv に社外アクターが存在（リトライによる重複送信リスク） |
| BUC に予約・申請等の状態変更操作が含まれる | BUC.tsv に「予約」「申請」「登録」等の更新系フローが存在 |

上記条件に 2 つ以上該当する場合は confidence: "high"、1 つの場合は confidence: "medium" とする。

冪等性方針には各層での具体的な対処方法を含めること:

| 層 | 対処 |
|----|------|
| フロントエンド | リクエストごとに冪等キー（UUID）を生成し、リクエストヘッダー X-Idempotency-Key に付与する。ダブルクリック防止の UI 制御も併用する |
| Backend API | 冪等キーを KVS で管理し、重複リクエストを検知して前回レスポンスを返却する。状態変更を伴う操作（POST/PUT/DELETE）が対象 |
| データストア（RDB） | 冪等キーカラムに UNIQUE 制約を設定し、ON CONFLICT（UPSERT）で重複挿入を防止する |
| ワーカー（CronJob） | ジョブ実行 ID で重複実行を検知する |
| ワーカー（FaaS/MQ） | MQ の MessageId で重複メッセージを検知する |

#### i18n 推論ルール

RDRA モデルと NFR グレードから i18n（国際化）対応の要否とアーキテクチャ方針を推論する。多くのシステムは日本語のみで十分だが、海外展開やグローバルユーザーの存在が示唆される場合は早期にテキスト外部化を導入しておくことで後の対応コストを大幅に下げられる。

##### i18n シグナルの検出

以下の RDRA/NFR 要素から i18n 対応の必要性を示すシグナルを検出する:

| シグナル源 | 条件 | confidence |
|-----------|------|-----------|
| アクター.tsv | アクター名に外国語名（英語等）が含まれる、または「海外」「外国」キーワード | medium |
| BUC.tsv | アクティビティに「多言語」「海外」「グローバル」「翻訳」「international」キーワード | high |
| バリエーション.tsv | 「言語」「地域」「リージョン」バリエーションが存在 | high |
| 外部システム.tsv | 海外サービス（国際決済、海外 SNS 等）との連携 | medium |
| システム概要.json | 概要に「海外」「グローバル」「多言語」「international」等の言及 | medium |
| NFR F（環境） | マルチリージョン要件、言語対応要件が記載 | high |

##### 推奨オプションの選定

検出されたシグナルの強度と数に基づき、以下の4つのオプションから推奨を選定する:

| 判定条件 | 推奨オプション | confidence |
|---------|--------------|-----------|
| i18n シグナルなし | 1: 日本語のみ（i18n 不要） | high |
| 弱いシグナル（medium confidence）が1件のみ | 2: 日本語 + 英語（ブラウザ翻訳補完） | low |
| アクターに外国語名 or システム概要にグローバル言及 | 2: 日本語 + 英語（ブラウザ翻訳補完） | medium |
| BUC/バリエーションに明示的な多言語要件 + 海外サービス連携 | 3: アプリケーション管理多言語 | medium |
| 上記に加え RTL 言語圏のアクター or NFR に RTL 要件 | 4: 多言語 + RTL 対応 | medium |

##### i18n オプション定義

| # | オプション | 概要 |
|:-:|----------|------|
| 1 | **日本語のみ** | i18n 対応不要。テキストはコード内に直接記述可能 |
| 2 | **日本語 + 英語（ブラウザ翻訳補完）** | フロントエンドのテキスト外部化のみ（ja/en リソースバンドル）。他言語はブラウザの機械翻訳機能に委ねる。バックエンド i18n 不要 |
| 3 | **アプリケーション管理多言語** | フル i18n: リソースバンドル、ロケール解決、API Accept-Language、DB 多言語カラム |
| 4 | **多言語 + RTL 対応** | オプション 3 + アラビア語/ヘブライ語等の RTL（右から左）レイアウト対応 |

##### オプション別アーキテクチャ影響

選択されたオプションに応じて、以下の policy/rule を各ティアに生成する:

| ティア | Option 2: 日本語+英語 | Option 3: アプリ管理多言語 | Option 4: 多言語+RTL |
|--------|---------------------|------------------------|---------------------|
| フロントエンド | SP: テキスト外部化（i18n キー管理、ja/en リソースバンドル）。ブラウザ翻訳に対応可能な DOM 構造（意味的な HTML、lang 属性設定）。日付・数値のロケール別書式（Intl API） | SP: リソースバンドル管理 + ロケール解決（URL パスベース/ブラウザ設定/デフォルト）+ 言語切替 UI。翻訳ファイルの遅延読み込み（言語別チャンク分割） | Option 3 + SP: CSS logical properties（margin-inline-start 等）、dir 属性による RTL 切替、双方向テキスト混在対応 |
| Backend API | なし | SP: Accept-Language ヘッダからロケール解決。エラーメッセージ・通知テキストの多言語化（エラーコード + クライアント側翻訳 or サーバー側翻訳） | 同左 |
| データストア | なし | data policy: 多言語カラム戦略 — JSON 型（`{"ja":"名前","en":"name"}`）または言語別翻訳テーブル（`{entity}_translations`）。検索インデックスの言語別アナライザ | 同左 |
| ワーカー | なし | 通知テンプレートの多言語対応（ユーザーの preferred_locale に基づくテンプレート選択） | 同左 |

Option 1（日本語のみ）は追加の policy/rule を生成しない。

Option 2 ではバックエンド・データ・ワーカーの i18n 対応が不要なため、フロントエンドのテキスト外部化のみで済むコストパフォーマンスの良い選択肢。ブラウザの機械翻訳（Google 翻訳、DeepL 等のブラウザ拡張）が外部化されたテキストを翻訳することで、追加の開発コストなく多言語アクセスが可能になる。

### ティア共通ルール（cross_tier_rules）推論ルール

| 推論元 | 推論先 | ルール | confidence |
|--------|--------|--------|-----------|
| NFR E（セキュリティ）E.6 暗号化 >= Lv1 | 通信暗号化: TLS 必須 | データ秘匿 | high |
| NFR C（運用）C.1 運用監視 | エラー通知: アラート基盤 | 運用監視要件 | medium |
| 一般的なベストプラクティス | API バージョニング方式 | 互換性維持 | default |
| IdP 導入 + NFR E.5.1 認証方式 | トークンライフサイクル管理: アクセストークン有効期限・リフレッシュトークン管理方針 | セッションハイジャック防止 | medium |

---

## Part 2: アプリケーションアーキテクチャ推論ルール

アプリケーションアーキテクチャの設計思想・レイヤー構成の詳細は `arch-app-patterns.md` を参照。

### レイヤリングパターンの選定

#### バックエンド API ティア

| 判定条件 | レイヤリング | confidence |
|---------|------------|-----------|
| 状態.tsv の状態遷移が5種以上 or 条件.tsv が10件以上 | 5層: presentation → usecase → domain → repository → gateway | high |
| 上記未満だが BUC が複雑 | 3層: presentation → usecase → gateway | medium |
| CRUD 中心のシンプルな BUC | 2層: handler → gateway | medium |

5層の各レイヤー:

| レイヤー | 責務 | 依存先 |
|---------|------|--------|
| presentation | Driver Side の入出力。HTTP リクエスト/レスポンス変換、入力バリデーション | usecase |
| usecase | ビジネスフロー制御、トランザクション境界 | domain, repository |
| domain | ビジネスルール、エンティティ、値オブジェクト、ドメインイベント | なし（最内層） |
| repository | domain のデータアクセス方法。aggregate root と 1:1 で定義。gateway/adapter を利用 | domain, gateway |
| gateway | Driven Side の入出力。adapter（datastore model と 1:1）と client（SDK ラッパー）で構成 | なし（datastore のみ知る） |

repository レイヤーの詳細:
- domain/aggregate root と 1:1 で定義する
- gateway/adapter を利用する。複数テーブルにアクセスする場合は複数の adapter を利用する
- event/snapshot 併用のデータモデルの場合: repository.save(domain) → historyAdapter.insert + snapshotAdapter.upsert
- method 名は JPA に寄せる: save, findById, findAll, deleteById など

gateway レイヤーの詳細:
- **adapter**: datastore へのアクセス方法。RDB テーブルなど datastore model と 1:1 で定義。adapter/client や外部ライブラリの client を利用する。method 名は datastore の操作に寄せる: insert, update, delete など。ORM 利用時は自動生成コードの配置場所となる
- **client**: datastore を操作する SDK。外部ライブラリの使い方に共通ルールがある場合や SDK が提供されていない場合に作成する

#### フロントエンドティア

| 判定条件 | レイヤリング | confidence |
|---------|------------|-----------|
| BUC の UC 数が20以上 | 3層: view → state management → api client | medium |
| UC 数が20未満 | 2層: view/component → api client | medium |

#### ワーカーティア

| 判定条件 | レイヤリング | confidence |
|---------|------------|-----------|
| 状態遷移やビジネスルールを扱う処理あり | 5層: presentation → usecase → domain → repository → gateway（Backend API と domain/repository/gateway を共有） | high |
| ドメインロジック（状態遷移なし） | 3層: presentation → usecase → gateway | medium |
| 単純なバッチ処理 | 2層: handler → gateway | medium |

補足: 状態.tsv にワーカーがトリガーする状態遷移がある場合、または条件.tsv にワーカーが適用するビジネスルールがある場合は5層を選択する。

注記: BUC に検索・照会系と登録・更新系の UC が混在し読み書き負荷が非対称な場合は CQRS パターンを検討する（→ arch-design-patterns.md 参照）。

### レイヤー方針（policies）推論ルール

| 推論元 | レイヤー | 方針 | confidence |
|--------|---------|------|-----------|
| 条件.tsv に入力バリデーション条件 | presentation | 入力バリデーション: API 境界で全入力を検証 | high |
| 状態.tsv に複数の状態遷移パス | domain | 状態遷移: ドメインモデル内で状態整合性を保証 | high |
| 外部システム連携あり | gateway | 冪等性: 外部呼出しの冪等性を保証 | high |
| 情報.tsv に金銭関連エンティティ | usecase | トランザクション: 金銭処理のトランザクション整合性を保証 | high |
| NFR C.1.3 監視範囲 + 外部アクターあり | presentation | アクセスログ: HTTP リクエスト/レスポンスのメタデータを構造化ログで出力。trace_id を発行し後続レイヤーに伝播 | medium |
| 状態.tsv に状態遷移 + NFR E.7.1 監査ログ | usecase | 監査ログ: 状態遷移を伴うビジネスイベントを構造化ログで記録（誰が、何を、どうしたか） | high |
| （常に適用） | domain | ログ出力禁止: domain 層は直接ログ出力を行わない。ドメインイベントの発行または例外のスローで状態変化を通知する | high |
| 外部システム連携あり + NFR C.1.3 | gateway | 依存関係ログ: 外部 DB/API 呼び出しの開始・終了、処理時間、成否を構造化ログで出力 | medium |
| 外部システム連携あり + NFR A.2.1 冗長化 >= Lv2 | gateway | 劣化兆候ログ: リトライ発生/サーキットブレーカー状態遷移/DNS-TLS 遅延を WARN レベルで構造化ログ出力。degradation_type, current_value, threshold を context に含める。しきい値は設定ファイルから読み込む。詳細は `arch-logging-patterns.md` 参照 | medium |
| NFR B.2.1 レスポンスタイム >= Lv3 + KVS キャッシュ利用 | gateway | キャッシュ劣化ログ: キャッシュミス率上昇/コネクションプール逼迫を WARN レベルで出力。しきい値は設定ファイルから読み込む | medium |
| BUC に非同期処理/MQ 利用 | presentation (MQ) | キュー劣化ログ: キュー深度超過/処理遅延を WARN レベルで出力。しきい値は設定ファイルから読み込む | medium |
| 外部アクター + IdP 利用 | presentation | トークン期限ログ: トークン期限接近を WARN レベルで出力。しきい値は設定ファイルから読み込む | low |
| 情報.tsv に状態モデルありエンティティ | gateway | 楽観ロック競合ログ: 楽観ロック競合（OptimisticLockException）を WARN レベルで出力。対象エンティティ ID と競合回数を context に含める | medium |

### レイヤー共通方針（cross_layer_policies）推論ルール

| 推論元 | 方針 | confidence |
|--------|------|-----------|
| 初期状態 | IF なし: レイヤー間は直接依存。開発スピードを優先 | default |
| 外部サービス API 変更が頻繁 or DB 製品乗り換え予定 or チーム分割 | 凹型: 該当 gateway に IF を導入し依存を内側に向ける | medium |
| 外部アクターあり | エラーハンドリング伝播: domain 例外は usecase で集約キャッチしログ出力（集約ポイント）。presentation で HTTP ステータスに変換。gateway は依存関係ログに記録後、技術例外としてスロー。多重ログ防止: 集約ポイント（usecase）で 1 回だけログ出力。cause chain を context に保持。詳細は `arch-logging-patterns.md` 参照 | default |
| NFR C（運用）ログ管理要件 | ロギング: レイヤーごとに責務に応じたログカテゴリを出力。domain 層は直接ログ出力しない。詳細は `arch-logging-patterns.md` 参照 | medium |
| NFR C.6（ログ管理）>= Lv2 | ログ運用方針: 非同期ログ出力を原則とする。DEBUG/TRACE は本番無効がデフォルト。ログローテーションはサイズ + 時間ベースの併用。保持期間は NFR C.6.1 と NFR E.7.1 に準拠。ログ出力先は stdout/stderr に統一（ベンダーニュートラル）。詳細は `arch-logging-patterns.md` 参照 | medium |
| NFR C.3.1（障害検知）>= Lv3 | 動的ログレベル変更: 再起動なしでログレベルを変更可能な仕組みを全ティアに実装 | medium |
| （常に適用） | ログアンチパターン防止: 多重ログ禁止、catch 握り潰し禁止、機密情報マスキング必須、ループ内逐次ログ禁止、構造化ログ強制、TZ は UTC 統一。詳細は `arch-logging-patterns.md` 参照 | default |

---

## Part 3: データアーキテクチャ推論ルール

データアーキテクチャの設計方針・イミュータブルデータモデルの詳細は `arch-data-patterns.md` を参照。

### エンティティ分類ルール

情報.tsv の各エンティティを、状態.tsv との対応に基づいて分類する。

| 判定条件 | 分類 | テーブル設計 | confidence |
|---------|------|-----------|-----------|
| 状態.tsv に対応する状態モデルがある | event_snapshot | {entity}_events（INSERT のみ）+ {entity}_snapshots（最新状態キャッシュ） | high |
| 個人情報（氏名・連絡先等）があり変更履歴の追跡が一般的 | event_snapshot | 同上。属性変更イベントを記録し、スナップショットで最新状態を保持 | medium |
| 「〜する」動詞で表現でき、発生日時を持ち、登録後に変更しない | event | {entity} テーブル（INSERT のみ）。スナップショット不要 | high |
| 金銭関連（金額・料金属性）で一度きりの記録 | event | 同上。金額を含む不変の事実記録 | high |
| 状態モデルなし + 属性変更が想定され世代管理が必要なマスタ | resource_scd2 | valid_from / valid_to で世代管理 | medium |
| 単純なマスタ・設定、上記いずれにも該当しない | resource_mutable | 従来型のテーブル | default |

event_snapshot 型のエンティティでは:
- nullable な日時属性（〜日時、〜日）は排除し、イベントの occurred_at で管理する
- current_status 属性はスナップショットテーブルに持たせる（キャッシュ的ステータス）
- repository 層が「イベント追記 + スナップショット更新」の二重書き込みを隠蔽する（historyAdapter.insert + snapshotAdapter.upsert）

event 型のエンティティでは:
- INSERT のみのテーブル。UPDATE/DELETE 禁止
- スナップショットテーブルは不要
- nullable 属性は原則なし（全属性が INSERT 時に確定）

### エンティティ抽出ルール

情報.tsv の各行を1エンティティとして抽出する。

| 情報.tsv カラム | マッピング先 | ルール |
|----------------|------------|--------|
| 情報（名前） | Entity.name | そのまま使用 |
| 属性 | Entity.attributes | カンマ区切りまたは読点（、）区切りで分割し、各属性を Attribute に変換 |
| 関連情報 | Entity.relationships | 参照先のエンティティを特定し、Relationship を生成 |
| 状態モデル | 追加属性: status | 状態モデルがある場合、string 型の status 属性を追加 |
| バリエーション | 追加属性: type/category | バリエーションがある場合、分類属性を追加 |

### 属性の型推論ルール

情報.tsv の属性名から論理型を推論する。

| 属性名パターン | 推論型 | confidence |
|---------------|--------|-----------|
| *ID, *id, *コード | string | high |
| *名, *名称, *氏名 | string | high |
| *日, *日時, *日付 | datetime（Event+Snapshot 型の場合は nullable 日時を排除し、イベントの occurred_at で管理） | high |
| *時間, *時刻 | datetime | high |
| *数, *量, *回数 | integer | high |
| *額, *金額, *料金, *率 | decimal | high |
| *フラグ, *可否, *有無 | boolean | high |
| *スコア, *点数, *評価 | decimal | medium |
| *メール, *電話, *住所, *URL | string | high |
| *内容, *コメント, *説明 | text | high |
| *画像, *ファイル | string (URI) | medium |
| *ステータス, *状態 | string (enum) | high |
| その他 | string | low |

### リレーション推論ルール

| 情報.tsv の関連情報パターン | カーディナリティ | confidence |
|---------------------------|----------------|-----------|
| A が B を「所有」「管理」する関係 | A 1:N B | medium |
| A が B に「属する」「紐づく」関係 | A N:1 B | medium |
| A と B が「参照」関係 | A N:1 B or 1:1 | low |
| 中間テーブル的な情報が存在 | N:M | low |

リレーションの推論は曖昧さが大きいため、confidence は medium 以下。Step2 で確認する。

### セッション・キャッシュエンティティ生成ルール

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 外部アクター + OAuth2/OIDC 認証 | セッション情報エンティティを生成（session_id, user_id, access_token, refresh_token, role, expires_at）、ストレージ: cache | high |
| NFR B（性能）でレスポンス要件あり + 検索系 UC あり | 対象エンティティに cache ストレージマッピングを追加（RDB との二重マッピング） | medium |
| 参照頻度が高いマスタデータ（運用ルール等） | 対象エンティティに cache ストレージマッピングを追加 | medium |

### ストレージマッピング推論ルール

| 判定条件 | ストレージ種別 | confidence |
|---------|-------------|-----------|
| 金銭・取引・予約に関するエンティティ | rdb | high |
| 状態モデルを持つエンティティ | rdb | high |
| 複数エンティティとの外部キー関係 | rdb | medium |
| 画像・ファイル属性を持つエンティティ | file (Object Storage) | medium |
| NFR B（性能）で頻繁に参照されるマスタデータ | cache (KVS) + rdb（→ Cache-Aside パターン参照: arch-design-patterns.md） | medium |
| 全文検索が必要なエンティティ | search + rdb | low |
| ログ・履歴系でトランザクション不要 | nosql | low |
| 上記いずれにも該当しない | rdb | default |

補足: Event テーブルと Snapshot テーブルは同一ストレージ（RDB）に配置する。repository 層が gateway/adapter を経由してイベント追記とスナップショット更新の二重書き込みを1トランザクションで実行する。

---

## 推論結果の出力形式

推論結果は `_inference.md` に以下の形式でまとめる:

```markdown
# アーキテクチャ推論根拠サマリ

- event_id: {event_id}
- created_at: {created_at}

## RDRA/NFR モデル分析結果

### 分析した RDRA 要素

| モデル | 要素数 | 主な特徴 |
|--------|--------|---------|
| BUC | {N} | {特徴} |
| アクター | {N} | {特徴} |
| 外部システム | {N} | {特徴} |
| 情報 | {N} | {特徴} |
| 状態 | {N} | {特徴} |
| 条件 | {N} | {特徴} |

### 参照した NFR グレード

| カテゴリ | 平均Lv | 主な影響 |
|---------|--------|---------|
| A. 可用性 | {N} | {影響} |
| B. 性能・拡張性 | {N} | {影響} |
| C. 運用・保守性 | {N} | {影響} |
| D. セキュリティ | {N} | {影響} |
| E. 移行性 | {N} | {影響} |
| F. 環境 | {N} | {影響} |

## システムアーキテクチャ推論

| ティア | テクノロジー候補 | confidence | 根拠 |
|--------|----------------|-----------|------|
| {tier} | {candidates} | {conf} | {reason} |

## アプリケーションアーキテクチャ推論

### {tier_name}

| レイヤー | 責務 | confidence | 根拠 |
|---------|------|-----------|------|
| {layer} | {responsibility} | {conf} | {reason} |

## データアーキテクチャ推論

| エンティティ | ストレージ | confidence | 根拠 |
|-------------|----------|-----------|------|
| {entity} | {storage} | {conf} | {reason} |

## 要確認項目

- {確認が必要な項目と理由}
```
