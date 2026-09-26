---
id: "0002"
title: "全ティアを TypeScript で書き、HTTP サーバーの具体的なフレームワークは段階③で契約生成との相性から選ぶ"
status: accepted
date: 2026-09-26
supersedes: []
superseded_by: null
basis: "requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518"
nfr_refs: ["F.1.1.1", "F.2.1.1", "C.4.1.1"]
scope: [system, app]
confidence: medium
rules:
  - scope: common
    text: "全ティアを TypeScript (strict モード) で書き、any を使わない"
  - scope: common
    text: "ティア間でやり取りする型は契約 (OpenAPI / DB スキーマ) から生成したものを使い、手で重複定義しない"
  - scope: tier:backend
    text: "HTTP フレームワーク固有の型は presentation 層に閉じ込め、usecase 以下へ漏らさない"
---

# 背景

3 ティア (ADR 0001) を 1 つのリポジトリで開発し、契約から型とテストを生成する。
Web アプリケーションとして OS に依存しない形で提供し (NFR F.1.1.1)、特定ベンダーに依存しない (NFR F.2.1.1)。

# 決定

- frontend・backend-api・worker をすべて TypeScript で書き、1 つのモノレポで管理する。
- 実行環境は Node.js 互換のランタイムとする。
- backend-api の HTTP フレームワークは未定とする。段階③で OpenAPI 契約から型とルーティングを生成しやすい軽量なものを選ぶ。
- frontend のフレームワークは ADR 0008 で決める。

# 却下した案

- backend-api を別言語 (Java / Go 等) で書く案: 契約から生成する型を frontend と共有できず、テストスタックも二重になる。
- この時点で HTTP フレームワークを固定する案: 契約生成の方式が段階③で決まるため、先に固定すると作り直しの恐れがある。

# 影響

- 契約型・テストツールを全ティアで共有でき、UC 単位の縦切り実装が速くなる。
- フレームワーク選定が段階③に残るため、段階③でこの ADR を更新するか後続 ADR を追加する。
