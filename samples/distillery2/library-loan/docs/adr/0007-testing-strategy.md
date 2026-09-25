---
id: "0007"
title: "受入・UC BDD・契約・単体の 4 段でテストし、受入は API ドライバで実行する"
status: accepted
date: "2026-09-25"
supersedes: []
superseded_by: null
basis: "requirements@4422a431dd381e737d643e7055432ad4b2330c9d"
nfr_refs: ["C.4.1.1", "B.4.1.1", "E.6.2.1"]
scope: [testing]
confidence: medium
capabilities:
  browser: false
rules:
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、API ドライバで実行する (@browser タグのシナリオはブラウザ実行を有効にするまで実行しない)"
  - scope: testing
    text: "受入基準に対応する Scenario には @acceptance タグを付け、別ディレクトリに e2e spec を作らない"
  - scope: testing
    text: "契約テストは契約から生成し、手で編集しない"
  - scope: testing
    text: "DB を使うテストは組み込み型の PostgreSQL 互換 DB (pglite) で動かし、コンテナに依存しない"
  - scope: testing
    text: "メール配信サービスと認証基盤はテストで in-memory の偽物に差し替え、送信内容と宛先を検証する"
  - scope: testing
    text: "時刻に依存するシナリオ (返却期限・リマインド・延滞) は Clock を固定して実行する"
  - scope: testing
    text: "テスト用 composition root で tracer を結線し、シナリオごとの実行トレースを残す"
---

# 背景

要求の受入基準は 1 行 Gherkin で書かれている。
UC 23 本のうち 2 本 (返却期限リマインド・延滞督促) は日次タイマー起動で、時刻に依存する。
通知はすべて外部システム「メール配信サービス」を経由する。
全ティアを TypeScript で書く (ADR 0002)。この実走では受入をブラウザではなく API ドライバで通す。

# 決定

- テストは次の 4 段にする。ティア別の BDD は作らない。

  | 段 | 対象 | 道具 |
  |---|---|---|
  | 受入 | 受入基準の充足 (@acceptance) | cucumber-js + API ドライバ |
  | UC BDD | UC 1 本の振る舞い | cucumber-js + API ドライバ |
  | 契約 | OpenAPI / DB スキーマと実装の一致 | 契約から生成したテストを vitest で実行 |
  | 単体 | ティア内のロジック | vitest |

- DB を使うテストは pglite で動かす。
- メール配信サービスと認証基盤は、テストで in-memory の偽物に差し替える。
- 時刻は Clock ポートで固定する (ADR 0003)。
- ブラウザでの実行は無効にする (`capabilities.browser: false`)。@browser タグのシナリオは書けるが、ブラウザ実行を有効にする ADR が出るまで実行しない。

# 却下した案

- 受入をブラウザドライバで実行する案: この実走では API ドライバで受入まで通す方針のため採らない。画面の見た目の確認は UI 部品のカタログ (ADR 0008) で補う。
- ティアごとに BDD を書く案: 同じ振る舞いを複数の場所に書くことになり、UC BDD と重複する。
- DB テストをコンテナの DB で動かす案: 実行環境にコンテナを要求し、CI と開発者の手元で差が出る。

# 影響

- 利点: 受入からの全段がコンテナ無しで高速に動き、UC ごとの TDD の周期が短くなる。
- 利点: 時刻とメールを差し替えられるため、日次ジョブの受入基準を決定的に検証できる。
- 欠点: 画面操作 (ボタンの有無・画面遷移) は受入で自動検証されない。
- 欠点: 本番の RDB と pglite の差 (拡張機能など) は検出できない。本番相当の確認はテスト環境 (C.4.1.1 Lv2) で行う。
