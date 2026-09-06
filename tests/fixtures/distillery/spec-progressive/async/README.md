# 分割AsyncAPIの実行例

`spec-contracts` の貸出登録が送信する既存 `sendLoan` 契約を分割した例。
業務仕様を追加せず、統合文書が元のAsyncAPIと同値であることをテストする。
貸出業務本体の全pipeline再生成を表すものではない。

- 編集: `_cross-cutting/api/asyncapi.yaml` → `operations/sendLoan.yaml` → `channels/loan-created.yaml` → `components/messages/LoanCreated.yaml` → `components/schemas/LoanCreatedPayload.yaml`
- 人が全体を見る/コード生成: `_cross-cutting/api/generated/asyncapi.bundle.yaml`
- 貸出登録の実装担当: `貸出業務/貸出フロー/貸出登録/_api-summary.yaml` と `_contract-slice.json`

```sh
node plugins/distillery/skills/dist-spec/scripts/compileContracts.js samples/distillery/spec-progressive/async
node plugins/distillery/skills/dist-spec/scripts/compileContracts.js samples/distillery/spec-progressive/async --check
node --test tests/dist-spec-split-asyncapi.test.js
```

`npm ci` 済みのリポジトリルートから実行する。入力は通常のYAML、生成物は再現性を保つJSON形式のYAML。
入口・分割ファイルを手編集すると、`--check` がbundleと影響UCの再生成漏れを検出する。
生成物は直接編集しない。過去イベント固定の参照は使用していない。
