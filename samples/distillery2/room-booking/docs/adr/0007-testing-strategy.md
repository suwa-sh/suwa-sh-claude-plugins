---
id: "0007"
title: "テストは受入・UC BDD・契約・単体の 4 段にし、受入は API で確かめる (ブラウザでは回さない)"
status: accepted
date: "2026-11-04"
supersedes: []
superseded_by: null
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
nfr_refs: ["B.4.1.1", "C.4.1.1"]
scope: [testing]
confidence: medium
capabilities:
  browser: false
rules:
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、受入基準は @acceptance: タグ付きの Scenario にする。別ディレクトリの e2e spec を作らない"
  - scope: testing
    text: "受入と UC BDD は API ドライバで画面の入口関数を通して実行する。ブラウザドライバ (@browser) は使わない"
  - scope: testing
    text: "契約テストは契約から生成し、手で編集しない"
  - scope: testing
    text: "単体と UC BDD は cucumber-js と vitest で書き、DB は pglite でシナリオごとに作り直す (docker を使わない)"
  - scope: testing
    text: "受入基準の「現在が … のとき」は固定の時計 (setNow) で決め、実行する日によって結果が変わらないようにする"
  - scope: testing
    text: "前提のデータ (既存の予約・取消済みの予約) は step から DB に直接入れ、予約の API を通して作らない"
  - scope: testing
    text: "テスト用の composition root で tracer を結線し、シナリオごとの実行トレースを残す"
  - scope: testing
    text: "同時の予約の受入基準は、同じ枠への 2 件の予約を続けて送り、成立が 1 件だけであることと、DB の一意制約が 2 件目を弾くことを契約 (DB) のテストで確かめる"
---

# 背景

受入基準 19 件は、空き状況の区分・予約の成否・取り消しの成否と示される理由を確かめるもので、すべて API の応答で判定できる。基準の多くは「現在が 2026-11-09 12:00 で」のように現在時刻を固定している。同時の予約で 1 件だけ成立する基準もある。TypeScript のモノレポで、DB は PostgreSQL 互換の RDB。

# 決定

- 4 段 (受入 / UC BDD / 契約 / 単体) にする。ティアごとの BDD は作らない。
- 道具は cucumber-js (BDD)・vitest (単体と契約のランナー)・pglite (DB。docker 不要) にする。
- ブラウザでの受入は回さない (`capabilities.browser: false`)。画面の見た目と部品は画面部品の段の Storybook で確かめる。
- 現在時刻は固定の時計で決める。
- 同時の予約は、pglite が 1 接続であるため本当の並行は再現しない。2 件を続けて送って 2 件目が「重なる」になることと、DB の一意制約が 2 件目を弾くことで確かめる。

# 却下した案

- ブラウザでも受入を回す: 画面は 4 枚で、受入基準は画面の操作の順序ではなく業務の結果を問う。ブラウザのジョブは遅く不安定になりやすく、得るものが少ない。
- docker の PostgreSQL でテストする: 実行環境の準備が増える。pglite で同じ migration を当てられる。
- 本当に並行で 2 件を送るテスト: pglite では再現できない。一意制約という DB の仕組みで守るので、制約の存在と違反の扱いを確かめれば足りる。

# 影響

- テストは docker もブラウザも無しで回る。
- 画面の結線の誤り (ボタンが API を呼んでいない など) は受入では見つからない。画面の入口関数を通すことと Storybook で補う。
- 本番の DB での本当の並行は、一意制約の仕組みに任せる (テストで再現しない)。
