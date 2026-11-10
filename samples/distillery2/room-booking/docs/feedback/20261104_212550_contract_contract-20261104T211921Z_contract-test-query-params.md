---
kind: plugin
title: 契約テストの生成が query の引数を送れない
from_uc: view-room-availability
status: open
created: "2026-11-04T22:06:32Z"
workaround: true
---

genContractTests.js と contractGraph.js の testUrl は経路の {param} だけを埋め、x-test-requests は path / headers / fixture / expect しか受けない。GET の query で時間帯を受ける operation では 200・401・422 の例がどれも同じ要求になり、例を区別できない

## 根拠

skills/d2-contract/scripts/lib/contractGraph.js の testUrl・invalidTestRequests、genContractTests.js の request(app) の組み立て (query を付けない)

## 推奨の直し方

x-test-requests に query (引数名 → 値) を足し、testUrl で URL エンコードして付ける。区別できない例の検査の要求の比較にも含める

## リポの中での回避

空き状況の照会を POST /api/room-availability (本文に TimeRange) にして、例ごとの時間帯を request example の本文で表した
