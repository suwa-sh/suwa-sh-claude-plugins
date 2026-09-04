# Spec 生成 分析根拠

design_available: true
event_id: 20260903_044456_spec_generation

## 分析日時

2026-09-03T04:44:56

## 入力

| 入力 | パス | 備考 |
|------|------|------|
| RDRA | `docs/rdra/latest/*.tsv`, `システム概要.json` | 6 業務 / 10 BUC / 27 UC / 9 情報 / 3 状態モデル / 14 条件 / 6 バリエーション / 1 外部システム |
| NFR | `docs/nfr/latest/nfr-grade.yaml` | `_inputs-digest.md` に A / B / E を転写 |
| Arch | `docs/arch/latest/arch-design.yaml` | `_inputs-digest.md` に technology_context / domain_architecture / tiers / tier_layers / entities を転写 |
| Design | `docs/design/latest/design-event.yaml` | brand.name = `Libro`、portals = patron（利用者）/ staff（司書）、24 画面 |

システム名の使い分け: API ドメイン・OpenAPI info.title は `Libro`、仕様書見出し・UI ラベルは `図書館蔵書管理システム`。

## UC 一覧（業務 / BUC / UC）

```
蔵書管理業務
  蔵書を管理するフロー
    書籍一覧を参照する      [司書] 画面: 蔵書一覧画面
    書籍を登録する          [司書] 画面: 書籍登録画面
    書籍を編集する          [司書] 画面: 書籍編集画面
    書籍を削除する          [司書] 画面: 書籍削除確認画面
  書籍を検索するフロー
    書籍を検索する          [利用者 / 司書] 画面: 蔵書検索画面 / 窓口蔵書検索画面
    書籍詳細を参照する      [利用者] 画面: 書籍詳細・在庫状況画面
利用者管理業務
  利用者を管理するフロー
    利用者を登録する        [司書] 画面: 利用者登録画面
    利用者を編集する        [司書] 画面: 利用者編集画面
    利用者を削除する        [司書] 画面: 利用者削除確認画面
    利用者一覧を参照する    [司書] 画面: 利用者一覧画面
貸出業務
  書籍を貸し出すフロー
    貸出を登録する          [司書] 画面: 貸出受付画面
  書籍を返却するフロー
    返却を登録する          [司書] 画面: 返却受付画面
    返却通知を送信する      [司書] 画面: 返却通知送信確認画面 / イベント: 返却通知メール配信 → メール配信サービス
  書籍を予約するフロー
    予約を登録する          [利用者] 画面: 予約申込画面
    予約を取り消す          [利用者] 画面: 予約取消画面
    予約一覧を参照する      [司書] 画面: 書籍別予約状況画面
期限管理業務
  返却期限を通知するフロー
    リマインド対象を抽出する [タイマー] 日次リマインド抽出バッチ
    リマインドを送信する    [タイマー] 日次リマインド送信バッチ / イベント: 返却期限リマインドメール配信 → メール配信サービス
  延滞者に督促するフロー
    延滞を判定する          [タイマー] 日次延滞判定バッチ
    督促を送信する          [タイマー] 日次督促送信バッチ / イベント: 延滞督促メール配信 → メール配信サービス
    延滞一覧を参照する      [司書] 画面: 延滞・督促状況画面
利用者サービス業務
  自分の利用状況を確認するフロー
    貸出履歴を参照する      [利用者] 画面: マイ貸出履歴画面
    予約状況を参照する      [利用者] 画面: マイ予約状況画面
    利用者の利用状況を参照する [司書] 画面: 窓口利用状況照会画面
運営分析業務
  蔵書の利用状況を分析するフロー
    在庫状況一覧を参照する  [司書] 画面: 在庫状況一覧画面
    人気書籍ランキングを参照する [司書] 画面: 人気書籍ランキング画面
    期間別貸出統計を参照する [司書] 画面: 期間別貸出統計画面
```

UC 数: 27（BUC.tsv の UC 列が空の行 = システムを使わない作業 7 件は対象外）。

## arch ティア構成と kind 判定

| tier_id | 名称 | technology_candidates | kind | UC Spec 対象 |
|---------|------|----------------------|------|:---:|
| tier-frontend-user | 利用者向けフロントエンド | SPA / レスポンシブ Web UI / CDN | presentation（user） | 対象 |
| tier-frontend-staff | 司書向けフロントエンド | SPA / レスポンシブ Web UI | presentation（admin） | 対象 |
| tier-api-gateway | API Gateway | API Gateway / WAF / LB | インフラ | 対象外（cross-cutting） |
| tier-idp | IdP | セルフホスト IdP / OAuth2/OIDC | インフラ | 対象外（cross-cutting） |
| tier-backend-api | Backend API | CaaS(k8s) / コンテナ + LB | api | 対象 |
| tier-worker | ワーカー | CronJob(k8s) / MQ / コンテナワーカー | worker | 対象 |
| tier-datastore | データストア | RDB / KVS / Object Storage | インフラ | 対象外（cross-cutting datastore） |
| tier-external-integration | 外部連携 | HTTPS API クライアント / SMTPS / ACL | インフラ | 対象外（worker の gateway 層で扱う） |

