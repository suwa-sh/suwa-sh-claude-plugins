---
id: "0008"
title: "単一の SPA に共有 UI 部品ライブラリとデザインシステムを持たせる"
status: accepted
date: "2026-09-25"
supersedes: []
superseded_by: null
basis: "requirements@4422a431dd381e737d643e7055432ad4b2330c9d"
nfr_refs: ["F.1.1.1", "F.1.1.2", "F.3.1.2", "B.2.1.1"]
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
      primary: "#1F4E79"
      secondary: "#2F6F5E"
      accent: "#B45309"
      neutral: "#5B6470"
    typography:
      heading: "Noto Sans JP"
      body: "Noto Sans JP"
    tone: ["落ち着いた", "信頼できる", "やさしい"]
    source: "inferred"
    confidence: low
rules:
  - scope: tier:frontend
    text: "共通 UI 部品は packages/ui からのみ取得し、アプリ側で独自に再実装しない"
  - scope: tier:frontend
    text: "色・文字・余白はデザイントークンから参照し、画面に直接の色コードを書かない"
  - scope: tier:frontend
    text: "利用者向け画面と司書向け画面は同じ SPA のルートで分け、ロールに応じてナビゲーションを出し分ける"
  - scope: tier:frontend
    text: "UI 部品は WCAG 2.1 AA のコントラストとキーボード操作を満たす"
---

# 背景

画面は 21 本の UC にまたがり、利用者向け (検索・予約・マイ貸出・マイ予約) と司書向け (受入・貸出受付・返却受付・レポート) がある。
検索結果の在庫状況表示や一覧・フォーム・入力エラー表示は、両方の画面で繰り返し使う。
公共の図書館サービスとして、アクセシビリティ (F.3.1.2 の仮置き WCAG 2.1 AA) を目標にした。
ブランド資料は存在しない。brand スキルは使えたが、ブランドガイドライン (docs/brand-guidelines.md) が無いため値を取り出せなかった。

# 決定

- frontend は React の SPA 1 つにする (ADR 0001, 0002)。スタイルはユーティリティ CSS (tailwind) にする。
- 共有 UI 部品ライブラリ (packages/ui) とデザイントークンを持つ。部品とトークンの生成は後段のデザイン工程が担う。
- 利用者向けと司書向けは同じ SPA のルートで分け、ロールでナビゲーションを出し分ける。
- ブランドは RDRA から推論して仮置きする (人の確認対象)。

  | 項目 | 値 | 意図 |
  |---|---|---|
  | 主色 | #1F4E79 (紺) | 公共施設らしい落ち着きと信頼感 |
  | 副色 | #2F6F5E (深緑) | 在庫あり・完了などの肯定的な状態 |
  | 強調色 | #B45309 (琥珀) | 受取可能・返却期限間近など注意を引く状態 |
  | 中立色 | #5B6470 (灰) | 補助文字・罫線 |
  | 書体 | Noto Sans JP (見出し・本文) | 日本語の可読性 |
  | トーン | 落ち着いた・信頼できる・やさしい | 幅広い年齢の利用者 |

# 却下した案

- 共有 UI 部品を持たず画面ごとに実装する案: 21 画面で一覧・フォーム・状態表示が重複し、見た目と操作性がそろわない。
- 利用者向けと司書向けで別の UI にする案: frontend を 1 つにした決定 (ADR 0001) と合わない。
- SSR / 静的生成案: 検索エンジン公開やモバイル最適化の要求が無い。

# 影響

- 利点: 在庫状況の表示や入力エラーの出し方が全画面でそろい、アクセシビリティの確認を部品単位で済ませられる。
- 欠点: 最初の UC の前に部品とトークンを用意する前倒しの工数がかかる。
- 欠点: ブランドの色と書体は推論値である。人の確認後に変える場合は、デザイントークンを作り直す。
