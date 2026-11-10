## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | CONCERN | 指摘 1 | Web 画面を使う要求に対し、ブラウザで主要操作を通す受入確認が依然として無い |
| P2 | ADR どうしの横の整合 | CONCERN | 指摘 2 | 新しい ADR 0021 と有効な ADR 0018 が、同じ `Route.element` に異なる型を指定している |
| P3 | 決めずに残した点 | PASS | なし | 移行方法、認証基盤、稼働時間などの仮置きは確認事項として返されている |

## (2) 指摘

### 指摘 1
- **perspective**: P1
- **対象**: [docs/adr/0007-testing-strategy.md:41](<repo>/docs/adr/0007-testing-strategy.md:41)、[docs/rules/testing.md:53](<repo>/docs/rules/testing.md:53)
- **severity**: medium
- **claim**: 前回指摘した、Web 画面の主要操作をブラウザで受入確認しない問題が残っている。
- **evidence**: 要望は Web 画面での空き状況の確認、予約、取消を求める。ADR 0007 はブラウザ受入を行わず、画面のボタンと API の結線誤りを受入では見つけられないと明記する。生成された testing rules もブラウザドライバを使わない。
- **why_raised**: API の確認が通っても、社員が画面から予約や取消を実行できない状態を受け入れ得る。
- **suggested_fix**: 空き状況の確認、予約、取消の代表経路をブラウザから通して確認する。

### 指摘 2
- **perspective**: P2
- **対象**: [docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:24](<repo>/docs/adr/0018-frontend-api-origin-dev-proxy-signin-callback.md:24)、[docs/adr/0021-frontend-screen-handoff-query.md:16](<repo>/docs/adr/0021-frontend-screen-handoff-query.md:16)
- **severity**: medium
- **claim**: 修正で追加された ADR 0021 は `Route.element` を 2 引数の型と定めるが、置き換えていない ADR 0018 は 1 引数の型と定めたままである。
- **evidence**: 両 ADR は `accepted` で、ADR 0021 は ADR 0018 を置き換えないと明記する。生成された [tier-frontend rules](<repo>/docs/rules/tier-frontend.md:71) にも両方の指定が残る。
- **why_raised**: 予約画面へクエリ値を渡すために型を実装する際、どちらの有効なルールに従うかで実装と型検査の結果が変わる。
- **suggested_fix**: ADR 0018 の型指定を更新するか、ADR 0021 がその指定を置き換えることを明示し、生成ルールを一つの型に揃える。

## (3) below-threshold

- P3 low 移行の全件照合は NFR に追加されたが、ADR の確認事項には「確かめる手順が無い」という旧文面が残る。
- P2 low ADR 0016 の影響欄には、修正済みの NFR がなお食い違うという旧記述が残る。

Codex session ID: 01a1c26d-be39-7091-9f98-cb0a280cb041
Resume in Codex: codex resume 01a1c26d-be39-7091-9f98-cb0a280cb041
