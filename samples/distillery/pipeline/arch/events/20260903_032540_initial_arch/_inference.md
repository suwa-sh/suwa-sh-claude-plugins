# アーキテクチャ推論根拠サマリ

- event_id: 20260903_032540_initial_arch
- created_at: 2026-09-03T03:51:01
- trigger_event: rdra:20260903_030744_initial_build, nfr:20260903_031858_initial_nfr
- 対象システム: 図書館蔵書管理システム（1 館・GUI）

## RDRA/NFR モデル分析結果

### 分析した RDRA 要素

| モデル | 要素数 | 主な特徴 |
|--------|--------|---------|
| BUC | 10（6 業務 / 27 UC） | 蔵書管理 2・利用者管理 1・貸出 3・期限管理 2・利用者サービス 1・運営分析 1。バッチ UC 4 件（リマインド抽出・送信、延滞判定・督促送信）→ ワーカー/タイマー処理。メール送信 UC 3 件 → 非同期処理候補 |
| アクター | 3 | 司書（社内提供者）/ 利用者（社外受益者）/ タイマー（社内提供者）。社外アクターあり → 利用者向け Web 画面必須。多言語・海外キーワードなし |
| 外部システム | 1 | メール配信サービス（通知系）。決済・認証連携なし |
| 情報 | 9 | 書籍・ジャンル・利用者・貸出・貸出期間・リマインド日数・予約・通知・貸出統計。個人情報あり（利用者の氏名・連絡先、通知の送信先）。金銭情報なし。コンテキスト列 6 区分 |
| 状態 | 3 モデル / 9 状態 / 17 遷移行 | 書籍の状態・貸出の状態・予約の状態。返却登録・貸出登録が 3 モデルに同期波及 |
| 条件 | 14 | 貸出可否・予約可否・返却期限算出・返却後書籍状態・返却通知対象・予約順位決定・リマインド対象・延滞判定・利用状況閲覧範囲（アクセス制御）・書籍検索条件・在庫状況・人気ランキング・集計期間・媒体種別 |
| バリエーション | 6 | 利用者区分・ジャンル・検索条件種別・媒体種別・通知種別・集計期間種別。言語・地域バリエーションなし |

### 参照した NFR グレード

| カテゴリ | 平均Lv | 主な影響 |
|---------|--------|---------|
| A. 可用性 | 2.0 | 9 時〜翌 8 時稼働（Lv3）・N+1 冗長（Lv3）・RTO 2h（Lv3）・RPO 数時間（Lv2）→ ステートレス API の複数インスタンス + LB、RDB のフル＋差分＋ログ退避、遠隔地バックアップ、ヘルスチェック、Retry/Circuit Breaker/Timeout |
| B. 性能・拡張性 | 1.7 | 同時〜100（Lv1）・50 TPS・応答 5 秒（Lv3）・バッチ 8h 枠 → 小規模。REST + Cache-Aside、CaaS によるスケールアウト、MQ による送信平準化、ピーク 2 倍想定の負荷テスト |
| C. 運用・保守性 | 2.0 | アプリ監視＋外形監視（Lv3）・ログ 6 ヶ月・4 種別ログ（Lv3）→ 構造化ログ + OpenTelemetry、バッチ完了/送信結果の監視、バックアップと日次バッチの分離、状態整合性確認を含む復旧手順、営業時間内サポート（Lv1） |
| D. 移行性 | 1.1 | 紙台帳・表計算からの一括移行（Lv1）・〜100GB・リハーサル 1 回 → データストアティアの初期移行ルール。構造への影響は小 |
| E. セキュリティ | 1.6 | ID/パスワード＋ポリシー（Lv2）・RBAC（Lv2）・館内/公開の利用制限・機密列の保管時暗号化・全通信 TLS・監査ログ Lv2・WAF・DMZ/内部分離 → API Gateway + WAF + IdP、2 系統フロントエンド、認可パターン A + PII BC 厳格化、ログ PII 禁止 |
| F. システム環境・エコロジー | 1.6 | Web アプリ・主要 OS/ブラウザ（Lv2）・PC/タブレット・モジュラ構成（Lv2）・ISBN 準拠・アクセシビリティ AA 目標（low）→ レスポンシブ SPA、モジュラモノリス、i18n 不要、ISBN 検証ルール |

