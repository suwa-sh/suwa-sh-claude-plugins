---
kind: plugin
title: 業務の拒否の戻りを図で ok と描く
source: "handoff:refute"
workaround: true
---

計装の tracer は呼び出しが例外を投げたときだけ result を error にし、値で返した業務の拒否も ok と記録する。抽出の図はこの result をそのまま戻りの線に描くため、409 の経路で save・usecase・画面の戻りがすべて ok になる。実装では save は overlaps、usecase は SLOT_OVERLAPS の業務のエラー、画面はエラーの状態を返す

## 根拠

packages/test-support/src/tracer.ts:170 と :203-229 (例外のときだけ error)。d2-asbuilt/scripts/traceTree.js:149 と :184 (meta.result を ok / error の線にする)。結果は docs/as-built/会議室予約/会議室を予約する/sequence.md:138-143。実装は apps/backend-api/src/repository/reservationRepository.ts:74、apps/backend-api/src/usecase/reserveRoom.ts:109、apps/frontend/src/screens/ReserveRoom/submitReservation.ts:41

## 推奨の直し方

tracer の雛形で、戻り値が業務の拒否 (overlaps や kind error など) のときに戻りの要約を meta に残し、traceTree.js がそれを戻りの線の名前に使う

## リポの中での回避

index.md の要約ブロック 整合性 の競合の行に、図の 409 の経路の ok は例外が無いことだけを示すこと、save は overlaps・usecase は SLOT_OVERLAPS・画面はエラーの状態を返すことを注記した (根拠 reservationRepository.ts:74、reserveRoom.ts:109、submitReservation.ts:41)
