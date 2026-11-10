---
id: "0021"
title: "ADR 0018 (同じオリジンの配信・開発時の中継・サインインの戻り先・画面の照合) を引き継ぎ、画面の間で選んだ値は移る先の URL のクエリで渡す。App.tsx が読んで Route の element に 2 つ目の引数で渡し、受け取った画面は初期値としてだけ使う"
status: accepted
date: "2026-11-10"
supersedes: ["0018"]
superseded_by: null
basis: "requirements@e0386bd5e156703d4c781abc9f94eb7992f0fb17"
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
    text: "routes.tsx の path は docs/design/screens.yaml の route と同じ書式 (:name のパラメータを含む) で書く。App.tsx は path を / で区切って 1 区切りずつ照合し、:name の区切りは / を含まない空でない値 1 つに合う。Route の element の型は (params: Record<string, string>, query: Record<string, string>) => ReactNode の 1 つとし、App.tsx が取り出したパラメータの値 (名前は :name の name) を params に、クエリを query に渡す。パラメータもクエリも使わない画面・クエリを使わない画面は、引数の少ない関数 (() => ... や (params) => ...) のまま書いてよい。画面はパラメータもクエリも window.location から読まない。navigate() で移る先 (サインイン後の戻り先を含む) も同じ照合で画面を選ぶ"
  - scope: tier:frontend
    text: "ADR 0014 の「契約の x-test-headers と同じ形のトークン (Bearer test-employee-<社員>)」は Authorization ヘッダの値の形を指す。トークンの供給元が返すのは接頭辞の無い値 (本番はアクセストークンそのもの、テストは test-employee-a・test-employee-b) とし、Bearer は生成クライアントの options.fetch を包む 1 か所で 1 回だけ付ける"
  - scope: tier:frontend
    text: "サインインの完了 (OIDC クライアントの signinRedirectCallback を包むもの) はトークンの供給元のインターフェイスに持たせ、コールバックの画面は OIDC クライアントを直接 import しない"
  - scope: tier:frontend
    text: "OIDC の設定は環境変数 VITE_OIDC_AUTHORITY (発行者)・VITE_OIDC_CLIENT_ID・VITE_OIDC_REDIRECT_URI (画面のオリジン + /auth/callback)・VITE_OIDC_SCOPE で渡し、apps/frontend/src/api/ のトークンの供給元の本番の実装だけが読む。VITE_OIDC_SCOPE は openid と profile に加え、この API 向けのアクセストークンを得る値を含める"
  - scope: tier:backend
    text: "backend-api は CORS の許可 (Access-Control-Allow-Origin 等の応答ヘッダや CORS のミドルウェア) を入れない。画面は同じオリジンから呼ぶため要らない"
  - scope: tier:frontend
    text: "画面の間で値 (選んだ会議室・照会した日付と時間帯など) を引き継ぐときは、移る先の path のクエリ (例 /reservations/new?roomId=room-1&date=2026-11-10&startTime=10:00&endTime=11:00) に入れて App.tsx の navigate() で移る。クエリは URLSearchParams で組み立て、文字列を手で連結しない。履歴の state・sessionStorage 等のブラウザの保存場所・画面の間で共有するメモリ (モジュールの変数・共有の状態) では渡さない"
  - scope: tier:frontend
    text: "App.tsx は window.location.search を URLSearchParams で読み、同じ名前が複数あれば最初の値を取って query に入れて element に渡す。クエリが無ければ空のオブジェクトを渡す。App.tsx は popstate と navigate() の両方で pathname と search を追い、どちらかが変われば描き直す。画面の照合 (どの Route を選ぶか) は pathname だけで行い、クエリは照合に使わない"
  - scope: tier:frontend
    text: "クエリの名前は、移る先の画面の入力項目と同じ値を指す名前 (lowerCamelCase) にする。契約の識別子を渡すときは契約の項目名 (roomId など) を使う。値は移る先の画面の入力の形 (日付は YYYY-MM-DD、時刻は HH:MM。終了の 24:00 を含む) で入れる"
  - scope: tier:frontend
    text: "受け取った画面はクエリの値を入力の初期値としてだけ使う。値が欠けているか、入力の形に合わない (日付・時刻の書式でない、選択肢に無い会議室など) ときは、その項目を空のまま (既定のまま) にして社員に入力させ、エラーの表示も画面の遷移もしない。業務の検証 (過去でないか・時間帯の範囲など) は画面で足さず API に任せる"
  - scope: tier:frontend
    text: "引き継いだクエリは path の一部としてサインインの state (この ADR の、今の画面の path をクエリごと入れる規則) に入るので、サインインの往復の後も初期値として残る。画面で入力中に変えた値はクエリへ書き戻さず、サインインの往復で残さない (入力値は保存も復元もしない規則のとおり)"