## ドメインアーキテクチャ推論

| サブドメイン | type | confidence | 根拠 |
|-------------|------|-----------|------|
| SD-001 貸出・予約・期限管理 | core | medium | BUC-004〜008。システム概要が「貸出・返却・予約」「リマインド・督促の自動送信」を目的として明示。3 状態モデルが連動する最複雑領域。「競争優位」明示なしのため medium |
| SD-002 蔵書管理 | supporting | medium | BUC-001, 002。書籍・ジャンルのマスタ管理と検索。中核業務の前提だが差別化要因ではない |
| SD-003 利用者管理 | supporting | medium | BUC-003, 009。利用者の登録管理と本人の利用状況閲覧。個人情報あり |
| SD-004 運営分析 | supporting | medium | BUC-010。貸出記録の参照系集計 |
| SD-005 通知配信 | generic | high | 外部システム「メール配信サービス」（通知系）と一致。外部 SaaS / ライブラリ採用 |

| BC | 所属 SD | owned entities | confidence | 根拠 |
|----|--------|----------------|-----------|------|
| BC-001 蔵書コンテキスト | SD-002 | E-001 書籍, E-002 ジャンル | medium | 情報.tsv コンテキスト「蔵書管理」。書籍の状態モデルを所有 |
| BC-002 利用者コンテキスト | SD-003 | E-003 利用者 | medium | 情報.tsv コンテキスト「利用者管理」。個人情報の保護境界。利用状況閲覧範囲判定を所有 |
| BC-003 貸出コンテキスト | SD-001 | E-004 貸出, E-005 貸出期間, E-006 リマインド日数 | medium | 情報.tsv コンテキスト「貸出管理」。貸出の状態モデル + 業務パラメータ + 日次バッチ |
| BC-004 予約コンテキスト | SD-001 | E-007 予約 | medium | 情報.tsv コンテキスト「予約管理」。予約の状態モデルと予約順位決定 |
| BC-005 通知コンテキスト | SD-005 | E-008 通知 | medium | 情報.tsv コンテキスト「通知管理」。メール配信サービスとの連携領域を隔離 |
| BC-006 運営分析コンテキスト | SD-004 | E-009 貸出統計 | medium | 情報.tsv コンテキスト「運営分析管理」。読み取り専用の集計 |

team_ownership はすべて null（RDRA からチーム情報は推論できない。auto_adopt で未定のまま）。派生エンティティ E-901 セッション / E-902 監査ログ / E-903 認証情報は横断基盤として BC の owned_entity_ids に含めない。

| コンテキストマップ | upstream → downstream | パターン | 根拠 |
|-------------------|----------------------|---------|------|
| CM-001 | BC-001 蔵書 → BC-003 貸出 | Customer-Supplier | 貸出登録・返却登録を契機に書籍の状態遷移を蔵書 BC に要求 |
| CM-002 | BC-001 蔵書 → BC-004 予約 | Customer-Supplier | 予約可否判定で書籍の状態を参照し、全予約取消時に在庫ありへ戻す遷移を要求 |
| CM-003 | BC-002 利用者 → BC-003 貸出 | OHS+PL | 利用者番号照会（登録済み判定・連絡先）を公開ホストサービスとして提供 |
| CM-004 | BC-002 利用者 → BC-004 予約 | OHS+PL | 予約主体を利用者番号で参照 |
| CM-005 | BC-004 予約 → BC-003 貸出 | Customer-Supplier | 返却時に予約順位 1 位を問い合わせ、貸出登録で予約を完了させる操作を要求 |
| CM-006 | BC-003 貸出 → BC-005 通知 | Conformist | リマインド対象・延滞判定の結果をそのまま受け取りメールを組み立てる |
| CM-007 | BC-004 予約 → BC-005 通知 | Customer-Supplier | 返却通知対象（順位 1 位）を取得し、送信後に予約中 → 通知済みの遷移を要求 |
| CM-008 | BC-002 利用者 → BC-005 通知 | OHS+PL | 利用者番号から送信先メールアドレスを取得 |
| CM-009 | BC-003 貸出 → BC-006 運営分析 | Conformist | 貸出記録をそのまま読み取り集計 |
| CM-010 | BC-001 蔵書 → BC-006 運営分析 | Conformist | 書籍の状態・ジャンルをそのまま読み取り在庫状況一覧に表示 |

