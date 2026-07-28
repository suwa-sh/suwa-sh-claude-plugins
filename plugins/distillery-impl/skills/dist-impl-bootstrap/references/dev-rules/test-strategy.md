# テスト戦略 正本(4 段テスト階層)

distillery-impl が生成・運用するテストは 4 段。**上 3 段の gherkin は distillery 仕様からの転写**であり、
実装ハーネスが創作しない。第 4 段(TDD)だけが実装者の設計物である。

| 段 | 名称 | gherkin の出典(転写元) | 配置 | 実行ゲート |
|---|---|---|---|---|
| ① | ATDD(受け入れ) | `docs/usdm/latest/requirements.yaml` の `requirements[].specifications[].acceptance_criteria[]` | `features/atdd/{spec_id}.feature` | ゲート 6(S7) |
| ② | UC BDD | `docs/specs/latest/{業務}/{BUC}/{UC}/spec.md` の「E2E 完了条件(BDD)」gherkin ブロック | `features/uc/{uc_id}.feature` | ゲート 5(S6) |
| ③ | tier BDD | 同 UC 配下 `{tier_id}.md`(例 `tier-frontend.md`)の「ティア完了条件(BDD)」gherkin ブロック | `{tier_dir}/features/{uc_id}.feature` | ゲート 4(S4) |
| ④ | TDD(単体) | 出典なし(実装者が red→green→refactor で設計) | `{tier_dir}/test/` | ゲート 3(S4) |

## 転写ルール(①〜③)

- **意訳・要約・補完を禁止**する。gherkin ブロックをそのまま転写する
- 転写先 feature ファイルの先頭に出典コメントを残す:
  `# source: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/spec.md#E2E完了条件(BDD)`
- ① の `acceptance_criteria` は 1 行 Given/When/Then 文字列。**1 criterion = 1 Scenario、
  Scenario 名は `{SPEC-ID}-{連番}`、一意タグ `@atdd_{SPEC-ID}-{連番}` を付与**して展開する
  (文言は原文のまま)。1 つの SPEC が複数 UC の基準を含むことがあるため、S7 での実行は
  uc-map の `atdd_scenarios` に基づく**タグ完全一致の選択実行**が前提(名前の部分一致は誤選択するため禁止)
- 仕様側の gherkin が空・欠落・不正(パース不能)なら転写せず、**S1 の input-preflight で変更要求として起票**する

## red baseline 規約(S2 test-scaffold の完了条件)

テスト先行を「feature ファイルの存在」でなく「**期待した理由で fail する実行可能テスト**」で担保する:

- ①〜③: feature + step definition skeleton(全 step が `pending`/`not implemented` を明示的に投げる)+ runner 設定
- ④: 実装対象(UC × tier)ごとに最初の failing 単体テストを 1 本以上
- S2 の done 条件 = 全 4 段のテストが「**未実装を理由に fail する**」こと(エラー種別を確認する。
  設定ミス・パースエラーによる fail は red baseline と認めない)

## テストメソッド命名規約(④ TDD)

```
テスト対象_XXXの場合_YYYであること
```

- 例: `貸出登録_在庫が0の場合_貸出不可エラーを返すこと`
- 言語のテストフレームワークに合わせて表現する(例: Python は `test_貸出登録_在庫が0の場合_貸出不可エラーを返すこと`、
  Java/Kotlin は バッククォート や `@DisplayName`、TypeScript(vitest/jest)は `describe('貸出登録', () => { it('在庫が0の場合、貸出不可エラーを返すこと', ...) })` の 2 分割も可)
- 「テスト対象」はメソッド・関数・振る舞いの名前。「XXXの場合」は前提条件。「YYYであること」は期待結果

## AAA 構造規約(④ TDD)

テストメソッド内は Arrange-Act-Assert を空行または最小限のコメントで 3 区画に分ける:

```
// Arrange: 前提の準備
// Act: テスト対象の実行(原則 1 呼び出し)
// Assert: 期待結果の検証
```

- Act は原則 1 呼び出し。複数の Act が必要になったらテストを分割する
- ①〜③ の gherkin は Given=Arrange / When=Act / Then=Assert に自然対応するため、step definition も同じ規律で書く
