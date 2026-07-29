# 冪等キー重複時の挙動: kvs-schema.yaml と tier-backend-api.md の記述差

## 仕様の記載

- `_cross-cutting/datastore/kvs-schema.yaml` の `idempotency:{idempotency_key}` パターン:
  `value_description: "処理済みレスポンスのJSON文字列。重複リクエスト時にキャッシュから返却"`
  → 重複時は元の成功レスポンス(201)をキャッシュから返す、と読める一般的な冪等性の説明。
- `tier-backend-api.md` エラーレスポンス表 / ティア完了条件(BDD)「冪等キー重複での二重貸出防止」:
  `409 | 冪等キー重複 | RFC 7807: detail="このリクエストは既に処理済みです"`
  → このAPIに限っては明示的に 409 を返す、とテストされている。

## 実装で判明した事実

両者は一般ルール(kvs-schema.yaml、全API共通の説明)と個別ルール(tier-backend-api.md、
本UC固有かつ BDD で実行検証される)の関係にあり、後者の方がこの UC/tier に対しては
具体的かつテスト可能な正本と判断した。

## 対応

`createLoanUseCase` は冪等キー重複時に常に 409 + 指定 detail を返す実装とした
(キャッシュ済みレスポンスの再送はしない)。ティア BDD シナリオ2はこれで pass する。

## 提案

他 UC(予約作成・予約キャンセル等、同じ idempotency パターンを使う API)でも同様の判断が
必要になるはずなので、`_cross-cutting/datastore/kvs-schema.yaml` の記述を
「重複時の挙動は各 API 仕様(tier-*.md のエラー表)を優先する」旨に補足するか、
全API共通で 409 に統一するなら kvs-schema.yaml 側の記述を訂正することを検討されたい。
