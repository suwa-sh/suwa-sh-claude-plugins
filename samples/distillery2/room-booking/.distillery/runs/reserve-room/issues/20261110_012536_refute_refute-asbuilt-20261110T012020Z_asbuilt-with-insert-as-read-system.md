---
kind: plugin
title: "回避できない: WITH で始まる INSERT の文を Read と数える"
source: "handoff:refute"
---

既存の課題 (WITH で始まる INSERT の文を Read と数える) の回避は UC の index.md の要約ブロックにしか書けない。全体横断の docs/as-built/_system/ (data-flow.md と traceability-index.json) はスクリプトだけが書き、要約ブロックが無いので注記できない。横断の記録は予約の 3 表 (reservation_events・reservations・room_slot_occupancies) を R とし、CTE の名前 inserted を表として載せたまま main に入る

## 根拠

docs/as-built/_system/data-flow.md:7-11 (inserted ほか 3 表が R)。docs/as-built/_system/traceability-index.json:502-509 (tables と tables_rw に inserted が read)。_system/index.md と data-flow.md に要約:begin のブロックが無い。SQL は apps/backend-api/src/repository/reservationRepository.ts:56

## 推奨の直し方

renderDataFlow.js と buildTraceIndex.js で、INSERT・UPDATE・DELETE を含む WITH の文を Write と数え、CTE の名前を表から外してから、抽出を回し直す
