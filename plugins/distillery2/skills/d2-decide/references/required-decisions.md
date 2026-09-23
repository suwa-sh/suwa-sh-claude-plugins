# 必須の決定領域 (ADR カバレッジ)

d2-decide は最低限、次の 8 領域を ADR で覆う。該当しない領域は「不要」と 1 本の ADR で明記する
(黙って省かない)。各領域には対応する [決定候補カタログ](decision-candidates/) がある。

| # | 決定領域 | scope | 該当カタログ | 補足 |
|---|---|---|---|---|
| 1 | ティア構成 | system | [tiers.md](decision-candidates/tiers.md) | frontend / backend-api / worker の分割。**arch_test 必須** |
| 2 | 各ティアのレイヤ構成と依存方向 | app | [app-layers.md](decision-candidates/app-layers.md) | 5/3/2 層と依存方向。**arch_test 必須** |
| 3 | 言語 / フレームワーク | system, app | [tiers.md](decision-candidates/tiers.md) | 未定ならその旨を ADR に明記 |
| 4 | データストアと migration | data | [data.md](decision-candidates/data.md) | エンティティ分類・ストレージ種別・移行方針 |
| 5 | テスト方針 | testing | [testing-stack.md](decision-candidates/testing-stack.md) | 4 段 = 受入 / UC BDD / 契約 / 単体。契約テストは契約から生成、ティア BDD は無い |
| 6 | メッセージング | app, system | [messaging.md](decision-candidates/messaging.md) | AsyncAPI が要るときのみ (同期完結なら「不要」ADR) |
| 7 | 認証 / 認可 | system, app | [auth.md](decision-candidates/auth.md) | authn 方式と authz モデル |
| 8 | UI 部品の方針 | ui | [ui.md](decision-candidates/ui.md) | presentation ティアがあるときのみ |

## ルール付与の要件 (validateAdr が検査)

- `scope` に `system` / `app` / `data` / `testing` / `ui` を含む accepted ADR は `rules[]` を最低 1 つ持つ
  (`infra` 専用の ADR は持たなくてよい)。
- **1 (ティア構成)** の ADR は `arch_test` を持つ `rule` を最低 1 つ持つ (ティア依存方向の機械検証)。
- **2 (レイヤ構成)** のように `scope` に `app` を含む accepted ADR があるなら、そのうち最低 1 つが
  `arch_test` (レイヤ依存規則) を持つ。
- `rules[]` が段階③ の rules 文書とアーキテストの唯一の入力になる。人が rules 文書を手で直さない。

## ティア構成 ADR の要件 (validateAdr が検査)

- `tiers[]` を宣言する accepted ADR は**ちょうど 1 つ** (0 件・2 件以上はエラー)。この 1 本だけが `datastore_owner` を持つ。
- 決定領域 1・3・6・7 のように複数の accepted ADR が `scope: system` を持ってよい。`tiers[]` は分割せず 1 本に集約する。

## auto-adopt 方針

各領域で推奨案を採用して完走する。推論の確信度が低い決定は front matter に `confidence: low` を付け、
`docs/adr/_review-summary.md` に「人が確認する項目」として平易な言葉で列挙する。