## UC-ティアマッピング

| UC | パターン | 対象ティア (kind) |
|----|---------|------------------|
| 書籍一覧を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 書籍を登録する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 書籍を編集する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 書籍を削除する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 書籍を検索する | 画面あり（社外 + 社内） | tier-frontend-user (presentation), tier-frontend-staff (presentation), tier-backend-api (api) |
| 書籍詳細を参照する | 画面あり（社外） | tier-frontend-user (presentation), tier-backend-api (api) |
| 利用者を登録する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者を編集する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者を削除する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 利用者一覧を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 貸出を登録する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 返却を登録する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 返却通知を送信する | 画面あり（社内）+ 外部連携 | tier-frontend-staff (presentation), tier-backend-api (api), tier-worker (worker) |
| 予約を登録する | 画面あり（社外） | tier-frontend-user (presentation), tier-backend-api (api) |
| 予約を取り消す | 画面あり（社外） | tier-frontend-user (presentation), tier-backend-api (api) |
| 予約一覧を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| リマインド対象を抽出する | タイマートリガー | tier-worker (worker), tier-backend-api (api) |
| リマインドを送信する | タイマートリガー + 外部連携 | tier-worker (worker), tier-backend-api (api) |
| 延滞を判定する | タイマートリガー | tier-worker (worker), tier-backend-api (api) |
| 督促を送信する | タイマートリガー + 外部連携 | tier-worker (worker), tier-backend-api (api) |
| 延滞一覧を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 貸出履歴を参照する | 画面あり（社外） | tier-frontend-user (presentation), tier-backend-api (api) |
| 予約状況を参照する | 画面あり（社外） | tier-frontend-user (presentation), tier-backend-api (api) |
| 利用者の利用状況を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 在庫状況一覧を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 人気書籍ランキングを参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |
| 期間別貸出統計を参照する | 画面あり（社内） | tier-frontend-staff (presentation), tier-backend-api (api) |

タイマー UC の api ティア: worker は Backend API のモジュール（usecase / domain / repository）を同一コードベースで呼ぶ想定（arch SP-014 モジュラモノリス）。tier-backend-api.md にはバッチが利用する内部ユースケースとデータモデルを記述し、外部公開 API は最小限（延滞一覧参照用の読み取り）に留める。

## UC-画面マッピング（design-event.yaml screens）

| UC | RDRA 画面 | ポータル |
|----|----------|---------|
| 書籍を検索する | 蔵書検索画面 / 窓口蔵書検索画面 | patron / staff |
| 書籍詳細を参照する | 書籍詳細・在庫状況画面 | patron |
| 予約を登録する | 予約申込画面 | patron |
| 予約を取り消す | 予約取消画面 | patron |
| 貸出履歴を参照する | マイ貸出履歴画面 | patron |
| 予約状況を参照する | マイ予約状況画面 | patron |
| 書籍一覧を参照する / 登録 / 編集 / 削除 | 蔵書一覧画面 / 書籍登録画面 / 書籍編集画面 / 書籍削除確認画面 | staff |
| 利用者一覧 / 登録 / 編集 / 削除 | 利用者一覧画面 / 利用者登録画面 / 利用者編集画面 / 利用者削除確認画面 | staff |
| 貸出を登録する / 返却を登録する / 返却通知を送信する | 貸出受付画面 / 返却受付画面 / 返却通知送信確認画面 | staff |
| 予約一覧を参照する / 延滞一覧を参照する / 利用者の利用状況を参照する | 書籍別予約状況画面 / 延滞・督促状況画面 / 窓口利用状況照会画面 | staff |
| 在庫状況一覧 / 人気書籍ランキング / 期間別貸出統計 | 在庫状況一覧画面 / 人気書籍ランキング画面 / 期間別貸出統計画面 | staff |

design の 24 画面と RDRA の 24 画面は 1:1 で対応する。

## API エンドポイント推定（REST / リソース複数形 / kebab-case）

