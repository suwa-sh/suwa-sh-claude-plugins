# Part 2: アプリケーションアーキテクチャ推論ルール

> **読み込みタイミング**: Step1 の Part 2（アプリケーション）推論 subagent だけが読む。基本方針・入力ファイル表・Part 索引は `references/arch-inference-rules.md`。

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
