# 第1段階の実生成検証（利用枠により未実施）

2026-09-05 20:41 JST に、コミット `381a77b7aa1f332d7041956ba841558ae3b9af7b` の distillery を凍結して実行した。
Claude Code が生成開始前に利用枠エラーを返したため、実生成の効果・品質はまだ検証できていない。
この記録を生成成功や第1段階の受入完了として扱わない。

## 実行条件と結果

- 隔離workspace: `/private/tmp/dist-spec-phase1-i9lcifk3`
- 凍結plugin: 同workspaceの `frozen/plugins/distillery`（`git archive 381a77b` で抽出）
- 固定入力: `samples/distillery/pipeline-opus-medium` の usdm / rdra / nfr / arch / infra / design を `docs/` にコピー。input / todo.md / pipeline-config もコピー。
- node_modules / storybook-static / .git / dist / build はコピー対象外。
- 上流固定後の **Step6 → Step6a → Step6b の再開実行**を指示。Step1からのフルpipeline再生成ではない。
- `dialogue_policy: auto_adopt`。元pipeline-configを保持（Step6は既定、Step6aはsonnet）。既定モデルの上書きなし。
- Claude Code `2.1.261`。初期化ログのモデルは `claude-opus-5[1m]`。
- `--permission-mode dontAsk` と明示的な `--allowedTools` で起動。承認バイパスフラグは未使用。
- 結果: exit code 1、`is_error: true`。利用枠エラーに「21:30 (Asia/Tokyo) にリセット」と表示。
- CLIの結果レコードには `subtype: success` とあるが、`is_error: true` およびプロセス終了コードから失敗と判定する。
- CLI申告の input / output / cache tokens および total_cost_usd はすべて0。`modelUsage` は空。Step6aのモデルは未実行のため観測されていない。
- 新規specファイル0件。上流568ファイルのSHA-256に変更なし。ダッシュボード起動・pipeline lease作成・validator実行まで到達していない。

## 比較できていない項目

UC数、API/イベント契約、BDD/RDRA網羅、原子性・冪等性・認可・再取得の維持、行数・バイト数・読込量の削減率は、生成物がないため比較不可。
既存の手編集縮約サンプルを実生成結果として代用していない。仕様の欠落・矛盾を確認したという結論も出していない。

## 再開方法

隔離workspaceが残っている間は、利用枠が回復した後に以下を実行する。`prompt.txt` は準備済みで、固定上流・新規event生成・所定レビュー/検証・6a/6b・隔離先への書込み制約を含む。
通常設定・認証情報・モデルを変更する必要はない。

```bash
cd /private/tmp/dist-spec-phase1-i9lcifk3
~/.local/bin/claude -p \
  --plugin-dir /private/tmp/dist-spec-phase1-i9lcifk3/frozen/plugins/distillery \
  --allowedTools 'Read,Write,Edit,Bash,Agent,Task,Skill,Glob,Grep,TodoWrite,TaskCreate,TaskUpdate,TaskList,TaskGet' \
  --permission-mode dontAsk \
  --output-format stream-json --verbose \
  < prompt.txt > retry-stream.jsonl 2> retry-stderr.log
```

再開後も init の実モデルを記録し、成果物のvalidator、網羅性と重要仕様の比較を行う。生transcriptは同梱せず、必要な実行結果のみ抽出する。

## 同梱ファイル

- `run-record.json`: CLI出力から必要項目だけ抽出した失敗記録
- `pipeline-config.yaml`: 元サンプルから変更していないモデル設定
- `upstream-manifest.json`: コピーした上流6ドメイン568ファイルの相対パスとSHA-256

既存サンプルの重複コピー、認証情報、メールアドレス、生transcript、node_modules、build成果物は同梱していない。
