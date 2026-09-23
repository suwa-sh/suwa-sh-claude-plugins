# mcp-server ティアのルール

- **入力**: 自ティアが関与する契約の生成型、UC の `.feature`。
- tool 名・入出力 JSON Schema・エラー形式が契約面。スキーマからの逸脱は変更要求経由。
- tool の description・スキーマは仕様の記載から転写する。実装の都合で意訳しない。
- 副作用を伴う tool は tracer 経由の port にまとめ、シナリオトレースに載るようにする。
