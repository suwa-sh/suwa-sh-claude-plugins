# 図書館蔵書管理システム — プロダクトインフラ ターゲットアーキテクチャ

> 派生生成物。正本は `docs/mcl/product/output/*.yaml` および `docs/cloud-context/decisions/product/*.yaml`。

| 項目 | 値 |
|---|---|
| ワークロードタイプ | web_app |
| 対象クラウド | AWS |
| リージョン | ap-northeast-1（東京）単一リージョン / 2 AZ |
| SLA | 99%（年間ダウンタイム約 3.65 日） |
| p99 応答目標 | 500ms |
| RPO / RTO | 4 時間 / 2 時間 |
| データ分類 | restricted（PII あり・国内保管） |
| コスト方針 | balanced |

---

## 1. ワークロード全体構成

```mermaid
graph TD
  subgraph edge["エッジ / 配信"]
    CF["CloudFront<br/>(利用者ポータル SPA)"]
    WAF["AWS WAF<br/>(マネージドルール + レート制限 + 職員 IP 許可)"]
    ALB["Application Load Balancer<br/>(TLS 終端 / アクセスログ全件)"]
  end

  subgraph identity["認証"]
    COG["Cognito user pools<br/>(OIDC / パスワードポリシー / ロック)"]
  end

  subgraph app["アプリケーション層 (app-private / 2 AZ)"]
    API["ECS Fargate: libms-api<br/>(モジュラモノリス / 2〜8 タスク)"]
    WRK["ECS Fargate: libms-worker<br/>(キュー消費 / 0〜10 タスク / Spot)"]
    BAT["ECS Fargate: libms-batch<br/>(日次 02:00 JST / Spot)"]
  end

  subgraph data["データ層 (data-private / 2 AZ)"]
    RDS["RDS for PostgreSQL 16<br/>Multi-AZ / PITR 14 日"]
    EC["ElastiCache for Valkey<br/>2 ノード / TTL"]
  end

  subgraph async["非同期"]
    SQSN["SQS: notification<br/>+ DLQ"]
    SQSR["SQS: report<br/>+ DLQ"]
    SCH["EventBridge Scheduler<br/>cron(0 2 * * ? *) JST"]
  end

  subgraph storage["ストレージ"]
    S3S["S3: static<br/>(OAC 経由のみ)"]
    S3L["S3: logs<br/>(180d → Glacier IR)"]
    S3B["S3: backup<br/>(Object Lock 30d)"]
  end

  subgraph external["外部連携"]
    SES["Amazon SES<br/>(DKIM / バウンス通知)"]
  end

  subgraph ops["運用"]
    CW["CloudWatch<br/>(Logs 180d / メトリクス / Canary 5 分)"]
    XR["X-Ray"]
    SNS["SNS: critical / warning"]
    BK["AWS Backup<br/>日次 04:30 JST"]
  end

  USER["利用者<br/>(インターネット)"] --> CF
  USER --> WAF
  STAFF["司書<br/>(館内ネットワーク)"] --> WAF
  CF --> S3S
  WAF --> ALB
  ALB --> API
  USER -.ログイン.-> COG
  API -.トークン検証.-> COG
  API --> RDS
  API --> EC
  API --> SQSN
  API --> SQSR
  SCH --> BAT
  BAT --> RDS
  BAT --> SQSN
  SQSN --> WRK
  SQSR --> WRK
  WRK --> RDS
  WRK --> EC
  WRK --> SES
  SES -.bounce / complaint.-> SQSN
  ALB --> S3L
  CF --> S3L
  RDS --> BK
  BK --> S3B
  API --> CW
  WRK --> CW
  API --> XR
  CW --> SNS
```

---

## 2. リクエストフロー

### 2-1. 利用者による書籍検索（同期）

