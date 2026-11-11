---
id: "0019"
title: "画面はトークンをメモリだけに持ち、期限が近づいたら更新する。更新できなければサインインへ戻す"
status: accepted
date: "2026-11-05"
supersedes: []
superseded_by: null
basis: "requirements@fa7a34900db10f9ae7dd5fe2d9026dc4587e7052"
nfr_refs: ["E.5.1.1", "E.6.1.2"]
scope: [system, app]
confidence: low
rules:
  - scope: tier:frontend
    text: "トークンの供給元の本番の実装は、OIDC クライアント (oidc-client-ts の UserManager) の userStore を new WebStorageStateStore({ store: new InMemoryWebStorage() }) と明示し、アクセストークン・ID トークン・リフレッシュトークンをメモリだけに持つ。既定 (sessionStorage) に任せない"
  - scope: tier:frontend
    text: "OIDC クライアントの stateStore (サインインの往復の間だけ要る state と PKCE の値) は new WebStorageStateStore({ store: window.sessionStorage }) と明示する。既定 (localStorage) に任せない"
  - scope: tier:frontend
    text: "画面のコードはトークン (アクセストークン・ID トークン・リフレッシュトークン) を localStorage・sessionStorage・IndexedDB・Cookie に書かず、ログやエラーの文にも出さない。トークンを持つのはトークンの供給元の本番の実装の中の OIDC クライアントだけとする"
  - scope: tier:frontend
    text: "OIDC クライアントの automaticSilentRenew は false にし、silent_redirect_uri を設定しない。iframe での更新 (prompt=none) は使わず、更新のための画面も作らない (既定では iframe が /auth/callback を開いてしまうため)"
  - scope: tier:frontend
    text: "トークンの供給元の「アクセストークンを返す」が返すのは、本番もテスト用の差し替えも接頭辞 (Bearer) の無い値とする (ADR 0018 のとおり。ADR 0014 の「Bearer test-employee-<社員> と同じ形」は Authorization ヘッダの値の形を指し、供給元の返す値の形ではない。Bearer は options.fetch を包む 1 か所で 1 回だけ付ける)"
  - scope: tier:frontend
    text: "トークンの供給元の本番の「アクセストークンを返す」は、保存したトークンの期限 (expires_in) が 60 秒より長く残っていればそのまま返す。60 秒以下か切れていて、リフレッシュトークンを持っていれば signinSilent() で更新してから返す。リフレッシュトークンが無いか更新に失敗したら、ADR 0014 と 0018 のサインインへ戻す (今の path を state に入れる) を呼ぶ"
  - scope: tier:frontend
    text: "画面を読み込み直してメモリのトークンが無いときも、トークンの供給元はサインインへ戻す (認証基盤のサインインが残っていれば、社員は入力せずに戻る)。トークンを保存して読み込み直しに備えることはしない"
  - scope: common
    text: "本番の前段の配信は、/api で始まる path と実在する画面の静的ファイル (ビルドの出力) を除く path (/auth/callback と routes.tsx の画面の path) に、画面の入口 (index.html) を返す。ファイル名として解決して 404 にしない。開発時は vite の開発サーバの既定 (appType: spa) のまま使う"
  - scope: tier:frontend
    text: "VITE_OIDC_SCOPE には ADR 0018 の値に加え、認証基盤がこの画面にリフレッシュトークンを出すのに要る値を含める (値は認証基盤の登録のときに決める)"
---

# 背景

空き状況の照会の UC (`from_uc: view-room-availability`) の独立検証の課題 (`docs/feedback/20261104_223602_verify_findings.frontend_token-storage.md`) で、次の穴が見つかった。

- ADR 0014・0015・0018 は、サインインの方式 (認可コード + PKCE)・トークンの付け方・サインインの戻り先を決めているが、アクセストークンと ID トークンをブラウザのどこに保存するか (メモリ・sessionStorage・localStorage) と、期限が切れるときに画面の裏で更新するかを決めていない。
- 今の画面は OIDC クライアントの既定に任せている (`apps/frontend/src/api/oidcTokenProvider.ts`)。

OIDC クライアント (oidc-client-ts) の既定は次のとおり (ライブラリのソースで確かめた)。

| 設定 | 既定 | 既定のままだと |
|---|---|---|
| userStore (トークンの保存先) | sessionStorage | 画面に入った不正なスクリプトがトークンを読める |
| stateStore (往復の間の state と PKCE の値) | localStorage | タブを閉じても残る |
| automaticSilentRenew (期限前の自動更新) | true | リフレッシュトークンが無いと iframe で更新する |
| silent_redirect_uri (iframe の更新先) | redirect_uri と同じ | iframe が /auth/callback を開き、コールバックの画面がサインインの完了を呼んでしまう |

`signinSilent()` は、持っているトークンにリフレッシュトークンがあればそれで更新し、無ければ iframe で更新する。

この ADR の決定のレビュー (`.distillery/reviews/decide/10/round1.md`) で、次の 2 つも分かったため、同じ ADR で決める。

- 供給元が返す値の形: 開発ルールに ADR 0014 由来の「Bearer test-employee-<社員> を返す」と ADR 0018 由来の「接頭辞の無い値を返す」が並んで残る。ADR 0018 が読み分けを書いているが、0014 の行だけを読んで `Bearer` 付きで返すと、ヘッダが `Bearer Bearer test-employee-a` になる。この ADR は「アクセストークンを返す」の中身を決めるので、返す値の形もここで言い切る。
- 画面の住所の配信: ADR 0018 は本番の前段の配信で「/api 以外を画面の静的ファイルへ」と書くが、/auth/callback のようにファイルが無い画面の住所に画面の入口 (index.html) を返すとは書いていない。この ADR では画面を読み込み直すたびにサインインへ戻り /auth/callback に帰ってくるので、ファイル名として解決する配信だと全社員がサインインを終えられない (404)。

