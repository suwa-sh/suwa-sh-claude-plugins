# Spec Event Summary

## Overview

| 項目 | 内容 |
|------|------|
| Event ID | 20260902_152849_spec_generation |
| Created At | 2026-09-02T08:09:38 |
| Source | Spec 生成: dist-pipeline Step6 (dist-spec) による UC 単位詳細仕様と全体横断 UX/UI 設計の初期生成。trigger_event: rdra=20260902_130741_initial_build, arch=20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design, design=20260902_145539_design_system |
| UC 総数 | 41 |
| API 総数 | 53 |
| 非同期イベント総数 | 6 |
| 業務数 | 7 |
| BUC 数 | 13 |

## UC 一覧

| 業務 | BUC | UC | API数 | 非同期 | インフラ |
|------|-----|-----|:-----:|:-----:|:-------:|
| 予約管理業務 | 予約者へ通知するフロー | 予約順1位の利用者を特定する | 2 | - | - |
| 予約管理業務 | 予約者へ通知するフロー | 取置き通知メールを送信する | 3 | - | - |
| 予約管理業務 | 予約者へ通知するフロー | 自分の取置き状況を照会する | 1 | - | - |
| 予約管理業務 | 書籍を予約するフロー | 予約を取り消す | 1 | - | - |
| 予約管理業務 | 書籍を予約するフロー | 予約を登録する | 1 | - | - |
| 予約管理業務 | 書籍を予約するフロー | 自分の予約順位を照会する | 1 | - | - |
| 利用照会業務 | 予約状況を確認するフロー | 自分の予約状況を照会する | 1 | - | - |
| 利用照会業務 | 予約状況を確認するフロー | 自分の取置き中の予約を照会する | 1 | - | - |
| 利用照会業務 | 貸出履歴を確認するフロー | 自分の現在の貸出を照会する | 1 | - | - |
| 利用照会業務 | 貸出履歴を確認するフロー | 自分の貸出履歴を照会する | 1 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者を削除する | 1 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者を登録する | 1 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者一覧を照会する | 1 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者情報を編集する | 2 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 自分の利用者情報を照会する | 1 | - | - |
| 蔵書分析業務 | 在庫状況を把握するフロー | 在庫状況を区分別に集計する | 1 | - | - |
| 蔵書分析業務 | 在庫状況を把握するフロー | 在庫状況レポートを参照する | 2 | - | - |
| 蔵書分析業務 | 貸出統計を把握するフロー | 期間別貸出統計を集計する | 1 | - | - |
| 蔵書分析業務 | 貸出統計を把握するフロー | 貸出統計レポートを参照する | 2 | - | - |
| 蔵書利用業務 | 書籍を検索するフロー | 司書向けに蔵書を検索する | 1 | - | - |
| 蔵書利用業務 | 書籍を検索するフロー | 書籍を検索する | 1 | - | - |
| 蔵書利用業務 | 書籍を検索するフロー | 書籍詳細と在庫状況を照会する | 1 | - | - |
| 蔵書利用業務 | 書籍を貸し出すフロー | 利用者番号で貸出対象利用者を特定する | 2 | - | - |
| 蔵書利用業務 | 書籍を貸し出すフロー | 書籍の貸出可否を判定する | 1 | - | - |
| 蔵書利用業務 | 書籍を貸し出すフロー | 自分の貸出内容と返却期限を照会する | 1 | - | - |
| 蔵書利用業務 | 書籍を貸し出すフロー | 貸出を登録する | 1 | - | - |
| 蔵書利用業務 | 書籍を返却するフロー | 自分の返却済み貸出を照会する | 1 | - | - |
| 蔵書利用業務 | 書籍を返却するフロー | 返却を登録する | 2 | - | - |
| 蔵書利用業務 | 書籍を返却するフロー | 返却対象の貸出を照会する | 1 | - | - |
| 蔵書利用業務 | 書籍を返却するフロー | 返却後の書籍状態を更新する | 1 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍を削除する | 2 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍を登録する | 1 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍情報を編集する | 2 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 蔵書一覧を照会する | 1 | - | - |
| 貸出期限管理業務 | 延滞を督促するフロー | 延滞中の貸出を照会する | 1 | - | - |
| 貸出期限管理業務 | 延滞を督促するフロー | 期限超過の貸出を延滞にする | 1 | - | - |
| 貸出期限管理業務 | 延滞を督促するフロー | 督促メールを送信する | 2 | - | - |
| 貸出期限管理業務 | 延滞を督促するフロー | 自分の延滞中の貸出を照会する | 1 | - | - |
| 貸出期限管理業務 | 返却期限をリマインドするフロー | リマインドメールを送信する | 2 | - | - |
| 貸出期限管理業務 | 返却期限をリマインドするフロー | 自分の返却期限を照会する | 1 | - | - |
| 貸出期限管理業務 | 返却期限をリマインドするフロー | 返却期限接近の貸出を判定する | 1 | - | - |

## UC ファイル構成

### 予約管理業務

#### 予約者へ通知するフロー

- **予約順1位の利用者を特定する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **取置き通知メールを送信する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md
- **自分の取置き状況を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

#### 書籍を予約するフロー

- **予約を取り消す**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **予約を登録する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **自分の予約順位を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

### 利用照会業務

#### 予約状況を確認するフロー

- **自分の予約状況を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **自分の取置き中の予約を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

#### 貸出履歴を確認するフロー

- **自分の現在の貸出を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **自分の貸出履歴を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

### 利用者管理業務

#### 利用者を管理するフロー

- **利用者を削除する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **利用者を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **利用者一覧を照会する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **利用者情報を編集する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **自分の利用者情報を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

### 蔵書分析業務

#### 在庫状況を把握するフロー

- **在庫状況を区分別に集計する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md
- **在庫状況レポートを参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

#### 貸出統計を把握するフロー

- **期間別貸出統計を集計する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md
- **貸出統計レポートを参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

### 蔵書利用業務

#### 書籍を検索するフロー

- **司書向けに蔵書を検索する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **書籍を検索する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **書籍詳細と在庫状況を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

#### 書籍を貸し出すフロー

- **利用者番号で貸出対象利用者を特定する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **書籍の貸出可否を判定する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **自分の貸出内容と返却期限を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **貸出を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

#### 書籍を返却するフロー

- **自分の返却済み貸出を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **返却を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **返却対象の貸出を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **返却後の書籍状態を更新する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

### 蔵書管理業務

#### 蔵書を管理するフロー

- **書籍を削除する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **書籍を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **書籍情報を編集する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **蔵書一覧を照会する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

### 貸出期限管理業務

#### 延滞を督促するフロー

- **延滞中の貸出を照会する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **期限超過の貸出を延滞にする**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md
- **督促メールを送信する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md
- **自分の延滞中の貸出を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md

#### 返却期限をリマインドするフロー

- **リマインドメールを送信する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md
- **自分の返却期限を照会する**: spec.md, tier-backend-api.md, tier-frontend-patron.md
- **返却期限接近の貸出を判定する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md

## 全体横断仕様

### UX Design

- User Flows: 8
- IA Pages: 41
- Psychology Principles: 11

### UI Design

- Layout Patterns: 2
- Responsive Breakpoints: 5
- Component Guidelines: 17

### Data Visualization

- Target Screens: 7
- Chart Types: 5