```mermaid
sequenceDiagram
  autonumber
  participant U as 利用者ブラウザ
  participant CF as CloudFront
  participant W as AWS WAF
  participant A as ALB
  participant API as ECS: libms-api
  participant EC as ElastiCache
  participant DB as RDS PostgreSQL

  U->>CF: SPA 静的資産の取得
  CF-->>U: index.html / JS / CSS（エッジキャッシュ）
  U->>W: GET /api/books?q=...（Bearer トークン付き）
  W->>W: マネージドルール + レート制限（3000req/5分/IP）
  W->>A: 許可されたリクエスト
  A->>API: 転送（trace_id 生成・伝播）
  API->>API: トークン検証（product-decision-002）
  API->>EC: book: キャッシュ参照
  alt キャッシュヒット
    EC-->>API: 書籍情報
  else キャッシュミス
    API->>DB: pg_trgm / tsvector で全文検索
    DB-->>API: 検索結果
    API->>EC: SET（TTL 300 秒）
  end
  API-->>A: 200 OK
  A-->>U: 検索結果（p99 目標 500ms）
```

### 2-2. 日次バッチによる督促通知（非同期）

```mermaid
sequenceDiagram
  autonumber
  participant S as EventBridge Scheduler
  participant B as ECS: libms-batch
  participant DB as RDS PostgreSQL
  participant Q as SQS: notification
  participant W as ECS: libms-worker
  participant SES as Amazon SES
  participant EC as ElastiCache
  participant SNS as SNS critical

  S->>B: RunTask（02:00 JST / 新規 trace_id）
  B->>DB: ジョブ実行 ID を INSERT（重複実行検知）
  B->>DB: 返却期限接近・期限超過の貸出を抽出
  B->>Q: 通知送信要求を投入（個人情報は含めず ID 参照のみ）
  Note over Q,W: キュー深度に応じて worker が 0→N にスケール
  Q->>W: メッセージ受信（at-least-once）
  W->>EC: idem:notify: で重複消費を検知
  W->>DB: 通知エンティティと宛先を取得
  W->>SES: SendEmail
  alt 送信成功
    SES-->>W: MessageId
    W->>DB: 通知状態 = 送信済
    W->>Q: DeleteMessage
  else 再試行上限（5 回）超過
    Q->>Q: DLQ へ退避
    W->>DB: 通知状態 = 送信失敗
    Q->>SNS: DLQ 滞留アラート（ALT-005）
  end
```

---

## 3. オートスケーリング構成

```mermaid
graph LR
  subgraph triggers["スケーリングトリガー"]
    T1["ECS CPU 使用率 60%"]
    T2["ALBRequestCountPerTarget 600"]
    T3["BacklogPerTask 20<br/>(可視メッセージ数 / タスク数)"]
    T4["RDS ストレージ使用量"]
  end

  subgraph targets["スケーリング対象"]
    G1["libms-api<br/>2 → 8 タスク<br/>out 60s / in 300s"]
    G2["libms-worker<br/>0 → 10 タスク<br/>out 60s / in 600s"]
    G3["RDS gp3 ストレージ<br/>100GB → 500GB"]
  end

  T1 --> G1
  T2 --> G1
  T3 --> G2
  T4 --> G3

  subgraph fixed["スケールしない要素"]
    F1["RDS インスタンスクラス<br/>(ライトサイジングのレビューで対応)"]
    F2["ElastiCache ノード数<br/>(2 ノード固定)"]
  end
```

スパイク倍率 2 倍（ベースライン 10rps → ピーク 20rps）に対し、api は 60 秒でスケールアウトする。
worker は平常時 0 タスクで固定費をゼロにし、日次バッチ直後の滞留に応じて増える。

---

## 4. AWS デプロイメント（ネットワーク配置）

