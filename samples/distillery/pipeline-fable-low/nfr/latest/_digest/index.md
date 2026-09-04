# nfr digest index

- source: `nfr/latest/nfr-grade.yaml`
- source_sha256: `f352e424419f352fb0a55e65541b02a9f420d7d6b9dec9d2a0f3b5de39d04780`
- generated_by: `buildDigest.js`（派生物。正本の sha256 と各 file の sha256 が一致するときだけ有効。不一致なら再生成する）

| section | file | name | lines | bytes | status | file_sha256 |
|---|---|---|---:|---:|---|---|
| `model_system` | `_digest/model_system.yaml` | - | 3 | 619 | ok | `c8adda787950e9475728b493b121f614a38b43b1db01f51bc91663f3b2066dc8` |
| `categories[id=A]` | `_digest/category-A.yaml` | 可用性 | 183 | 8720 | ok | `25c6ac654948fe31b1d73d3293615fd71ce336ccd3e0a341ea887ce9c81ced62` |
| `categories[id=B]` | `_digest/category-B.yaml` | 性能・拡張性 | 179 | 9576 | ok | `597f8c25031d9f036042e58f7b5a0fc77046cd84957d20ed63cc55ef4c8f8411` |
| `categories[id=C]` | `_digest/category-C.yaml` | 運用・保守性 | 241 | 11477 | ok | `b083bad7cf2114e5e055fcbd724c87a93839eaf34c25d611db4ebf744a6a42b3` |
| `categories[id=D]` | `_digest/category-D.yaml` | 移行性 | 118 | 6710 | ok | `f9dcf182f8cef9148cf4e1eb2bc168e729891e71a7951868cfeaa8d7e6058064` |
| `categories[id=E]` | `_digest/category-E.yaml` | セキュリティ | 272 | 14219 | ok | `35d46a715664155857e6df32f51410afcb6ebb653a2966113dc743a5ca9093b5` |
| `categories[id=F]` | `_digest/category-F.yaml` | システム環境・エコロジー | 158 | 8141 | ok | `be974ea12f5f7f3a133396accd9ca36416b310de6ff4cd3ad6ed46b0422b7ea3` |

読み方: 必要な section の file だけを読む。`not_applicable` は正本にセクションが無い（元ファイルを読みに行かない）。
nfr の `name` 列はカテゴリ名（id ↔ 名前の対応はここで確認する）。
