---
kind: plugin
title: WITH で始まる INSERT の文を Read と数える
source: "handoff:asbuilt"
workaround: true
---

extractAsBuilt.js が予約の保存の SQL (WITH inserted AS (INSERT ...) INSERT INTO room_slot_occupancies) を読み取りと判定する。データの流れの図は ReservationRepository の線がすべて Read で、CTE の名前 inserted を表として描く。分岐の表の書き込みも 201 のシナリオで「なし」になる

## 根拠

d2-asbuilt/scripts/renderDataFlow.js:19 と buildTraceIndex.js:23 が先頭の動詞 WITH を読み取りに分類する。結果は docs/as-built/会議室予約/会議室を予約する/index.md のデータの流れ (n2 -. Read .-> n9 inserted ほか) と分岐の表の書き込みの列。SQL は apps/backend-api/src/repository/reservationRepository.ts:56

## 推奨の直し方

renderDataFlow.js と buildTraceIndex.js で、INSERT・UPDATE・DELETE を含む WITH の文を Write と数え、CTE の名前を表から外す

## リポの中での回避

index.md の要約ブロック 整合性 の原子性の行に、抽出の図の Read は誤りで実際は 3 表への Write であること・inserted は WITH 句の名前であること・分岐の表の書き込みのなしも誤りであることを注記した (根拠 reservationRepository.ts:56 と :57)