```mermaid
graph TD
  subgraph aws["AWS ap-northeast-1"]
    subgraph vpc["VPC 10.20.0.0/16"]
      subgraph az1["AZ: ap-northeast-1a"]
        P1["public 10.20.0.0/24<br/>ALB / NAT Gateway"]
        A1["app-private 10.20.10.0/24<br/>ECS タスク"]
        D1["data-private 10.20.20.0/24<br/>RDS primary / Valkey primary"]
      end

      subgraph az2["AZ: ap-northeast-1c"]
        P2["public 10.20.1.0/24<br/>ALB"]
        A2["app-private 10.20.11.0/24<br/>ECS タスク"]
        D2["data-private 10.20.21.0/24<br/>RDS standby / Valkey replica"]
      end

      VPE["VPC エンドポイント<br/>S3(GW) / SQS / Secrets Manager<br/>/ ECR / Logs / KMS"]
    end

    subgraph regional["リージョナルサービス（VPC 外）"]
      COG2["Cognito"]
      SES2["SES"]
      S3X["S3"]
      CW2["CloudWatch / X-Ray"]
      BK2["AWS Backup"]
      KMS["KMS (data / logs)"]
    end

    CFX["CloudFront（エッジ）"]
  end

  CFX --> S3X
  P1 --> A1
  P2 --> A2
  A1 --> D1
  A2 --> D1
  D1 -. Multi-AZ 同期レプリケーション .-> D2
  A1 --> VPE
  A2 --> VPE
  VPE --> S3X
  A1 -. NAT 経由 .-> SES2
  A1 --> COG2
  D1 --> KMS
  D1 --> BK2
  A1 --> CW2
```

**ネットワーク方針の要点**

- `data-private` サブネットは `0.0.0.0/0` の経路を持たない。データ層は外部から直接到達できない
- NAT Gateway はコスト最適化のため 1 AZ に集約する。AZ 障害時は外向き通信（メール送信）が停止するが SLA 99% では許容する
- S3 / SQS / Secrets Manager / ECR / CloudWatch Logs / KMS は VPC エンドポイント経由とし、NAT のデータ処理料を抑える
- 職員ポータルは WAF の IP 許可リストで館内ネットワークからのみ許可する（暫定。product-decision-004）

---

## 5. 主要な設計判断

| ID | 判断 | 選択 | 主な理由 |
|---|---|---|---|
| product-decision-001 | アプリケーション実行基盤 | ECS on Fargate | 小規模運用体制で基盤運用を委譲しつつ、p99 500ms とモジュラモノリスに適合 |
| product-decision-002 | API エッジ構成 | ALB + WAF（トークン検証はアプリ層） | 常駐コンテナ構成でのコスト効率を優先。WAF レート制限で緩和 |
| product-decision-003 | リレーショナルデータストア | RDS PostgreSQL Multi-AZ | SLA 99% / 100GB 未満の規模に対して Aurora は過剰 |
| product-decision-004 | 職員面の閉域化 | 接続元 IP 制限（暫定） | 根拠 NFR が confidence: low、館内ネットワーク設備が未確定 |
| product-decision-005 | リージョン構成 | 単一リージョン 2 AZ | 災害対策の範囲が最小水準。冗長化と切替時間の要件は満たす |

---

## 6. 適合性サマリ

| 状態 | 件数 |
|---|---:|
| conformant | 60 |
| partial | 3 |
| non_conformant | 0 |
| deferred | 1 |

**partial の 3 件**

1. `REQ-IWD-001` / `REQ-NET-002` — 職員面の閉域化を IP 制限で代替（product-deviation-001、期限 2026-12-31）
2. `REQ-EDGE-001` — トークン検証がエッジではなくアプリ層（product-deviation-002、期限 2027-03-31）

**deferred の 1 件**

- `REQ-BKP-002` — RTO 2 時間の実測検証は本番構築後の復旧演習で行う

---

## 7. 未確定事項（IaC の TODO）

| # | 項目 | 影響 |
|---|---|---|
| 1 | 館内ネットワークのグローバル IP | 未設定の間は職員ポータルが全拒否になる |
| 2 | ACM 証明書 ARN と独自ドメイン | ALB / CloudFront の HTTPS リスナー |
| 3 | SES 送信ドメインと DKIM / SPF / DMARC の DNS 登録 | 通知メールの到達率 |
| 4 | SES サンドボックス解除の申請 | 本番稼働前に 24〜48 時間のリードタイム |
| 5 | コンテナイメージ URI（api / worker / batch） | ECS タスク定義 |
| 6 | アラート通知先メールアドレス | SNS サブスクリプション |
| 7 | Terraform リモートステートのバックエンド | 複数人での運用時に必須 |
