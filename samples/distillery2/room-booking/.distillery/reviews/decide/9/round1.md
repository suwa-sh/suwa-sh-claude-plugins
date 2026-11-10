## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | PASS | — | 社員数十人・会議室5部屋という要望と、非機能グレード、2ティア構成、認証委任を照合した。 |
| P2 | ADR どうしの横の整合 | FAIL | 指摘 1, 2, 3 | テスト用トークンの形式と付与方法、戻り先の経路と画面切替、入力保持の説明に不整合がある。 |
| P3 | 決めずに残した点 | PASS | — | 認証基盤の対応、API向けトークン、同一オリジン配信の可否と scope は確認事項として返されている。 |

## (2) 指摘

### 指摘 1
- **perspective**: P2
- **対象**: `docs/adr/0014-tier-structure-frontend-oidc.md:53, 81–82`
- **severity**: high
- **claim**: テスト用の供給元が返す値に `Bearer` を含める記述と、供給元の値に `Bearer` を付けて送る記述が両立していない。
- **evidence**: ADR はテスト用の供給元が `Bearer test-employee-a` と同じ形のトークンを返すとし、別の箇所では要求ごとに `Authorization: Bearer <トークン>` を付けるとしている。契約の `x-test-headers` は `Authorization: Bearer test-employee-a`。
- **why_raised**: 記述どおりに組み合わせると `Bearer Bearer test-employee-a` になり、社員を切り替えるテストの認証が通らない。
- **suggested_fix**: 供給元は接頭辞なしのトークン値を返し、ヘッダを組み立てる箇所で一度だけ `Bearer` を付けると明記する。

### 指摘 2
- **perspective**: P2
- **対象**: `docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:22, 53`、`docs/design/screens.yaml:76`
- **severity**: high
- **claim**: サインイン前の画面へ戻す決定は、予約取消画面の経路では現在の画面切替方式と整合しない。
- **evidence**: ADR 0018 は保存した path へ `App.tsx` の `navigate()` で戻す。設計上の取消画面は `/my-reservations/:reservationId/cancel` だが、現在の `App.tsx:20` は `route.path === pathname` の完全一致で経路を探す。
- **why_raised**: 予約取消画面からサインインに進んだ社員は、戻った後に実際の予約 ID を含む path が経路表と一致せず、「画面が見つかりません」に到達する。
- **suggested_fix**: パラメータ付き経路の照合方法を決定し、戻り先にも同じ照合を適用する。

### 指摘 3
- **perspective**: P2
- **対象**: `docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:22, 52–53, 70`
- **severity**: medium
- **claim**: 元の path へ戻すことを、予約画面の入力喪失を避ける理由にしているが、決定した保存対象は path とクエリだけである。
- **evidence**: ADR は OIDC の state に「今の画面の path（クエリを含む）」を入れると定める。一方、先頭画面へ戻す案を退ける理由には「開いていた画面と入力を失う」と記す。フォームの入力値を保存・復元する決定はない。
- **why_raised**: 予約フォームを入力中に401となった社員は、サインイン後に同じ画面へ戻れても、入力内容は復元されない。却下理由から期待される挙動と実際の決定が食い違う。
- **suggested_fix**: 入力保持を求めるなら保存・復元方法を決める。求めないなら、却下理由を「開いていた画面を失う」に限定する。

## (3) below-threshold

- P2 low 指定された `0014-frontend-oidc-auth-code-pkce.md` は存在せず、ADR一覧が指す `0014-tier-structure-frontend-oidc.md` を確認した。

Codex session ID: 01a1a860-ef73-7422-a454-1f6d583ae0a9
Resume in Codex: codex resume 01a1a860-ef73-7422-a454-1f6d583ae0a9
