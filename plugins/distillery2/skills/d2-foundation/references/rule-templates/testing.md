# テストルール (testing)

テストは 4 段。上 3 段は要求・契約からの転写であり、実装ハーネスが創作しない。第 4 段 (単体) だけが実装者の設計物。

| 段 | 名称 | 出典 | 配置 | ゲート |
|---|---|---|---|---|
| ① | 受入 | USDM の受入基準を実現する `.feature` の `@acceptance:<SPEC>-<n>` タグ付き Scenario | `features/**/*.feature`, `features/acceptance/*.feature` | acceptance |
| ② | UC BDD | UC 着手時に書いて人が承認した `.feature` (`@uc:<slug>`) | `features/<業務>/<slug>.feature` | uc-bdd |
| ③ | 契約 | 契約 (OpenAPI/AsyncAPI/RDB) から **機械生成** | `apps/<provider>/test/contract/` | contract |
| ④ | 単体 | 出典なし (実装者が red → green → refactor で設計) | `apps/<tier>/src/**/*.test.ts` (同居) | unit |

## 転写 → タグ対応 (①②)

- 意訳・要約・補完を禁止する。受入基準は 1 criterion = 1 Scenario に展開し、原文の文言のまま書く。
- 受入基準と Scenario の対応は **タグで表す** (別ファイルへの転写ではない)。
  各受入 Scenario に `@acceptance:<SPEC>-<n>` を、UC のシナリオに `@uc:<slug>` を付ける。
- UC の spec_ids が指す受入基準が、どこかの Scenario に `@acceptance:` タグで必ず現れること (網羅チェック)。

## 契約テスト (③) は契約から生成する

- 提供側 (provider) の契約テストは `packages/contracts` / 契約 bundle から生成され、手で書かない。
- OpenAPI operation は examples 必須。無ければ d2-contract が停止する。

## 命名 (④ 単体)

`テスト対象_XXXの場合_YYYであること`。vitest では `describe('貸出登録', () => it('在庫が0の場合、貸出不可エラーを返すこと', …))` の 2 分割も可。

## AAA 構造 (④ 単体)

Arrange / Act / Assert を空行かコメントで 3 区画に分ける。Act は原則 1 呼び出し。複数必要ならテストを分割する。

## 実体 I/O テスト規約

- I/O 境界 (RDB・メッセージング・外部プロセス・ファイル) はモックでなく実体で検証する。
- 実 DB はテストが自前で起動・破棄する使い捨てインスタンスを使う (このサンプルは pglite。docker 不要)。
  常設サービスに接続しない。
- 環境不足は fail にする (暗黙 skip 禁止)。意図的に外すときだけ明示 skip の環境変数を使い、理由を出力に残す。
- テスト用 DDL は正本ではない。migration は `datastore_owner` ティアの `migrations/` が正本。
