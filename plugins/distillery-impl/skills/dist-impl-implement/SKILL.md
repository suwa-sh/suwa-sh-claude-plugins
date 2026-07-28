---
name: distillery-impl:dist-impl-implement
description: >
  distillery-impl の Implementer スキル。mode 引数で 4 役を切り替える:
  test-scaffold(4 段テストの red baseline 生成)/ tier-impl(単一 UC × tier の TDD 実装、
  ゲート 1〜4 通過まで)/ uc-bdd / atdd(統合テストの step 実装と実行)。
  契約型・Storybook コンポーネント起点の契約駆動で、ddd-tactical-implementation を知識ガイドに使う。
  通常は dist-impl-run のサブエージェントとして呼ばれる。
---

# dist-impl-implement

引数: `mode={test-scaffold|tier-impl|uc-bdd|atdd} uc_id={id} [tier={tier_id}] [attempt={n}] config={impl-config.yaml へのパス}`

共通の前提:

- `config` から specs_root / repo_root / tiers / commands / capabilities を読む
- 対象 UC のパスは `docs/impl/latest/uc-map.yaml` の uc_id 行から引く
- **読む入力を最小に保つ**(コンテキスト 25% 制約): 該当 UC の spec.md / tier md / _api-summary.yaml /
  _model-summary.yaml / packages/contracts / docs/dev-rules のみ。他 UC・openapi 全量・実装履歴は読まない
- **git 操作禁止**。done ファイルは自分の write-set 内のものだけを書く(state-schema.md の write-set 表)
- 仕様と実装が両立しない事実を見つけたら、実装で仕様を曲げず
  `docs/impl/latest/{uc_id}/issues/{ts}_{slug}.md` に「仕様の記載 / 実装で判明した事実 / 提案」を書き捨てて先へ進む
  (blocker で進めない場合はその旨を結果として返す)

## mode=test-scaffold(S2)

4 段テストの実行可能な足場を作り、**red baseline** を確認する。

1. `docs/dev-rules/test-strategy.md` の転写ルールに従い、
   ② `features/uc/{uc_id}.feature`(spec.md の E2E 完了条件)/ ③ 各 tier の
   `{tier_dir}/features/{uc_id}.feature`(tier md のティア完了条件)を転写生成
   (① ATDD は bootstrap P7 で生成済み。無ければ同ルールで補生成)
2. step definition skeleton(全 step が「未実装」を明示して fail)+ runner 設定を配置
3. ④ 対象 UC × tier ごとに最初の failing 単体テストを 1 本以上書く(命名・AAA は test-strategy.md)
4. **red baseline 確認**: 4 段すべてを実行し「未実装を理由に fail する」ことを確認。
   パースエラー・設定ミス由来の fail は red と認めず修正する
5. `S2_test-scaffold.done.yaml` を書く(`red_baseline: pass` を含める)

## mode=tier-impl(S4)

単一 (UC × tier) を TDD で実装し、ゲート 1〜4 を通す。

1. 入力を読む: tier md(API 仕様表 / データモデル変更表 / ビジネスルール / ティア完了条件)、
   _api-summary / _model-summary、契約生成物、`docs/dev-rules/` 3 ファイル
2. **ddd ガイドの読込**(capabilities.has_ddd_plugin が true の場合):
   Skill ツールで `ddd:ddd-tactical-implementation` を呼び出し、判断ゲートとワークフローを把握してから
   実装に入る。呼び出し時に平文で渡す: 対象言語 / 実装対象モデル(_model-summary.yaml の該当エンティティ)/
   不変条件・業務ルール(tier md のビジネスルール欄)/ 成果物パス({tier_dir}/src)。
   false の場合は `docs/dev-rules/coding-rules.md` の基準のみで実装する
3. **TDD ループ**: tier BDD シナリオ(③)を外側の目標に、内側で red→green→refactor を回す。
   attempt が 2 以上なら、渡された findings の blocker を先に修正対象へ組み込む
4. **ゲート 1〜4 を実行**(`references/gates.md`。コマンドは config の commands。
   format/lint は check-only。書き換えを伴う format は実行しない)
5. 全ゲート pass → `attempt-{n}/S4_tier-impl.{tier_id}.done.yaml` を書く(gates 結果を記録)

## mode=uc-bdd(S6)/ mode=atdd(S7)

integration writer として統合テストを実装・実行する。**tier 実装コードは変更禁止**。

1. `features/uc/{uc_id}.feature`(S7 は uc-map の spec_ids に対応する `features/atdd/*.feature`)の
   step definition を実装(全 tier 結合。起動・シード・呼び出しは config の integration_commands)
2. 実行して結果を判定:
   - pass → `S6_uc-bdd.done.yaml`(S7 は `S7_atdd.done.yaml`)を書く
   - fail → done を書かず、「どの tier の何が仕様と食い違うか」の分析を結果として返す
     (S4 への差し戻しはオーケストレータの判断)
3. S7 で uc-map の `spec_ids_confirmed: false` の場合は実行せず、その旨を返す(S1 の確認漏れ)

## 完了報告(全 mode 共通)

生成・更新ファイル一覧 / ゲート・テストの実行結果(コマンドと exit code)/ issues に書いた仕様疑義の有無
