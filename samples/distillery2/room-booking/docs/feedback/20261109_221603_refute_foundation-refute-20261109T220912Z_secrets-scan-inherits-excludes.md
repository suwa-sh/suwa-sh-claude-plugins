---
kind: plugin
title: 秘密の検出が生成物の除外を受け継ぐ
source: "handoff:refute"
workaround: true
from_uc: null
status: open
created: "2026-11-09T22:16:03Z"
---

checks.js:33 は secrets を「qlty check --all ... --filter trufflehog」にし、genQlty.js の overlay (L248-253) は生成物 (packages/ui・packages/contracts・contracts/generated・docs/design/storybook-app・docs/design/screenshots・**/test/contract・.distillery) を全プラグイン共通の exclude_patterns に入れる。exclude_patterns は trufflehog にも効くので、ADR 0012 の「リポ全体の秘密の検出」が生成物を見ない。qlty の既定の除外 (**/seed/**・**/templates/**・**/assets/** など) も同じく trufflehog から隠れる。genQlty.js --refresh はプラグインを足すと overlay を当て直し、生成物を exclude_patterns に戻す

## 根拠

回避の前は trufflehog の検査が 156 ファイル、生成物の除外を [[exclude]] (trufflehog 以外) に移した後は 594 ファイル (qlty 0.618.0、--no-cache で実測)。レビュー foundation/6 round1 の指摘 1

## 推奨の直し方

genQlty.js は生成物の除外を exclude_patterns ではなく、trufflehog を除くプラグインを並べた [[exclude]] に書く (refresh でプラグインを足したときはその plugins にも足す)。qlty の既定の除外を trufflehog にも効かせてよいかも見直す

## リポの中での回避

.qlty/qlty.toml の exclude_patterns から生成物の 7 パターンを外し、ファイル末尾に [[exclude]] (plugins = actionlint・biome・ripgrep・zizmor・osv-scanner、file_patterns = 生成物の 7 パターン) を手で足した。commands.quality は exit 0 で指摘は前と同じ (features の TODO の note 3 件だけ)、生成物には trufflehog だけが走る。genQlty.js --refresh がプラグインを足したときは、生成物が exclude_patterns に戻るので [[exclude]] に移し直し、足したプラグインを plugins に加える