外部システム「メール配信サービス」に対しては BC-005 通知が ACL（confidence: high）で隔離する（tier-external-integration の ACL adapter として表現）。integration_events はすべて空配列（dist-spec で具体化）。

| 集約仮説 | root | invariants | confidence |
|---------|------|-----------|-----------|
| AG-001（BC-001） | E-001 書籍 | 貸出中・予約待ちの書籍は削除不可 / 電子媒体は登録のみ / 状態は 3 値のいずれか 1 つ | low（上限） |
| AG-002（BC-002） | E-003 利用者 | 利用者番号は一意 / 利用者区分=利用者は本人分のみ閲覧 | low（上限） |
| AG-003（BC-003） | E-004 貸出 | 在庫あり + 登録済み利用者のみ貸出可 / 予約待ちは順位 1 位のみ / 返却期限 = 貸出日 + 貸出期間 / 期限超過で延滞 / 返却済みは不変 | low（上限） |
| AG-004（BC-003） | E-005 貸出期間（member: E-006 リマインド日数） | 適用開始日時点で有効な値が 1 つ存在する | low（上限） |
| AG-005（BC-004） | E-007 予約 | 在庫ありの書籍には予約不可 / 順位は受付順・取消時に繰り上げ / 取消・終了は順位対象外 | low（上限） |
| AG-006（BC-005） | E-008 通知 | 同一契機 × 通知種別の重複送信・漏れ防止 / 返却通知は順位 1 位のみ | low（上限） |
| AG-007（BC-006） | E-009 貸出統計 | なし（派生データ。読み取りモデル） | low（上限） |

## システムアーキテクチャ推論

| ティア | テクノロジー候補 | confidence | 根拠 |
|--------|----------------|-----------|------|
| tier-frontend-user 利用者向けフロントエンド | SPA, レスポンシブ Web UI, CDN | high（要否）/ medium（分離） | 社外アクター「利用者」+ NFR E.5.3.1（利用者機能は公開）、F.1.1.x（Web / 主要ブラウザ / PC・タブレット） |
| tier-frontend-staff 司書向けフロントエンド | SPA, レスポンシブ Web UI | medium | 社内アクター「司書」+ NFR E.5.3.1（管理機能は館内限定）。公開経路と物理分離 |
| tier-api-gateway API Gateway | API Gateway / リバースプロキシ, WAF, LB | medium | フロントエンド 2 種 + NFR E.5.3.1 IP 制限 + E.10.1.1 WAF |
| tier-idp IdP | セルフホスト IdP, OAuth2/OIDC | medium | NFR E.5.1.1 ID/パスワード＋ポリシー、社外アクター + E.5 Lv2 で OIDC 推奨 |
| tier-backend-api バックエンド API | CaaS(k8s), コンテナ + LB | medium | NFR A.2.1.1 N+1 冗長・B.3.1.1 スケールアウト。6 BC のモジュラモノリス（F.2.2.1） |
| tier-worker ワーカー | CronJob(k8s), MQ, コンテナワーカー | high（要否）/ medium（MQ） | タイマー起動 4 UC + メール送信 UC 3 件。Queue-Based Load Leveling + DLQ |
| tier-datastore データストア | RDB, KVS, Object Storage | high | 状態モデル + FK を持つ 9 情報 → RDB 正本。冪等キー・セッション・キャッシュ → KVS。A.3.1.1 遠隔地バックアップ → Object Storage |
| tier-external-integration 外部連携 | HTTPS API クライアント, SMTPS クライアント, ACL アダプタ | high（要否） | 外部システム「メール配信サービス」。Retry + Circuit Breaker + Timeout（A.1.2.1） |

認可サービスティアは不要（パターン A: RBAC + Backend 作り込み。所有権ベース条件 1 件のみ）。i18n は日本語のみ（CTP-007, high）。

## アプリケーションアーキテクチャ推論

### tier-backend-api（5 層, confidence: high）

