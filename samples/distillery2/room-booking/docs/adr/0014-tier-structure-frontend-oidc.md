---
id: "0014"
title: "frontend は OIDC でトークンを得て、API 呼び出しの層の 1 か所で付ける"
status: accepted
date: "2026-11-04"
supersedes: ["0001"]
superseded_by: null
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
nfr_refs: ["B.1.1.1", "B.3.1.1", "A.2.1.1", "F.1.1.1", "E.5.1.1"]
scope: [system, app]
confidence: low
tiers:
  - id: frontend
    dir: apps/frontend
    kind: frontend
    lang: typescript
    provides: []
    consumes: [api]
    packages: [oidc-client-ts]
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
    provides: [api]
    consumes: [db]
    packages: [express, pg, jose, pino]
    dev_packages: ["@types/express", "@types/pg"]
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
  - scope: tier:frontend
    text: "frontend は OIDC クライアント (oidc-client-ts) で、認可コード + PKCE のリダイレクトにより社内の認証基盤へサインインする。ログインの画面は作らず、パスワードを扱わない"
  - scope: tier:frontend
    text: "トークンの取得と Authorization ヘッダ (Bearer) の付与は apps/frontend/src/api/ のトークンの供給元 (インターフェイス) 1 か所にまとめ、生成クライアントの options.fetch を包んで付ける。画面や画面の入口関数でトークンを扱ったり OIDC クライアントを直接 import したりしない"
  - scope: tier:frontend
    text: "画面の入口関数はトークンの供給元を引数で受け取る。単体・UC BDD・受入では供給元をテスト用に差し替え、接頭辞 (Bearer) の無いテスト用のトークン (社員Aは test-employee-a、社員Bは test-employee-b) を返して社員A・社員Bを切り替える。Bearer は options.fetch を包む 1 か所で 1 回だけ付け、送る Authorization ヘッダの値が契約の x-test-headers と同じ Bearer test-employee-<社員> になる"
  - scope: tier:frontend
    text: "API が 401 (UNAUTHENTICATED) を返したら、トークンの供給元のサインインを呼んで認証基盤のサインインへ戻す。画面ごとに 401 の扱いを書かない"
  - scope: tier:frontend
    text: "画面に出す社員の表示名は、トークンの供給元が ID トークンの name クレームから返す。表示名のために API を呼ばない"
---

# 背景

ADR 0001 を置き換える。画面の段に入る前の点検 (課題 `docs/feedback/20261104_123555_precheck_precheck-view-room-availability-frontend_frontend-token-acquisition.md`。UC 着手前の点検から出た課題で `from_uc` は無い) で、次の穴が見つかった。

- ADR 0006 は「frontend は認証基盤からトークンを得て、API を呼ぶときに付ける」とだけ書き、frontend 側の OIDC クライアントの道具・フロー・トークンの持ち方・401 を受けたときの扱いを決めていない。
- ADR 0001 の frontend の packages は空で、OIDC クライアントが入っていない。
- 開発ルールは生成クライアントの options.fetch の注入だけを決めており、Authorization ヘッダをどこで付けるか、テストで社員ごと (社員A・社員B) のトークンをどう渡すかが無い。空き状況の照会の受入基準 3 (社員Bが照会し社員Aの名前が出ない) でも社員の切り替えが要る。
- 決めないと 4 つの UC が別々の方式でトークンを扱う。

方式は「実績のある OIDC クライアントの依存を足す」で決まった (自前で認可コード + PKCE を書く案は退けた)。依存はティア構成の `packages` に持つため、ティア構成の ADR を置き換える。

ADR 0001 の背景は「外部システムは無い」としていたが、これは誤りだった。要求の外部システム (`docs/requirements/rdra/外部システム.tsv`) には社内の認証基盤が 1 つあり、ADR 0006 は認証をそこへ任せている。この ADR の前提は「外部システムは社内の認証基盤 1 つ (社員のサインインとトークンの発行だけに使う)」とする。それ以外の前提 (社員 1 種のアクター、4 つの UC、業務 1 つ、タイマー起動なし、利用者は数十人で同時アクセス 100 以下、拡張はスケールアップ) は ADR 0001 のとおり。

