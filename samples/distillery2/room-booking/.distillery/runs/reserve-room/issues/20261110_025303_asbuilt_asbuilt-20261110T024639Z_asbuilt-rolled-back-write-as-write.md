---
kind: plugin
title: 取り消された書き込みを分岐の表で書き込みと数える
source: "handoff:asbuilt"
workaround: true
---

409 のシナリオ (重なり) では予約の保存の文が占有の主キーの違反で文ごと取り消され、何も書かれない。抽出の分岐の表は 409 の行の書き込みの列に reservation_events, reservations, room_slot_occupancies を載せ、データの流れの図も同じ文を Write に数える。失敗した文と書けた文を区別していない

## 根拠

docs/as-built/会議室予約/会議室を予約する/index.md の分岐の表 (他の社員の予約とまったく同じ時間帯は… の行ほか 409 の 5 行)。トレースでは DB の呼び出しは result error で記録されている (.distillery/runs/reserve-room/traces/reserve-room#-39d4398e.jsonl の 13 行目 kind db.query)。抽出はその result を見ずに表を書き込みに数える。SQL と取り消しは apps/backend-api/src/repository/reservationRepository.ts:96・:114・:132

## 推奨の直し方

抽出 (分岐の表・データの流れ・traceability-index の tables_rw) で、result が error の db.query の表を書き込みに数えない (または「試みて取り消し」と区別する)

## リポの中での回避

index.md の要約ブロック 整合性 の原子性の行に「分岐の表の 409 の書き込みは取り消された文」と注記した (根拠 reservationRepository.ts:96・:132)。抽出節は直していない
