# Spec Event Summary

## Overview

| 項目 | 内容 |
|------|------|
| Event ID | 20260903_044456_spec_generation |
| Created At | 2026-09-03T04:44:56+09:00 |
| Source | Spec 生成: dist-pipeline Step6 (dist-spec) による RDRA / NFR / Arch / Design からの UC 単位詳細仕様・全体横断仕様の初回生成。trigger_event: rdra=20260903_030744_initial_build, arch=20260903_041150_arch_infra_feedback_20260903_040307_infra_product_design, design=20260903_041812_design_system |
| UC 総数 | 27 |
| API 総数 | 30 |
| 非同期イベント総数 | 13 |
| 業務数 | 6 |
| BUC 数 | 10 |

## UC 一覧

| 業務 | BUC | UC | API数 | 非同期 | インフラ |
|------|-----|-----|:-----:|:-----:|:-------:|
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍一覧を参照する | 2 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍を登録する | 1 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍を編集する | 2 | - | - |
| 蔵書管理業務 | 蔵書を管理するフロー | 書籍を削除する | 1 | - | - |
| 蔵書管理業務 | 書籍を検索するフロー | 書籍を検索する | 2 | - | - |
| 蔵書管理業務 | 書籍を検索するフロー | 書籍詳細を参照する | 1 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者を登録する | 1 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者を編集する | 2 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者を削除する | 2 | - | - |
| 利用者管理業務 | 利用者を管理するフロー | 利用者一覧を参照する | 1 | - | - |
| 貸出業務 | 書籍を貸し出すフロー | 貸出を登録する | 2 | - | - |
| 貸出業務 | 書籍を返却するフロー | 返却を登録する | 2 | - | - |
| 貸出業務 | 書籍を返却するフロー | 返却通知を送信する | 2 | - | - |
| 貸出業務 | 書籍を予約するフロー | 予約を登録する | 2 | - | - |
| 貸出業務 | 書籍を予約するフロー | 予約を取り消す | 2 | - | - |
| 貸出業務 | 書籍を予約するフロー | 予約一覧を参照する | 1 | - | - |
| 期限管理業務 | 返却期限を通知するフロー | リマインド対象を抽出する | 0 | - | - |
| 期限管理業務 | 返却期限を通知するフロー | リマインドを送信する | 0 | - | - |
| 期限管理業務 | 延滞者に督促するフロー | 延滞を判定する | 0 | - | - |
| 期限管理業務 | 延滞者に督促するフロー | 督促を送信する | 0 | - | - |
| 期限管理業務 | 延滞者に督促するフロー | 延滞一覧を参照する | 2 | - | - |
| 利用者サービス業務 | 自分の利用状況を確認するフロー | 予約状況を参照する | 1 | - | - |
| 利用者サービス業務 | 自分の利用状況を確認するフロー | 利用者の利用状況を参照する | 1 | - | - |
| 利用者サービス業務 | 自分の利用状況を確認するフロー | 貸出履歴を参照する | 1 | - | - |
| 運営分析業務 | 蔵書の利用状況を分析するフロー | 人気書籍ランキングを参照する | 1 | - | - |
| 運営分析業務 | 蔵書の利用状況を分析するフロー | 在庫状況一覧を参照する | 1 | - | - |
| 運営分析業務 | 蔵書の利用状況を分析するフロー | 期間別貸出統計を参照する | 1 | - | - |

## UC ファイル構成

### 蔵書管理業務

#### 蔵書を管理するフロー

- **書籍一覧を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **書籍を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **書籍を編集する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **書籍を削除する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

#### 書籍を検索するフロー

- **書籍を検索する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-frontend-user.md
- **書籍詳細を参照する**: spec.md, tier-backend-api.md, tier-frontend-user.md

### 利用者管理業務

#### 利用者を管理するフロー

- **利用者を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **利用者を編集する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **利用者を削除する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **利用者一覧を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

### 貸出業務

#### 書籍を貸し出すフロー

- **貸出を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

#### 書籍を返却するフロー

- **返却を登録する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **返却通知を送信する**: spec.md, tier-backend-api.md, tier-frontend-staff.md, tier-worker.md

#### 書籍を予約するフロー

- **予約を登録する**: spec.md, tier-backend-api.md, tier-frontend-user.md
- **予約を取り消す**: spec.md, tier-backend-api.md, tier-frontend-user.md
- **予約一覧を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

### 期限管理業務

#### 返却期限を通知するフロー

- **リマインド対象を抽出する**: spec.md, tier-backend-api.md, tier-worker.md
- **リマインドを送信する**: spec.md, tier-backend-api.md, tier-worker.md

#### 延滞者に督促するフロー

- **延滞を判定する**: spec.md, tier-backend-api.md, tier-worker.md
- **督促を送信する**: spec.md, tier-backend-api.md, tier-worker.md
- **延滞一覧を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

### 利用者サービス業務

#### 自分の利用状況を確認するフロー

- **予約状況を参照する**: spec.md, tier-backend-api.md, tier-frontend-user.md
- **利用者の利用状況を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **貸出履歴を参照する**: spec.md, tier-backend-api.md, tier-frontend-user.md

### 運営分析業務

#### 蔵書の利用状況を分析するフロー

- **人気書籍ランキングを参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **在庫状況一覧を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md
- **期間別貸出統計を参照する**: spec.md, tier-backend-api.md, tier-frontend-staff.md

## 全体横断仕様

### UX Design

- User Flows: 6
- IA Pages: 24
- Psychology Principles: 10

### UI Design

- Layout Patterns: 2
- Responsive Breakpoints: 4
- Component Guidelines: 18

### Data Visualization

- Target Screens: 4
- Chart Types: 5
