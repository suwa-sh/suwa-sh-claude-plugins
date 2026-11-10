---
kind: plugin
title: DB 契約テストが一意制約の弾きを確かめない
source: "handoff:refute"
workaround: true
from_uc: null
status: open
created: "2026-11-09T22:16:03Z"
---

d2-contract が生成する db-schema.test.ts は列・型・NULL 可否・主キーの集合だけを比べ、UNIQUE 制約 (rooms_room_name_key など) も見ず、重複の挿入もしない。開発ルール testing.md (ADR 0007) の「DB の一意制約が 2 件目を弾くことを契約 (DB) のテストで確かめる」を満たさない

## 根拠

apps/backend-api/test/contract/db-schema.test.ts:143-165 (比較は information_schema の列と主キーだけ)。docs/rules/testing.md:59。contracts/db/domains/room_reservation.yaml:109 (room_slot_occupancies の主キー = 二重予約の防止)。レビュー foundation/6 round1 の指摘 3

## 推奨の直し方

genContractTests (DB 契約テスト) が、主キーと UNIQUE 制約ごとに、外部キーを満たす前提の行を入れたうえで同じキーの行を 2 件挿入し、1 件目の成功と 2 件目の 23505 (unique_violation) を確かめるテストを生成する

## リポの中での回避

手書きの DB 契約テスト apps/backend-api/test/contract/db-unique-constraints.test.ts を足した (OWNER_TAG を持たないので genContractTests の掃除の対象外)。migration 0001・0002 を当て、予約 2 件を入れ、room_slot_occupancies に同じ (room_id, slot_start_at) を 2 件挿入して 1 件目の成功と 2 件目の code 23505 を確かめる。npm run test:contract -w apps/backend-api は 12 件すべて成功。機能の点検役が挙げた回避 (repository の単体テストと UC のシナリオで代える) は、このテストがあるので予備になる。生成器が対応したらこの手書きのファイルを消す
