# d2-contract トラブルシューティング

契約と契約テスト (genContractTests / 提供側の test-app) で踏んだ問題。実走で踏んだ環境依存の問題と回避策をためる (手順そのものには書かない)。項目は「症状 → 原因 → 回避」の順。
他のスキルの項目: [`d2-run`](../../d2-run/references/troubleshooting.md) / [`d2-foundation`](../../d2-foundation/references/troubleshooting.md)

## 契約テストの 401 が、提供側のテスト用ヘッダ補完のせいで落ちる (0.1.16 より前の実装)

- 症状: 0.1.15 以前に作った提供側の `test-app.ts` が Authorization を補うため、`x-headers: { Authorization: null }` の 401 テストが 200 になる
- 原因: 契約テストがヘッダを送れなかった頃の回避策が残っている
- 回避: 既存の operation にも `x-test-headers` を足して契約テストを作り直し、そのうえで提供側の補完を外す (0.1.16 の再実走でこの順に実施)
