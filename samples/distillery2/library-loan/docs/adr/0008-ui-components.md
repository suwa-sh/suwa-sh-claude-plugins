---
id: "0008"
title: "単一の React SPA とし、共通 UI 部品を packages/ui に集約する。ブランドは RDRA から推論した落ち着いた青と緑を仮置きする"
status: accepted
date: 2026-09-26
supersedes: []
superseded_by: null
basis: "requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518"
nfr_refs: ["F.1.1.2", "F.1.1.3", "F.3.1.2", "B.2.1.1"]
scope: [ui]
confidence: low
ui:
  framework: react
  rendering: spa
  styling: tailwind
  design_system: true
  component_lib: true
  brand:
    name: "図書館蔵書管理システム"
    tagline: "読みたい本に、すぐ出会える"
    colors:
      primary: "#1F5F8B"
      secondary: "#2E7D6B"
      accent: "#C8812A"
      neutral: "#5F6B76"
    typography:
      heading: "Noto Sans JP"
      body: "Noto Sans JP"
    tone: ["落ち着いた", "親しみやすい", "信頼できる"]
    source: "inferred"
    confidence: low
rules:
  - scope: tier:frontend
    text: "共通 UI 部品は packages/ui からのみ取得し、アプリ側で独自に再実装しない"
  - scope: tier:frontend
    text: "色・余白・文字サイズはデザイントークンから取り、画面に直接値を書かない"
  - scope: tier:frontend
    text: "画面は WCAG 2.1 AA 相当を目安にし、フォーム部品にはラベルを付け、キーボードだけで操作できるようにする"
  - scope: tier:frontend
    text: "利用者向けと司書向けの画面は同じアプリの中でルートを分け、ロールに応じて表示を出し分ける"
---

# 背景

UC は 27 本で、利用者向け (検索・予約・マイ貸出履歴・マイ予約状況) と司書向け (登録・貸出・返却・レポート) の画面がある。
社外の一般市民が使うため、見た目の一貫性とアクセシビリティが要る (NFR F.3.1.2)。
モバイルや SEO の要件は無い (NFR F.1.1.2 Lv2)。
プロジェクトにブランド資料 (ブランドガイドライン) は無い。

# 決定

- frontend は React の SPA とする。サーバーサイドレンダリングは使わない。
- 利用者向けと司書向けは 1 つのアプリに集約し、ルートとロールで出し分ける (ADR 0001)。
- 共通 UI 部品ライブラリを `packages/ui` に持ち、デザイントークンと部品と Storybook を置く。部品とトークンの生成は段階③の d2-design が担う。
- スタイリングはユーティリティ CSS (tailwind) とデザイントークンで行う。
- ブランドは RDRA (公共図書館・単館・利用者と司書) から推論して仮置きする。
  - 主色は落ち着いた青 (#1F5F8B)、副色は緑 (#2E7D6B)、強調色は本の背表紙を思わせる琥珀 (#C8812A)、中間色は灰青 (#5F6B76)。
  - 書体は見出し・本文とも Noto Sans JP。
  - トーンは「落ち着いた・親しみやすい・信頼できる」。

# 却下した案

- 利用者向けと司書向けで別アプリにする案: 認証経路を分ける要件が無く、部品と実装が二重になる。
- 共通部品ライブラリを持たない案: 画面が 20 枚を超え、2 種類の利用者に一貫した見た目とアクセシビリティを提供しにくい。
- SSR / SSG にする案: モバイルや検索エンジン向けの要件が無い。

# 影響

- d2-design はこの `ui.brand` を起点にトークンを作り、再推論しない。
- ブランドは推論による仮置きのため、色と書体は人の確認後に確定する。変更はこの ADR を更新して行う。