# 決定

- ティア構成 (frontend と backend-api の 2 ティア・言語・枠組み・`datastore_owner: backend-api`) と ADR 0001 の 4 つのルール (ティア間の 2 本のアーキテストを含む) はそのまま引き継ぐ。
- frontend の packages に OIDC クライアント `oidc-client-ts` を足す。
  - **この名前の npm パッケージが実在し、型定義を同梱しているかは、この決定の時点で確かめていない。** 基盤で依存を入れるときに確かめ、無ければこの ADR を置き換える。型定義を同梱していない場合は dev_packages を足す。
- サインインは認可コード + PKCE のリダイレクトで社内の認証基盤へ送る。ログインの画面は作らない (ADR 0006 のとおり)。
- トークンの取得と Authorization ヘッダの付与は、`apps/frontend/src/api/` のトークンの供給元 1 か所にまとめる。
  - 供給元はインターフェイスとし、少なくとも「アクセストークンを返す」「サインインへ戻す」「表示名を返す」を持つ。本番の実装は OIDC クライアントを包む。
  - 生成クライアントの options.fetch を包み、要求ごとに `Authorization: Bearer <トークン>` を付ける。
  - 画面の入口関数は供給元を引数で受け取る。テストでは供給元を差し替え、契約の x-test-headers と同じ形 (`Bearer test-employee-<社員>`) のトークンを返して社員を切り替える。契約が今定めるのは `test-employee-a` (社員A) だけで、社員Bの `test-employee-b` は契約とテスト用の検証器の側で足す (この ADR の外)。
- API が 401 (UNAUTHENTICATED) を返したら、供給元のサインインを呼んで認証基盤へ戻す。
- 画面に出す社員の表示名は ID トークンの `name` クレームから取る。

# 却下した案

- 認可コード + PKCE をブラウザ標準の Web Crypto と fetch で自前で書く: 依存は増えないが、認証のフローの実装と安全性の保守を自前で持つことになる。
- トークンの付与を画面ごとに書く: 4 つの UC で方式がばらつき、401 の扱いも散らばる。
- テストで本物の認証基盤からトークンを取る: 社内の認証基盤に依存し、docker もブラウザも無しで回すテスト方針 (ADR 0007) と合わない。
- 表示名を API から取る: 契約に表示名の API が無く、ID トークンに既にある値のために API を足すことになる。

# 影響

- 基盤で frontend の依存 (oidc-client-ts) を入れ直す作業が要る。開発ルールとアーキテストも作り直しが要る (この ADR の受理後に行う)。
- 社内の認証基盤が OIDC の認可コード + PKCE に対応し、ID トークンに `name` クレームを入れることが前提になる (確認してほしいこと。ADR 0006 の前提と同じ)。
- 画面の入口関数の引数にトークンの供給元が加わる。テストは供給元を差し替えるだけで社員を切り替えられる。
- 認証基盤の設定 (発行者・クライアント ID・リダイレクト先) は環境ごとの設定にする。
- 可用性は社内の認証基盤に依存する。認証基盤が止まっている間は、社員は新たにサインインできず、トークンの期限が切れた社員は空き状況の照会も予約もできない (API は 401 を返し、画面はサインインへ戻す)。このシステムは認証基盤を冗長化せず、代わりのログイン手段も持たない (ログインの画面を作らない ADR 0006 のとおり)。認証基盤の稼働は社内基盤の側の責任とし、このシステムのサーバを冗長化しない判断 (非機能グレード A.2.1.1 冗長化なし) は変えない: 認証基盤が止まればサーバを冗長化しても使えないため、冗長化で得るものが無い。
  - 非機能グレード表の選定根拠と A.2.1.1 の根拠は「外部システムは無い」と書いたままで、この前提に合わせて直す必要がある (確認してほしいこと)。