| リソース | 主なエンドポイント | UC |
|---------|------------------|----|
| /books | GET /books（一覧・検索）, POST /books, GET /books/{bookId}, PUT /books/{bookId}, DELETE /books/{bookId} | 蔵書管理・検索 |
| /genres | GET /genres | 書籍登録・検索の選択肢 |
| /patrons | GET /patrons, POST /patrons, GET /patrons/{patronId}, PUT, DELETE | 利用者管理 |
| /loans | POST /loans, POST /loans/{loanId}/return, GET /loans（延滞一覧 / 利用状況） | 貸出・返却・延滞 |
| /me/loans, /me/reservations | GET | 利用者サービス（本人限定） |
| /reservations | POST /reservations, POST /reservations/{reservationId}/cancel, GET /books/{bookId}/reservations | 予約 |
| /notifications/return-notices | POST（返却通知送信の確定） | 返却通知 |
| /reports/inventory, /reports/popular-books, /reports/loan-statistics | GET | 運営分析 |

詳細は Step3 の `_api-summary.yaml` で確定し、Step4a で openapi.yaml に統合する。

## 非同期イベント

| イベント | 発行契機 | 消費者 | 外部システム |
|---------|---------|-------|------------|
| ReturnNoticeRequested（返却通知メール配信） | 返却通知送信の確定（API） | tier-worker（通知送信） | メール配信サービス |
| ReminderMailRequested（返却期限リマインドメール配信） | 日次リマインド抽出バッチ | tier-worker（リマインド送信） | メール配信サービス |
| OverdueNoticeRequested（延滞督促メール配信） | 日次延滞判定バッチ | tier-worker（督促送信） | メール配信サービス |

MQ は arch tier-worker の technology_candidates（MQ）に基づく。

## 全体横断設計方針

### ユーザーフロー

- 利用者: 検索 → 詳細/在庫状況 → 予約申込 → マイ予約状況 → 返却通知（メール）→ 来館
- 利用者: ログイン → マイ貸出履歴 / マイ予約状況 → 予約取消
- 司書（窓口）: 貸出受付 / 返却受付 → 返却通知送信確認、窓口蔵書検索、窓口利用状況照会
- 司書（管理）: 蔵書一覧 → 登録/編集/削除、利用者一覧 → 登録/編集/削除
- 司書（監視・分析）: 延滞・督促状況、書籍別予約状況、在庫状況一覧 / 人気書籍ランキング / 期間別貸出統計

### 情報アーキテクチャ

- 利用者ポータル（patron, 6 画面）: 蔵書検索 / 書籍詳細 / 予約申込 / 予約取消 / マイ貸出履歴 / マイ予約状況
- 司書ポータル（staff, 18 画面）: 窓口（貸出・返却・返却通知・窓口検索・窓口照会）/ 蔵書管理 / 利用者管理 / 予約・延滞状況 / 分析レポート

### データ可視化対象

| 画面 | 指標 |
|------|------|
| 在庫状況一覧画面 | 書籍の状態別件数（在庫あり / 貸出中 / 予約待ち） |
| 人気書籍ランキング画面 | 書籍別貸出回数（上位 N） |
| 期間別貸出統計画面 | 集計期間種別（日 / 月 / 年）ごとの貸出件数推移 |
| 延滞・督促状況画面 | 延滞件数 / 督促送信状況 |

## NFR 反映事項

| NFR | 反映 |
|-----|------|
| A（可用性） | API ステートレス N+1、バッチは冪等・再実行可能 |
| B.2.1.1 / B.2.1.3 | 利用者画面 5 秒以内、集計画面 10 秒以内 → 一覧はページネーション、統計は集計テーブル |
| E.5.1.1 / E.5.2.1 | IdP トークンの利用者区分クレームで粗粒度 RBAC、本人限定判定は Backend API |
| E.1.2.1 / E.6.1.1 | 個人情報は既定で伏せる（マスク表示）、ブラウザ永続化禁止 |
| E.7.1.1 / C.6.1.2 | 監査ログ（ログイン、データアクセス）、trace_id 伝播 |

## 確認推奨項目（dialogue_policy: auto_adopt で ⭐推奨を採用）

### 1: API 命名規則
- **Option A** (⭐推奨): REST / リソース名は複数形 kebab-case / JSON フィールドは camelCase / ID は `{resource}Id` — SPA + 汎用 Web フレームワークと OpenAPI codegen に最も相性がよい
- **Option B**: REST / snake_case JSON — Python 系バックエンドで自然だが、TypeScript フロントで変換層が必要
- **Option C**: GraphQL 単一エンドポイント — 画面主導の取得に柔軟だが、27 UC の小規模では複雑性が過剰

**推奨理由**: medium — arch technology_context「REST + ORM を持つ汎用 Web フレームワーク」と tier-frontend の SPA から推論。言語未定のため camelCase を JSON の共通言語とする

