---
id: "0002"
title: "全ティアを TypeScript で実装し、フロントは SPA とする (サーバ側の HTTP フレームワークは未定)"
status: accepted
date: "2026-09-24"
supersedes: []
superseded_by: null
basis: "requirements@ca8f7fb28b2dc8ef6b6abfcee29c0898fa879a12"
nfr_refs: ["F.1.1.1", "F.1.1.2", "F.2.1.1", "B.2.1.1"]
scope: [system, app]
confidence: low
rules:
  - scope: common
    text: "全ティアを TypeScript (strict モード) で実装し、tsconfig.base.json を継承する"
  - scope: tier:frontend
    text: "フロントはブラウザで動く SPA とし、サーバサイドレンダリングを前提にしない"
  - scope: tier:backend
    text: "HTTP フレームワーク固有の型は presentation 層に閉じ、usecase 層以降へ漏らさない (フレームワークを後から差し替えられるようにする)"
---

# 背景

- 要求は Web 画面での利用 (システム概要の interface_kind: gui) で、検索エンジン最適化やネイティブアプリの要件は無い。
- 後段のテスト基盤 (受入 / UC BDD / 契約 / 単体) の既定は TypeScript モノレポであり、DB 契約テストは PostgreSQL 互換の組み込み DB で動く。
- 言語やフレームワークについての要望は要求に無い。

# 決定

- 全ティア (2 つのフロント・backend-api・worker) を TypeScript で実装し、1 つのモノレポで管理する。
- フロントは SPA とする。部品はコンポーネント指向の UI ライブラリで作り、共通部品は packages/ui に置く (ADR-0008)。
- backend-api の HTTP フレームワークは未定とする。段階③ (基盤) で決める。どれを選んでも presentation 層に閉じる。

# 却下した案

- サーバとフロントで別言語 (例: サーバをほかの静的型付け言語): 契約から生成する型を両側で共有できず、既定のテスト基盤も使えないため却下。
- サーバサイドレンダリング: 検索エンジン最適化の要件が無く、SPA で足りるため却下。
- この時点で HTTP フレームワークまで確定する: 要求に判断材料が無いため、差し替え可能にしたうえで先送りする。

# 影響

- 良い点: API 契約から生成した型をフロントと backend-api で共有でき、テスト基盤も既定のまま使える。
- 悪い点: HTTP フレームワークの選定が残る。段階③で決めるまで presentation 層の骨格は仮になる。
