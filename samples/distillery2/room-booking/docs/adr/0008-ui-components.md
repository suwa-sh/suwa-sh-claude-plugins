---
id: "0008"
title: "画面は単一の React SPA とし、共通の画面部品を packages/ui に持つ"
status: accepted
date: "2026-11-04"
supersedes: []
superseded_by: null
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
nfr_refs: ["F.1.1.1", "F.1.1.2", "F.1.1.3"]
scope: [ui]
confidence: low
ui:
  framework: react
  rendering: spa
  styling: tailwind
  design_system: true
  component_lib: true
  brand:
    name: "会議室予約システム"
    tagline: "空いている会議室がすぐ分かる"
    colors:
      primary: "#1D4ED8"
      secondary: "#0F766E"
      accent: "#F59E0B"
      neutral: "#64748B"
    typography:
      heading: "Noto Sans JP"
      body: "Noto Sans JP"
    tone: ["分かりやすい", "落ち着いた", "迷わない"]
    source: "inferred"
    confidence: low
rules:
  - scope: tier:frontend
    text: "共通の画面部品は packages/ui からだけ取り、アプリ側で同じ部品を作り直さない"
  - scope: tier:frontend
    text: "色・文字・余白はデザイントークンで指定し、画面に色の値を直接書かない"
  - scope: tier:frontend
    text: "空き・予約済みの区分は色だけでなく文字 (「空き」「予約済み」) でも示す"
  - scope: tier:frontend
    text: "業務のエラー (重なる・時刻が正しくない・取り消せない など) は、契約のエラー型のコードに応じた理由の文を画面に表示する"
---

# 背景

画面は空き状況・予約・自分の予約一覧・予約取消確認の 4 枚で、使うのは社員 1 種。社外向けではなく SEO も無い。PC のブラウザで使う想定で、スマートフォンの要求は無い。ブランドの資料はこのリポジトリに無い (ブランドの道具を試したが、元になるブランドの指針の文書が無かった)。

# 決定

- 画面は単一の frontend の React の SPA にする。スタイルは Tailwind。
- 共通の画面部品とデザイントークンを packages/ui に持つ (画面部品の段が Storybook と一緒に作る)。4 枚の画面で、空き・予約済みの表示・時間帯の入力・確認のダイアログを使い回す。
- ブランドは要求から推論した (確認してほしいこと)。
  - 名前: 会議室予約システム。添え書き: 空いている会議室がすぐ分かる。
  - 色: 主色 #1D4ED8 (青)、補助色 #0F766E (緑寄りの青。「空き」を示す)、強調色 #F59E0B (橙。注意)、中立色 #64748B (灰)。
  - 文字: 見出しも本文も Noto Sans JP (日本語の画面のため)。
  - 印象: 分かりやすい・落ち着いた・迷わない。
- 多言語には対応しない (日本語だけ)。

# 却下した案

- 画面部品を持たず画面ごとに直接書く: 4 枚と少ないが、空き・予約済みの表示と時間帯の入力が複数の画面に出る。部品とトークンを作る段が既にあり、追加の手間は小さい。
- 利用者向けと管理者向けに画面を分ける: 管理者が居ない。
- SSR / SSG: 社内向けで SEO もモバイルの要求も無い。
- 会社のブランドの色をそのまま使う: このリポジトリに資料が無く、値が分からない。

# 影響

- 画面部品の段 (デザイントークン) はここに書いた色と文字を起点にする。
- ブランドが推論なので、会社の色が決まっていればこの ADR を置き換えて差し替える。
