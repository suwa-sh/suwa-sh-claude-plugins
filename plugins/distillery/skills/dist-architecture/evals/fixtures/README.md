# dist-architecture Fixtures

`evals/evals.json` の振る舞い指向アサーション（id:4〜id:7）で参照する arch-design.yaml の fixture 集と、その生成出力サンプル。

## ディレクトリ構成

```
fixtures/
├── README.md                     # 本ファイル
├── *.yaml                        # 4 つの入力 fixture
└── expected/                     # 各 fixture の Md / coverage 出力 baseline
    ├── minimal-with-domain.md           # ドメインセクション付き設計書のサンプル
    ├── minimal-with-domain.coverage.md  # ドメイン設計密度（ヒューリスティクス指標）を含む coverage report
    └── legacy-no-domain.md              # 既存 sample 相当（domain なし）の Md baseline
```

`expected/` 配下は決定論的に生成されるため、git で baseline として管理し回帰検証に使用する。

## fixture 一覧

| ファイル | 用途 | 期待される validator 結果 |
|---|---|---|
| `minimal-with-domain.yaml` | domain_architecture を最低構成で含む最小 yaml | PASS (exit 0)、WARN なし |
| `legacy-no-domain.yaml` | 既存スナップショット（domain なし）| PASS (exit 0)、`domain_architecture` 欠落 WARN 1 件 |
| `invalid-bc-ref.yaml` | BC.owned_entity_ids[] が存在しない entity を参照 | FAIL (exit 1) + 関連 WARN（aggregate root が BC owned に無い）|
| `high-confidence-core.yaml` | Core サブドメインに confidence: "high" 指定 | PASS (exit 0)、confidence 上限超過 WARN 1 件 |

## 実行コマンド

```bash
SKILL=plugins/distillery/skills/dist-architecture

# 1) validator の振る舞い確認
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/minimal-with-domain.yaml; echo "exit=$?"
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/legacy-no-domain.yaml; echo "exit=$?"
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/invalid-bc-ref.yaml; echo "exit=$?"
node $SKILL/scripts/validateArchDesign.js $SKILL/evals/fixtures/high-confidence-core.yaml; echo "exit=$?"

# 2) Md baseline の再生成（決定論的なので git diff が空であるべき）
node $SKILL/scripts/generateArchDesignMd.js $SKILL/evals/fixtures/minimal-with-domain.yaml
mv $SKILL/evals/fixtures/arch-design.md $SKILL/evals/fixtures/expected/minimal-with-domain.md
node $SKILL/scripts/generateArchDesignMd.js $SKILL/evals/fixtures/legacy-no-domain.yaml
mv $SKILL/evals/fixtures/arch-design.md $SKILL/evals/fixtures/expected/legacy-no-domain.md

# 3) Coverage baseline の再生成（既存 samples の rdra/nfr を流用）
node $SKILL/scripts/generateCoverageReport.js \
  samples/distillery/rdra/latest \
  samples/distillery/nfr/latest/nfr-grade.yaml \
  $SKILL/evals/fixtures/minimal-with-domain.yaml
mv $SKILL/evals/fixtures/coverage-report.md $SKILL/evals/fixtures/expected/minimal-with-domain.coverage.md

# 4) 差分なしを確認
git diff $SKILL/evals/fixtures/expected/
```

## 設計判断

- evals.json の prompt-based eval は LLM 実行が必要だが、fixture-based eval は `command_exit_code` アサーションで CI でも実行できる
- fixture は意図的に最小構成にして「何を検証するか」を明確化
- `legacy-no-domain.yaml` は実 sample からのコピー（後方互換テスト用）。実 sample の更新時は手動で同期する

## 追加すべき fixture / eval（TODO）

codex 再レビューで指摘された未対応項目。将来 PR で追加する:

| 領域 | fixture | 検証内容 |
|---|---|---|
| 差分モード | `diff-minimal.yaml` | `meta` + 変更セクションのみの diff yaml が `--mode=diff` で validate 通過すること（**現状は完全版スキーマで検証するため一部 ERROR**）|
| 差分マージ | `diff-merge-base.yaml` + `diff-merge-overlay.yaml` | event-sourcing-rules.md のマージキー（id 照合）で差分が正しく適用されること |
| decisions upsert | `decisions-upsert-base/` + `decisions-upsert-diff/` | latest/decisions が **artifact_id で upsert** され、過去の有効な決定が保持されること（**PR3 では仕様変更のみ、テストは未実装**）|
| ddd 未導入 | (環境変数で ddd plugin を無効化) | distillery 単独で processing が完走すること |
| 部分 domain セクション | `partial-domain-only-subdomains.yaml` 等 | subdomains だけ / BC だけ等の部分 yaml がどう扱われるか |
| BC = 1 と context_map | `single-bc-no-cm.yaml` | BC 1 個のみで context_map: [] が valid であること |

これらは PR3 のスコープ外（仕様/実装変更を伴うため）。後続 PR で対応する。
