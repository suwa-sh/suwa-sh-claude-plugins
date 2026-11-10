## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | ADR との縦の整合 | CONCERN | 指摘 1 | ADR のリポジトリ全体の秘密検出と、実際の除外設定を照合した |
| P2 | 契約の骨格と画面部品 | CONCERN | 指摘 2 | 要求・API 契約の会議室名と画面 Story の表示データを照合した |
| P3 | 基盤の中の横の整合 | CONCERN | 指摘 3 | DB 契約と生成された契約テストの検証内容を照合した |

## (2) 指摘

### 指摘 1
- **perspective**: P1
- **対象**: [.distillery/config.yaml](<repo>/.distillery/config.yaml:51)、[.qlty/qlty.toml](<repo>/.qlty/qlty.toml:33)
- **severity**: medium
- **claim**: リポジトリ全体の秘密検出コマンドが、画面部品・契約生成物・Storybook のコードを検査対象から外している。
- **evidence**: [ADR 0012](<repo>/docs/adr/0012-machine-checks.md:37) はリポジトリ全体で秘密を検出すると決める。設定の `secrets` は `qlty check --all ... --filter trufflehog` を実行する一方、qlty の `exclude_patterns` に `packages/ui/**`、`packages/contracts/**`、`docs/design/storybook-app/**` がある。
- **why_raised**: これらのファイルに秘密情報が混入した場合、CI の秘密検出を通過し得るため。
- **suggested_fix**: 秘密検出ではこれらの除外を適用しない設定または専用コマンドにする。

### 指摘 2
- **perspective**: P2
- **対象**: [docs/design/storybook-app/src/stories/sampleData.ts](<repo>/docs/design/storybook-app/src/stories/sampleData.ts:9)
- **severity**: medium
- **claim**: 画面 Story の会議室名が要求・API 契約と異なり、契約にない収容人数まで表示している。
- **evidence**: [要求仕様](<repo>/docs/requirements/requirements.md:11) と [OpenAPI の応答例](<repo>/contracts/openapi/openapi.yaml:99) は「会議室A」から「会議室E」の順。Story の見本は「会議室 A (6 名)」などを使い、5 件目は「大会議室 (20 名)」。[RoomAvailability](<repo>/contracts/openapi/openapi.yaml:265) に収容人数の項目はない。
- **why_raised**: Story を画面構造の正として実装する際、契約の応答だけでは見本の表示を再現できず、要求された会議室名との不一致も生じるため。
- **suggested_fix**: Story の会議室名を契約の初期データに合わせ、収容人数の表示は契約で提供することを決めてから加える。

### 指摘 3
- **perspective**: P3
- **対象**: [apps/backend-api/test/contract/db-schema.test.ts](<repo>/apps/backend-api/test/contract/db-schema.test.ts:143)
- **severity**: medium
- **claim**: 生成された DB 契約テストは占有表の主キーの存在を確認するが、同じ枠への 2 件目の挿入が拒否される動作を検証しない。
- **evidence**: [DB 契約](<repo>/contracts/db/domains/room_reservation.yaml:109) は `(room_id, slot_start_at)` を二重予約防止の主キーとする。[テスト方針](<repo>/docs/rules/testing.md:59) は DB の一意制約が 2 件目を弾くことを契約テストで確かめると定める。生成テストが比較するのは列・型・NULL 可否・主キーの定義で、重複挿入は行わない。
- **why_raised**: 予約 UC の実装時に、二重予約防止の動作を実際に確かめないまま契約テストが通るため。
- **suggested_fix**: 占有表へ同じ `(room_id, slot_start_at)` の行を 2 件挿入し、2 件目の拒否を確かめる生成テストを加える。

## (3) below-threshold

- P2 low `Reservable` Story の固定日付は 2026-11-05 で、現在は過去の時間帯になっている。

Codex session ID: 01a1c258-bb98-7871-866a-5f5de7d68dc5
Resume in Codex: codex resume 01a1c258-bb98-7871-866a-5f5de7d68dc5
