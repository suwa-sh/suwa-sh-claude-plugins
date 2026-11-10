## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | ADR との縦の整合 | CONCERN | 指摘 1 | ADR の許可する依存方向と、静的検査が禁止する依存方向を照合した |
| P2 | 契約の骨格と画面部品 | PASS | なし | RDRA・UC 一覧の 4 画面、共通の認証・エラー型、画面部品を照合した |
| P3 | 基盤の中の横の整合 | CONCERN | 指摘 2 | DB 契約、契約テストの配置、CI のテストコマンドを照合した |

## (2) 指摘

### 指摘 1
- **perspective**: P1
- **対象**: `docs/rules/tier-backend.md:10–35`、`.dependency-cruiser.cjs` の `forbidden`
- **severity**: medium
- **claim**: ADR 0002 は層間の依存方向を限定し、ルールは静的ゲートで強制するとしているが、検査定義はその一部しか禁止していない。
- **evidence**: `tier-backend.md:33` は許可する方向を列挙する。一方、`.dependency-cruiser.cjs` には、例えば `usecase → gateway` と `presentation → domain` を禁止する規則がない。
- **why_raised**: 実装者がこれらの依存を追加しても依存検査を通過でき、ADR が定めた層の境界を CI で守れない。
- **suggested_fix**: ADR の許可方向から禁止規則を網羅的に生成し、規則の欠落を検査する。

### 指摘 2
- **perspective**: P3
- **対象**: `contracts/db/domains/room_reservation.yaml:109–139`、`.distillery/config.yaml:33`、`scripts/check.mjs:28,305–308`
- **severity**: medium
- **claim**: DB 契約には二重予約防止の主キーが定義されているが、現時点の契約テストゲートはテストがなくても成功する設定になっている。
- **evidence**: DB 契約は `(room_id, slot_start_at)` を主キーとする。`apps/backend-api/test/contract/` にテストファイルはなく、CI 用の `test:contract` 実行には `--passWithNoTests` が付いている。
- **why_raised**: この状態で CI が通っても、予約の中核である DB 制約が契約テストで確認されたとは判断できない。後続工程でテスト生成に失敗しても、テストがゼロなら同じゲートを通過する。
- **suggested_fix**: DB 契約テストの生成を確認し、契約が存在する場合はテストゼロを失敗として扱う。

## (3) below-threshold

- P2 low `Problem.detail` は契約上任意だが、ADR 0010 はエラー型の構成要素として挙げている。

Codex session ID: 01a1a65c-6dba-7983-be03-84f1724479a5
Resume in Codex: codex resume 01a1a65c-6dba-7983-be03-84f1724479a5