ADR 0014・0015・0018 は置き換えず、そのまま有効とする。この ADR はトークンの供給元の本番の実装の中身 (保存先と更新・返す値の形) と、画面の住所の配信の規則を足す。依存のパッケージ (oidc-client-ts) は変えない (InMemoryWebStorage・WebStorageStateStore は同じパッケージにある)。

# 決定

- トークン (アクセストークン・ID トークン・リフレッシュトークン) はメモリだけに持つ。userStore を InMemoryWebStorage にすると明示する。
- サインインの往復の間だけ要る state と PKCE の値は sessionStorage に置くと明示する。リダイレクトでページが入れ替わるのでメモリでは消える。sessionStorage ならタブごとに分かれ、タブを閉じれば消える。
- 画面のコードはトークンをブラウザのどの保存場所にも書かず、ログにも出さない (ADR 0011 のとおり)。
- 期限前の更新は、トークンの供給元が API を呼ぶ前に自分で行う。
  - 残り 60 秒より長ければ、そのまま返す。
  - 残り 60 秒以下でリフレッシュトークンがあれば、`signinSilent()` で更新する。
  - リフレッシュトークンが無いか更新に失敗したら、サインインへ戻す (ADR 0018 のとおり今の path を state に入れる)。
- OIDC クライアントの自動更新 (automaticSilentRenew) は切り、iframe での更新は使わない。
- 画面を読み込み直すとメモリのトークンは消えるので、サインインへ戻す。認証基盤のサインインが残っていれば、社員はパスワードを入れずに戻る。
- トークンの供給元が返すアクセストークンは、本番もテストも接頭辞 (`Bearer `) の無い値にする (テストは `test-employee-a`・`test-employee-b`)。`Bearer ` は options.fetch を包む 1 か所で 1 回だけ付ける。ADR 0014 の「`Bearer test-employee-<社員>` と同じ形」はヘッダの値の形として読む (ADR 0018 のとおり。食い違って読めるときはこの ADR と ADR 0018 を優先する)。
- 本番の前段の配信は、/api で始まる path と実在する静的ファイルを除く path (/auth/callback と画面の path) に画面の入口 (index.html) を返す。開発時の vite の開発サーバは既定 (appType: spa) で同じ動きをする。
- テストではトークンの供給元を差し替えるので、保存先と更新は本番の実装の中だけの話になる (ADR 0014 のとおり)。本番の実装の単体テストは OIDC クライアントを偽物に差し替え、期限の残りとリフレッシュトークンの有無の組み合わせで「そのまま返す」「更新して返す」「サインインへ戻す」を確かめる。

# 却下した案

- sessionStorage に保存する (既定のまま): 読み込み直してもサインインし直さずに済むが、画面に不正なスクリプトが入るとトークンを読まれる。読み込み直しは認証基盤のサインインが残っていれば入力無しで戻るので、得るものが少ない。
- localStorage に保存する: タブを閉じても残り、別のタブとも共有される。読まれる危険は sessionStorage と同じで、残る期間が長い。
- 自動更新を既定のまま使う: リフレッシュトークンが無いと iframe で更新し、iframe がコールバックの画面 (/auth/callback) を開く。更新のための画面を足しても、ブラウザがサードパーティの Cookie を止めると iframe の更新は失敗する。
- 更新をせず、期限が切れたら毎回サインインへ戻す: 仕組みは最も少ないが、アクセストークンの期限 (認証基盤によっては数分〜1 時間) ごとに画面が認証基盤へ移り、入力中の値を失う (ADR 0018 は入力中の値を戻さない)。
- 画面の裏の中継 (BFF) にトークンを持たせ、画面は Cookie で呼ぶ: 画面からトークンを消せるが、ティアが 1 つ増え、ティア構成 (ADR 0014) と認証の流れを作り直すことになる。利用者は社内の数十人で、そこまでの守りは要らない。

# 影響

- トークンの供給元の本番の実装に、期限の確かめと更新の分岐が加わる。画面と画面の入口関数は変わらない (トークンの供給元のインターフェイスは ADR 0014・0018 のまま)。
- 画面を読み込み直すたびに認証基盤へ一度移って戻る。
- 社内の認証基盤が、この画面 (公開のクライアント) にリフレッシュトークンを出すことが、更新の前提になる (確認してほしいこと)。出さない場合も動くが、アクセストークンの期限ごとにサインインへ戻り、入力中の値を失う。そのときは、期限を長くしてもらうか、この ADR を置き換えて別の更新の方式にする。
- 認証基盤の登録で、リフレッシュトークンを得る scope の値 (認証基盤によっては offline_access) を決める。ADR 0018 の scope の確認と同じ時期に行う。
- 本番の前段の配信 (ADR 0018 のリバースプロキシ等) が、ファイルの無い画面の住所に index.html を返せることが前提になる (確認してほしいこと。ADR 0018 の前段の確認と同じ時期)。返せない配信なら、配信の方式を決め直す。
- 開発ルール (docs/rules/) はこの ADR から生成し直す (ADR を直すたびに d2-run が行う)。アーキテストの規則は増えない (層とティアの依存は変えない)。
