---
kind: requirement
title: "応答を失った再送が自分の予約と重なる"
source: asbuilt
---

## 背景

予約が DB に書けた後に、応答が画面に届かないことがある (通信の切断など)。

## 今の実装

- 予約 ID は要求ごとに新しく採番する (apps/backend-api/src/app.ts:58)
- 画面は応答を受け取れないと INTERNAL_ERROR を出す (apps/frontend/src/screens/ReserveRoom/submitReservation.ts:44)
- 社員が同じ枠を送り直すと、自分の予約の占有の主キーの違反で 409 SLOT_OVERLAPS になる (apps/backend-api/src/repository/reservationRepository.ts:74)
- 社員には「予約済み」と出るが、実際は自分の予約が成立している

## 対処の案

- 同じ要求の再送をどう扱うかを要求で決める (例: 冪等キーで同じ予約を返す / 今のまま 409 とし、自分の予約一覧で確かめてもらう)

## 根拠

- apps/backend-api/src/app.ts:58
- apps/backend-api/src/repository/reservationRepository.ts:74
- apps/frontend/src/screens/ReserveRoom/submitReservation.ts:44
