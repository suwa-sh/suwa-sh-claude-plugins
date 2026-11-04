# 決定候補カタログ: 機械チェック

実装に持たせる機械チェックを決める。ADR の `scope: [system]`。front matter に `checks` を書く (accepted で 1 本だけ。validateAdr が検査する)。
段階③ (d2-foundation) が `checks` から `.distillery/config.yaml` のコマンドと、一括実行のスクリプト `scripts/check.mjs`・コミットのときの hook (`.githooks/commit-msg`)・CI を生成する。

---

## 6 つの観点と当てる範囲

| 観点 | リポ全体 (文書類・設定) | ティアごと (ソース) |
|---|---|---|
| generate (生成物の鮮度) | 契約の bundle・slice・契約テスト・開発ルール・アーキテスト・ADR の索引・入口の README・一括チェック自身 (distillery2 が決める。ADR には書かない) | — |
| format | `repo.format` | `tiers.<id>.format` |
| lint | `repo.lint` (+ アーキテスト) | `tiers.<id>.lint` |
| build | — | `tiers.<id>.build` (型の検査を含む) |
| test | UC のシナリオ・受入 (ci だけ) | `tiers.<id>.test` (単体)。契約テストは提供側だけ (ci だけ) |
| security | `repo.security` (秘密情報の検出) | `tiers.<id>.security` (依存の脆弱性・SAST。ci だけ) |

## 2 つのモード

- **ci**: 全ティア・全観点。CI と `npm run check` が回す
- **hook**: コミットするファイルに関わるものだけ (変えたティアの format・lint・build・単体テスト、文書類の format・lint、生成物の鮮度、秘密情報)。git の `commit-msg` の hook が回す (git の標準の仕組み。追加の依存なし)。d2-run の commit は回さない (d2-run は記録付きのゲートを自分で回す)

## 道具の選び方

- **選択肢 (TypeScript のティア)**: format・lint は `biome` / build は `tsc` / test は `vitest` / security は `dependency-audit` (npm audit。ワークスペースごと) と `sast` (qlty の有効な検査をティアのパスに当てる)
- **選択肢 (リポ全体)**: format は `biome` / lint は `qlty` / security は `secrets` (qlty の trufflehog)
- ほかの道具は `{cmd: "<コマンド>"}` で書く (ティアは `{dir}` が `apps/` の下の名前になる)。リポ全体の format は `{files}` を書くと、hook ではコミットするファイル、ci では `.` が入る (`{files}` の無い独自のコマンドは hook で回さない)
- **向く条件 (既定のまま)**: TypeScript のモノレポ (段階③ の骨格のまま)
- **向く条件 (ティアで上書き)**: ティアの言語が違う (Python なら `{cmd: "ruff format --check apps/{dir}"}` など)・SAST の道具をティアの性質で変える (外部入力を受けるティアだけ強い検査)
- 依存の脆弱性は、UC と無関係に脆弱性情報の更新で落ちる。d2-run のゲートでは止めずに報告し (advisory)、CI (ci モード) で止める

## front matter の例

```yaml
scope: [system]
checks:
  repo:
    format: biome
    lint: qlty
    security: [secrets]
  tiers:
    "*":
      format: biome
      lint: biome
      build: tsc
      test: vitest
      security: [dependency-audit, sast]
    frontend:
      security: [dependency-audit]
rules:
  - scope: common
    text: "コミットの前に node scripts/check.mjs --mode hook が通る状態にする (hook が自動で回す)"
  - scope: common
    text: "main に入れる前は d2-run の全段のゲートで止める (生成物の鮮度と security は報告にとどめる)。main への push の後に CI が node scripts/check.mjs --mode ci で 6 観点 (generate / format / lint / build / test / security) を回し、落ちたらすぐ直す"
```
