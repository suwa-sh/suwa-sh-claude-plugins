# recovery: このスキル自身のハマりどころ

実行者が別セッションでも届くように、学びはここに追記する。書式は「症状 / 原因 / 検出 / 復旧 / 再発防止 / 最終確認日」。

## Claude Code は `.agents/skills/` を読まない
- 症状: Codex では skill が発見されるが Claude Code では発見されない
- 原因: Claude Code の project skill は `.claude/skills/` (起動ディレクトリから repo root までの各階層) と `~/.claude/skills/`、plugin のみ。`.agents/skills/` は探索対象外 (公式 docs skills / slash-commands、2026-09-05 確認)
- 検出: `verify.sh` の skill 発見テストが claude だけ fail
- 復旧: `harness.yaml` の `skills_mode` を `generate` (コピー) か `symlink` にして `gen_adapters.py` を再実行
- 再発防止: init は既定で generate。symlink は Windows / scanner で差が出るため opt-in
- 最終確認日: 2026-09-05

## Codex の project hook は「project trust」と「hook 単位の trust hash」の両方が要る
- 症状: `.codex/hooks.json` を置き project も trusted なのに、`codex exec` で hook が `invoked` を残さない。警告も出ない
- 原因: 非 managed hook は hash 単位で Trusted / Modified / Untrusted を持ち、exec は Untrusted / Modified を黙って飛ばす。再生成で内容が変わると Modified に戻る
- 検出: app-server の `hooks/list` の `trustStatus`。手軽には `codex exec --dangerously-bypass-hook-trust` で発火するなら trust が原因
- 復旧: TUI で hook を trust する、または `hooks.state` に `trusted_hash` を書く。検証だけなら bypass フラグ
- 再発防止: `verify.sh` は bypass フラグで配線を検証する。運用の trust は adapter 再生成のたびに見直す
- 最終確認日: 2026-09-05 (codex-cli 0.145.0、テストリポで実測)

## LLM は `curl | sh` の実行自体を断るので hook 拒否テストに使えない
- 症状: hook 拒否テストで `invoked` すら残らない (Claude Code / Codex とも)
- 原因: モデルが危険コマンドをツール呼び出しせずに断るため、PreToolUse が発火しない
- 復旧: `pre-tool-policy.sh` の番兵 (`MID_HARNESS_HOOK_LOG` 有効時のみ `MID_HARNESS_DENY_ME` を拒否) を使う。curl|sh の正規表現は fixture でスクリプト単体テストする
- 最終確認日: 2026-09-05

## Grok / Antigravity の trust は canonical パスで登録する
- 症状: `~/.grok/trusted_folders.toml` や agy の `trustedWorkspaces` に repo を足したのに hook が発火しない
- 原因: `/tmp/...` のような symlink 経由のパスで登録した。製品側は git root の canonical パス (`/private/tmp/...`) で照合する
- 検出: `grok inspect` の `Project trusted`、agy のログ `loaded N named hooks from M hooks.json file(s)`
- 復旧: `git rev-parse --show-toplevel` の出力 (canonical) で登録し直す
- 最終確認日: 2026-09-05

## Antigravity の headless は project に束縛しないと workspace hooks を読まない
- 症状: `.agents/hooks.json` があり trust もあるのに `loaded 0 named hooks`
- 原因: `agy -p` は既定で default project に束縛される。workspace の project は `--new-project` (初回登録) か `--project <project id>` で選ぶ
- 復旧: 初回だけ `agy -p "reply OK" --new-project` を repo で実行。以降は `--project <id>` (verify.sh は `scripts/agy_project_id.py` で folderUri から ID を引く。名前 = basename でも指定できるが重複し得る)
- 再発防止: `--new-project` を毎回付けない (同名 project が増える)
- 最終確認日: 2026-09-05 (agy 1.1.26)

## Copilot の repo hook (`.github/hooks/*.json`) が `-p` で発火しない
- 症状: docs どおりの `.github/hooks/mid-harness.json` を置いても hook ログが空。user hook (`~/.copilot/hooks/`) は同形式で発火する
- 原因: 未特定 (trust 済みの repo でも再現。1.0.80、2026-09-05)
- 検出: `copilot -p ... --log-level debug --log-dir <dir>` の `[rust:hooks] [hook stdout]` 行に repo hook の出力が無い
- 復旧: 未解決。skill 発見は `.agents/skills` で通るので、hook だけ fail として報告する
- 最終確認日: 2026-09-05

## Cursor の `-p` が Opus の usage limit で止まる
- 症状: `ActionRequiredError: You've hit your usage limit for Opus`
- 復旧: `--model auto` を付ける (verify.sh は既定で付ける)
- 最終確認日: 2026-09-05

## PyYAML が無い環境
- 症状: `ModuleNotFoundError: No module named 'yaml'`
- 復旧: `pip install pyyaml` (またはその環境の python に合わせて)。scripts は PyYAML 以外の外部依存を持たない
- 最終確認日: 2026-09-05
