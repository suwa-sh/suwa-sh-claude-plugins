---
id: "0007"
title: "テストは受入・UC BDD・契約・単体の 4 段とし、画面の受入はブラウザでも確かめる"
status: accepted
date: "2026-09-24"
supersedes: []
superseded_by: null
basis: "requirements@ca8f7fb28b2dc8ef6b6abfcee29c0898fa879a12"
nfr_refs: ["B.4.1.1", "C.4.1.1", "E.6.2.1", "F.1.1.2"]
scope: [testing]
confidence: medium
capabilities:
  browser: false
rules:
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、API ドライバで実行する。画面操作を確かめる Scenario だけに @browser タグを付けてブラウザドライバでも実行する"
  - scope: testing
    text: "受入基準に対応する Scenario には @acceptance タグで仕様 ID を付ける"
  - scope: testing
    text: "契約テストは契約から生成し、手で編集しない"
  - scope: testing
    text: "DB を使うテストは組み込みの PostgreSQL 互換 DB で動かし、コンテナを前提にしない"
  - scope: testing
    text: "メール配信は in-memory の偽実装に差し替え、送った宛先・件名・通知種別を検証できるようにする"
  - scope: testing
    text: "日次の期限チェックのテストは時計を差し替えて、返却期限の 3 日前・1 日前・超過の日付を再現する"
  - scope: testing
    text: "テスト用の composition root で tracer を結線し、シナリオごとの実行トレースを残す"
  - scope: testing
    text: "テストデータの利用者の氏名・連絡先は架空の値を使い、実在の個人情報を使わない"
---

# 背景

- 受入基準は 1 行の Gherkin として要求段階で確定している。多くは「画面を開く」「一覧表示される」など、画面を通した結果を述べる。
- 日次の期限チェック (リマインド・督促) は日付に依存する。メール配信サービスへの送信は、テストで実際に行えない。
- データストアは PostgreSQL 互換の RDB である (ADR-0004)。

# 決定

- 4 段のテストを置く。
  - 単体: 各ティアに同居させる。
  - 契約: API と DB の契約から生成する。
  - UC BDD: features/ の Gherkin を API ドライバで実行する。
  - 受入: `@acceptance` タグ付きの Scenario として書く。
- ティア別の BDD は作らない。
- スタックは TypeScript の既定を使う。
  - BDD ランナー: cucumber-js
  - 単体・契約テストのランナー: vitest
  - DB 契約テスト: pglite
  - ブラウザドライバ: Playwright (ライブラリとして使う)
- 画面を持つシステムのため、ブラウザでの受入を有効にする (`capabilities.browser: true`)。ただしブラウザで実行するのは `@browser` タグを付けた Scenario だけにする。
- メール配信は偽実装に、時計は差し替え可能な実装にする。

# 却下した案

- ブラウザでの受入を無効にする (API ドライバだけ): 利用者向け画面の表示内容 (返却期限付き一覧・予約順) を確かめられないため却下。
- 別ディレクトリに E2E テストを置く: 受入基準と Scenario の対応が二重管理になるため却下。
- コンテナの DB でテストする: CI の準備が重くなり、組み込み DB で足りるため却下。

# 影響

- 良い点: 受入基準から実装までを Scenario で追跡できる。日付に依存する処理も決定的にテストできる。
- 悪い点: CI にブラウザ実行のジョブが加わり、実行時間が延びる。
