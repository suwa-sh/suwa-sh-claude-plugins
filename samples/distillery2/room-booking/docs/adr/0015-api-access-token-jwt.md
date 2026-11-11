---
id: "0015"
title: "API のトークンは認証基盤が発行する JWT とし、backend-api が検証して社員 ID を得る"
status: accepted
date: "2026-11-04"
supersedes: []
superseded_by: null
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
nfr_refs: ["E.5.1.1", "E.5.2.1"]
scope: [system, app]
confidence: low
rules:
  - scope: common
    text: "API の Authorization ヘッダ (Bearer) に載せるのは、社内の認証基盤が JWT で発行するアクセストークンとする。ID トークンを API に送らない (ID トークンは frontend が表示名を読むためだけに使う)"
  - scope: tier:frontend
    text: "トークンの供給元が Authorization ヘッダに付けるのはアクセストークンとする。ID トークンを Bearer に付けない"
  - scope: tier:backend
    text: "backend-api のトークンの検証器 (TokenVerifier の本番の実装) は、アクセストークンを JWT として jose で検証する。署名は認証基盤の公開鍵 (発行者が公開する鍵の一覧) で確かめ、発行者 (iss)・宛先 (aud)・期限 (exp) が合わなければ 401 にする。発行者・宛先・鍵の一覧の場所は環境ごとの設定にする"
  - scope: tier:backend
    text: "社員 ID はアクセストークンの sub から取る。sub が無いトークンは 401 にする"
---

# 背景

契約の骨格の段の第三者レビューの後の引き継ぎ (課題 `docs/feedback/20261104_131802_contract-skeleton_contract-skeleton-refute-20261104T131550Z_adr-access-token-wording.md`。UC からではなく契約の骨格の段から出た課題で `from_uc` は無い) で、次の食い違いが見つかった。

- 契約 (`contracts/openapi/openapi.yaml` の `bearerAuth`) は、API の Bearer を「社内の認証基盤が発行したアクセストークン (JWT)。sub を社員 ID として使う」に直した。ADR 0014 のトークンの供給元が「アクセストークンを返す」と決めているのに合わせたもの。
- 一方、ADR 0002 の gateway の説明は「ID トークンの検証の鍵の取得」と書いたままで、API に送るのがどちらのトークンかが ADR の間で食い違って読める。ADR 0002 は ADR 0013 に置き換わっており、本文は決定の履歴として変えない。
- ADR 0006 と ADR 0014 の前提 (確認してほしいこと) は「OIDC に対応する」「ID トークンに name クレームを入れる」だけで、「アクセストークンを JWT で発行し、sub に社員の識別子を入れる」が無い。backend-api は jose で JWT を検証する前提 (ADR 0014 の packages) なので、認証基盤のアクセストークンが中身の読めない文字列 (不透明なトークン) だと検証できない。

旧 ADR の本文は変えられないため、API に送るトークンの種類と検証の仕方をこの ADR で決め直す。ADR 0006・0013・0014 の決定 (認証の委任・層の構成・トークンの供給元) は置き換えず、そのまま有効とする。

# 決定

- API に送るトークンは、社内の認証基盤が JWT で発行するアクセストークンにする。ID トークンは API に送らず、frontend が表示名 (`name` クレーム) を読むためだけに使う (ADR 0014 のとおり)。
- backend-api の本番のトークンの検証器は、アクセストークンを jose で JWT として検証する。
  - 署名は認証基盤が公開する鍵の一覧で確かめる (鍵の一覧の取得は gateway の中で行う。ADR 0002 の「ID トークンの検証の鍵の取得」は、この ADR では「アクセストークンの検証の鍵の取得」と読み替える)。
  - 発行者 (iss)・宛先 (aud)・期限 (exp) のどれかが合わなければ 401 (UNAUTHENTICATED) にする。
  - 社員 ID は sub から取る。sub が無ければ 401 にする。
- 発行者・宛先・鍵の一覧の場所は環境ごとの設定にする。
- テストの扱いは変えない。テストの composition root ではテスト用の検証器に差し替え、契約の x-test-headers の形 (`Bearer test-employee-<社員>`) で社員を決める (ADR 0006・0014 のとおり)。テスト用の検証器は JWT の検証をしない。

# 却下した案

- ID トークンを API の Bearer に送る: ID トークンはサインインした本人を frontend に伝えるためのもので、API の利用の許可の証明に使うのは OIDC の想定外になる。宛先 (aud) は frontend のクライアント ID になり、API の側で宛先を確かめられない。
- アクセストークンを不透明なトークンとし、backend-api が毎回認証基盤に問い合わせて確かめる (トークンの照会): 要求ごとに認証基盤への呼び出しが増え、jose で手元で検証する ADR 0014 の前提と合わない。認証基盤が JWT を出せない場合にだけ置き換えを考える。
- 宛先 (aud) を確かめない: 同じ認証基盤が別のシステム向けに出したアクセストークンでも API を呼べてしまう。

# 影響

- 社内の認証基盤が、このシステムの API 向けのアクセストークンを JWT で発行し、sub に社員の識別子を入れ、aud にこの API の宛先の値を入れることが前提になる (確認してほしいこと。ADR 0006・0014 の前提に加わる)。満たさない場合は、トークンの照会に切り替えるためにこの ADR を置き換える。
- backend-api の設定に、発行者・宛先・鍵の一覧の場所が加わる。
- 契約 (`bearerAuth` の bearerFormat: JWT と説明) とこの ADR の決定が一致する。契約は変えない。
- 開発ルール (docs/rules/) とアーキテスト (.dependency-cruiser.cjs) は作り直しが要る (この ADR の受理後に行う)。アーキテストの規則は増えない (層とティアの依存は変えない)。
