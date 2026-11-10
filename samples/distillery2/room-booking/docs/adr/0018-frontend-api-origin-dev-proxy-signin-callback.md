---
id: "0018"
title: "画面と API は同じオリジンで配信し、画面は相対パス /api で呼ぶ。開発時は vite の中継で /api を backend-api へ送り、サインインの戻り先は /auth/callback の 1 画面で元の画面へ戻す"
status: superseded
date: "2026-11-05"
supersedes: []
superseded_by: "0021"
basis: "requirements@fa7a34900db10f9ae7dd5fe2d9026dc4587e7052"
nfr_refs: ["E.5.1.1"]
scope: [system, app]
confidence: medium
rules:
  - scope: common
    text: "画面 (frontend) と API (backend-api) は利用者から見て同じオリジンで配信する。本番は前段の配信 (リバースプロキシ等) で /api で始まる path を backend-api へ、それ以外を画面の静的ファイルへ振り分ける"
  - scope: tier:frontend
    text: "画面は生成クライアントの baseUrl を指定せず (既定の同一オリジンのまま)、契約の path (/api で始まる相対パス) で API を呼ぶ。API の宛先のオリジンを画面の設定や環境変数で持たない"
  - scope: tier:frontend
    text: "開発時は apps/frontend/vite.config.ts の server.proxy で /api を backend-api へ中継する。中継先の既定は http://localhost:3000 (契約の servers と同じ) とし、環境変数 API_PROXY_TARGET で上書きできるようにする"
  - scope: tier:frontend
    text: "サインインのコールバック (認可コードを受け取る画面) は path /auth/callback の 1 画面とし、src/routes.tsx の表に 1 行足す。UC の画面ではないため docs/design/screens.yaml には載せない。コールバックの画面はサインインの完了を待つ間は何も描かない"
  - scope: tier:frontend
    text: "サインインへ送るとき (最初の表示と 401 で戻すときの両方)、トークンの供給元は今の画面の path (クエリを含む) を OIDC の state に入れる。コールバックの画面はトークンの供給元のサインインの完了を呼び、返った path へ App.tsx の navigate() で戻す。state が無いか同じオリジンの path でなければ routes の先頭の画面へ戻す。戻すのは画面 (path) だけで、画面の入力値は保存も復元もしない"
  - scope: tier:frontend
    text: "routes.tsx の path は docs/design/screens.yaml の route と同じ書式 (:name のパラメータを含む) で書く。App.tsx は path を / で区切って 1 区切りずつ照合し、:name の区切りは / を含まない空でない値 1 つに合う。Route の element は (params: Record<string, string>) => ReactNode とし、App.tsx が取り出したパラメータの値 (名前は :name の name) を渡す。画面はパラメータを window.location から読まない。navigate() で移る先 (サインイン後の戻り先を含む) も同じ照合で画面を選ぶ"
  - scope: tier:frontend
    text: "ADR 0014 の「契約の x-test-headers と同じ形のトークン (Bearer test-employee-<社員>)」は Authorization ヘッダの値の形を指す。トークンの供給元が返すのは接頭辞の無い値 (本番はアクセストークンそのもの、テストは test-employee-a・test-employee-b) とし、Bearer は生成クライアントの options.fetch を包む 1 か所で 1 回だけ付ける"
  - scope: tier:frontend
    text: "サインインの完了 (OIDC クライアントの signinRedirectCallback を包むもの) はトークンの供給元のインターフェイスに持たせ、コールバックの画面は OIDC クライアントを直接 import しない"
  - scope: tier:frontend
    text: "OIDC の設定は環境変数 VITE_OIDC_AUTHORITY (発行者)・VITE_OIDC_CLIENT_ID・VITE_OIDC_REDIRECT_URI (画面のオリジン + /auth/callback)・VITE_OIDC_SCOPE で渡し、apps/frontend/src/api/ のトークンの供給元の本番の実装だけが読む。VITE_OIDC_SCOPE は openid と profile に加え、この API 向けのアクセストークンを得る値を含める"
  - scope: tier:backend
    text: "backend-api は CORS の許可 (Access-Control-Allow-Origin 等の応答ヘッダや CORS のミドルウェア) を入れない。画面は同じオリジンから呼ぶため要らない"
