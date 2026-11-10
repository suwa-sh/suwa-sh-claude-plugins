---
id: "0001"
title: "画面の frontend と API の backend-api の 2 ティアにし、TypeScript と Express で作る"
status: superseded
date: "2026-11-04"
supersedes: []
superseded_by: "0014"
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
nfr_refs: ["B.1.1.1", "B.3.1.1", "A.2.1.1", "F.1.1.1"]
scope: [system, app]
confidence: medium
datastore_owner: backend-api
rules:
  - scope: common
    text: "frontend は backend-api の内部実装へ直接依存してはならない (契約から生成したクライアント経由で呼ぶ)"
    arch_test:
      from: "apps/frontend/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "backend-api は frontend の実装へ依存してはならない"
    arch_test:
      from: "apps/backend-api/**"
      to: "apps/frontend/src/**"
      effect: forbid
      level: tier
  - scope: common
    text: "backend-api は単一のデプロイ単位 (モジュラモノリス) とし、データストアへの読み書きは backend-api だけが行う"
  - scope: common
    text: "ティアの言語は TypeScript とし、frontend は React の SPA、backend-api は Node.js 上の Express で作る"
---

# 背景

社員 1 種のアクターが、画面で空き状況の照会・予約・自分の予約の一覧・取り消しの 4 つの UC を行う。業務は「会議室予約」1 つ、外部システムは無く、状態遷移にタイマー起動も無い。利用者は数十人で、同時アクセスは 100 以下 (非機能グレードの同時アクセス数 Lv1)、拡張はスケールアップで足りる。

# 決定

- ティアは 2 つにする。
  - `frontend` (apps/frontend): 社員が使う画面。React の SPA。
  - `backend-api` (apps/backend-api): 画面が呼ぶ API。Node.js 上の Express で作る単一のデプロイ単位 (モジュラモノリス)。データストア (RDB) を持つのはこのティアだけ (`datastore_owner`)。
- 言語は両ティアとも TypeScript にする。frontend の枠組み・ビルド (React・Vite・Tailwind) は基盤の骨格が入れるので、ここでは追加の依存を持たない。backend-api は Express (HTTP)・pg (RDB のクライアント)・jose (ID トークンの検証)・pino (構造化ログ) を使う。
- worker (非同期・定期処理)・API Gateway は置かない。認証基盤は社内の既存のものを使い、このシステムには置かない (認証の決定を参照)。
- 業務のドメインは「会議室予約」1 つなので、境界づけられたコンテキストには分けない (`contexts[]` は書かない)。

# 却下した案

- worker を置く: タイマー起動・通知・一括処理が要求に無い。置いても仕事が無い。
- backend-api をドメイン別に分割する: 業務は 1 つ、利用者は数十人。分割は運用の手間だけが増える。
- API Gateway を置く: 社外の利用者も複数の画面アプリも無く、IP 制限や WAF の要求も無い。
- 画面をサーバ側で描く (SSR): 社内向けで SEO も無く、モバイル専用の要求も無い。SPA で足りる。
- frontend を利用者向け・管理者向けに分ける: 管理者のアクターが居ない (会議室は初期データで入れる)。

# 影響

- UC ごとの実装は frontend と backend-api の 2 ティアだけで済む。
- 定期処理や通知が後から要るときは、worker を足す ADR を新しく書く。
- 単一のデプロイ単位なので、止まると全機能が止まる。可用性の要求 (冗長化なし・再起動で復旧) と合っている。
