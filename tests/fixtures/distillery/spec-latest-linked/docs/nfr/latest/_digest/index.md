# nfr digest index

- source: `nfr/latest/nfr-grade.yaml`
- source_sha256: `9ecccca870476f5c8b048641028a922e9f2b393562b9bca87d4bd1f567861198`
- generated_by: `buildDigest.js`（派生物。正本の sha256 と各 file の sha256 が一致するときだけ有効。不一致なら再生成する）

| section | file | name | lines | bytes | status | file_sha256 |
|---|---|---|---:|---:|---|---|
| `model_system` | `_digest/model_system.yaml` | - | 3 | 604 | ok | `a96a15108c2daa3fb928bcf86686731fae0f6d452cc133eb1c8614d6d91f5a55` |
| `categories[id=A]` | `_digest/category-A.yaml` | 可用性 | 183 | 8986 | ok | `b1bef7942f5d4693e60ced25fb600e2ec0059bc5ec6585507c44d213acd6d3aa` |
| `categories[id=B]` | `_digest/category-B.yaml` | 性能・拡張性 | 179 | 9755 | ok | `b33d0820666287891246a5b9ff1db44db31c6429702c07ebced515c8fb561051` |
| `categories[id=C]` | `_digest/category-C.yaml` | 運用・保守性 | 241 | 11611 | ok | `752679f5ff2a1899cbfabfd46221ed8b30a6edca3c62abfc4407789a4235bfbd` |
| `categories[id=D]` | `_digest/category-D.yaml` | 移行性 | 118 | 6832 | ok | `c53a2e410b91135b020b2969920946dff7c05546d9243e735262d4002524f8ef` |
| `categories[id=E]` | `_digest/category-E.yaml` | セキュリティ | 272 | 15120 | ok | `e48c573bb35444bb922d5a3199c39c00093e2def2d6401a259cd14a87fcf7e2d` |
| `categories[id=F]` | `_digest/category-F.yaml` | システム環境・エコロジー | 158 | 8538 | ok | `96fc4635ed0b9d7d6e89182ae0db4be97a28abb56236b025be4e9ef2570c65f6` |

読み方: 必要な section の file だけを読む。`not_applicable` は正本にセクションが無い（元ファイルを読みに行かない）。
nfr の `name` 列はカテゴリ名（id ↔ 名前の対応はここで確認する）。
