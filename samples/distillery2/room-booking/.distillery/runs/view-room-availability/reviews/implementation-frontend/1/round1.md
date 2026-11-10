| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | シナリオと契約との縦の整合 | PASS | なし | 空き状況照会の要求・応答・エラーを feature と OpenAPI に照合した |
| P2 | ルールと ADR | CONCERN | 指摘 1 | 認証基盤から履歴で戻った後の再サインインが、ADR の決定どおりに動かない |
| P3 | ティアどうしの横の整合 | PASS | なし | 画面から生成クライアントまでの項目・エラーの受け渡しを確認した |
| P4 | 補った前提 | PASS | なし | 戻り先、クエリ、トークン保存先の実装上の前提を照合した |

### 指摘 1
- **perspective**: P2
- **対象**: `apps/frontend/src/api/oidcTokenProvider.ts:103`
- **severity**: medium
- **claim**: サインインの送出が正常に終了した後も `redirecting` が残り、同じページで次に `signIn()` を呼んでも認証基盤へ送られません。
- **evidence**: `redirecting` を `undefined` に戻す処理は `signinRedirect()` の失敗時だけです。`oidc-client-ts` のリダイレクト処理は `pageshow` で Promise を解決するため、履歴復帰したページでは解決済みの Promise が残り得ます。ADR 0014・0021 は未認証時と API の 401 時にサインインへ戻すと定めています。
- **why_raised**: 社員が認証基盤の画面からブラウザの「戻る」で復帰し、同じページで再び操作すると、トークンが無いままサインインを再試行できず、再読み込みが必要になります。
- **suggested_fix**: 同時実行中だけ送出を共有し、送出が終了したら成功・失敗のどちらでも `redirecting` を解除する。

## below-threshold

- P2 low パラメータの `%2F` を復号すると、ADR が禁じる `/` を含む値になる。現行の route にはパラメータ付き画面がない。

Codex session ID: 01a1c389-ca2e-7b01-9fa2-5f9b1b4cf47d
Resume in Codex: codex resume 01a1c389-ca2e-7b01-9fa2-5f9b1b4cf47d
