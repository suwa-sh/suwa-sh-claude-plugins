---
kind: requirement
title: "未入力でも画面で止めずに送る"
source: asbuilt
---

## 背景

予約の画面は、時間帯の正しさ・過去かどうか・重なりの判定を API に任せる (apps/frontend/src/screens/ReserveRoom/submitReservation.ts:22)。

## 今の実装

- 画面は入力の値を確かめずに予約の API へ送る (apps/frontend/src/screens/ReserveRoom/submitReservation.ts:31)
- 未入力の項目があっても送り、API が返したエラーのコードを画面のエラーとして出す (apps/frontend/src/screens/ReserveRoom/submitReservation.ts:44)

## 対処の案

- 必須の項目が未入力のときに画面で送信を止めるかを要求で決める (止めない場合は今のまま API のエラーのコードを出す)

## 根拠

- apps/frontend/src/screens/ReserveRoom/submitReservation.ts:31
- apps/frontend/src/screens/ReserveRoom/submitReservation.ts:44