---

# 背景

画面の段に入る前の点検 (課題 `docs/feedback/20261104_210143_precheck_precheck-view-room-availability-frontend_frontend-cross-wiring-method.md`。空き状況の照会の画面の着手前の点検から出た課題で、`from_uc` は無い) で、画面の横断の結線のうち次の方式がどの ADR の rules にも無いと分かった。

- API の宛先: 画面と API を同じオリジンに置いて相対パス /api で呼ぶか、別のオリジンに置いて宛先を設定で渡すか。別のオリジンなら backend-api に CORS の許可が要る。
- 開発時の中継: vite の開発サーバから backend-api (契約の servers は http://localhost:3000) へ /api を中継するか。
- サインイン後の戻り先: 認可コードを受け取るコールバックの画面の path と、サインイン前に開いていた画面 (401 で戻されたときを含む) へ戻すかどうか。
- OIDC の設定 (発行者・クライアント ID・リダイレクト先・scope) を画面にどう渡すか。ADR 0014 は「環境ごとの設定」とだけ書く。

開発ルール (docs/rules/tier-frontend.md) は、方式が書かれていない結線を画面の機能が土台に足すことを禁じている。決めないと画面の機能ごとに結線が食い違い、backend の CORS の要否も決まらない。

この ADR の決定のレビューで、次の 2 つも分かったため、同じ ADR で決める。

- 戻り先の画面の照合: 設計の予約の取消の画面は `/my-reservations/:reservationId/cancel` のようにパラメータを含むが、土台の App.tsx は path の完全一致で画面を選び、routes.tsx の element は値を受け取れない。このままでは取消の画面へ戻れず (直接開いても)「画面が見つかりません」になる。
- テスト用のトークンの形: ADR 0014 は、テスト用の供給元が「Bearer test-employee-<社員> と同じ形のトークン」を返すと書き、別の箇所で要求ごとに `Authorization: Bearer <トークン>` を付けると書く。そのまま組み合わせると `Bearer Bearer test-employee-a` になる。

ADR 0014 (サインインとトークンの供給元) と ADR 0015 (API に送るのはアクセストークン) は置き換えず、そのまま有効とする。この ADR はその上に、宛先・中継・戻り先・画面の照合・設定の渡し方を足し、ADR 0014 のトークンの形の書き方を読み分ける。ティア構成・依存のパッケージは変えない (vite の server.proxy と oidc-client-ts の state は既に入っている依存の機能)。

# 決定

- 画面と API は同じオリジンで配信する。
  - 画面は生成クライアントの baseUrl を既定 (同一オリジン) のまま使い、契約の path (/api で始まる相対パス) で呼ぶ。API のオリジンを設定で持たない。
  - backend-api に CORS の許可を入れない。
  - 本番は前段の配信 (リバースプロキシ等) で /api を backend-api へ、それ以外を画面の静的ファイルへ振り分ける。
- 開発時は vite の開発サーバの server.proxy で /api を backend-api へ中継する。中継先の既定は http://localhost:3000 とし、環境変数 API_PROXY_TARGET で上書きできる。
- サインインのコールバックは /auth/callback の 1 画面にする。
  - サインインへ送るとき (最初の表示・401 で戻すとき) は、今の path を OIDC の state に入れる。
  - コールバックの画面はトークンの供給元の「サインインの完了」を呼び、返った path へ navigate() で戻す。state が無いか同じオリジンの path でなければ、routes の先頭の画面 (空き状況の画面) へ戻す。
  - 戻すのは画面 (path) だけで、入力中の値は保存も復元もしない。予約の画面を入力中に 401 になったら、社員はサインイン後に同じ画面で入力し直す。
  - 「サインインの完了」はトークンの供給元のインターフェイスに足す (ADR 0014 の「アクセストークンを返す」「サインインへ戻す」「表示名を返す」に加える)。コールバックの画面も OIDC クライアントを直接扱わない。
- 画面の照合はパラメータ付きの path に対応させる。
  - routes.tsx の path は screens.yaml の route と同じ書式 (`/my-reservations/:reservationId/cancel` など) で書く。
  - App.tsx は path を `/` で区切って照合し、`:name` の区切りは `/` を含まない空でない値 1 つに合う。
  - Route の element は `(params) => ReactNode` とし、App.tsx が取り出した値 (例: `{ reservationId: "..." }`) を渡す。画面は window.location からパラメータを読まない。
  - サインイン後の戻り先も navigate() で移るので、同じ照合で画面が選ばれる。
- テスト用のトークンの形: トークンの供給元が返すのは接頭辞の無い値 (テストは `test-employee-a`・`test-employee-b`) とし、`Bearer ` は options.fetch を包む 1 か所で 1 回だけ付ける。ADR 0014 の「`Bearer test-employee-<社員>` と同じ形」は、ヘッダの値 (契約の x-test-headers) の形を指す。
- OIDC の設定は 4 つの環境変数で渡す。

| 環境変数 | 中身 |
|---|---|
| VITE_OIDC_AUTHORITY | 認証基盤の発行者 |
| VITE_OIDC_CLIENT_ID | この画面のクライアント ID |
| VITE_OIDC_REDIRECT_URI | 画面のオリジン + /auth/callback |
| VITE_OIDC_SCOPE | openid と profile、この API 向けのアクセストークンを得る値 |

  読むのは apps/frontend/src/api/ のトークンの供給元の本番の実装だけにする。テストでは供給元を差し替えるので、環境変数は要らない (ADR 0014 のとおり)。

# 却下した案

- 画面と API を別のオリジンに置き、API の宛先を環境変数で渡す: backend-api に CORS の許可と許可するオリジンの設定が要り、Authorization ヘッダ付きの要求ごとに事前の確認 (preflight) が増える。利用者は社内の数十人で、画面と API を分けて配信する理由が無い。
- 開発時も中継を使わず、backend-api に開発用だけ CORS を許可する: 開発と本番で呼び方が変わり、開発でだけ動く結線が生まれる。
- サインイン後は常に先頭の画面へ戻す: 予約の画面などを開いた状態で 401 になると、社員が開いていた画面を失う (取消の画面なら、どの予約だったかも失う)。
- 入力中の値も保存して復元する: 入力中にトークンの期限が切れる場面は少なく、入力は数項目で入れ直せる。画面ごとに保存と復元と後始末を書くことになる。
- 画面がパラメータを window.location から自分で読む: 画面ごとに path の解析が散らばり、入口関数の引数で値を渡すテストの形と合わない。
- テスト用の供給元が `Bearer ` 付きの値を返す: 本番の供給元 (アクセストークンそのものを返す) と形が変わり、付ける側で付けるかどうかの分岐が要る。
- 戻り先を sessionStorage 等に別に保存する: OIDC の state で同じことができ、保存場所と後始末が増える。
- OIDC の設定を API から取る: 設定を返す API が契約に無く、サインインの前に API を呼ぶ順番の問題が生まれる。

# 影響

- 画面の機能 (最初は空き状況の画面) が土台に次を足す: vite.config.ts の server.proxy、routes.tsx の /auth/callback の行と Route の element の形 (`(params) => ReactNode`)、App.tsx のパラメータ付きの照合、src/api/ のトークンの供給元の「サインインの完了」と state の扱い。足した結線は AssumptionRecord に書き、後の画面の機能はそれに載せる。App.tsx と routes.tsx は土台の生成が再実行で上書きしないファイルなので、画面の機能が手で直す。
- backend-api は CORS を扱わない。契約の path は今の /api で始まる形のまま。
- 本番の配信で、画面と API を同じオリジンにまとめる前段 (リバースプロキシ等) が要る。認証基盤には、リダイレクト先として 画面のオリジン + /auth/callback を登録する。
- 認証基盤が「この API 向けのアクセストークン」を出すのに要る scope の値は認証基盤によって違う。値は環境変数で渡し、決めるのは認証基盤の登録のとき (確認してほしいこと。ADR 0015 の宛先 (aud) の確認と同じ時期)。
- 開発ルール (docs/rules/) は作り直しが要る (この ADR の受理後に行う)。アーキテストの規則は増えない (層とティアの依存は変えない)。