| レイヤー | 責務 | confidence | 根拠 |
|---------|------|-----------|------|
| L-backend-api-presentation | REST 入出力変換、入力バリデーション、認可コンテキスト抽出、アクセスログ + trace_id 伝播 | high | 条件 14 件の入力検証、NFR E.5.2.1 / C.6.1.1 |
| L-backend-api-usecase | UC 単位のフロー制御、トランザクション境界、本人限定判定、監査ログ、通知メッセージ発行 | high | 3 状態モデルへの同期波及（越境状態遷移の単一トランザクション）、条件「利用状況閲覧範囲判定」、NFR E.7.1.1 |
| L-backend-api-domain | 状態遷移、不変条件、ストラテジー、ドメイン例外。BC ごとのモジュール | high | 状態.tsv 3 モデル / 17 遷移行 + 条件.tsv 14 件 |
| L-backend-api-repository | 集約 root 1:1 のデータアクセス、技術例外のラップ、楽観ロック | default / medium | DDD 集約パターン、Event/Snapshot 併用 |
| L-backend-api-gateway | RDB / KVS adapter、MQ client、依存関係ログ、劣化兆候ログ、Cache-Aside | default / medium | NFR B.2.1.1、C.3.x |

### tier-worker（5 層。domain / repository / gateway を Backend API と共有, confidence: high）

| レイヤー | 責務 | confidence | 根拠 |
|---------|------|-----------|------|
| L-worker-presentation | CronJob ハンドラ / MQ コンシューマ、重複検知、バッチサマリログ | high / medium | タイマー起動 4 UC、NFR B.2.2.1 / C.3.3.1 |
| L-worker-usecase | チャンク単位トランザクション、抽出と送信の分離、監査ログ、送信結果反映 | medium / high | 条件「リマインド対象判定」「延滞判定」、NFR B.1.1.4 |
| L-worker-domain | Backend API と同一モジュールを共有 | high | 状態遷移規則の二重実装防止 |
| L-worker-repository | Backend API と共有 + チャンク抽出メソッド | default | バッチ〜10 万件 |
| L-worker-gateway | RDB / KVS / MQ adapter、外部連携アダプタ呼び出し、冪等性 | high / medium | 外部システム「メール配信サービス」、NFR A.1.2.1 |

### tier-frontend-user / tier-frontend-staff（2 層, confidence: medium）

| レイヤー | 責務 | confidence | 根拠 |
|---------|------|-----------|------|
| L-frontend-user-view / L-frontend-staff-view | 画面描画・操作・画面内状態・エラー表示（司書向けは確認ステップ・最少操作・集計の段階表示） | medium | 利用者 UC 6 件 / 司書 UC 18 件（いずれも 20 未満 → 状態管理層なし） |
| L-frontend-user-apiclient / L-frontend-staff-apiclient | Gateway 呼び出し、トークン保持、trace_id・冪等キー付与、エラー正規化 | medium / high | NFR E.5.1.1、CTP-004 冪等性 |

### tier-external-integration（2 層, confidence: medium）

| レイヤー | 責務 | confidence | 根拠 |
|---------|------|-----------|------|
| L-external-integration-adapter | 通知語彙 ↔ メール配信サービス API の ACL 翻訳、Retry + Circuit Breaker + Timeout | medium / high | 外部システム「メール配信サービス」、NFR A.1.2.1 |
| L-external-integration-client | HTTPS / SMTPS SDK ラッパー、TLS1.2+、認証情報注入 | high | NFR E.6.1.2 |

レイヤー間依存は IF なし（直接依存）で開始（CLP-001 ほか, default）。CQRS は不採用（NFR B.1.1.1 Lv1）。

## データアーキテクチャ推論

