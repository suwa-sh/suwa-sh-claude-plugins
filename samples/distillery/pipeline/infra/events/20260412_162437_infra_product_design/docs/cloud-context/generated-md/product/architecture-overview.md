# 図書館蔵書管理システム - AWS インフラアーキテクチャ

## 概要

図書館の蔵書と利用者を一元管理する Web システム。コスト最適化優先の Serverless アーキテクチャを採用し、AWS の従量課金サービスを中心に構成する。

| 項目 | 値 |
|------|-----|
| ワークロードタイプ | Web App (SSR + REST API) |
| 可用性目標 | 99.9% SLA |
| レイテンシ目標 | p99 < 1s |
| コスト方針 | コスト最適化優先 |
| 推定月額コスト | $50-80 |
| 対象クラウド | AWS (ap-northeast-1) |

## ワークロード全体構成図

```mermaid
graph TD
    subgraph "Public"
        User[利用者/司書<br/>ブラウザ]
    end

    subgraph "AWS ap-northeast-1"
        subgraph "Public Subnet"
            AR[App Runner<br/>Next.js SSR]
            APIGW[API Gateway<br/>REST API v1]
        end

        subgraph "Private Subnet"
            LB[Lambda<br/>Backend API]
            LW_BATCH[Lambda<br/>延滞検出バッチ]
            LW_EMAIL[Lambda<br/>メール送信ワーカー]
            RDS[(RDS PostgreSQL<br/>db.t4g.micro Multi-AZ)]
            REDIS[(ElastiCache Redis<br/>cache.t4g.micro)]
        end

        COG[Cognito<br/>User Pool]
        SQS[SQS FIFO<br/>通知キュー]
        SES[SES<br/>メール送信]
        EB[EventBridge<br/>Scheduler]
        CW[CloudWatch<br/>監視/ログ/アラーム]
        SM[Secrets Manager]
    end

    User -->|HTTPS| AR
    User -->|HTTPS| APIGW
    User -->|認証| COG
    AR -->|REST API| APIGW
    APIGW --> LB
    LB --> RDS
    LB --> REDIS
    LB -->|メッセージ発行| SQS
    LB -->|トークン検証| COG
    LB -->|DB認証情報| SM
    EB -->|日次 21:00 JST| LW_BATCH
    LW_BATCH --> RDS
    LW_BATCH -->|通知メッセージ| SQS
    SQS --> LW_EMAIL
    LW_EMAIL --> SES
    SES -->|メール| User
    LB --> CW
    LW_BATCH --> CW
    LW_EMAIL --> CW
```

## リクエストフロー図

```mermaid
sequenceDiagram
    actor User as 利用者
    participant AR as App Runner<br/>(Next.js SSR)
    participant APIGW as API Gateway
    participant Lambda as Lambda<br/>(Backend API)
    participant Cognito as Cognito
    participant Redis as ElastiCache<br/>(Redis)
    participant RDS as RDS<br/>(PostgreSQL)

    User->>AR: ページリクエスト (HTTPS)
    AR->>APIGW: API コール
    APIGW->>Lambda: プロキシ統合

    Note over Lambda: 認証チェック
    Lambda->>Cognito: トークン検証
    Cognito-->>Lambda: 検証結果 + ユーザー情報

    Note over Lambda: 冪等キーチェック
    Lambda->>Redis: GET idempotency:{key}
    Redis-->>Lambda: null (新規リクエスト)

    Note over Lambda: ビジネスロジック実行
    Lambda->>RDS: BEGIN TRANSACTION
    Lambda->>RDS: INSERT/UPDATE (状態遷移)
    Lambda->>RDS: COMMIT

    Note over Lambda: 冪等キー登録
    Lambda->>Redis: SETEX idempotency:{key} 86400

    Lambda-->>APIGW: JSON レスポンス
    APIGW-->>AR: レスポンス
    AR-->>User: HTML レスポンス
```

## バッチ処理フロー図

```mermaid
sequenceDiagram
    participant EB as EventBridge<br/>Scheduler
    participant LB as Lambda<br/>(延滞検出)
    participant RDS as RDS<br/>(PostgreSQL)
    participant SQS as SQS FIFO
    participant LW as Lambda<br/>(メール送信)
    participant SES as SES

    Note over EB: 毎日 21:00 JST
    EB->>LB: スケジュール起動

    LB->>RDS: 返却期限超過の貸出を検索
    RDS-->>LB: 延滞候補リスト

    loop 延滞候補ごと
        LB->>RDS: 延滞フラグ更新
        LB->>SQS: 督促通知メッセージ発行
    end

    SQS->>LW: メッセージ受信 (バッチサイズ: 10)
    LW->>SES: メール送信
    SES-->>LW: 送信結果
```

## AWS サービス構成図

```mermaid
graph TD
    subgraph "Compute"
        AR[App Runner<br/>0.25 vCPU / 0.5 GB<br/>min:1 max:4]
        APIGW[API Gateway<br/>REST API]
        LB[Lambda Backend<br/>512 MB / 29s timeout<br/>reserved: 10]
        LWB[Lambda Batch<br/>1024 MB / 900s timeout]
        LWE[Lambda Email<br/>256 MB / 60s timeout<br/>reserved: 5]
    end

    subgraph "Data Store"
        RDS[(RDS PostgreSQL 16<br/>db.t4g.micro Multi-AZ<br/>gp3 20GB / 暗号化)]
        REDIS[(ElastiCache Redis 7.1<br/>cache.t4g.micro<br/>暗号化 in-transit + at-rest)]
    end

    subgraph "Messaging"
        SQS[SQS FIFO<br/>重複排除 / DLQ]
        EB[EventBridge Scheduler<br/>日次 21:00 JST]
    end

    subgraph "Security"
        COG[Cognito User Pool<br/>OAuth2/OIDC / RBAC]
        SM[Secrets Manager<br/>DB認証情報 / 30日ローテーション]
        KMS[KMS<br/>RDS暗号化キー]
    end

    subgraph "Observability"
        CW[CloudWatch<br/>Logs 30日 / Audit 365日]
        XRAY[X-Ray<br/>分散トレーシング 100%]
        DASH[Dashboard<br/>概要ダッシュボード]
        SNS[SNS<br/>アラート通知]
    end

    subgraph "Email"
        SES[SES<br/>TLS / バウンス通知]
    end
```
