# ゲート (5 段)

コマンドの正本は `.distillery/config.yaml` (`skills/d2-run/references/config-schema.md`)。実行は `scripts/runGates.js`。
「通過しなければ次に進めない」実行可能な検査で、安い順に並ぶ。落ちたゲートで止まる。

| # | ゲート | 実行するもの | 誰が回すか |
|---|---|---|---|
| 1 | static | format_check / lint / typecheck (ティア並列) + arch_test (依存方向) | tier 実装者 (自ティア限定・check-only)、d2-run |
| 2 | unit | 各ティアの単体テスト (ティア並列) | tier 実装者、d2-run |
| 3 | contract | 各ティアの契約テスト (契約から生成。提供側は応答をスキーマ検証、消費側は stub) | d2-run |
| 4 | uc-bdd | `@uc:<slug>` のシナリオを API ドライバで実行 (実 DB は pglite) | integrate、d2-run |
| 5 | acceptance | `@uc:<slug> and @acceptance:*` のシナリオ。`@browser` は capabilities.browser のときだけブラウザドライバで | integrate、d2-run |

## 判定規則

- **exit code が正**。出力文字列の grep で pass 判定しない
- pending / skipped のシナリオは pass に数えない (cucumber は strict で実行する)
- 定義の無いコマンドは skipped (失敗ではない)。ただし unit と uc-bdd が skipped のまま UC を完了にしない
- scaffold の red baseline は `--only unit --expect-red unit` で「落ちること」を確認する。パースエラー・設定ミスは red と認めない

## check-only 規約 (ティア並列中)

- tier 実装者は自ティアに限定した check-only コマンドだけ実行する。書き換えを伴う formatter (`--write` / `--fix`) は禁止
- 整形が必要なら実装者が自分のコードを直す。リポ全体の整形は d2-run が barrier 後に単一 writer として行う

## 失敗時

- 1〜2 の fail: 実装者が直す。同じ失敗が 3 回続いたら仕様疑義として `issues/` に書き、状況を返す
- 3 の fail: 提供側ティアの attempt++ (契約側が間違っていると思うなら `kind: contract` の issue)
- 4〜5 の fail: integrate は直さず分析を返す。d2-run が該当ティアに戻す
- 環境起因 (依存欠落・ポート衝突) はゲート結果と区別して報告する