| エンティティ | model_type | ストレージ | confidence | 根拠 |
|-------------|-----------|----------|-----------|------|
| E-001 書籍 | event_snapshot | rdb | high | 状態.tsv「書籍の状態」あり。FK を持つ正本 |
| E-002 ジャンル | resource_mutable | rdb + cache | high / medium | 8 値の固定マスタ。Cache-Aside（NFR B.2.1.1） |
| E-003 利用者 | event_snapshot | rdb | high | 個人情報の変更履歴追跡（NFR E.1.1.1 / E.1.2.1）。保管時暗号化（E.6.1.1）・マスキング（E.6.2.1） |
| E-004 貸出 | event_snapshot | rdb | high | 状態.tsv「貸出の状態」あり。RPO 数時間（A.4.1.1）の主対象 |
| E-005 貸出期間 | resource_scd2 | rdb + cache | high / medium | 属性「適用開始日」→ 世代管理。現行世代を Cache-Aside |
| E-006 リマインド日数 | resource_scd2 | rdb + cache | high / medium | 同上 |
| E-007 予約 | event_snapshot | rdb | high | 状態.tsv「予約の状態」あり。予約順位の繰り上げにトランザクション |
| E-008 通知 | event | rdb | high | 送信記録は INSERT のみ。重複送信防止の一意制約。個人情報の暗号化 |
| E-009 貸出統計 | resource_mutable | rdb | medium | 貸出からの派生集計（Materialized View）。NFR B.2.1.3 TAT 10 秒以内 |
| E-901 セッション（派生） | resource_mutable | cache | high | 社外アクター + Web ログイン（NFR E.5.1.1）。TTL 付き KVS、スケールアウト時に共有（B.3.1.1） |
| E-902 監査ログ（派生） | event | rdb | medium | NFR E.7.1.1 Lv2（ログイン/ログアウト + データアクセスログ）。INSERT のみ、別スキーマ |
| E-903 認証情報（派生） | resource_mutable | rdb | high | NFR E.5.1.1 ID/パスワード + ポリシー、E.7.2.1 アカウントロック。利用者と 1:1 |

全文検索（search）・Object Storage（file）は不採用（画像・ファイル属性なし。検索は RDB の索引で対応）。

## ユーザー確認による変更

なし（dialogue_policy: auto_adopt。全 Part の全要確認項目（Part0 8 件 / Part1 9 件 / Part2 8 件 / Part3 7 件）で ⭐推奨 Option A を採用。confidence は推論値のまま維持し、user には変更していない）。

### 仮採用した confidence: low の項目（docs/todo.md に登録済み）

| Part | # | 項目 | 仮採用値 | todo |
|------|---|------|---------|------|
| Part0 | 5 | 集約境界（AG-003 貸出 / AG-005 予約）と越境トランザクション | 貸出・予約・書籍を別集約、UC 単位で同期整合 | DIST-017 |
| Part0 | 6 | 集約 invariants（不変条件）16 件 | 条件.tsv からの機械抽出 16 件を採用 | DIST-018 |
| Part0 | 8 | BC の team_ownership | 未定（null） | DIST-019 |
| Part1 | 8 | 書籍検索のストレージ | RDB の索引 + LIKE / 全文検索インデックス（Search Engine なし） | DIST-020 |
| Part1 | 9 | サポート体制と夜間バッチ失敗の運用（CTP-015） | 営業時間内サポート + 翌営業日再実行 | DIST-021 |
| Part2 | 8 | トークン期限接近ログ（LP-004） | presentation 層で WARN 出力 | DIST-023 |
| Part3 | 3 | 貸出統計（E-009）の持ち方 | resource_mutable の集計テーブル（Materialized View） | DIST-022 |

そのほか confidence: low の policy: SP-004 アクセシビリティ目標（NFR F.4.1.x が low 推定）。

## 要確認項目

- 上記の仮採用 low 項目 7 件（DIST-017〜023）は後続の dist-spec / dist-infrastructure / 実装で再判定する
- 集約境界仮説 AG-001〜007 はすべて仮説（confidence: low 上限）。最終確定は dist-spec または ddd-tactical-implementation で行う
- technology_context の言語 / フレームワークは未定。dist-impl の bootstrap 時に確定する
- デプロイ先（クラウド / オンプレ）未定。CaaS(k8s) を第一候補、コンテナ + LB を代替候補として dist-infrastructure で具体化する

## confidence 内訳

| セクション | high | medium | low | default | user | 合計 |
|-----------|:----:|:------:|:---:|:-------:|:----:|:----:|
| ドメインアーキテクチャ | 1 | 20 | 7 | 0 | 0 | 28 |
| システムアーキテクチャ | 16 | 43 | 2 | 10 | 0 | 71 |
| アプリケーションアーキテクチャ | 20 | 49 | 1 | 28 | 0 | 98 |
| データアーキテクチャ | 10 | 5 | 0 | 0 | 0 | 15 |
| 合計 | 47 | 117 | 10 | 38 | 0 | 212 |

（ドメイン = SD 5 + BC 6 + CM 10 + AG 7、システム = SP 29 + SR 19 + CTP 15 + CTR 8、アプリ = LP 42 + LR 31 + CLP 15 + CLR 10、データ = storage_mapping 15 件）
