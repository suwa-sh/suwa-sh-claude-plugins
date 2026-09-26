# mode=scaffold: テストの足場 (固定指示)

承認済みシナリオと契約 slice から、UC BDD の step 骨格と、ティアごとの最初の失敗する単体テストを作る。
v1 の 4 段 red baseline を「上位段は静的確認、実行して落とすのは単体だけ」に変えたもの。

## 読むもの

- `features/<業務>/<slug>.feature` (と関係する `features/acceptance/*.feature`)
- 既存の `features/step_definitions/**` と `features/support/**`、`packages/test-support/README.md`
- `contracts/generated/slices/<slug>/contract-slice.json`、`rdb-slice.yaml`
- `docs/rules/testing.md`、`.distillery/config.yaml` (tiers と commands)

## 書くもの

| 対象 | 内容 |
|---|---|
| `features/step_definitions/<slug>.steps.ts` | シナリオの全 step に対応する定義。**本体は `return 'pending'`** (cucumber の pending)。既存の step と同文のものは再定義しない |
| `apps/<tier>/src/**/*.test.ts` | ティアごとに、UC の中心となる振る舞い 1 つに対する**失敗する単体テスト 1 本以上** (未実装のモジュールを import して落ちるのではなく、実装が無いことを理由に assert が落ちる形) |
| `<run>/reports/` | 完了条件の `runGates.js --expect-red unit` が書くゲートの記録 (自分では書かない) |
| `apps/<tier>/src/**` の入口スタブ | テストが import する入口 (frontend の画面の入口関数、backend のユースケース) がまだ無ければ、**新規ファイルとして**最小のスタブを置く。export した関数は**型に合う中立の値** (空配列・`undefined`・失敗を表す結果) を返し、テストの assertion で落ちるようにする (throw で落とさない。例外は assertion の前に落ちるので red の理由にならない)。tier 段階で実装に置き換わる前提 |

## 完了条件 (静的確認 + 単体の red)

1. `node ${CLAUDE_PLUGIN_ROOT}/scripts/lib/gherkin.js` 相当の静的確認: feature が parse でき、
   `npx cucumber-js -p dryrun --dry-run --tags "@uc:<slug>"` で undefined / ambiguous step が 0 (pending は可)。
   `-p dryrun` は cucumber.js の dryrun プロファイル (アプリを import しない)。既定プロファイルは world.ts 経由で `apps/<backend>/src/test-app` を読むので、
   実装前は解決に失敗する (0.1.10 実走 ④-4)
2. `node ${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js --uc <slug> --only unit --expect-red unit` が exit 0
   (単体ゲートが「テストの assertion で落ちること」を確認する。各ティアの unit コマンドは `{report}` に JSON レポートを書く設定で、
   runGates はレポートの失敗テスト数が 1 以上のときだけ red と認める。レポートが無い・skipped・失敗 0 は設定ミスとして fail になる)
3. 契約テスト (`apps/<tier>/test/contract/`) は生成物なので触らない。todo / red のままでよい

## 規則

- step 文はシナリオからそのまま取る。意訳しない
- 単体テストの命名は `テスト対象_XXXの場合_YYYであること`、構造は Arrange / Act / Assert (`docs/rules/testing.md`)
- ティアの実装コードは書かない (足場だけ)。書き込みは step_definitions、各ティアの test ファイル、新規の入口スタブに限定する
- 既存の `apps/<tier>/src/**` (テスト以外) は変更・削除しない (d2-run が受理時に確かめる)
- 入口が無いことを動的 import (`import(/* @vite-ignore */ ...)` など) で回避しない。スタブを置く (0.1.16 実走で回避策として使われた)
- 報告に「step 数 / pending 数 / ティアごとの red テスト名 / 置いた入口スタブの一覧 / dry-run と expect-red の結果」を書く
