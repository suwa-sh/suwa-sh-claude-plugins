---
kind: plugin
title: tracedFetch の親 span が画面を指す
from_uc: view-room-availability
status: open
created: "2026-11-04T22:06:32Z"
workaround: true
---

packages/test-support/src/tracer.ts の tracedFetch は、シナリオのヘッダ (x-scenario-span) を http.out の span を開く前に付ける。そのため backend の http.in の親が http.out ではなく画面の call になり、README の「http.out → http.in の入れ子」にならない (as-built のシーケンス図で API 呼び出しが画面の直下に並ぶ)

## 根拠

回避前のトレース (正常系 1 本) で http.in の parent が画面の call (seq 1) を指し、http.out (seq 2) と兄弟になっていた。tracer.ts の tracedFetch で scenarioHeaders() を span() の外で呼んでいる

## 推奨の直し方

tracedFetch で scenarioHeaders() を span() のコールバックの中で読み、http.out の seq を x-scenario-span に載せる

## リポの中での回避

features/support/drivers/api.ts の asFetch で、tracedFetch が付けた x-scenario-id / x-scenario-span を落とし、ApiDriver.request が http.out の span の中で付け直す scenarioHeaders() を使うようにした。回避後は 画面 → http.out → http.in → usecase → repository → db.query の入れ子になる
