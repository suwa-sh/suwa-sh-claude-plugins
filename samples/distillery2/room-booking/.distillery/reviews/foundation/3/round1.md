## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | ADR との縦の整合 | PASS | — | ADR 0017 の開発ルールへの反映と、依存検査・CI の設定を確認した |
| P2 | 契約の骨格と画面部品 | CONCERN | 指摘 1 | 共通エラー文が契約で定めるエラー原因を狭く説明している |
| P3 | 基盤の中の横の整合 | CONCERN | 指摘 2 | config のテストコマンドと、テストがまだ無い骨組み・CI の扱いが異なる |

## (2) 指摘

### 指摘 1
- **perspective**: P2
- **対象**: `docs/design/storybook-app/src/components/domain/errorMessages.ts:8–15`、`packages/ui/components/domain/errorMessages.ts:8–15`
- **severity**: medium
- **claim**: `VALIDATION_ERROR` と `UNAUTHENTICATED` の文言が、それぞれ必須項目の未指定、ログイン期限切れだけを原因として示している。契約上は日時形式の誤りや、トークンの欠落・検証失敗も同じコードになる。
- **evidence**: 両ファイルの文言は同一。`contracts/openapi/openapi.yaml:146–153` は 400 に「日時の形式が違う」、401 に「トークンが無いか検証できない」を含めている。
- **why_raised**: 日時形式が誤った場合やトークンを検証できない場合、利用者に実際の原因と異なる説明が出て、修正すべき入力や認証状態を判断しにくくなる。
- **suggested_fix**: 各コードで起こり得る原因に共通して当てはまる文言にする。

### 指摘 2
- **perspective**: P3
- **対象**: `.distillery/config.yaml:17,31,33`
- **severity**: medium
- **claim**: config の単体・契約テストコマンドには、テストが0件の場合に通す指定がない。現在の骨組みには該当テストがなく、CI 用の `scripts/check.mjs` だけが `--passWithNoTests` を付けている。
- **evidence**: `contracts/uc-index.yaml:4` は `ucs: []`。`apps/*/vitest*.config.ts` はテストファイルを対象にしているが、現時点で該当ファイルは無い。`scripts/check.mjs:17,27–28` のコマンドには `--passWithNoTests` がある。
- **why_raised**: 最初の UC のテストを生成する前に config のコマンドを実行すると、テスト0件で失敗し、同じ骨組みに対する CI の判定と食い違う。
- **suggested_fix**: この段階でテスト0件を許す方針を config のコマンドにも反映する。

## (3) below-threshold

- P3 low frontend に契約テスト設定はあるが、config には frontend の契約テストコマンドが無い。現時点では UC と契約テストが0件。

Codex session ID: 01a1a845-bb75-7281-95f2-8fd318916a91
Resume in Codex: codex resume 01a1a845-bb75-7281-95f2-8fd318916a91
