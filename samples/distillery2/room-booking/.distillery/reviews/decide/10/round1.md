| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | PASS | — | 5部屋・利用者数十人という要望と、2ティア構成および非機能グレードの根拠を照合した。 |
| P2 | ADR どうしの横の整合 | CONCERN | 指摘 1 | テスト用トークンの返却値について、受理済みの決定がルール内で食い違う。 |
| P3 | 決めずに残した点 | CONCERN | 指摘 2 | 本番のコールバック URL を配信する条件が決定にも確認事項にもない。 |

### 指摘 1
- **perspective**: P2
- **対象**: [docs/rules/tier-frontend.md:53](<repo>/docs/rules/tier-frontend.md:53)、[同:72](<repo>/docs/rules/tier-frontend.md:72)
- **severity**: medium
- **claim**: ADR 0014由来のルールはテスト用の供給元が `Bearer test-employee-a` を返すと読める一方、ADR 0018由来のルールは `test-employee-a` を返すと定める。0018の説明を読めば意図は分かるが、実装規則として両方が残っている。
- **evidence**: ルール53行は「Bearer test-employee-<社員> … を返して」と記し、72行は供給元が返す値に接頭辞を付けず、`Bearer` は `options.fetch` 側で1回付けると記す。契約の `x-test-headers` は `Authorization: Bearer test-employee-a`。
- **why_raised**: 実装者が53行に従って返却値に `Bearer` を含めると、72行の付与処理によってヘッダが二重接頭辞になり、社員を切り替えるテストが失敗する。
- **suggested_fix**: 供給元の返却値は接頭辞なしとルールを統一し、ADR 0014の記述との優先関係も明示する。

### 指摘 2
- **perspective**: P3
- **対象**: [docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:14](<repo>/docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:14)、[同:20](<repo>/docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:20)
- **severity**: medium
- **claim**: 本番で `/auth/callback` をSPAの入口へ返す条件が未決定のまま、コールバックの配信が成立する前提になっている。
- **evidence**: ADR 0018は `/api` 以外を「画面の静的ファイル」へ振り分け、OIDCの戻り先を `/auth/callback` と定める。静的ファイルに対応しない画面URLを `index.html` へ返す規則、またはそれを配信環境で確認する問いは記されていない。
- **why_raised**: 本番の静的配信がURLをファイル名として解決する構成なら、認証基盤から戻った全社員の要求が `/auth/callback` で404になり、サインインを完了できない。
- **suggested_fix**: `/api` と実在する静的資産を除く画面URLはSPAの入口へ返すと決め、前段の配信が対応できるかを確認事項に加える。

### below-threshold

- P2 nit ADR 0019の「開発ルールは作り直しが要る」という影響欄は、対象ルールへ0019が反映済みの現在の状態と合っていない。

Codex session ID: 01a1a8b9-2c8b-7f71-afa6-338ee954dc00
Resume in Codex: codex resume 01a1a8b9-2c8b-7f71-afa6-338ee954dc00