### 2: エラーハンドリング戦略
- **Option A** (⭐推奨): RFC 9457 `application/problem+json` + 業務エラーコード（例 `BOOK_NOT_AVAILABLE`）/ 400 入力 / 401 未認証 / 403 権限 / 404 不在 / 409 業務ルール違反 / 422 検証 — 司書向け「判定結果と根拠を同時に示す」ブランド原則に合致
- **Option B**: 独自エラー封筒 `{code, message}` を 200 で返す — 実装は簡単だがクライアント・監視でステータス判定が使えない
- **Option C**: 例外を HTTP 500 に集約 — 業務エラーと障害が区別できず NFR C（運用）に不利

**推奨理由**: medium — design brand.voice「判定結果と根拠を同時に示す」と条件.tsv の可否判定（貸出可否 / 予約可否）から、業務ルール違反を 409 + code で返す方針を推論

### 3: RDB 正規化レベル
- **Option A** (⭐推奨): 第 3 正規形を基本、`貸出統計` のみ集計テーブル（非正規化）として保持 — NFR B.2.1.3 集計 10 秒以内と arch DIST-022 の仮採用に整合
- **Option B**: 完全 3NF（貸出統計はオンデマンド集計ビュー） — 単純だが蔵書規模が不明で 10 秒以内が保証できない
- **Option C**: 一覧画面向けに書籍へ貸出回数などを非正規化 — 読み取りは速いが更新整合が複雑

**推奨理由**: medium — arch data_architecture.entities（貸出統計 = resource_mutable 集計テーブル）と NFR B.2.1.3 から推論

### 4: ページネーション方式
- **Option A** (⭐推奨): offset / limit（`page`, `pageSize`, 既定 20, 上限 100）+ `totalCount` — 司書の一覧画面でページ番号表示が必要
- **Option B**: カーソル方式 — 大規模データに強いが、ページ番号 UI と相性が悪い
- **Option C**: ページネーションなし（全件） — 1 館規模なら可能だが NFR B.2.1.1 5 秒以内を蔵書増で破る

**推奨理由**: medium — arch SP-002「一覧のページネーションを標準」と design の一覧画面（Pagination コンポーネント）から推論

### 5: 予約順位の保持方式
- **Option A** (⭐推奨): `予約.予約順位` を永続化し、取消時に後続の順位をトランザクション内で繰り上げる — RDRA 条件「予約順位決定」の記述どおりで、画面表示も単純
- **Option B**: 順位は保持せず受付日時から都度算出 — 更新は不要だが情報.tsv の属性「予約順位」と不整合
- **Option C**: 順位保持 + 非同期で再計算 — 一貫性が一時的に崩れ、利用者画面で順位が古くなる

**推奨理由**: high — 情報.tsv「予約.予約順位」と条件.tsv「予約順位決定」から直接導出

### 6: 通知送信の同期 / 非同期境界
- **Option A** (⭐推奨): API / バッチは通知レコードを作成し MQ に発行、worker がメール配信サービスへ送信して送信結果を更新する — 外部システム障害を UC の同期処理から切り離せる（arch tier-worker: MQ）
- **Option B**: API から同期でメール送信 — 単純だが外部障害で返却登録が失敗する
- **Option C**: worker が通知テーブルをポーリング — MQ 不要だが遅延と二重送信防止の実装が増える

**推奨理由**: medium — arch tier-worker technology_candidates（MQ）と NFR A（外部連携の障害分離）から推論

### 7: 利用者削除時の貸出中・予約中の扱い
- **Option A** (⭐推奨): 貸出中 / 延滞の貸出、または予約中 / 通知済みの予約がある利用者は削除不可（409） — FK 整合性と書籍状態の破綻を防ぐ保守的な扱い
- **Option B**: 削除時に予約を取消・貸出は返却済み扱いにして連鎖処理 — 業務上の判断を自動化してしまう
- **Option C**: 制約なしで削除（貸出・予約は利用者番号だけ残す） — 情報.tsv の関連（貸出→利用者）が孤児化する

**推奨理由**: low — RDRA 条件.tsv に利用者削除の可否条件は無い（書籍削除には「貸出中・予約待ちは削除不可」がある）。保守的に Option A を仮採用し、todo.md に RDRA 追加提案として登録

### 8: 書籍検索のキーワード照合方式
- **Option A** (⭐推奨): タイトル・著者・出版社・ISBN に対する部分一致（大文字小文字・全角半角を正規化） — RDB 索引 + LIKE で実装可能（arch DIST-020 の仮採用に整合）
- **Option B**: 完全一致のみ — 実装は軽いが利用者の検索体験が悪い
- **Option C**: 形態素解析つき全文検索 — 表記揺れに強いが Search Engine が必要

**推奨理由**: low — 条件.tsv「書籍検索条件判定」は照合方式（部分一致 / 完全一致）を規定していない。保守的に部分一致を仮採用し todo.md に登録
