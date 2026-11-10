---
kind: plugin
title: 抽出が日本語のパスを引用符と八進数で残す
source: "handoff:refute"
workaround: true
---

extractAsBuilt の変更ファイルは git diff --name-only の出力をそのまま使う。core.quotePath が既定 (true) のため、日本語を含むパスが引用符と八進数のエスケープ付きの文字列になり、traceability-index.json の files と index.md の付録に実在しないパスとして載る

## 根拠

buildTraceIndex.js:116 が git diff --name-only を -z も -c core.quotePath=false も付けずに呼ぶ。直す前の traceability-index.json:125 に "features/\344\274..." が入っていた (as-built のレビュー 指摘 2)

## 推奨の直し方

git の呼び出しを git -c core.quotePath=false diff --name-only -z にし、NUL で分割する

## リポの中での回避

traceability-index.json の files を UTF-8 に戻した一覧を <run>/reports/changed-files.txt に書き、extractAsBuilt.js を --changed でその一覧を渡して回し直した
