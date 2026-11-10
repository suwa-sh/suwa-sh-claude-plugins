---
kind: plugin
title: シーケンス図が並行の呼び出しを順に描く
from_uc: view-room-availability
status: open
created: "2026-11-10T00:07:17Z"
workaround: true
---

renderSequence.js と traceTree.js は兄弟の span を seq の順に並べるだけで、時間が重なる span を par で描かない。viewRoomAvailability.ts:89 は listRooms と listReservations を Promise.all で並行に呼ぶが、正常系の図は listRooms の ok の後に listReservations を呼ぶ順で描かれる

## 根拠

apps/backend-api/src/usecase/viewRoomAvailability.ts:89-92 の Promise.all。トレース traces/view-room-availability#-04af9327.jsonl で listReservations の ts (23:49:20.280Z) が listRooms の ts_end (23:49:20.281Z) より前で、2 つの span が重なる

## 推奨の直し方

同じ親を持つ兄弟の span で、後の ts が前の ts_end より前のものを mermaid の par ブロックにまとめて描く

## リポの中での回避

index.md の要約ブロック「整合性」の「競合」の行に「図の順と違い、2 つの読み取りは同時に始まる」を足した (根拠 viewRoomAvailability.ts:89)。sequence.md は生成物なので触っていない
