---
kind: plugin
title: 抽出が閉じると決めた課題も未決に数える
from_uc: view-room-availability
status: open
created: "2026-11-05T00:15:44Z"
workaround: true
---

extractAsBuilt.js は <run>/issues/*.md をすべて未決の課題に数える。閉じると決めた課題もファイルを消すまで「未決の課題 10 件」に残る

## 根拠

extractAsBuilt.js:356 の loadIssues が状態を見ずに全ファイルを読む。index.md:29 が 10 件のまま (閉じる決定は decisions.jsonl:128)

## 推奨の直し方

課題ファイルを消した後に as-built を抽出し直す。または閉じる決定の課題を抽出で除く

## リポの中での回避

要約の課題ブロックの 6 行に「閉じる決定済み」と「main マージで課題ファイルを消す」を書き、件数との差を読み手に示した
