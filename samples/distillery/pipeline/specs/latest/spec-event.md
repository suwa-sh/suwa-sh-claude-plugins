# Spec Event Summary

## Overview

| 項目 | 内容 |
|------|------|
| Event ID | 20260412_195542_spec_generation |
| Created At | 2026-04-12T19:55:42 |
| Source | RDRA/NFR/Arch/Design モデルからの初期 UC Spec 生成 |
| UC 総数 | 18 |
| API 総数 | 20 |
| 非同期イベント総数 | 2 |
| 業務数 | 6 |
| BUC 数 | 8 |

## UC 一覧

| 業務 | BUC | UC | API数 | 非同期 | インフラ |
|------|-----|-----|:-----:|:-----:|:-------:|
| 蔵書管理業務 | 蔵書管理フロー | 書籍を登録する | 1 | - | - |
| 蔵書管理業務 | 蔵書管理フロー | 書籍情報を編集する | 2 | - | - |
| 蔵書管理業務 | 蔵書管理フロー | 書籍を削除する | 1 | - | - |
| 貸出管理業務 | 貸出管理フロー | 書籍を貸出する | 1 | - | - |
| 貸出管理業務 | 貸出管理フロー | 書籍を返却する | 1 | - | - |
| 貸出管理業務 | 貸出管理フロー | 貸出状況を確認する | 1 | - | - |
| 貸出管理業務 | 延滞管理フロー | 延滞を検出する | 2 | - | - |
| 貸出管理業務 | 延滞管理フロー | 督促通知を送信する | 1 | - | - |
| 予約管理業務 | 予約管理フロー | 書籍を予約する | 1 | - | - |
| 予約管理業務 | 予約管理フロー | 予約通知を送信する | 0 | - | - |
| 予約管理業務 | 予約管理フロー | 予約をキャンセルする | 1 | - | - |
| 利用者管理業務 | 利用者管理フロー | 利用者を登録する | 1 | - | - |
| 利用者管理業務 | 利用者管理フロー | 利用者情報を編集する | 2 | - | - |
| 閲覧業務 | 蔵書検索フロー | 書籍を検索する | 1 | - | - |
| 閲覧業務 | 利用者マイページフロー | 貸出履歴を確認する | 1 | - | - |
| 閲覧業務 | 利用者マイページフロー | 予約状況を確認する | 1 | - | - |
| 統計業務 | 統計・レポートフロー | 在庫状況を確認する | 1 | - | - |
| 統計業務 | 統計・レポートフロー | 統計レポートを閲覧する | 1 | - | - |

## UC ファイル構成

### 蔵書管理業務

#### 蔵書管理フロー

- **書籍を登録する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **書籍情報を編集する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **書籍を削除する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

### 貸出管理業務

#### 貸出管理フロー

- **書籍を貸出する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **書籍を返却する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **貸出状況を確認する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

#### 延滞管理フロー

- **延滞を検出する**: spec.md, tier-frontend.md, tier-backend-api.md, tier-worker.md, _api-summary.yaml, _model-summary.yaml
- **督促通知を送信する**: spec.md, tier-backend-api.md, tier-worker.md, _api-summary.yaml, _model-summary.yaml

### 予約管理業務

#### 予約管理フロー

- **書籍を予約する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **予約通知を送信する**: spec.md, tier-backend-api.md, tier-worker.md, _api-summary.yaml, _model-summary.yaml
- **予約をキャンセルする**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

### 利用者管理業務

#### 利用者管理フロー

- **利用者を登録する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **利用者情報を編集する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

### 閲覧業務

#### 蔵書検索フロー

- **書籍を検索する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

#### 利用者マイページフロー

- **貸出履歴を確認する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **予約状況を確認する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

### 統計業務

#### 統計・レポートフロー

- **在庫状況を確認する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml
- **統計レポートを閲覧する**: spec.md, tier-frontend.md, tier-backend-api.md, _api-summary.yaml, _model-summary.yaml

## 全体横断仕様

### UX Design

- User Flows: 8
- IA Pages: 16
- Psychology Principles: 8

### UI Design

- Layout Patterns: 2
- Responsive Breakpoints: 3
- Component Guidelines: 9

### Data Visualization

- Target Screens: 2
- Chart Types: 5
