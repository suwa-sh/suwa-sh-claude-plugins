# dist-architecture Fixtures

`evals/evals.json` の振る舞い指向アサーション（id:4〜id:7）で参照する arch-design.yaml の fixture 集。

## fixture 一覧

| ファイル | 用途 | 期待される validator 結果 |
|---|---|---|
| `minimal-with-domain.yaml` | domain_architecture を最低構成で含む最小 yaml | PASS (exit 0)、WARN なし |
| `legacy-no-domain.yaml` | 既存スナップショット（domain なし）| PASS (exit 0)、`domain_architecture` 欠落 WARN 1 件 |
| `invalid-bc-ref.yaml` | BC.owned_entity_ids[] が存在しない entity を参照 | FAIL (exit 1) + 関連 WARN（aggregate root が BC owned に無い）|
| `high-confidence-core.yaml` | Core サブドメインに confidence: "high" 指定 | PASS (exit 0)、confidence 上限超過 WARN 1 件 |

## 実行コマンド

```bash
# 各 fixture の振る舞いを手動確認
SKILL=plugins/distillery/skills/dist-architecture
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/minimal-with-domain.yaml; echo "exit=$?"
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/legacy-no-domain.yaml; echo "exit=$?"
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/invalid-bc-ref.yaml; echo "exit=$?"
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/high-confidence-core.yaml; echo "exit=$?"
```

## 設計判断

- evals.json の prompt-based eval は LLM 実行が必要だが、fixture-based eval は `command_exit_code` アサーションで CI でも実行できる
- fixture は意図的に最小構成にして「何を検証するか」を明確化
- `legacy-no-domain.yaml` は実 sample からのコピー（後方互換テスト用）。実 sample の更新時は手動で同期する
