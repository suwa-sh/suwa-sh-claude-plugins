---
kind: plugin
title: 推奨案で承認した前提を「人が承認」と書く
source: "handoff:refute"
---

抽出は前提の処遇が confirmed なら、承認の方法 (decisions.jsonl の by) を見ずに「人が承認」と書く。reserve-room の回答必須の前提 4 件 (A-001・A-002・A-009・A-010) は推奨案で承認された (by recommended) のに、結果の表の「人が承認 4」と見出し「人が承認した前提 (4)」になっている。抽出節なので手で直せない。要約ブロックの行は概要・整合性で決まっており、課題の行は要求の下書きになるので、承認の方法を書ける場所が無い。根拠もコードでなく実行記録で、要約の読んでよい範囲の外のため、要約での回避はしていない

## 根拠

docs/as-built/会議室予約/会議室を予約する/index.md:28・:199。.distillery/runs/reserve-room/stages/review.done.yaml:3 (approved_by: recommended)、.distillery/runs/reserve-room/decisions.jsonl:114-117 (by recommended)。extractAsBuilt.js:104 (DECISION_JA.confirmed = 人が承認)・:552・:653 が by を区別しない

## 推奨の直し方

抽出で、confirmed の前提を by ごとに分け、by が recommended のものは「推奨案で承認」(結果の表と見出しの両方) と書く
