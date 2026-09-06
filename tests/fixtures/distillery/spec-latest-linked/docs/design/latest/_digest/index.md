# design digest index

- source: `design/latest/design-event.yaml`
- source_sha256: `a7c591614e86518c64bedfab204693aecdd149bcc2c0a230692d585870a9e4cf`
- generated_by: `buildDigest.js`（派生物。正本の sha256 と各 file の sha256 が一致するときだけ有効。不一致なら再生成する）

| section | file | name | lines | bytes | status | file_sha256 |
|---|---|---|---:|---:|---|---|
| `brand` | `_digest/brand.yaml` | - | 40 | 1612 | ok | `19d43f8bde5d2a2aa082ec4b073d525ddb79102e3ad591f0f6e4ae3f04f0bda0` |
| `portals` | `_digest/portals.yaml` | - | 11 | 249 | ok | `08c81f576fb24bfe486219d5df9f09169683f51858faa114e1e756bdb259e8ab` |
| `tokens` | `_digest/tokens.yaml` | - | 294 | 8772 | ok | `dec7b99f0bba8fb0029783bdd6a626561ada03c5c561cbec659e4308b78413a9` |
| `components` | `_digest/components.yaml` | - | 483 | 19214 | ok | `bd02d7ccc036b9a858c305abbac62346a726e3df9c560ecaccfaf9a97554af71` |
| `screens` | `_digest/screens.yaml` | - | 688 | 18193 | ok | `77b89b9c6f59f94d6ab227b6fc459f07e937a2c67b5abd31543f5a4df29d81c2` |
| `states` | `_digest/states.yaml` | - | 115 | 4213 | ok | `041bb468ed9d5629d0ef4ea9fbfc36007382da610a19c15c0e8721af05a6ba0c` |
| `nfr_decisions` | `_digest/nfr_decisions.yaml` | - | 25 | 3065 | ok | `9fa5de00e4f7829eea0fcd266148ba5a6e0f64ee394b6bf5301f5c5f8cba7809` |
| `storybook` | `_digest/storybook.yaml` | - | 22 | 1307 | ok | `e8c6bd4ea3f892f14904aa2f740b21605790fcd7efb0fe770d5497e49dfa172e` |

読み方: 必要な section の file だけを読む。`not_applicable` は正本にセクションが無い（元ファイルを読みに行かない）。
nfr の `name` 列はカテゴリ名（id ↔ 名前の対応はここで確認する）。
