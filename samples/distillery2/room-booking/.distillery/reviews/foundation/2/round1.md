## (1) 観点サマリ

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | ADR との縦の整合 | PASS | — | 開発ルール、依存方向の検査、実行設定、CI を受理済み ADR と照合した |
| P2 | 契約の骨格と画面部品 | CONCERN | 指摘 1 | 認証契約のトークン種別が ADR と食い違う |
| P3 | 基盤の中の横の整合 | CONCERN | 指摘 2 | DB 契約に表がある一方、migration と契約テストが無く、CI はテスト0件を許す |

## (2) 指摘

### 指摘 1
- **perspective**: P2
- **対象**: `contracts/openapi/openapi.yaml:9-10, 23-28`
- **severity**: high
- **claim**: API に送る Bearer トークンを OpenAPI は ID トークンと定めるが、ADR 0014 はアクセストークンを送る設計にしている。
- **evidence**: OpenAPI の説明と `bearerAuth` は ID トークンを指定している。`docs/adr/0014-tier-structure-frontend-oidc.md:79-84` は供給元がアクセストークンを返し、ID トークンは表示名の取得に使うと定めている。
- **why_raised**: frontend が ADR どおりに実装し、backend-api が契約どおりに検証すると、正規の API 呼び出しが認証に失敗する。認証境界の実装判断に直接影響する。
- **suggested_fix**: API 用のトークン種別を決定し、OpenAPI と ADR の記述を一致させる。

### 指摘 2
- **perspective**: P3
- **対象**: `contracts/db/domains/room_reservation.yaml:4-5, 109-124`、`.distillery/config.yaml:33`
- **severity**: medium
- **claim**: DB 契約は4表と二重予約を防ぐ主キーを定義しているが、対応する migration と契約テストは生成されていない。CI の契約テスト実行は0件でも成功する設定になっている。
- **evidence**: `apps/backend-api/migrations/` と `apps/backend-api/test/contract/` にファイルが無い。`scripts/check.mjs:28` は契約テストに `--passWithNoTests` を付ける。`packages/test-support/src/pglite-harness.ts:60-64` は migration ディレクトリが無ければ DB を用意しない。
- **why_raised**: この基盤のまま CI を通しても、契約が定める二重予約防止の DB 制約は検証されない。後続の UC 実装者には、契約テストが通ったように見える。
- **suggested_fix**: DB 契約から migration と制約テストを生成し、契約テスト0件を成功扱いにしない。

## (3) below-threshold

- P2 low `Problem.detail` は ADR 0010 が業務エラーへの設定を求める一方、OpenAPI の必須項目には含まれない。

Codex session ID: 01a1a6b1-2269-77d2-a0e0-394f76d7cef8
Resume in Codex: codex resume 01a1a6b1-2269-77d2-a0e0-394f76d7cef8
