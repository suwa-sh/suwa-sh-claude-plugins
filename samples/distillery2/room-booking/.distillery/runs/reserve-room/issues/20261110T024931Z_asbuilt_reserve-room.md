---
kind: requirement
title: "SLOT_OVERLAPS を usecase が作る"
source: asbuilt
---

## 背景

開発ルール (ADR 0010) は「占有の表の一意制約の違反は repository で SLOT_OVERLAPS の業務のエラーに変える」と書く (docs/rules/tier-backend.md:77)。

## 今の実装

- repository の save は占有の主キーの違反のとき 'overlaps' を返す (apps/backend-api/src/repository/reservationRepository.ts:132)
- usecase が 'overlaps' を受けて SLOT_OVERLAPS の業務のエラーを作る (apps/backend-api/src/usecase/reserveRoom.ts:148)

## 対処の案

- ルールの文を「repository は重なりを値で返し、usecase が SLOT_OVERLAPS に変える」に直すか、実装を repository で SLOT_OVERLAPS を作る形に揃える

## 根拠

- apps/backend-api/src/repository/reservationRepository.ts:132
- apps/backend-api/src/usecase/reserveRoom.ts:148
