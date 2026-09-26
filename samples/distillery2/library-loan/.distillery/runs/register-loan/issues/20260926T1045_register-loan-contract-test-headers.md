---
kind: contract
title: "契約テストが必須ヘッダを送らない"
uc: "register-loan"
tier: "backend-api"
---

## 事実

- 契約 `POST /loans` (registerLoan) は `Idempotency-Key` ヘッダを `required: true` とし、`security: bearerAuth` を要求する。
- 生成された契約テスト `apps/backend-api/test/contract/registerLoan.test.ts` は、どの example でも `Authorization` と `Idempotency-Key` を送らない。
- 契約どおりに実装すると、このテストは 401 / 400 になり、example の 201 / 409 を検証できない。

## 実装側の対応 (暫定)

- 本番の入口 (`createApp`) は契約どおり、ヘッダが無ければ 401 / 400 を返す。
- テスト用の入口 (`createTestApp`) だけが、ヘッダが無い要求に司書のテストトークンと新しい `Idempotency-Key` を補う。
- この判断は AssumptionRecord A-009 に記録した。

## 求める変更

- 契約テストの生成器 (d2-contract genContractTests) が、`required: true` のヘッダ parameter の `example` と securityScheme 用のテスト資格情報を要求に付けるようにする。
- 例: `.set('Idempotency-Key', <example>)`、`.set('Authorization', 'Bearer <test token>')`。テストトークンの受け渡し口 (test-app の export 名など) も生成側で決める。
- 生成器が直れば、`createTestApp` の既定ヘッダ補完 (A-009) は外せる。