---

# 背景

ADR 0018 を置き換える。予約の画面の着手前の点検 (課題 `docs/feedback/20261109_222249_precheck_precheck-reserve-room-frontend-2_screen-handoff-values.md`。点検から出た課題で、`from_uc` は無い) で、次の穴が見つかった。

- 空き状況の画面部品 (Screens/RoomAvailability の Reservable) と予約の画面部品 (Screens/ReserveRoom の Default) は、空き状況で選んだ会議室と照会した日付・開始時刻・終了時刻を予約の画面 (/reservations/new) へ引き継ぐと決めている。
- ADR 0018 の rules は、Route の element が受け取るのを path の `:name` のパラメータだけとし、画面が window.location からパラメータを読むことを禁じている。/reservations/new には path のパラメータが無い。
- 土台の App.tsx は pathname だけで照合し、navigate() は履歴の state を渡さない。
- クエリ・履歴の state・共有のメモリのどれで渡すかを決めた ADR が無く、どれを選んでも ADR 0018 の element の形か「画面は window.location から読まない」に触れる。
- ADR 0018 はサインインへ送るときに path をクエリ付きで state に入れる一方、入力値は保存も復元もしないと書いており、引き継いだ値がサインインの往復で残るかも決まっていない。

予約の画面の機能の中で決めると、後に値を引き継ぐ画面 (一覧から選んだものを別の画面に渡すとき) が別の方式を選んで食い違う。

最初はこの ADR を ADR 0018 への追記とし、ADR 0018 をそのまま有効にしていた。決定のレビューで、ADR 0018 の「Route の element は `(params) => ReactNode`」とこの ADR の「`(params, query) => ReactNode`」が、どちらも有効な規則として開発ルールに並ぶと分かった。routes.tsx の Route の element の型の宣言は 1 つで、1 引数の型で宣言すると App.tsx が query を渡せず型検査が落ちるので、両方には従えない。ADR は本文と rules を書き換えずに履歴を残す決まりのため、ADR 0018 を置き換え、その rules をこの ADR に引き継ぐ。

- ADR 0018 の rules 10 本は、画面の照合の規則を除いて文面を変えずに引き継ぐ (同じオリジンの配信・開発時の中継・サインインのコールバックと戻り先・トークンの形・サインインの完了・OIDC の設定・backend-api の CORS)。
- 画面の照合の規則だけは、element の型を `(params, query) => ReactNode` の 1 つに直して引き継ぐ。1 引数の関数は 2 引数の型に代入でき、2 引数で呼ばれても動くので、ADR 0018 に沿って書いた既存の画面は変えなくてよい。
- ADR 0018 の決定の理由と却下した案は ADR 0018 の本文のとおり (この ADR では繰り返さない)。

ティア構成・依存のパッケージは変えない (URLSearchParams はブラウザの標準)。

# 決定

- ADR 0018 の決定 (同じオリジンの配信、開発時の中継、/auth/callback の 1 画面で元の画面へ戻す、パラメータ付きの path の照合、トークンの形、OIDC の設定の渡し方、backend-api は CORS を入れない) はそのまま引き継ぐ。
- 画面の間で引き継ぐ値は、移る先の URL のクエリに入れる。
  - 例: 空き状況の画面で会議室を選ぶと `/reservations/new?roomId=room-1&date=2026-11-10&startTime=10:00&endTime=11:00` へ移る。
  - クエリは URLSearchParams で組み立てる。
  - 履歴の state・ブラウザの保存場所・共有のメモリでは渡さない。
