---
id: "0007"
title: "受入・UC BDD・契約・単体の 4 段でテストし、受入は API ドライバで実行する (ブラウザドライバは使わない)"
status: accepted
date: 2026-09-26
supersedes: []
superseded_by: null
basis: "requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518"
nfr_refs: ["C.4.1.1", "B.4.1.1", "E.6.2.1"]
scope: [testing]
confidence: medium
capabilities:
  browser: false
rules:
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、API ドライバで実行する"
  - scope: testing
    text: "受入基準に対応する Scenario には @acceptance: タグを付け、別ディレクトリに e2e spec を作らない"
  - scope: testing
    text: "契約テストは契約から生成し、手で編集しない"
  - scope: testing
    text: "DB を使うテストは pglite で実行し、docker に依存しない"
  - scope: testing
    text: "メール配信システムと IdP はテスト用の in-memory 実装に差し替え、送信したメールをシナリオで検証する"
  - scope: testing
    text: "テスト用 composition root で tracer を結線し、シナリオごとの実行トレースを残す"
  - scope: testing
    text: "テストデータの利用者の氏名と連絡先は合成データを使い、実在の個人情報を使わない"
  - scope: testing
    text: "日付に依存する処理 (返却期限・リマインド・督促) は時計をテストから固定できるようにする"
---

# 背景

受入基準は requirements.yaml に 1 行 Gherkin として書かれている。
返却期限・リマインド・督促は日付に依存し、メール配信システムという外部システムへの送信を伴う。
全ティアを TypeScript で書き (ADR 0002)、データストアは RDB (ADR 0004)。

# 決定

- テストは 4 段にする。
  - 単体: 各ティアの中のロジック (vitest)。
  - 契約: 契約 (OpenAPI / DB スキーマ) と実装の一致。契約から生成する (vitest + pglite)。
  - UC BDD: UC 1 本の振る舞い。`features/` の Gherkin を cucumber-js と API ドライバで実行する。
  - 受入: `@acceptance:` タグ付きの Scenario。API ドライバで実行する。
- ブラウザドライバによる受入は行わない (`capabilities.browser: false`)。画面の確認は後続の UI レビューに任せる。
- ティア別の BDD は作らない。
- 時計・メール配信システム・IdP はテストから差し替えられるようにする。

# 却下した案

- ブラウザドライバで受入を実行する案: 今回の実走では API ドライバで受入まで通す方針で、ブラウザ実行の環境コストと不安定さを避ける。
- 契約テストを手書きする案: 契約と実装の食い違いを見落とす。
- docker で本物の RDB を起動する案: pglite で十分に検証でき、CI の準備が軽い。

# 影響

- 受入は API の振る舞いで確かめるため、画面のレイアウトや操作の不具合は受入で検出されない。
- 日付と外部送信を固定できるため、リマインドと督促のシナリオを決定的に書ける。
- 本番縮小構成のテスト環境 (NFR C.4.1.1 Lv2) で同じシナリオを流せる。
