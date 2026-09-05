# 振る舞いの同等性を確認する受け入れテスト

設定ファイルを配置できただけでは移植できたと判断しない。同じ課題を各製品に与え、次の 8 項目で確認する。`scripts/verify.sh` が自動化するのは **1〜3**。残りは手動手順。

| # | テスト | 自動化 | 何を確認するか |
|---|---|---|---|
| 1 | skill 発見 | verify.sh | プローブ skill (`mid-harness-probe`) を各製品が headless で発見し、トークン `MID_HARNESS_PROBE_OK` を返す |
| 2 | headless | verify.sh | `claude -p` / `codex exec` で hook が有効 (対話モードとの差) |
| 3 | hook 拒否 | verify.sh | 危険コマンド (`curl … \| sh`) が止まり、hook ログに `deny` が残る |
| 4 | 指示の衝突 | 手動 | root とサブディレクトリに逆の指示を置き、解決順を確認する |
| 5 | custom agent | 手動 | 利用 tools、model、context 分離が設定どおりか |
| 6 | adapter 検証 | check_drift.py + gen の exit code | 未対応 field や変換不能 tool を警告のまま常態化させず失敗として扱う |
| 7 | MCP 境界 | 手動 | 認証情報をリポへ置かず、許可した tool だけ使えるか |
| 8 | memory 汚染 | 手動 | 誤った記憶を発見・削除・無効化できるか |

## verify.sh の仕組み

- 各製品の CLI (`claude` / `codex`) が PATH に無ければその製品は `skip`
- **1 skill 発見**: リポに一時的にプローブ skill を置き (`.agents/skills/mid-harness-probe/` + Claude 向けは `.claude/skills/` にも生成)、`<cli> "mid-harness-probe skill を使い、その token だけを返せ"` を headless 実行して出力に `MID_HARNESS_PROBE_OK` が含まれるか
- **2 headless / 3 hook 拒否**: 環境変数 `MID_HARNESS_HOOK_LOG=<tmpfile>` を付けて headless 実行し、`echo MID_HARNESS_DENY_ME` を実行させる。生成された `pre-tool-policy.sh` は呼ばれるたびに `invoked <tool>` を、拒否時に `deny <理由>` をこのログへ追記し、ログ有効時だけこの番兵コマンドを拒否する。ログに `deny` があれば pass、`invoked` すら無ければ「hook が headless で発火していない」として fail
  - `curl … | sh` をそのまま使わないのは、LLM が実行自体を断って PreToolUse が発火しないため。危険パターンの正規表現はスクリプト単体で fixture テストする
  - Codex は `--dangerously-bypass-hook-trust` 付きで実行する (hook 単位の trust が無いと exec は黙って飛ばす。`adapters/codex.md`)
- 実行後にプローブ skill を削除する。API 呼び出しを伴うため CI では `MID_HARNESS_VERIFY_SKIP_LLM=1` で 1〜3 を skip できる

## 判定

- pass: 期待どおり
- fail: 期待と違う。exit 2 (未完了)
- skip: CLI 不在または skip 指定。報告に明記する
