---
id: "0002"
title: "全ティアを TypeScript で書き、frontend は React の SPA にする (backend の HTTP フレームワークは未定)"
status: accepted
date: "2026-09-25"
supersedes: []
superseded_by: null
basis: "requirements@4422a431dd381e737d643e7055432ad4b2330c9d"
nfr_refs: ["F.1.1.1", "F.1.1.2", "F.2.1.1"]
scope: [system, app]
confidence: medium
rules:
  - scope: common
    text: "全ティアと共有パッケージを TypeScript の strict モードで書き、1 つのモノレポで管理する"
  - scope: common
    text: "ティア間で共有する型は契約 (OpenAPI / DB スキーマ) から生成した packages/contracts から取り込み、手書きで複製しない"
  - scope: tier:backend
    text: "HTTP フレームワーク固有の型は presentation 層に閉じ込め、usecase 層以下へ持ち込まない"
---

# 背景

3 ティア (ADR 0001) はどれも Web と定時ジョブの処理で、特別な計算性能を要しない。
デプロイ環境は未定で、クラウドとオンプレの間を移せること (F.2.1.1 Lv3 の仮置き) を求める。
テスト方針 (ADR 0007) は TypeScript モノレポを前提にした道具立てを既定にしている。

# 決定

- 言語は全ティアで TypeScript (strict) にする。実行環境は Node.js の LTS 版にする。
- リポジトリは 1 つのモノレポにし、apps/ にティア、packages/ に契約の生成物と UI 部品を置く。
- frontend は React の SPA にする (詳細は ADR 0008)。
- backend-api の HTTP フレームワークは未定とする。OpenAPI 契約から型を生成して使える軽量なものを段階③で選ぶ。フレームワーク固有の型は presentation 層に閉じ込め、後から差し替えられるようにする。
- 特定クラウドのサービスや SDK には依存しない。

# 却下した案

- backend を別言語 (例: JVM 系) にする案: 型を契約から全ティアへ共有できなくなり、テストの道具立ても 2 系統になる。
- frontend を SSR にする案: 検索エンジン向け公開やモバイル向け最適化の要求が無い (F.1.1.2 Lv2)。
- HTTP フレームワークをここで固定する案: 段階③の契約生成の道具との相性を見てから決める方が手戻りが少ない。

# 影響

- 利点: 契約から生成した型を frontend・backend-api・worker で共有でき、ティア間の食い違いを型検査で検出できる。
- 欠点: HTTP フレームワークが未定のため、段階③でその選定を記録する追加 ADR が要る。
