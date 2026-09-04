# design digest index

- source: `design/latest/design-event.yaml`
- source_sha256: `22c0e9cf3d317c1de493b857b44d4e180fc0ab7249b138e3c9edbc450150e729`
- generated_by: `buildDigest.js`（派生物。正本の sha256 と各 file の sha256 が一致するときだけ有効。不一致なら再生成する）

| section | file | name | lines | bytes | status | file_sha256 |
|---|---|---|---:|---:|---|---|
| `brand` | `_digest/brand.yaml` | - | 40 | 1648 | ok | `b8d537a0efe83fa455deb5f18a0d835c0841077783296f4cd9214a06cefe0675` |
| `portals` | `_digest/portals.yaml` | - | 11 | 248 | ok | `712d84084d62ecafdc5efd7260d7efda95f528db440c9d1c7ceb7c64610fc37f` |
| `tokens` | `_digest/tokens.yaml` | - | 257 | 8017 | ok | `c650df82b0b28af359061949453acad534211d2f2cd32a69a5de779f9f763d73` |
| `components` | `_digest/components.yaml` | - | 439 | 15562 | ok | `ea8ca17d572c8f6a505dcebb663073709bbc9caf0cf15da9c8b1c6478c3d530a` |
| `screens` | `_digest/screens.yaml` | - | 357 | 9277 | ok | `5fbf2a055320d9f37fa87b3dad9e5bd48ddef588e1fe4a54fe93e68776c894a0` |
| `states` | `_digest/states.yaml` | - | 78 | 2131 | ok | `3d3758e27174e6c46741851b76d50bad53f310c56f41dab7b4aba89adb07a952` |
| `nfr_decisions` | `_digest/nfr_decisions.yaml` | - | 19 | 1926 | ok | `628b276373225e505242ab2d5bf047f26bd788403385b4526ee401d7276dff37` |
| `storybook` | `_digest/storybook.yaml` | - | 18 | 819 | ok | `5a0e1aedb6f668855a5353438166dcf76a0feb4d3c5bbb1af5f32e7939a55ae0` |

読み方: 必要な section の file だけを読む。`not_applicable` は正本にセクションが無い（元ファイルを読みに行かない）。
nfr の `name` 列はカテゴリ名（id ↔ 名前の対応はここで確認する）。
