---
id: "0001"
title: ティア構成
status: accepted
scope: [system]
nfr_refs: []
tiers:
  - { id: backend-api, dir: apps/backend-api, kind: backend, lang: typescript, provides: [api], consumes: [db] }
  - { id: frontend, dir: apps/frontend, kind: frontend, lang: typescript, provides: [], consumes: [api] }
  - { id: worker, dir: apps/worker, kind: worker, lang: typescript, provides: [], consumes: [events, db] }
datastore_owner: backend-api
rules:
  - scope: common
    text: "全ティアは契約型 (packages/contracts) を直接編集しない。"
---

# ティア構成

backend-api / frontend / worker の 3 ティア。datastore_owner は backend-api。