- App.tsx がクエリを読み、Route の element に 2 つ目の引数 `query` で渡す。
  - element の型は `(params, query) => ReactNode` の 1 つにする (ADR 0018 の 1 引数の型は使わない)。クエリやパラメータを使わない画面は、引数の少ない関数のまま書いてよい。
  - 画面はパラメータもクエリも window.location から読まない。
  - App.tsx は pathname と search の両方を追う。どの画面を選ぶかは pathname だけで決める。
- クエリの名前と値の形は、移る先の画面の入力に合わせる。

| 名前の例 | 中身 | 形 |
|---|---|---|
| roomId | 会議室 (契約の識別子の項目名) | 契約の識別子 |
| date | 日付 | YYYY-MM-DD |
| startTime / endTime | 開始・終了の時刻 | HH:MM (終了は 24:00 を含む) |

- 受け取った画面は、クエリの値を初期値としてだけ使う。
  - 欠けた値や形の合わない値は空のまま (既定のまま) にして、社員に入力させる。エラーは出さない。
  - 業務の検証 (過去でないか・時間帯の範囲) は画面で足さず、API に任せる。
- サインインの往復 (最初の表示・401) では、クエリが path と一緒にサインインの state に入るので、引き継いだ値は残る。入力中に変えた値は残さない (引き継いだ「入力値は保存も復元もしない」のとおり)。

# 却下した案

- ADR 0018 を有効のまま残し、この ADR で element の型を上書きする (「食い違って読めるときはこの ADR を優先する」と書く): 開発ルールに 1 引数と 2 引数の型が両方残り、ADR 0018 の節だけを読んだ実装者が 1 引数の型で宣言すると、query を渡す App.tsx の型検査が落ちる。読み分けを書いても、型の規則は 1 つにならない。
- 履歴の state (pushState の第 1 引数) で渡す: サインインの state には path しか入らないため、サインインの往復で値が消える。画面を読み込み直しても消え、URL を共有しても値が伝わらない。
- sessionStorage 等のブラウザの保存場所で渡す: 書く画面と読む画面の両方に保存と後始末が要り、別のタブで開いた画面と食い違う。ADR 0019 はトークンについて保存場所を避けており、方式が揃わない。
- 画面の間で共有するメモリ (モジュールの変数・共有の状態) で渡す: 読み込み直しとサインインの往復で消え、画面どうしが共有の状態でつながる。
- 画面が window.location.search を自分で読む: ADR 0018 がパラメータで却下したのと同じ理由 (解析が画面ごとに散らばり、入口関数の引数で値を渡すテストの形と合わない)。
- 予約の画面の path にパラメータで入れる (/reservations/new/:roomId など): 画面の設計 (docs/design/screens.yaml の route) を変えることになり、日付や時間帯のように省ける値を path で表せない。
- 形の合わない値でエラーを出す・空き状況の画面へ戻す: 引き継ぎは入力の手間を省くためのもので、値が無くても予約の画面で入力できる。業務の検証は API が返す (ADR 0010 のエラーの扱い)。

# 影響

- ADR 0018 は置き換え済み (superseded) になり、その rules はこの ADR から開発ルールに入る。ADR 0019・0020 の本文の「ADR 0018 のとおり」(サインインの戻り先・入力値を戻さない・トークンの形) は、この ADR に引き継いだ同じ規則を指す。
- 予約の画面の機能が土台に次を足す: App.tsx の search の追跡と query の受け渡し、routes.tsx の Route の element の型 (2 つ目の引数)、navigate() がクエリ付きの path を受けること。足した結線は AssumptionRecord に書き、後の画面の機能はそれに載せる。App.tsx と routes.tsx は土台の生成が再実行で上書きしないファイルなので、画面の機能が手で直す。
- 空き状況の画面は、会議室を選んだときにクエリ付きの path で予約の画面へ移る。空き状況の画面の既存の部分 (照会) は変えない。既存の画面の入口関数は 1 引数のままでよい。
- 引き継いだ値は URL に見える (会議室の識別子・日付・時刻だけで、個人情報は含まない)。個人情報や秘密の値はクエリで渡さない。
- ADR 0018 の影響 (本番の前段の配信、認証基盤へのリダイレクト先の登録、scope の値は認証基盤の登録のときに決める) はそのまま残る。
- 開発ルール (docs/rules/tier-frontend.md・tier-backend.md・common) はこの ADR の受理後に作り直す。アーキテストの規則は増えない (層とティアの依存は変えない)。
